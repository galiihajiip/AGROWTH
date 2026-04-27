"""Router rekomendasi pertanian: gabungan mangsa + LLM + crops + Multi-ML.

Endpoint:
- ``POST /api/recommendation`` -> :class:`RecommendationResponse`

Pipeline internal:
1. ``predict_weather(lat, lon)`` -- cuaca saat ini, forecast 7 hari, risk,
   anomaly (di-enrich oleh Multi-ML ensemble).
2. ``get_current_mangsa()`` -- mangsa aktif sesuai tanggal sekarang.
3. ``generate_recommendation(...)`` async -- LLM Gemini (atau fallback statis)
   -> ``traditional_wisdom``, ``modern_action``, ``crop_recommendation``,
   ``warning``, ``narrative``.
4. Mapping ke :class:`RecommendationResponse` dengan data sources & ML probs.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Request, status

from app.core import get_limit, get_settings, limiter
from app.models import RecommendationRequest, RecommendationResponse
from app.services.llm_service import generate_recommendation
from app.services.pranata_mangsa import get_current_mangsa, match_crops_to_mangsa
from app.services.weather_service import predict_weather

router = APIRouter(prefix="/api", tags=["recommendation"])


def _get_data_sources() -> List[str]:
    """Daftar sumber data yang aktif berkontribusi ke rekomendasi."""
    s = get_settings()
    sources = []
    if s.weather_provider == "openmeteo":
        sources.append("Open-Meteo (real-time weather)")
    else:
        sources.append("Mock Weather (deterministic)")
    sources.append("BMKG Klimatologis (historical baseline)")
    sources.append("NASA POWER (solar radiation estimation)")
    sources.append("GHG Regional (greenhouse gas context)")
    if s.ml_enabled:
        sources.append("Multi-ML Ensemble (RF + GB + SVM)")
    if s.llm_enabled:
        sources.append(f"LLM {s.gemini_model} (narrative generation)")
    sources.append("Pranata Mangsa (traditional calendar)")
    return sources


def _get_ml_probs(
    lat: float, lon: float, forecast_data: list,
) -> tuple[Optional[Dict[str, float]], Optional[Dict[str, float]]]:
    """Ambil probabilitas ML ensemble (jika tersedia)."""
    s = get_settings()
    if not s.ml_enabled:
        return None, None
    try:
        from app.ml.predictor import get_predictor
        predictor = get_predictor()
        _, _, a_probs, r_probs = predictor.predict_multi_day(
            lat=lat, lon=lon, forecast_data=forecast_data,
        )
        return a_probs, r_probs
    except Exception:
        return None, None


@router.post(
    "/recommendation",
    response_model=RecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Rekomendasi pertanian hybrid (cuaca + Pranata Mangsa + Multi-ML + LLM).",
    responses={
        200: {"description": "Rekomendasi berhasil dibuat."},
        422: {"description": "Koordinat di luar batas Pulau Jawa."},
        429: {"description": "Rate limit terlampaui (per-IP)."},
    },
)
@limiter.limit(lambda: get_limit("recommendation"))
async def recommend(
    request: Request,  # noqa: ARG001 -- wajib agar slowapi bisa baca client IP
    req: RecommendationRequest,
) -> RecommendationResponse:
    """Gabungkan prediksi cuaca + mangsa aktif + saran LLM menjadi satu respons."""
    # 1) Prediksi cuaca + risiko + anomali (dengan ML enrichment).
    pred = await predict_weather(req.coordinates.lat, req.coordinates.lon)

    # 2) Mangsa aktif (hari ini).
    mangsa = get_current_mangsa()

    # 3) Rekomendasi terstruktur dari LLM (cache + fallback statis).
    llm = await generate_recommendation(
        weather=pred.current,
        forecast=pred.forecast,
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

    # 5) Action items murni -- TIDAK merge crops ke teks (UI menampilkan
    #    daftar tanaman dari ``crops`` field terstruktur).
    recommendations: List[str] = list(llm.modern_action)

    # 6) ML probabilitas untuk transparency
    forecast_dicts = [
        {
            "date": f.date,
            "temp_max_c": f.temp_max_c,
            "temp_min_c": f.temp_min_c,
            "humidity_pct": f.humidity_pct,
            "rainfall_mm": f.rainfall_mm,
            "wind_speed_ms": f.wind_speed_ms,
        }
        for f in pred.forecast
    ]
    ml_a_probs, ml_r_probs = _get_ml_probs(
        req.coordinates.lat, req.coordinates.lon, forecast_dicts,
    )

    return RecommendationResponse(
        location=pred.location,
        current=pred.current,
        forecast=pred.forecast,
        mangsa=mangsa,
        risk_level=pred.risk_level,
        anomaly=pred.anomaly,
        recommendations=recommendations,
        crops=crops[:10],
        weather_advice=llm.traditional_wisdom,
        risk_warnings=list(llm.warning),
        summary=llm.narrative,
        # UTC + offset eksplisit supaya kompatibel dengan parser ISO 8601
        # apa pun (mis. Date di JS, dateutil di Python, dst.)
        generated_at=datetime.now(timezone.utc),
        data_sources=_get_data_sources(),
        ml_anomaly_probs=ml_a_probs,
        ml_risk_probs=ml_r_probs,
    )
