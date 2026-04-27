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

    # ---------- Gemini LLM ----------
    gemini_api_key: str = Field(default="", description="Google AI Studio API key")
    gemini_model: str = Field(default="gemini-2.5-flash")
    gemini_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    gemini_cache_ttl_sec: int = Field(default=300, ge=1)
    gemini_timeout_sec: float = Field(default=20.0, gt=0)

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
