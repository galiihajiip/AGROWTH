"""NASA POWER API service -- data radiasi matahari, kelembapan, & suhu historis.

NASA POWER (Prediction Of Worldwide Energy Resources) menyediakan parameter
meteorologi harian gratis tanpa API key. Endpoint:

    https://power.larc.nasa.gov/api/temporal/daily/point

Parameter yang diambil:
- ``ALLSKY_SFC_SW_DWN`` -- Radiasi matahari permukaan (kW h/m^2/hari)
- ``T2M`` -- Suhu rata-rata 2 m (C)
- ``T2M_MAX`` / ``T2M_MIN`` -- Suhu harian maks/min
- ``RH2M`` -- Kelembapan relatif 2 m (%)
- ``PRECTOTCORR`` -- Curah hujan terkalibrasi (mm/hari)
- ``WS2M`` -- Kecepatan angin 2 m (m/s)

Digunakan oleh ML pipeline sebagai data training historis dan enrichment
konteks saat prediksi real-time.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import httpx

from app.core import get_settings

logger = logging.getLogger(__name__)

# ---------- Constants ----------

NASA_POWER_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"

# Parameter NASA POWER yang relevan untuk AGROWTH
NASA_POWER_PARAMS = [
    "ALLSKY_SFC_SW_DWN",  # Solar radiation (kWh/m2/day)
    "T2M",                # Temperature avg 2m (C)
    "T2M_MAX",            # Temperature max 2m (C)
    "T2M_MIN",            # Temperature min 2m (C)
    "RH2M",               # Relative humidity 2m (%)
    "PRECTOTCORR",        # Precipitation corrected (mm/day)
    "WS2M",               # Wind speed 2m (m/s)
]

# ---------- HTTP client ----------

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Lazy-init persistent async HTTP client untuk NASA POWER."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
        )
    return _http_client


async def close_nasa_http_client() -> None:
    """Tutup HTTP client (panggil saat app shutdown)."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


# ---------- Data models ----------

class NASAPowerDaily:
    """Satu hari data NASA POWER untuk sebuah titik."""

    __slots__ = (
        "date", "solar_radiation", "temp_avg", "temp_max", "temp_min",
        "humidity", "precipitation", "wind_speed",
    )

    def __init__(
        self,
        date: date,
        solar_radiation: float,
        temp_avg: float,
        temp_max: float,
        temp_min: float,
        humidity: float,
        precipitation: float,
        wind_speed: float,
    ) -> None:
        self.date = date
        self.solar_radiation = solar_radiation
        self.temp_avg = temp_avg
        self.temp_max = temp_max
        self.temp_min = temp_min
        self.humidity = humidity
        self.precipitation = precipitation
        self.wind_speed = wind_speed

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date.isoformat(),
            "solar_radiation_kwh_m2": self.solar_radiation,
            "temp_avg_c": self.temp_avg,
            "temp_max_c": self.temp_max,
            "temp_min_c": self.temp_min,
            "humidity_pct": self.humidity,
            "precipitation_mm": self.precipitation,
            "wind_speed_ms": self.wind_speed,
        }


# ---------- API calls ----------

async def fetch_nasa_power_daily(
    lat: float,
    lon: float,
    start_date: date,
    end_date: date,
) -> List[NASAPowerDaily]:
    """Fetch data harian NASA POWER untuk rentang tanggal.

    Parameters
    ----------
    lat, lon : float
        Koordinat titik (Pulau Jawa).
    start_date, end_date : date
        Rentang tanggal (inklusif). Maks 365 hari per request oleh API.

    Returns
    -------
    List[NASAPowerDaily]
        List data harian yang berhasil di-parse.

    Raises
    ------
    httpx.HTTPStatusError
        Jika API mengembalikan error HTTP.
    ValueError
        Jika response tidak bisa di-parse.
    """
    params = {
        "parameters": ",".join(NASA_POWER_PARAMS),
        "community": "AG",  # Agroclimatology community
        "longitude": round(lon, 4),
        "latitude": round(lat, 4),
        "start": start_date.strftime("%Y%m%d"),
        "end": end_date.strftime("%Y%m%d"),
        "format": "JSON",
    }

    client = _get_http_client()
    resp = await client.get(NASA_POWER_BASE_URL, params=params)
    resp.raise_for_status()
    data = resp.json()

    # Parse response
    properties = data.get("properties", {})
    parameters = properties.get("parameter", {})

    if not parameters:
        raise ValueError("NASA POWER response tidak mengandung data parameter")

    # Ambil semua tanggal dari parameter pertama
    first_param = list(parameters.values())[0]
    dates_str = sorted(first_param.keys())

    results: List[NASAPowerDaily] = []
    for d_str in dates_str:
        try:
            d = date(int(d_str[:4]), int(d_str[4:6]), int(d_str[6:8]))
        except (ValueError, IndexError):
            continue

        solar = _safe_float(parameters.get("ALLSKY_SFC_SW_DWN", {}).get(d_str))
        t_avg = _safe_float(parameters.get("T2M", {}).get(d_str))
        t_max = _safe_float(parameters.get("T2M_MAX", {}).get(d_str))
        t_min = _safe_float(parameters.get("T2M_MIN", {}).get(d_str))
        hum = _safe_float(parameters.get("RH2M", {}).get(d_str))
        precip = _safe_float(parameters.get("PRECTOTCORR", {}).get(d_str))
        wind = _safe_float(parameters.get("WS2M", {}).get(d_str))

        # Skip baris dengan data invalid (NASA POWER memakai -999 untuk missing)
        if any(v is None for v in [solar, t_avg, t_max, t_min, hum, precip, wind]):
            continue

        results.append(NASAPowerDaily(
            date=d,
            solar_radiation=solar,  # type: ignore[arg-type]
            temp_avg=t_avg,  # type: ignore[arg-type]
            temp_max=t_max,  # type: ignore[arg-type]
            temp_min=t_min,  # type: ignore[arg-type]
            humidity=hum,  # type: ignore[arg-type]
            precipitation=precip,  # type: ignore[arg-type]
            wind_speed=wind,  # type: ignore[arg-type]
        ))

    logger.info(
        "NASA POWER: %d hari data untuk (%.2f, %.2f) %s s.d. %s",
        len(results), lat, lon, start_date.isoformat(), end_date.isoformat(),
    )
    return results


async def fetch_recent_nasa_power(
    lat: float,
    lon: float,
    lookback_days: int = 30,
) -> List[NASAPowerDaily]:
    """Shortcut: ambil data NASA POWER N hari terakhir.

    NASA POWER API memiliki delay ~2-5 hari dari real-time. Data mungkin
    tidak mencakup hari ini atau kemarin.
    """
    end = date.today() - timedelta(days=2)  # Buffer delay NASA
    start = end - timedelta(days=lookback_days)
    return await fetch_nasa_power_daily(lat, lon, start, end)


# ---------- Helpers ----------

def _safe_float(val: Any) -> Optional[float]:
    """Convert value ke float; return None jika missing/invalid (-999 dari NASA)."""
    if val is None:
        return None
    try:
        f = float(val)
        if f <= -999.0:
            return None
        return f
    except (ValueError, TypeError):
        return None
