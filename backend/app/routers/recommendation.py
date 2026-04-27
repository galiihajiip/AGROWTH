"""Router rekomendasi pertanian: gabungan mangsa + LLM + crops.

Endpoint:
- ``POST /api/recommendation`` → :class:`RecommendationResponse`

Pipeline internal:
1. ``predict_weather(lat, lon)`` — cuaca saat ini, forecast 7 hari, risk, anomaly.
2. ``get_current_mangsa()`` — mangsa aktif sesuai tanggal sekarang.
3. ``generate_recommendation(...)`` async — LLM Gemini (atau fallback statis)
   → ``traditional_wisdom``, ``modern_action``, ``crop_recommendation``,
   ``warning``, ``narrative``.
4. Mapping ke :class:`RecommendationResponse`.
"""
from __future__ import annotations

from datetime import datetime
from typing import List

from fastapi import APIRouter, status

from app.models import RecommendationRequest, RecommendationResponse
from app.services.llm_service import generate_recommendation
from app.services.pranata_mangsa import get_current_mangsa, match_crops_to_mangsa
from app.services.weather_mock import predict_weather

router = APIRouter(prefix="/api", tags=["recommendation"])


@router.post(
    "/recommendation",
    response_model=RecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Rekomendasi pertanian hybrid (cuaca + Pranata Mangsa + LLM).",
    responses={
        200: {"description": "Rekomendasi berhasil dibuat."},
        422: {"description": "Koordinat di luar batas Pulau Jawa."},
    },
)
async def recommend(req: RecommendationRequest) -> RecommendationResponse:
    """Gabungkan prediksi cuaca + mangsa aktif + saran LLM menjadi satu respons."""
    # 1) Prediksi cuaca + risiko + anomali untuk koordinat tersebut.
    pred = predict_weather(req.coordinates.lat, req.coordinates.lon)

    # 2) Mangsa aktif (hari ini).
    mangsa = get_current_mangsa()

    # 3) Rekomendasi terstruktur dari LLM (cache + fallback statis).
    llm = await generate_recommendation(
        weather=pred.current,
        forecast=pred.forecast_7d,
        mangsa=mangsa,
        risk_level=pred.risk_level,
        anomaly=pred.anomaly,
        location=pred.location,
        crop_type=req.crop_type,
        planting_date=req.planting_date,
        notes=req.notes,
    )

    # 4) Tanaman: utamakan output LLM, fallback ke matcher Pranata Mangsa.
    crops: List[str] = list(llm.crop_recommendation) or match_crops_to_mangsa(
        mangsa, pred.anomaly
    )

    # 5) Daftar tindakan praktis (action items).
    recommendations: List[str] = list(llm.modern_action)
    if crops:
        recommendations.append(
            "Pilihan tanaman direkomendasikan: " + ", ".join(crops[:5])
        )

    return RecommendationResponse(
        location=pred.location,
        current=pred.current,
        forecast_7d=pred.forecast_7d,
        mangsa=mangsa,
        risk_level=pred.risk_level,
        anomaly=pred.anomaly,
        recommendations=recommendations,
        weather_advice=llm.traditional_wisdom,
        risk_warnings=list(llm.warning),
        summary=llm.narrative,
        generated_at=datetime.now(),
    )
