"""Weather service orchestrator — pilih provider + auto-fallback.

Strategi:
- ``WEATHER_PROVIDER=openmeteo`` (default) → async call Open-Meteo API.
  Bila gagal (timeout / HTTP error / parse error) → fallback otomatis ke mock
  supaya UI tetap responsif dan offline development tetap jalan.
- ``WEATHER_PROVIDER=mock`` → langsung pakai mock deterministik.

Import ini di router, BUKAN ``weather_mock`` langsung.
"""
from __future__ import annotations

import logging
from datetime import date

from app.core import get_settings
from app.models import PredictionResponse
from app.services.weather_mock import predict_weather as predict_weather_mock

logger = logging.getLogger(__name__)


async def predict_weather(
    lat: float,
    lon: float,
    ref_date: date | None = None,
    days: int = 7,
) -> PredictionResponse:
    """Orchestrator publik (async): cuaca + forecast + risk + anomaly.

    Otomatis pilih provider berdasarkan ``WEATHER_PROVIDER`` env var.
    Fallback ke mock bila Open-Meteo gagal.
    """
    s = get_settings()

    if s.weather_provider == "openmeteo":
        try:
            from app.services.weather_openmeteo import predict_weather_openmeteo

            result = await predict_weather_openmeteo(lat, lon, ref_date, days)
            logger.debug(
                "Open-Meteo OK untuk (%.2f, %.2f) days=%d", lat, lon, days,
            )
            return result
        except Exception as exc:
            logger.warning(
                "Open-Meteo gagal (%.2f, %.2f): %s — fallback ke mock.",
                lat, lon, exc,
            )
            # Fallback ke mock
            return predict_weather_mock(lat, lon, ref_date, days)

    # Provider = mock (explicit)
    return predict_weather_mock(lat, lon, ref_date, days)
