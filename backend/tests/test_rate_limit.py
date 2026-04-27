"""Tests untuk rate limiting (slowapi) di endpoint AGROWTH.

Default conftest set ``RATE_LIMIT_ENABLED=false`` supaya test lain
(mis. parametrize ``days``) tidak kena 429. Test di file ini me-reset
limiter + enable + override limit ke nilai kecil sehingga 429 bisa
diobservasi dalam waktu detik.
"""
from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_strict_limit(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Client baru dengan limit recommendation = 2/menit (per-IP)."""
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_RECOMMENDATION", "2/minute")
    monkeypatch.setenv("RATE_LIMIT_PREDICT", "2/minute")

    # Reload modul yang membaca settings agar pengaturan baru efektif.
    from app.core import settings as settings_mod
    settings_mod.get_settings.cache_clear()

    # Bersihkan in-memory storage slowapi supaya counter tidak nyambung
    # dari test sebelumnya.
    import app.core.rate_limit as rl_mod
    importlib.reload(rl_mod)

    # Reload main agar app pakai limiter baru.
    import main as main_mod
    importlib.reload(main_mod)

    return TestClient(main_mod.app)


def test_rate_limit_recommendation_429(
    client_with_strict_limit: TestClient,
) -> None:
    """Hit 3 kali ke /api/recommendation; request ke-3 → 429."""
    payload = {"coordinates": {"lat": -7.7956, "lon": 110.3695}}

    r1 = client_with_strict_limit.post("/api/recommendation", json=payload)
    r2 = client_with_strict_limit.post("/api/recommendation", json=payload)
    r3 = client_with_strict_limit.post("/api/recommendation", json=payload)

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 429

    body = r3.json()
    assert body["code"] == "rate_limited"
    assert "Terlalu banyak request" in body["detail"]


def test_rate_limit_predict_429(
    client_with_strict_limit: TestClient,
) -> None:
    """Hit 3 kali ke /api/predict; request ke-3 → 429."""
    payload = {"lat": -7.7956, "lon": 110.3695}

    r1 = client_with_strict_limit.post("/api/predict", json=payload)
    r2 = client_with_strict_limit.post("/api/predict", json=payload)
    r3 = client_with_strict_limit.post("/api/predict", json=payload)

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 429
    assert r3.json()["code"] == "rate_limited"


# Catatan: jalur "rate-limit disabled" sudah terbukti tertutup secara
# implisit oleh seluruh test suite lain (170 test lain memanggil endpoint
# berkali-kali dengan default ``RATE_LIMIT_ENABLED=false`` di conftest dan
# tidak pernah mendapat 429).
