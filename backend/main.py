"""Entry point FastAPI AGROWTH: include semua router + middleware CORS."""
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import (
    RequestLoggingMiddleware,
    configure_logging,
    get_settings,
    register_exception_handlers,
)
from app.routers import mangsa, predict, recommendation

configure_logging()
settings = get_settings()
app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

register_exception_handlers(app)

# Routers
app.include_router(predict.router)
app.include_router(recommendation.router)
app.include_router(mangsa.router)


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
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_environment,
        "llm_enabled": settings.llm_enabled,
        "llm_model": settings.gemini_model if settings.llm_enabled else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
