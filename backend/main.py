"""Entry point FastAPI AGROWTH: include semua router + middleware CORS."""
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from app.core import (
    RequestLoggingMiddleware,
    configure_logging,
    get_settings,
    limiter,
    register_exception_handlers,
)
from app.routers import mangsa, predict, recommendation, vulnerability

configure_logging()
settings = get_settings()

# OpenAPI metadata untuk /docs dan /redoc
_API_DESCRIPTION = """
**AGROWTH** (Applied Generative Reasoning for Optimal Weather & Traditional
Harvest) adalah ekosistem intelijen iklim terintegrasi untuk Pulau Jawa yang
memadukan:

* **Multi-Machine Learning** (Random Forest, Gradient Boosting, SVM) untuk
  klasifikasi anomali iklim & risk level berbasis data komprehensif
* **Tiga sumber data terintegrasi**: BMKG klimatologis, NASA POWER (radiasi
  matahari & kelembapan), dan data emisi GRK regional
* **Prediksi cuaca real-time** (Open-Meteo API / mock fallback, 1-14 hari)
* **Pranata Mangsa** (kalender pertanian tradisional Jawa, 12 mangsa)
* **Rekomendasi naratif Bahasa Jawa** via Google Gemini 2.5 Flash
  (otomatis fallback ke aturan statis bila API key tidak tersedia)
* **Pemetaan kerentanan wilayah** (spatial vulnerability grid)

Validasi koordinat membatasi input ke Pulau Jawa
(lat in [-9, -5], lon in [105, 115]); di luar batas -> **422**.

Setiap respons dilabeli `X-Request-ID` untuk traceability.
""".strip()

_TAGS_METADATA = [
    {
        "name": "prediction",
        "description": "Prediksi cuaca harian, risiko, dan anomali iklim.",
    },
    {
        "name": "recommendation",
        "description": (
            "Rekomendasi pertanian gabungan cuaca + Pranata Mangsa + LLM."
        ),
    },
    {
        "name": "mangsa",
        "description": "Lookup mangsa Pranata Mangsa Jawa (12 mangsa).",
    },
    {
        "name": "vulnerability",
        "description": "Pemetaan kerentanan wilayah (spatial vulnerability grid).",
    },
    {
        "name": "meta",
        "description": "Health check, identitas, dan status komponen.",
    },
]

@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Startup / shutdown lifecycle."""
    # Startup: pre-load ML models jika enabled (non-blocking first request)
    if settings.ml_enabled:
        try:
            from app.ml.predictor import get_predictor
            get_predictor()  # Trigger lazy-load + auto-train
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "ML models gagal di-load saat startup: %s (akan retry saat request pertama)", exc,
            )

    yield

    # Shutdown: tutup shared HTTP clients
    from app.services.weather_openmeteo import close_http_client
    await close_http_client()
    try:
        from app.services.nasa_power import close_nasa_http_client
        await close_nasa_http_client()
    except Exception:
        pass


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version=settings.app_version,
    description=_API_DESCRIPTION,
    summary="Hybrid agriculture recommendation API for Java island.",
    contact={
        "name": "AGROWTH",
        "url": "https://github.com/galiihajiip/AGROWTH",
    },
    license_info={"name": "MIT"},
    openapi_tags=_TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SlowAPIMiddleware)

register_exception_handlers(app)


# ---------- Rate limit hookup ----------
# slowapi membutuhkan limiter terpasang di app.state agar decorator
# ``@limiter.limit(...)`` di router-level bisa menemukannya.
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _ratelimit_handler(  # noqa: D401 - simple alias signature
    request: Request, exc: RateLimitExceeded,
) -> JSONResponse:
    """Map ``RateLimitExceeded`` → **429 Too Many Requests** dengan body
    yang konsisten dengan format error AGROWTH (``{"detail", "code"}``)
    dan header ``Retry-After`` dari slowapi (kalau ada).
    """
    response = JSONResponse(
        status_code=429,
        content={
            "detail": (
                f"Terlalu banyak request. Limit: {exc.detail}. "
                "Silakan tunggu beberapa saat lalu coba lagi."
            ),
            "code": "rate_limited",
        },
    )
    # slowapi menyetel Retry-After di response yang di-bocor lewat exc.headers
    retry_after = getattr(exc, "headers", None) or {}
    if "Retry-After" in retry_after:
        response.headers["Retry-After"] = str(retry_after["Retry-After"])
    return response

# Routers
app.include_router(predict.router)
app.include_router(recommendation.router)
app.include_router(mangsa.router)
app.include_router(vulnerability.router)


@app.get("/", tags=["meta"])
async def read_root():
    """Landing route: identitas singkat + tautan dokumentasi."""
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "status": "ok",
    }


@app.get("/health", tags=["meta"])
async def health_check():
    """Health check ringan: identitas + status komponen + timestamp."""
    ml_status = "disabled"
    if settings.ml_enabled:
        try:
            from app.ml.predictor import get_predictor
            p = get_predictor()
            ml_status = "loaded" if p.is_loaded else "not_loaded"
        except Exception:
            ml_status = "error"

    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_environment,
        "weather_provider": settings.weather_provider,
        "llm_enabled": settings.llm_enabled,
        "llm_model": settings.gemini_model if settings.llm_enabled else None,
        "ml_enabled": settings.ml_enabled,
        "ml_status": ml_status,
        "data_sources": [
            "Open-Meteo (real-time weather)",
            "BMKG Klimatologis (historical baseline)",
            "NASA POWER (solar radiation & humidity)",
            "GHG Regional (greenhouse gas emissions)",
        ],
        "ml_models": [
            "Random Forest",
            "Gradient Boosting",
            "Support Vector Machine",
        ] if settings.ml_enabled else [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
