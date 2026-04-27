"""Konfigurasi terpusat AGROWTH (pydantic-settings).

Semua nilai bisa di-override via environment variable atau file ``.env``
di direktori ``backend/``. Satu sumber kebenaran untuk:

- Identitas aplikasi (nama, versi, environment)
- CORS origins (dev/prod)
- Logging level
- Gemini LLM (api key, model, temperature, cache TTL, timeout)

Akses singleton via :func:`get_settings` (cached).
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_CORS = "http://localhost:3000,http://localhost:5173,http://localhost:8080"


class AppSettings(BaseSettings):
    """Konfigurasi root aplikasi AGROWTH."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------- App identity ----------
    app_name: str = Field(default="AGROWTH API")
    app_version: str = Field(default="0.1.0")
    app_environment: str = Field(default="development")  # development|staging|production

    # ---------- CORS ----------
    # Disimpan sebagai string CSV supaya pydantic-settings TIDAK menjalankan
    # JSON-decode otomatis pada complex type ``List[str]`` (yang akan crash
    # bila value berupa CSV biasa). Property :attr:`cors_origins` melakukan
    # split + strip on access.
    cors_origins_raw: str = Field(
        default=_DEFAULT_CORS,
        alias="CORS_ORIGINS",
        description="Origin yang diizinkan, pisahkan dengan koma (CSV).",
    )

    # ---------- Logging ----------
    log_level: str = Field(default="INFO")

    # ---------- Rate limiting (slowapi) ----------
    # Format mengikuti limits library: "<count>/<period>" — mis.
    # "30/minute", "100/hour", "5/second". Set ``RATE_LIMIT_ENABLED=false``
    # di test/CI untuk men-disable.
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_predict: str = Field(
        default="60/minute",
        description="Limit per-IP untuk POST /api/predict.",
    )
    rate_limit_recommendation: str = Field(
        default="20/minute",
        description=(
            "Limit per-IP untuk POST /api/recommendation. Lebih ketat "
            "karena memicu Gemini call yang ber-biaya token."
        ),
    )

    # ---------- Gemini LLM ----------
    gemini_api_key: str = Field(default="", description="Google AI Studio API key")
    gemini_model: str = Field(default="gemini-2.5-flash")
    gemini_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    gemini_cache_ttl_sec: int = Field(default=300, ge=1)
    gemini_timeout_sec: float = Field(default=20.0, gt=0)

    # ---------- Weather provider ----------
    # ``openmeteo`` (default) → call api.open-meteo.com (gratis, no key)
    # ``mock`` → fallback statis deterministic untuk dev/CI offline.
    # Bila Open-Meteo gagal/timeout, orchestrator akan fallback otomatis ke mock
    # supaya UI tetap responsif.
    weather_provider: str = Field(default="openmeteo")
    open_meteo_base_url: str = Field(default="https://api.open-meteo.com/v1/forecast")
    open_meteo_timeout_sec: float = Field(default=8.0, gt=0)

    @field_validator("weather_provider")
    @classmethod
    def _normalize_provider(cls, v: str) -> str:
        v_lower = v.strip().lower()
        if v_lower not in {"openmeteo", "mock"}:
            raise ValueError(
                f"WEATHER_PROVIDER harus 'openmeteo' atau 'mock' (got: {v})"
            )
        return v_lower

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, v: str) -> str:
        return v.upper()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> List[str]:
        """Daftar origin CORS terparsing dari ``CORS_ORIGINS`` (CSV)."""
        return [
            item.strip()
            for item in self.cors_origins_raw.split(",")
            if item.strip()
        ]

    @property
    def is_production(self) -> bool:
        return self.app_environment.lower() == "production"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Singleton settings (lazy + cached)."""
    return AppSettings()
