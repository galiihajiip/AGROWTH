"""Feature engineering untuk Multi-ML pipeline AGROWTH.

Mengekstrak fitur dari tiga sumber data:
1. Data cuaca real-time/forecast (Open-Meteo / NASA POWER)
2. Data klimatologis BMKG (baseline normal bulanan)
3. Data emisi GRK regional (konteks tekanan antropogenik)

Fitur yang dihasilkan:
- Variabel atmosferik langsung (suhu, curah hujan, kelembapan, angin)
- Deviasi dari normal klimatologis BMKG (anomali terhadap baseline)
- Radiasi matahari (dari NASA POWER)
- Indeks turunan (heat index, dryness index, dll)
- Konteks spasial (GHG regional, vulnerability index)
- Fitur temporal (DOY, musim, mangsa)
"""
from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from app.services.bmkg_service import get_monthly_climate

# ---------- GHG data loader ----------

_GHG_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "ghg_java.json"

with _GHG_DATA_FILE.open("r", encoding="utf-8") as _fh:
    _GHG_DATA = json.load(_fh)
_GHG_PROVINCES: List[Dict[str, Any]] = _GHG_DATA["provinces"]


def _get_ghg_context(lat: float, lon: float) -> Dict[str, float]:
    """Ambil konteks GHG dari provinsi terdekat (by center point)."""
    best: Optional[Dict[str, Any]] = None
    best_dist = float("inf")
    for prov in _GHG_PROVINCES:
        d = math.sqrt(
            (lat - prov["lat_center"]) ** 2 + (lon - prov["lon_center"]) ** 2,
        )
        if d < best_dist:
            best_dist = d
            best = prov
    if best is None:
        return {
            "ghg_total_kton": 0.0,
            "ghg_per_ha_ton": 0.0,
            "vulnerability_idx": 0.5,
            "drought_freq": 0.0,
            "flood_freq": 0.0,
        }
    return {
        "ghg_total_kton": float(best["ghg_total_co2e_kton"]),
        "ghg_per_ha_ton": float(best["ghg_per_ha_agriculture_ton"]),
        "vulnerability_idx": float(best["vulnerability_index"]),
        "drought_freq": float(best["drought_events_2019_2023"]) / 5.0,
        "flood_freq": float(best["flood_events_2019_2023"]) / 5.0,
    }


# ---------- Feature names (order harus konsisten train & predict) ----------

FEATURE_NAMES: List[str] = [
    # Atmosferik langsung (7)
    "temp_avg_c",
    "temp_max_c",
    "temp_min_c",
    "temp_range_c",
    "rainfall_mm",
    "humidity_pct",
    "wind_speed_ms",
    # NASA POWER: radiasi matahari (1)
    "solar_radiation_kwh",
    # Deviasi dari normal BMKG (4)
    "temp_dev_from_normal",
    "rain_dev_from_normal",
    "humidity_dev_from_normal",
    "rain_ratio_to_normal",
    # Indeks turunan (3)
    "heat_index",
    "dryness_index",
    "storm_index",
    # Temporal (3)
    "doy_sin",
    "doy_cos",
    "month",
    # GHG konteks regional (5)
    "ghg_total_kton",
    "ghg_per_ha_ton",
    "vulnerability_idx",
    "drought_freq",
    "flood_freq",
]

N_FEATURES = len(FEATURE_NAMES)


# ---------- Public API ----------

def extract_features(
    lat: float,
    lon: float,
    ref_date: date,
    temp_avg: float,
    temp_max: float,
    temp_min: float,
    rainfall_mm: float,
    humidity_pct: float,
    wind_speed_ms: float,
    solar_radiation: Optional[float] = None,
) -> np.ndarray:
    """Ekstrak feature vector (1, N_FEATURES) dari data cuaca satu hari.

    Parameters
    ----------
    lat, lon : float
        Koordinat titik.
    ref_date : date
        Tanggal referensi.
    temp_avg, temp_max, temp_min : float
        Suhu (Celsius).
    rainfall_mm : float
        Curah hujan (mm).
    humidity_pct : float
        Kelembapan relatif (%).
    wind_speed_ms : float
        Kecepatan angin (m/s).
    solar_radiation : float, optional
        Radiasi matahari (kWh/m2/hari). Default None -> estimasi dari suhu.

    Returns
    -------
    np.ndarray shape (1, N_FEATURES)
    """
    # Deviasi dari normal BMKG
    bmkg_normal = get_monthly_climate(lat, lon, ref_date.month)
    temp_dev = temp_avg - bmkg_normal["temp_avg_c"]
    rain_dev = rainfall_mm - (bmkg_normal["rainfall_mm"] / 30.0)
    hum_dev = humidity_pct - bmkg_normal["humidity_pct"]
    rain_normal_daily = bmkg_normal["rainfall_mm"] / 30.0
    rain_ratio = rainfall_mm / max(rain_normal_daily, 0.1)

    # Solar radiation: estimasi dari suhu jika tidak tersedia
    if solar_radiation is None:
        solar_radiation = _estimate_solar_from_temp(temp_max, temp_min, lat, ref_date)

    # Indeks turunan
    heat_idx = _heat_index(temp_avg, humidity_pct)
    dry_idx = _dryness_index(rainfall_mm, temp_avg, humidity_pct)
    storm_idx = _storm_index(rainfall_mm, wind_speed_ms)

    # Temporal
    doy = ref_date.timetuple().tm_yday
    doy_sin = math.sin(2 * math.pi * doy / 365.0)
    doy_cos = math.cos(2 * math.pi * doy / 365.0)

    # GHG konteks
    ghg = _get_ghg_context(lat, lon)

    features = [
        temp_avg,
        temp_max,
        temp_min,
        temp_max - temp_min,  # temp_range
        rainfall_mm,
        humidity_pct,
        wind_speed_ms,
        solar_radiation,
        temp_dev,
        rain_dev,
        hum_dev,
        rain_ratio,
        heat_idx,
        dry_idx,
        storm_idx,
        doy_sin,
        doy_cos,
        float(ref_date.month),
        ghg["ghg_total_kton"],
        ghg["ghg_per_ha_ton"],
        ghg["vulnerability_idx"],
        ghg["drought_freq"],
        ghg["flood_freq"],
    ]

    return np.array(features, dtype=np.float64).reshape(1, -1)


def extract_features_batch(
    records: List[Dict[str, Any]],
) -> np.ndarray:
    """Batch extraction untuk training. Setiap record harus punya keys
    yang sesuai dengan parameter ``extract_features``."""
    arrays = []
    for r in records:
        arr = extract_features(
            lat=r["lat"],
            lon=r["lon"],
            ref_date=r["date"] if isinstance(r["date"], date) else date.fromisoformat(r["date"]),
            temp_avg=r["temp_avg_c"],
            temp_max=r["temp_max_c"],
            temp_min=r["temp_min_c"],
            rainfall_mm=r["rainfall_mm"],
            humidity_pct=r["humidity_pct"],
            wind_speed_ms=r["wind_speed_ms"],
            solar_radiation=r.get("solar_radiation_kwh"),
        )
        arrays.append(arr)
    return np.vstack(arrays)


# ---------- Internal helpers ----------

def _heat_index(temp_c: float, humidity: float) -> float:
    """Simplified heat index (Steadman, 1979)."""
    if temp_c < 27:
        return temp_c
    t_f = temp_c * 9 / 5 + 32
    hi = (
        -42.379
        + 2.04901523 * t_f
        + 10.14333127 * humidity
        - 0.22475541 * t_f * humidity
        - 0.00683783 * t_f**2
        - 0.05481717 * humidity**2
        + 0.00122874 * t_f**2 * humidity
        + 0.00085282 * t_f * humidity**2
        - 0.00000199 * t_f**2 * humidity**2
    )
    return (hi - 32) * 5 / 9  # kembali ke Celsius


def _dryness_index(rainfall_mm: float, temp_c: float, humidity: float) -> float:
    """Indeks kekeringan sederhana (0=basah, 1=sangat kering)."""
    rain_factor = 1.0 - min(rainfall_mm / 50.0, 1.0)
    temp_factor = min(max(temp_c - 25.0, 0) / 15.0, 1.0)
    hum_factor = 1.0 - min(humidity / 100.0, 1.0)
    return (rain_factor * 0.5 + temp_factor * 0.3 + hum_factor * 0.2)


def _storm_index(rainfall_mm: float, wind_ms: float) -> float:
    """Indeks potensi badai (0=tenang, 1=badai ekstrem)."""
    rain_factor = min(rainfall_mm / 100.0, 1.0)
    wind_factor = min(wind_ms / 20.0, 1.0)
    return rain_factor * 0.6 + wind_factor * 0.4


def _estimate_solar_from_temp(
    temp_max: float, temp_min: float, lat: float, ref_date: date,
) -> float:
    """Estimasi radiasi matahari dari delta suhu (Hargreaves-Samani method)."""
    doy = ref_date.timetuple().tm_yday
    # Deklinasi matahari
    decl = 23.45 * math.sin(math.radians(360 / 365 * (284 + doy)))
    lat_rad = math.radians(lat)
    decl_rad = math.radians(decl)
    # Sudut jam matahari terbenam
    ws = math.acos(
        max(-1.0, min(1.0, -math.tan(lat_rad) * math.tan(decl_rad))),
    )
    # Radiasi ekstraterestrial (MJ/m2/hari) - simplified
    dr = 1 + 0.033 * math.cos(2 * math.pi * doy / 365)
    ra = (
        24 * 60 / math.pi * 0.0820 * dr
        * (
            ws * math.sin(lat_rad) * math.sin(decl_rad)
            + math.cos(lat_rad) * math.cos(decl_rad) * math.sin(ws)
        )
    )
    # Hargreaves-Samani
    dt = max(temp_max - temp_min, 0.1)
    rs = 0.16 * math.sqrt(dt) * ra  # MJ/m2/day
    return round(rs * 0.2778, 2)  # Convert MJ -> kWh
