"""Unit tests untuk service ``weather_mock``.

Cakupan:
- Determinisme (input sama → output sama, beda → beda)
- ``get_region_name`` mapping per provinsi Pulau Jawa + fallback
- ``classify_risk`` semua 4 level + dominant anomaly
- ``predict_weather`` shape, days param, batas
- ``_anomaly_score`` thresholds
"""
from __future__ import annotations

from datetime import date

import pytest

from app.models import AnomalyType, PredictionResponse, RiskLevel
from app.services.weather_mock import (
    _anomaly_score,
    _seed_for,
    classify_risk,
    clear_cache,
    generate_current_weather,
    generate_forecast,
    get_region_name,
    predict_weather,
)


# ---------- get_region_name ----------

@pytest.mark.parametrize("lat, lon, expected", [
    (-6.20, 106.85, "DKI Jakarta"),
    (-7.80, 110.36, "DI Yogyakarta"),
    (-6.50, 106.00, "Banten"),
    (-7.00, 107.50, "Jawa Barat"),
    (-7.00, 110.00, "Jawa Tengah"),
    (-7.50, 112.50, "Jawa Timur"),
    (-8.50, 115.00, "Bali"),
])
def test_region_name_known_provinces(lat: float, lon: float, expected: str) -> None:
    assert get_region_name(lat, lon) == expected


def test_region_name_fallback_for_outside_box() -> None:
    """Koordinat di luar bounding box yang dikenal → fallback Pulau Jawa."""
    assert get_region_name(-5.5, 113.0) == "Pulau Jawa"


# ---------- _seed_for: determinism ----------

def test_seed_deterministic() -> None:
    a = _seed_for(-7.79, 110.37, date(2025, 6, 22))
    b = _seed_for(-7.79, 110.37, date(2025, 6, 22))
    assert a == b


def test_seed_changes_with_date() -> None:
    a = _seed_for(-7.79, 110.37, date(2025, 6, 22))
    b = _seed_for(-7.79, 110.37, date(2025, 6, 23))
    assert a != b


def test_seed_changes_with_location() -> None:
    a = _seed_for(-7.79, 110.37, date(2025, 6, 22))
    b = _seed_for(-7.20, 110.37, date(2025, 6, 22))
    assert a != b


# ---------- generate_current_weather: shape & range ----------

def test_current_weather_within_physical_range() -> None:
    w = generate_current_weather(-7.79, 110.37, date(2025, 6, 22))
    assert 10.0 <= w.temperature_c <= 45.0
    assert 0.0 <= w.humidity_pct <= 100.0
    assert 0.0 <= w.rainfall_mm <= 200.0
    assert 0.0 <= w.wind_speed_ms <= 30.0
    assert 990.0 <= w.pressure_hpa <= 1025.0
    assert isinstance(w.condition, str) and w.condition


def test_current_weather_deterministic() -> None:
    w1 = generate_current_weather(-7.79, 110.37, date(2025, 6, 22))
    w2 = generate_current_weather(-7.79, 110.37, date(2025, 6, 22))
    assert w1.temperature_c == w2.temperature_c
    assert w1.rainfall_mm == w2.rainfall_mm


# ---------- generate_forecast ----------

@pytest.mark.parametrize("days", [1, 3, 7, 14])
def test_forecast_returns_requested_days(days: int) -> None:
    forecast, scores, types = generate_forecast(-7.79, 110.37, date(2025, 6, 22), days=days)
    assert len(forecast) == days
    assert len(scores) == days
    assert len(types) == days


def test_forecast_clamps_days_high() -> None:
    forecast, _, _ = generate_forecast(-7.79, 110.37, date(2025, 6, 22), days=100)
    assert len(forecast) == 14


def test_forecast_clamps_days_low() -> None:
    forecast, _, _ = generate_forecast(-7.79, 110.37, date(2025, 6, 22), days=0)
    assert len(forecast) == 1


# ---------- _anomaly_score ----------

def test_anomaly_score_normal() -> None:
    score, atype = _anomaly_score(temp=27.0, rain=2.0, wind=2.0)
    assert atype == AnomalyType.NORMAL
    assert score == 0.0


def test_anomaly_score_heatwave() -> None:
    score, atype = _anomaly_score(temp=36.0, rain=0.0, wind=2.0)
    assert atype == AnomalyType.HEATWAVE
    assert score >= 0.4


def test_anomaly_score_flood() -> None:
    score, atype = _anomaly_score(temp=26.0, rain=120.0, wind=8.0)
    assert atype == AnomalyType.FLOOD
    assert score >= 0.5


def test_anomaly_score_drought() -> None:
    score, atype = _anomaly_score(temp=33.0, rain=0.0, wind=2.0)
    assert atype in {AnomalyType.DROUGHT, AnomalyType.HEATWAVE}
    assert score > 0.0


# ---------- classify_risk ----------

def test_classify_risk_low() -> None:
    risk, anomaly = classify_risk(scores=[0.0] * 7, types=[AnomalyType.NORMAL] * 7)
    assert risk == RiskLevel.LOW
    assert anomaly == AnomalyType.NORMAL


def test_classify_risk_medium() -> None:
    risk, _ = classify_risk(scores=[0.20] * 7, types=[AnomalyType.FLOOD] * 7)
    assert risk == RiskLevel.MEDIUM


def test_classify_risk_high() -> None:
    risk, _ = classify_risk(scores=[0.35] * 7, types=[AnomalyType.FLOOD] * 7)
    assert risk == RiskLevel.HIGH


def test_classify_risk_critical() -> None:
    risk, anomaly = classify_risk(scores=[0.70] * 7, types=[AnomalyType.FLOOD] * 7)
    assert risk == RiskLevel.CRITICAL
    assert anomaly == AnomalyType.FLOOD


def test_classify_risk_dominant_anomaly_when_mixed() -> None:
    """Saat campur, tipe non-normal terbanyak yang menang."""
    risk, anomaly = classify_risk(
        scores=[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        types=[
            AnomalyType.FLOOD, AnomalyType.FLOOD, AnomalyType.FLOOD,
            AnomalyType.FLOOD, AnomalyType.HEATWAVE, AnomalyType.HEATWAVE,
            AnomalyType.NORMAL,
        ],
    )
    assert anomaly == AnomalyType.FLOOD
    assert risk == RiskLevel.CRITICAL


def test_classify_risk_empty_returns_low_normal() -> None:
    risk, anomaly = classify_risk(scores=[], types=[])
    assert risk == RiskLevel.LOW
    assert anomaly == AnomalyType.NORMAL


# ---------- predict_weather (orchestrator) ----------

def test_predict_weather_returns_complete_response() -> None:
    clear_cache()
    pred = predict_weather(-7.79, 110.37, date(2025, 6, 22))
    assert isinstance(pred, PredictionResponse)
    assert pred.location.province in {
        "DI Yogyakarta", "Jawa Barat", "Jawa Tengah", "Jawa Timur",
        "Banten", "Bali", "DKI Jakarta", "Pulau Jawa",
    }
    assert len(pred.forecast) == 7
    assert pred.risk_level in set(RiskLevel)
    assert pred.anomaly in set(AnomalyType)


@pytest.mark.parametrize("days", [1, 5, 10, 14])
def test_predict_weather_with_days_param(days: int) -> None:
    clear_cache()
    pred = predict_weather(-7.79, 110.37, date(2025, 6, 22), days=days)
    assert len(pred.forecast) == days


def test_predict_weather_deterministic_across_calls() -> None:
    clear_cache()
    p1 = predict_weather(-7.79, 110.37, date(2025, 6, 22))
    clear_cache()
    p2 = predict_weather(-7.79, 110.37, date(2025, 6, 22))
    assert p1.current.temperature_c == p2.current.temperature_c
    assert p1.risk_level == p2.risk_level
    assert p1.anomaly == p2.anomaly


def test_predict_weather_different_location_different_result() -> None:
    clear_cache()
    p_yogya = predict_weather(-7.79, 110.37, date(2025, 6, 22))
    p_jakarta = predict_weather(-6.20, 106.85, date(2025, 6, 22))
    # Sangat tidak mungkin temperature persis sama untuk koordinat berbeda
    assert (
        p_yogya.current.temperature_c != p_jakarta.current.temperature_c
        or p_yogya.current.rainfall_mm != p_jakarta.current.rainfall_mm
    )


def test_predict_weather_cache_hit_returns_same_object() -> None:
    """LRU cache mengembalikan object yang sama (identity check)."""
    clear_cache()
    p1 = predict_weather(-7.79, 110.37, date(2025, 6, 22), days=7)
    p2 = predict_weather(-7.79, 110.37, date(2025, 6, 22), days=7)
    assert p1 is p2  # cache hit -> same instance


def test_predict_weather_different_days_different_cache_entries() -> None:
    """Days berbeda → cache entry berbeda (object identity berbeda)."""
    clear_cache()
    p7 = predict_weather(-7.79, 110.37, date(2025, 6, 22), days=7)
    p14 = predict_weather(-7.79, 110.37, date(2025, 6, 22), days=14)
    assert p7 is not p14
    assert len(p7.forecast) == 7 and len(p14.forecast) == 14
