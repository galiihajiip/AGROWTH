"""Open-Meteo weather service — async wrapper ke api.open-meteo.com.

Gratis, tanpa API key, input lat/lon langsung. Cocok sempurna dengan
CoordinateInput validator (lat ∈ [-9,-5], lon ∈ [105,115]).

Response di-mapping 1:1 ke ``WeatherCurrent`` / ``ForecastPoint`` tanpa
mengubah Pydantic schema. WMO weather_code di-translate ke kondisi
Bahasa Indonesia.

CRITICAL-H-009: Menambahkan exponential backoff retry logic (max 2 retries).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Tuple

import httpx

from app.core import get_settings
from app.models import (
    AnomalyType,
    ForecastPoint,
    LocationInfo,
    PredictionResponse,
    RiskLevel,
    WeatherCurrent,
)
from app.services.geocode_service import reverse_geocode
from app.services.weather_mock import (
    _anomaly_score,
    classify_risk,
    get_region_name,
)

logger = logging.getLogger(__name__)

# ---------- WMO Weather Code → kondisi Bahasa Indonesia ----------

_WMO_CONDITION: Dict[int, str] = {
    0: "cerah",
    1: "cerah berawan",
    2: "berawan sebagian",
    3: "mendung",
    45: "berkabut",
    48: "berkabut tebal",
    51: "gerimis ringan",
    53: "gerimis sedang",
    55: "gerimis lebat",
    56: "gerimis beku ringan",
    57: "gerimis beku lebat",
    61: "hujan ringan",
    63: "hujan sedang",
    65: "hujan lebat",
    66: "hujan beku ringan",
    67: "hujan beku lebat",
    71: "hujan salju ringan",
    73: "hujan salju sedang",
    75: "hujan salju lebat",
    77: "butiran salju",
    80: "hujan ringan sesaat",
    81: "hujan sedang sesaat",
    82: "hujan sangat lebat",
    85: "hujan salju ringan sesaat",
    86: "hujan salju lebat sesaat",
    95: "badai petir",
    96: "badai petir disertai hujan es ringan",
    99: "badai petir disertai hujan es lebat",
}


def wmo_to_condition(code: int) -> str:
    """Translate WMO weather interpretation code ke Bahasa Indonesia."""
    return _WMO_CONDITION.get(code, f"kode cuaca {code}")


# ---------- Async HTTP client ----------

# Reusable async client (dibuat lazy, ditutup saat shutdown).
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Lazy-init persistent async HTTP client."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        s = get_settings()
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(s.open_meteo_timeout_sec),
            follow_redirects=True,
        )
    return _http_client


async def close_http_client() -> None:
    """Tutup HTTP client (panggil saat app shutdown)."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


# ---------- Open-Meteo API call ----------

# Field current yang diminta
_CURRENT_FIELDS = (
    "temperature_2m,relative_humidity_2m,precipitation,"
    "wind_speed_10m,surface_pressure,weather_code"
)

# Field daily yang diminta
_DAILY_FIELDS = (
    "temperature_2m_max,temperature_2m_min,precipitation_sum,"
    "relative_humidity_2m_mean,wind_speed_10m_max,weather_code"
)


async def _fetch_openmeteo(
    lat: float, lon: float, forecast_days: int,
) -> dict:
    """Hit Open-Meteo forecast endpoint, return parsed JSON.
    
    CRITICAL-H-009: Dengan exponential backoff retry (max 2 retries).
    Retry strategy: 500ms, 1s. Jika semua gagal, raise exception.
    """
    s = get_settings()
    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "current": _CURRENT_FIELDS,
        "daily": _DAILY_FIELDS,
        "timezone": "Asia/Jakarta",
        "forecast_days": min(forecast_days + 1, 16),  # +1: hari ini = current
        "wind_speed_unit": "ms",  # m/s langsung, tidak perlu konversi
    }
    client = _get_http_client()
    
    # Exponential backoff retry: max 3 attempts (0 retries = initial, 2 retries)
    max_attempts = 3
    retry_delays = [0.5, 1.0]  # seconds
    
    last_error = None
    for attempt in range(max_attempts):
        try:
            resp = await client.get(s.open_meteo_base_url, params=params)
            resp.raise_for_status()
            return resp.json()
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
            last_error = e
            if attempt < max_attempts - 1:
                delay = retry_delays[attempt] if attempt < len(retry_delays) else retry_delays[-1]
                logger.warning(
                    "Open-Meteo request failed (attempt %d/%d), retrying in %.1fs: %s",
                    attempt + 1, max_attempts, delay, e
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    "Open-Meteo request failed after %d attempts: %s",
                    max_attempts, e
                )
    
    # Semua retry habis
    raise RuntimeError(f"Open-Meteo API failed after {max_attempts} attempts") from last_error


# ---------- Schema mapping ----------

def _parse_current(data: dict) -> WeatherCurrent:
    """Map Open-Meteo ``current`` object → ``WeatherCurrent``."""
    cur = data["current"]
    wmo_code = int(cur.get("weather_code", 0))

    # Open-Meteo current.time format: "2025-01-15T12:00" (local tz)
    ts_str = cur.get("time", "")
    try:
        ts = datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        ts = datetime.now(timezone.utc)

    return WeatherCurrent(
        timestamp=ts,
        temperature_c=round(float(cur["temperature_2m"]), 1),
        humidity_pct=round(float(cur["relative_humidity_2m"]), 1),
        rainfall_mm=round(max(float(cur.get("precipitation", 0)), 0), 2),
        wind_speed_ms=round(float(cur["wind_speed_10m"]), 2),
        pressure_hpa=round(float(cur.get("surface_pressure", 1013)), 1),
        condition=wmo_to_condition(wmo_code),
    )


def _parse_forecast(
    data: dict, start_date: date, days: int,
) -> Tuple[List[ForecastPoint], List[float], List[AnomalyType]]:
    """Map Open-Meteo ``daily`` arrays → list ``ForecastPoint`` + anomaly info.

    Hari dimulai dari ``start_date + 1`` (besok) sejumlah ``days`` hari.
    """
    daily = data["daily"]
    dates_raw: List[str] = daily["time"]
    t_max_arr = daily["temperature_2m_max"]
    t_min_arr = daily["temperature_2m_min"]
    rain_arr = daily["precipitation_sum"]
    hum_arr = daily["relative_humidity_2m_mean"]
    wind_arr = daily["wind_speed_10m_max"]
    wmo_arr = daily["weather_code"]

    tomorrow = start_date + timedelta(days=1)

    forecast: List[ForecastPoint] = []
    scores: List[float] = []
    types: List[AnomalyType] = []

    for i, d_str in enumerate(dates_raw):
        d = date.fromisoformat(d_str)
        if d < tomorrow:
            continue  # skip hari ini (sudah di current)
        if len(forecast) >= days:
            break

        t_max = float(t_max_arr[i])
        t_min = float(t_min_arr[i])
        rain = max(float(rain_arr[i] or 0), 0)
        hum = float(hum_arr[i] or 80)
        wind = float(wind_arr[i] or 0)
        wmo_code = int(wmo_arr[i] or 0)

        # Anomaly scoring pakai rata-rata suhu + rain + wind
        # (identik dengan input shape yang dipakai weather_mock)
        mean_t = (t_max + t_min) / 2
        score, atype = _anomaly_score(mean_t, rain, wind)
        scores.append(score)
        types.append(atype)

        forecast.append(ForecastPoint(
            date=d,
            temp_min_c=round(t_min, 1),
            temp_max_c=round(t_max, 1),
            humidity_pct=round(min(max(hum, 0), 100), 1),
            rainfall_mm=round(rain, 2),
            wind_speed_ms=round(wind, 2),
            condition=wmo_to_condition(wmo_code),
        ))

    return forecast, scores, types


# ---------- Public API (async) ----------

async def predict_weather_openmeteo(
    lat: float,
    lon: float,
    ref_date: date | None = None,
    days: int = 7,
) -> PredictionResponse:
    """Fetch cuaca real dari Open-Meteo → PredictionResponse.

    CRITICAL: Validate koordinat dalam bounds Pulau Jawa sebelum fetch.
    Raise pada network/parse error — caller (orchestrator) yang menangani
    fallback ke mock.
    
    Java bounds: lat ∈ [-9, -5], lon ∈ [105, 115]
    """
    # CRITICAL-C-004: Validate bounds sebelum fetch API
    if not (-9 <= lat <= -5 and 105 <= lon <= 115):
        raise ValueError(
            f"Koordinat ({lat:.4f}, {lon:.4f}) di luar batas Pulau Jawa "
            f"(lat: [-9, -5], lon: [105, 115])"
        )
    
    if ref_date is None:
        ref_date = date.today()
    days = max(1, min(int(days), 14))

    raw = await _fetch_openmeteo(lat, lon, days)

    # Location info: coba reverse geocode presisi dulu, fallback bbox provinsi
    elevation = raw.get("elevation")
    elevation_m = round(float(elevation), 1) if elevation is not None else None

    geo = await reverse_geocode(lat, lon)
    if geo is not None:
        location = LocationInfo(
            lat=lat,
            lon=lon,
            name=geo.name,
            kelurahan=geo.kelurahan,
            kecamatan=geo.kecamatan,
            region=geo.region,
            province=geo.province,
            elevation_m=elevation_m,
        )
    else:
        region = get_region_name(lat, lon)
        location = LocationInfo(
            lat=lat,
            lon=lon,
            province=region,
            name=f"Lokasi {region}",
            elevation_m=elevation_m,
        )

    current = _parse_current(raw)
    forecast, scores, types = _parse_forecast(raw, ref_date, days)

    # Pastikan minimal 1 forecast point (contract schema min_length=1)
    if not forecast:
        raise ValueError("Open-Meteo tidak mengembalikan data forecast yang cukup")

    risk, anomaly = classify_risk(scores, types)

    return PredictionResponse(
        location=location,
        current=current,
        forecast=forecast,
        risk_level=risk,
        anomaly=anomaly,
        data_source_info={
            "mode": "live",
            "sources": [
                "Open-Meteo API (real-time)",
                "Koordinat real Pulau Jawa",
            ],
        },
    )
