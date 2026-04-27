"""Unit tests untuk service ``llm_service``.

Cakupan:
- ``build_recommendation_prompt`` struktur, conditional KONTEKS PETANI
- ``_strip_json_fences`` markdown handling
- ``_parse_llm_json`` valid + invalid input
- ``_fallback_recommendation`` per RiskLevel + AnomalyType
- TTL cache: store/get/expiry
- ``generate_recommendation`` async fallback path (no API key)
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime
from typing import List

import pytest

from app.models import (
    AnomalyType,
    ForecastPoint,
    LocationInfo,
    RiskLevel,
    WeatherCurrent,
)
from app.services.llm_service import (
    RecommendationLLM,
    _cache_get,
    _cache_key,
    _cache_set,
    _fallback_recommendation,
    _parse_llm_json,
    _strip_json_fences,
    build_recommendation_prompt,
    clear_cache,
    generate_recommendation,
)
from app.services.pranata_mangsa import get_mangsa_by_id


# ---------- Fixtures ----------

@pytest.fixture
def mangsa_kapitu():
    return get_mangsa_by_id(7)


@pytest.fixture
def mangsa_kasa():
    return get_mangsa_by_id(1)


@pytest.fixture
def location_yogya() -> LocationInfo:
    return LocationInfo(
        lat=-7.7956, lon=110.3695,
        name="Lokasi DI Yogyakarta", province="DI Yogyakarta",
    )


@pytest.fixture
def weather_sample() -> WeatherCurrent:
    return WeatherCurrent(
        timestamp=datetime(2025, 1, 15, 12),
        temperature_c=24.5, humidity_pct=92.0, rainfall_mm=85.0,
        wind_speed_ms=4.5, pressure_hpa=1008.0, condition="hujan lebat",
    )


@pytest.fixture
def forecast_sample() -> List[ForecastPoint]:
    return [
        ForecastPoint(
            date=date(2025, 1, 15 + i if 15 + i <= 28 else 28),
            temp_min_c=22.0, temp_max_c=29.0,
            humidity_pct=88.0, rainfall_mm=50.0,
            wind_speed_ms=3.0, condition="hujan sedang",
        )
        for i in range(7)
    ]


@pytest.fixture(autouse=True)
def reset_cache_between_tests():
    clear_cache()
    yield
    clear_cache()


# ---------- build_recommendation_prompt ----------

def test_prompt_contains_core_sections(
    mangsa_kapitu, location_yogya, weather_sample, forecast_sample,
):
    prompt = build_recommendation_prompt(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.HIGH, AnomalyType.FLOOD, location_yogya,
    )
    for marker in [
        "KONTEKS CUACA SAIKI",
        "PRAKIRAAN 7 DINA",
        "MANGSA AKTIF",
        "ANALISIS RISIKO",
        "INSTRUKSI OUTPUT",
        "Kapitu",
        "high",
        "flood",
    ]:
        assert marker in prompt, f"section/marker missing: {marker}"


def test_prompt_omits_farmer_section_when_no_context(
    mangsa_kapitu, location_yogya, weather_sample, forecast_sample,
):
    prompt = build_recommendation_prompt(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.LOW, AnomalyType.NORMAL, location_yogya,
    )
    # Section header literal "== KONTEKS PETANI ==" should not appear
    assert "== KONTEKS PETANI ==" not in prompt


def test_prompt_includes_farmer_section_when_provided(
    mangsa_kapitu, location_yogya, weather_sample, forecast_sample,
):
    prompt = build_recommendation_prompt(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.LOW, AnomalyType.NORMAL, location_yogya,
        crop_type="padi varietas IR64",
        planting_date=date(2024, 12, 1),
        notes="lahan miring, drainase kurang baik",
    )
    assert "== KONTEKS PETANI ==" in prompt
    assert "IR64" in prompt
    assert "2024-12-01" in prompt
    assert "lahan miring" in prompt


def test_prompt_partial_farmer_context(
    mangsa_kapitu, location_yogya, weather_sample, forecast_sample,
):
    """Hanya crop_type saja juga harus memunculkan section."""
    prompt = build_recommendation_prompt(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.LOW, AnomalyType.NORMAL, location_yogya,
        crop_type="jagung",
    )
    assert "== KONTEKS PETANI ==" in prompt
    assert "jagung" in prompt


# ---------- _strip_json_fences ----------

@pytest.mark.parametrize("raw, expected", [
    ('{"a":1}', '{"a":1}'),
    ('```json\n{"a":1}\n```', '{"a":1}'),
    ('```\n{"a":1}\n```', '{"a":1}'),
    ('  {"a":1}  ', '{"a":1}'),
    ('```json\n{"a":1}', '{"a":1}'),  # only opening fence
])
def test_strip_json_fences(raw: str, expected: str) -> None:
    assert _strip_json_fences(raw) == expected


# ---------- _parse_llm_json ----------

def test_parse_llm_json_valid() -> None:
    raw = (
        '{"traditional_wisdom": "wisdom", "modern_action": ["a"], '
        '"crop_recommendation": ["padi"], "warning": ["w1"], '
        '"narrative": "narasi"}'
    )
    out = _parse_llm_json(raw)
    assert isinstance(out, RecommendationLLM)
    assert out.modern_action == ["a"]


def test_parse_llm_json_with_fence() -> None:
    raw = (
        '```json\n{"traditional_wisdom": "x", "modern_action": [], '
        '"crop_recommendation": [], "warning": [], "narrative": "n"}\n```'
    )
    out = _parse_llm_json(raw)
    assert out.traditional_wisdom == "x"


def test_parse_llm_json_invalid_json_raises() -> None:
    import json
    with pytest.raises(json.JSONDecodeError):
        _parse_llm_json("not a json")


def test_parse_llm_json_missing_fields_raises() -> None:
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        _parse_llm_json('{"only_one_field": "x"}')


# ---------- _fallback_recommendation ----------

@pytest.mark.parametrize("risk, expected_count", [
    (RiskLevel.LOW, 1),
    (RiskLevel.MEDIUM, 2),
    (RiskLevel.HIGH, 3),
    (RiskLevel.CRITICAL, 4),
])
def test_fallback_warning_count_scales_with_risk(
    mangsa_kapitu, risk: RiskLevel, expected_count: int,
) -> None:
    fb = _fallback_recommendation(mangsa_kapitu, risk, AnomalyType.NORMAL)
    assert len(fb.warning) >= expected_count


@pytest.mark.parametrize("anomaly", [
    AnomalyType.NORMAL,
    AnomalyType.DROUGHT,
    AnomalyType.FLOOD,
    AnomalyType.HEATWAVE,
    AnomalyType.EL_NINO,
    AnomalyType.LA_NINA,
])
def test_fallback_returns_valid_for_all_anomalies(mangsa_kapitu, anomaly: AnomalyType):
    fb = _fallback_recommendation(mangsa_kapitu, RiskLevel.MEDIUM, anomaly)
    assert isinstance(fb, RecommendationLLM)
    assert fb.traditional_wisdom
    assert fb.narrative
    assert fb.modern_action
    assert fb.warning


def test_fallback_drought_swaps_crops(mangsa_kapitu) -> None:
    """Mangsa hujan + DROUGHT → crops drought-tolerant (sorgum/kacang/jagung)."""
    fb = _fallback_recommendation(mangsa_kapitu, RiskLevel.HIGH, AnomalyType.DROUGHT)
    assert any(c.lower() in {"sorgum", "kacang hijau", "ubi kayu (singkong)",
                              "kacang tanah", "jagung"} for c in fb.crop_recommendation)


def test_fallback_narrative_in_word_range(mangsa_kapitu) -> None:
    """Narrative fallback umumnya 80-150 kata (target spec 80-120 + slack)."""
    fb = _fallback_recommendation(mangsa_kapitu, RiskLevel.MEDIUM, AnomalyType.NORMAL)
    n = len(fb.narrative.split())
    assert 60 <= n <= 200, f"narrative {n} kata di luar batas wajar"


# ---------- TTL cache ----------

def test_cache_key_differentiates_by_crop_type(mangsa_kapitu) -> None:
    k_a = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH, crop_type="padi")
    k_b = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH, crop_type="jagung")
    assert k_a != k_b


def test_cache_key_differentiates_by_planting_date(mangsa_kapitu) -> None:
    k_a = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH,
                     planting_date=date(2024, 12, 1))
    k_b = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH,
                     planting_date=date(2024, 11, 1))
    assert k_a != k_b


def test_cache_key_normalizes_crop_type(mangsa_kapitu) -> None:
    """Crop_type case-insensitive & trim whitespace."""
    k_a = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH, crop_type="Padi  ")
    k_b = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH, crop_type="padi")
    assert k_a == k_b


def test_cache_get_returns_none_for_missing_key(mangsa_kapitu) -> None:
    k = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH)
    assert _cache_get(k) is None


def test_cache_set_then_get(mangsa_kapitu) -> None:
    k = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH)
    fb = _fallback_recommendation(mangsa_kapitu, RiskLevel.HIGH, AnomalyType.NORMAL)
    _cache_set(k, fb)
    got = _cache_get(k)
    assert got is not None
    assert got.narrative == fb.narrative


def test_cache_expiry(monkeypatch, mangsa_kapitu) -> None:
    """Setelah TTL lewat, cache_get harus None (entri auto-purge)."""
    import app.services.llm_service as llm_mod
    base = 1000.0
    times = [base]
    monkeypatch.setattr(llm_mod.time, "monotonic", lambda: times[0])

    k = _cache_key(-7.79, 110.37, mangsa_kapitu, RiskLevel.HIGH)
    fb = _fallback_recommendation(mangsa_kapitu, RiskLevel.HIGH, AnomalyType.NORMAL)
    _cache_set(k, fb)
    assert _cache_get(k) is not None

    # Advance past TTL (default 300s)
    times[0] = base + 301
    assert _cache_get(k) is None


# ---------- generate_recommendation (fallback path) ----------

def test_generate_recommendation_returns_fallback_without_api_key(
    mangsa_kapitu, location_yogya, weather_sample, forecast_sample, monkeypatch,
):
    """Tanpa API key, generate_recommendation harus jalur fallback."""
    # Pastikan client None
    import app.services.llm_service as llm_mod
    llm_mod._client = None
    monkeypatch.setattr(
        llm_mod.get_settings(), "gemini_api_key", "",
        raising=False,
    )

    result = asyncio.run(generate_recommendation(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.HIGH, AnomalyType.FLOOD, location_yogya,
    ))
    assert isinstance(result, RecommendationLLM)
    assert result.narrative
    assert result.modern_action


def test_generate_recommendation_cache_hit(
    mangsa_kapitu, location_yogya, weather_sample, forecast_sample,
):
    """Panggilan kedua dengan input identik harus dari cache (cepat)."""
    r1 = asyncio.run(generate_recommendation(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.HIGH, AnomalyType.FLOOD, location_yogya,
    ))
    r2 = asyncio.run(generate_recommendation(
        weather_sample, forecast_sample, mangsa_kapitu,
        RiskLevel.HIGH, AnomalyType.FLOOD, location_yogya,
    ))
    # Hasil identik (cache hit)
    assert r1.narrative == r2.narrative
