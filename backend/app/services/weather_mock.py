"""Mock weather service deterministik berbasis seed (lat, lon, date).

Hasil 100% reproducible: input sama → output sama. Cocok untuk pengembangan UI
dan integrasi sebelum model ML asli dipasang.
"""
from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from typing import List, Tuple

import numpy as np

from app.models import (
    AnomalyType,
    ForecastPoint,
    LocationInfo,
    PredictionResponse,
    RiskLevel,
    WeatherCurrent,
)


# ---------- Region mapping ----------

# Bounding box approx tiap provinsi (lat_min, lat_max, lon_min, lon_max).
# Urutan dari yang paling spesifik (kecil) ke umum agar prioritas benar.
_PROVINCE_BBOX: List[Tuple[str, float, float, float, float]] = [
    ("DKI Jakarta",   -6.40, -6.00, 106.65, 107.00),
    ("DI Yogyakarta", -8.20, -7.50, 110.00, 110.80),
    ("Banten",        -7.00, -5.70, 105.00, 106.65),
    ("Jawa Barat",    -7.80, -5.90, 106.40, 108.85),
    ("Jawa Tengah",   -8.25, -6.40, 108.50, 111.70),
    ("Jawa Timur",    -8.80, -6.80, 111.00, 114.60),
    ("Bali",          -8.90, -8.00, 114.40, 115.80),
]


def get_region_name(lat: float, lon: float) -> str:
    """Mapping bounding box (lat, lon) → nama provinsi di Pulau Jawa.

    Mengembalikan ``"Pulau Jawa"`` sebagai fallback bila tidak masuk box mana pun.
    """
    for name, lat_min, lat_max, lon_min, lon_max in _PROVINCE_BBOX:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return name
    return "Pulau Jawa"


# ---------- Seed deterministic ----------

def _seed_for(lat: float, lon: float, dt: date) -> int:
    """Seed integer deterministik dari (lat, lon, tanggal)."""
    key = f"{round(lat, 2)}|{round(lon, 2)}|{dt.isoformat()}"
    h = hashlib.md5(key.encode("utf-8")).hexdigest()
    return int(h[:8], 16)


# ---------- Komponen klimatologis ----------

def _temp_seasonal(doy: int) -> float:
    """Suhu rata-rata harian sinusoidal (°C). Puncak ~Oktober (DOY 285)."""
    return 27.0 + 1.8 * math.cos(2 * math.pi * (doy - 285) / 365.0)


def _rain_intensity(doy: int) -> float:
    """Profil bimodal musiman (0..1): puncak Jan-Feb dan Nov-Des."""
    primary = math.exp(-((doy - 30) / 50.0) ** 2)        # Jan-Feb
    secondary = math.exp(-((doy - 330) / 50.0) ** 2)     # Nov-Des
    return min(1.0, primary + secondary)


def _condition_from(temp: float, rain: float) -> str:
    if rain > 30:
        return "hujan lebat"
    if rain > 10:
        return "hujan sedang"
    if rain > 1:
        return "hujan ringan"
    if temp > 33:
        return "panas terik"
    if temp < 22:
        return "sejuk"
    return "cerah berawan"


def _generate_day_weather(rng: np.random.Generator, doy: int) -> Tuple[float, float, float, float]:
    """Hasilkan (temp_mean, rainfall_mm, humidity_pct, wind_ms) untuk satu hari."""
    base_temp = _temp_seasonal(doy)
    temp = base_temp + float(rng.normal(0.0, 1.5))

    # Bimodal rainfall: probabilitas hujan menyesuaikan profil musiman
    rain_p = _rain_intensity(doy) * 0.85
    if float(rng.random()) < rain_p:
        rainfall = float(rng.lognormal(mean=2.5, sigma=0.7))
    else:
        rainfall = 0.0
    rainfall = float(np.clip(rainfall, 0.0, 200.0))

    humidity = float(np.clip(rng.normal(82.0 - 0.5 * (temp - 27.0), 5.0), 40.0, 100.0))
    wind = float(abs(rng.normal(2.5, 1.5)))
    return temp, rainfall, humidity, wind


# ---------- Cuaca saat ini ----------

def generate_current_weather(lat: float, lon: float, ref_date: date) -> WeatherCurrent:
    """Cuaca saat ini deterministik untuk lokasi & tanggal tertentu."""
    seed = _seed_for(lat, lon, ref_date)
    rng = np.random.default_rng(seed)
    doy = ref_date.timetuple().tm_yday

    temp, rain, hum, wind = _generate_day_weather(rng, doy)
    pressure = float(np.clip(rng.normal(1010.0, 4.0), 990.0, 1025.0))

    return WeatherCurrent(
        timestamp=datetime.combine(ref_date, time(hour=12)),
        temperature_c=round(temp, 1),
        humidity_pct=round(hum, 1),
        rainfall_mm=round(rain, 2),
        wind_speed_ms=round(wind, 2),
        pressure_hpa=round(pressure, 1),
        condition=_condition_from(temp, rain),
    )


# ---------- Anomali ----------

def _anomaly_score(temp: float, rain: float, wind: float) -> Tuple[float, AnomalyType]:
    """Skor anomali 0..1 dan tipe dominan untuk satu hari."""
    types_score = {
        AnomalyType.HEATWAVE: 0.0,
        AnomalyType.FLOOD: 0.0,
        AnomalyType.DROUGHT: 0.0,
    }

    # Threshold suhu (heatwave)
    if temp >= 35.0:
        types_score[AnomalyType.HEATWAVE] += 0.45
    elif temp >= 33.0:
        types_score[AnomalyType.HEATWAVE] += 0.25
    elif temp >= 31.0:
        types_score[AnomalyType.HEATWAVE] += 0.10

    # Threshold hujan (flood)
    if rain >= 80.0:
        types_score[AnomalyType.FLOOD] += 0.50
    elif rain >= 50.0:
        types_score[AnomalyType.FLOOD] += 0.30
    elif rain >= 30.0:
        types_score[AnomalyType.FLOOD] += 0.15

    # Threshold angin (penguatan flood saat badai)
    if wind >= 12.0:
        types_score[AnomalyType.FLOOD] += 0.10
    elif wind >= 8.0:
        types_score[AnomalyType.FLOOD] += 0.05

    # Drought (kering & panas)
    if rain < 0.5 and temp >= 30.0:
        types_score[AnomalyType.DROUGHT] += 0.20
    if rain < 0.5 and temp >= 32.0:
        types_score[AnomalyType.DROUGHT] += 0.20

    dominant = max(types_score, key=lambda k: types_score[k])
    score = types_score[dominant]
    if score < 0.10:
        return 0.0, AnomalyType.NORMAL
    return min(score, 1.0), dominant


# ---------- Forecast 7 hari ----------

def generate_forecast_7d(
    lat: float, lon: float, start_date: date
) -> Tuple[List[ForecastPoint], List[float], List[AnomalyType]]:
    """Generate 7 hari forecast + skor anomali per hari + tipe anomali per hari."""
    forecast: List[ForecastPoint] = []
    scores: List[float] = []
    types: List[AnomalyType] = []

    for i in range(7):
        d = start_date + timedelta(days=i)
        seed = _seed_for(lat, lon, d)
        rng = np.random.default_rng(seed)
        doy = d.timetuple().tm_yday

        mean_t, rain, hum, wind = _generate_day_weather(rng, doy)
        diurnal = float(abs(rng.normal(7.0, 1.5)))
        t_max = mean_t + diurnal / 2
        t_min = mean_t - diurnal / 2

        score, atype = _anomaly_score(mean_t, rain, wind)
        scores.append(score)
        types.append(atype)

        forecast.append(ForecastPoint(
            date=d,
            temp_min_c=round(t_min, 1),
            temp_max_c=round(t_max, 1),
            humidity_pct=round(hum, 1),
            rainfall_mm=round(rain, 2),
            wind_speed_ms=round(wind, 2),
            condition=_condition_from(mean_t, rain),
        ))

    return forecast, scores, types


# ---------- Klasifikasi risiko ----------

def classify_risk(
    scores: List[float], types: List[AnomalyType]
) -> Tuple[RiskLevel, AnomalyType]:
    """Rata-rata skor → RiskLevel; tipe non-normal terbanyak → AnomalyType dominan."""
    if not scores:
        return RiskLevel.LOW, AnomalyType.NORMAL

    avg = sum(scores) / len(scores)
    if avg >= 0.50:
        risk = RiskLevel.CRITICAL
    elif avg >= 0.30:
        risk = RiskLevel.HIGH
    elif avg >= 0.15:
        risk = RiskLevel.MEDIUM
    else:
        risk = RiskLevel.LOW

    counts: dict[AnomalyType, int] = {}
    for t in types:
        if t == AnomalyType.NORMAL:
            continue
        counts[t] = counts.get(t, 0) + 1

    if not counts or risk == RiskLevel.LOW:
        return risk, AnomalyType.NORMAL
    dominant = max(counts, key=lambda k: counts[k])
    return risk, dominant


# ---------- Orchestrator + cache ----------

@lru_cache(maxsize=128)
def _predict_weather_cached(
    lat_r: float, lon_r: float, date_iso: str
) -> PredictionResponse:
    ref_date = date.fromisoformat(date_iso)
    region = get_region_name(lat_r, lon_r)
    location = LocationInfo(
        lat=lat_r,
        lon=lon_r,
        province=region,
        name=f"Lokasi {region}",
    )
    current = generate_current_weather(lat_r, lon_r, ref_date)
    forecast, scores, types = generate_forecast_7d(
        lat_r, lon_r, ref_date + timedelta(days=1)
    )
    risk, anomaly = classify_risk(scores, types)
    return PredictionResponse(
        location=location,
        current=current,
        forecast_7d=forecast,
        risk_level=risk,
        anomaly=anomaly,
    )


def predict_weather(
    lat: float, lon: float, ref_date: date | None = None
) -> PredictionResponse:
    """Orchestrator publik: cuaca saat ini + forecast 7h + risk + anomaly.

    Cache key: (lat dibulatkan 2 desimal, lon dibulatkan 2 desimal, tanggal ISO).
    """
    if ref_date is None:
        ref_date = date.today()
    return _predict_weather_cached(round(lat, 2), round(lon, 2), ref_date.isoformat())


def clear_cache() -> None:
    """Bersihkan cache prediksi (untuk test/dev)."""
    _predict_weather_cached.cache_clear()
