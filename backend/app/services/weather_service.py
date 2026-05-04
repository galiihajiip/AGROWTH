"""Weather service orchestrator — pilih provider + auto-fallback + ML enrichment.

Strategi:
- ``WEATHER_PROVIDER=openmeteo`` (default) -> async call Open-Meteo API.
  Bila gagal (timeout / HTTP error / parse error) -> fallback otomatis ke mock
  supaya UI tetap responsif dan offline development tetap jalan.
- ``WEATHER_PROVIDER=mock`` -> langsung pakai mock deterministik.

Setelah data cuaca didapat dari provider manapun, anomaly detection dan
risk classification di-override oleh **Multi-ML ensemble** (Random Forest,
Gradient Boosting, SVM) jika model tersedia. Ini menggantikan
rule-based threshold yang sebelumnya dipakai.

ML pipeline menggunakan fitur dari:
- Data cuaca real-time (suhu, hujan, kelembapan, angin)
- Deviasi dari baseline klimatologis BMKG
- Estimasi radiasi matahari (Hargreaves-Samani / NASA POWER)
- Konteks GHG regional per provinsi Jawa

Import ini di router, BUKAN ``weather_mock`` langsung.
"""
from __future__ import annotations

import logging
from datetime import date

from app.core import get_settings
from app.models import PredictionResponse
from app.services.weather_mock import (
    generate_ml_variables,
    predict_weather as predict_weather_mock,
)

logger = logging.getLogger(__name__)


def _enrich_with_ml(result: PredictionResponse) -> PredictionResponse:
    """Override anomaly & risk menggunakan Multi-ML ensemble predictor.

    Jika ML models gagal di-load atau predict, fallback ke hasil
    rule-based yang sudah ada di ``result``.
    """
    try:
        from app.ml.predictor import get_predictor

        predictor = get_predictor()

        # Gunakan multi-day prediction dari forecast data
        forecast_dicts = [
            {
                "date": f.date,
                "temp_max_c": f.temp_max_c,
                "temp_min_c": f.temp_min_c,
                "humidity_pct": f.humidity_pct,
                "rainfall_mm": f.rainfall_mm,
                "wind_speed_ms": f.wind_speed_ms,
            }
            for f in result.forecast
        ]

        anomaly, risk, anomaly_probs, risk_probs = predictor.predict_multi_day(
            lat=result.location.lat,
            lon=result.location.lon,
            forecast_data=forecast_dicts,
        )

        # Override hasil rule-based dengan ML prediction
        result = result.model_copy(update={
            "risk_level": risk,
            "anomaly": anomaly,
        })

        logger.debug(
            "ML enrichment OK (%.2f, %.2f): anomaly=%s risk=%s",
            result.location.lat, result.location.lon,
            anomaly.value, risk.value,
        )

    except Exception as exc:
        logger.warning(
            "ML enrichment gagal (%.2f, %.2f): %s — pakai rule-based.",
            result.location.lat, result.location.lon, exc,
        )

    return result


async def predict_weather(
    lat: float,
    lon: float,
    ref_date: date | None = None,
    days: int = 7,
) -> PredictionResponse:
    """Orchestrator publik (async): cuaca + forecast + risk + anomaly.

    Pipeline:
    1. Fetch data cuaca dari provider (Open-Meteo / mock)
    2. Enrich anomaly & risk via Multi-ML ensemble
    3. Return PredictionResponse

    Otomatis pilih provider berdasarkan ``WEATHER_PROVIDER`` env var.
    Fallback ke mock bila Open-Meteo gagal.
    ML enrichment fallback ke rule-based bila model gagal.
    """
    s = get_settings()

    if s.weather_provider == "openmeteo":
        try:
            from app.services.weather_openmeteo import predict_weather_openmeteo

            result = await predict_weather_openmeteo(lat, lon, ref_date, days)
            logger.debug(
                "Open-Meteo OK untuk (%.2f, %.2f) days=%d", lat, lon, days,
            )
        except Exception as exc:
            logger.warning(
                "Open-Meteo gagal (%.2f, %.2f): %s — fallback ke mock.",
                lat, lon, exc,
            )
            # Fallback ke mock
            result = predict_weather_mock(lat, lon, ref_date, days)
    else:
        # Provider = mock (explicit)
        result = predict_weather_mock(lat, lon, ref_date, days)

    # Enrich dengan Multi-ML prediction
    if s.ml_enabled:
        result = _enrich_with_ml(result)

    return result
