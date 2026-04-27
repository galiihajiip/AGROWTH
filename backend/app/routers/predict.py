"""Router prediksi cuaca + risiko + anomali.

Endpoint:
- ``POST /api/predict`` → :class:`PredictionResponse`

Validasi koordinat di luar Pulau Jawa (lat -9..-5, lon 105..115) ditangani
otomatis oleh :class:`CoordinateInput`; FastAPI akan mengembalikan **422
Unprocessable Entity** bila batas dilanggar.
"""
from __future__ import annotations

from fastapi import APIRouter, Query, Request, status

from app.core import get_limit, limiter
from app.models import CoordinateInput, PredictionResponse
from app.services.weather_mock import predict_weather

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Prediksi cuaca + risiko + anomali untuk koordinat (Pulau Jawa).",
    responses={
        200: {"description": "Prediksi berhasil dibuat."},
        422: {"description": "Koordinat di luar batas Pulau Jawa atau days di luar 1..14."},
        429: {"description": "Rate limit terlampaui (per-IP)."},
    },
)
@limiter.limit(lambda: get_limit("predict"))
async def predict(
    request: Request,  # noqa: ARG001 — wajib agar slowapi bisa baca client IP
    coords: CoordinateInput,
    days: int = Query(
        default=7, ge=1, le=14,
        description="Panjang forecast harian (1-14 hari). Default 7.",
    ),
) -> PredictionResponse:
    """Hitung cuaca saat ini + forecast 1..14 hari + risiko & anomali.

    Cache deterministik di layer service (lat~2dp, lon~2dp, tanggal, days).
    Rate limit per-IP: lihat ``RATE_LIMIT_PREDICT`` (default 60/menit).
    """
    return predict_weather(coords.lat, coords.lon, days=days)
