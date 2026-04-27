"""Tests untuk ``AppSettings`` (env parsing + computed fields).

Regression khusus untuk bug B1 di review: CSV ``CORS_ORIGINS`` env var
sebelumnya memicu ``SettingsError`` karena pydantic-settings v2 mencoba
JSON-decode otomatis pada ``List[str]`` complex type. Solusinya: simpan
sebagai string mentah lalu split via ``computed_field``.
"""
from __future__ import annotations

import pytest

from app.core.settings import AppSettings


def _fresh_settings(monkeypatch: pytest.MonkeyPatch) -> AppSettings:
    """Helper: buat AppSettings baru tanpa membaca .env (isolated)."""
    # Cegah .env di working dir mempengaruhi test
    monkeypatch.setattr(AppSettings.model_config, "env_file", None)
    return AppSettings()


# ---------- CORS_ORIGINS ----------

def test_cors_origins_default_is_list_of_three() -> None:
    """Default factory mengembalikan 3 origin localhost dev."""
    s = AppSettings()
    assert "http://localhost:3000" in s.cors_origins
    assert len(s.cors_origins) >= 3


def test_cors_origins_csv_from_env_does_not_crash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression B1: CSV string dari env tidak boleh memicu SettingsError."""
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "http://app.example.com,https://www.example.com",
    )
    s = AppSettings()
    assert s.cors_origins == [
        "http://app.example.com",
        "https://www.example.com",
    ]


def test_cors_origins_strips_whitespace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Spasi tambahan antar koma harus di-trim, entri kosong disaring."""
    monkeypatch.setenv(
        "CORS_ORIGINS",
        " http://a.com , http://b.com , , http://c.com ",
    )
    s = AppSettings()
    assert s.cors_origins == [
        "http://a.com",
        "http://b.com",
        "http://c.com",
    ]


def test_cors_origins_single_value(monkeypatch: pytest.MonkeyPatch) -> None:
    """Satu origin tanpa koma tetap parse jadi list 1-elemen."""
    monkeypatch.setenv("CORS_ORIGINS", "https://prod.example.com")
    s = AppSettings()
    assert s.cors_origins == ["https://prod.example.com"]


# ---------- log_level ----------

def test_log_level_normalized_to_uppercase(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LOG_LEVEL", "debug")
    s = AppSettings()
    assert s.log_level == "DEBUG"


# ---------- llm_enabled / is_production ----------

def test_llm_enabled_reflects_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "")
    assert AppSettings().llm_enabled is False
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-key")
    assert AppSettings().llm_enabled is True


def test_is_production_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENVIRONMENT", "Production")
    assert AppSettings().is_production is True
    monkeypatch.setenv("APP_ENVIRONMENT", "development")
    assert AppSettings().is_production is False
