"""Router prediksi cuaca + risiko + anomali.

Endpoint:
- ``POST /api/predict`` → :class:`PredictionResponse`

Validasi koordinat di luar Pulau Jawa (lat -9..-5, lon 105..115) ditangani
otomatis oleh :class:`CoordinateInput`; FastAPI akan mengembalikan **422
Unprocessable Entity** bila batas dilanggar.
"""
from __future__ import annotations

from fastapi import APIRouter, status

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
        422: {"description": "Koordinat di luar batas Pulau Jawa."},
    },
)
async def predict(coords: CoordinateInput) -> PredictionResponse:
    """Hitung cuaca saat ini + forecast 7 hari + risiko & anomali.

    Cache deterministik di layer service (lat~2dp, lon~2dp, tanggal).
    """
    return predict_weather(coords.lat, coords.lon)
