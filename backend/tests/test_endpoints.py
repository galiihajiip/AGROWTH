"""End-to-end tests untuk endpoint AGROWTH FastAPI (TestClient httpx).

Cakupan:
1. ``GET  /health``                        — health check.
2. ``POST /api/predict``                   — koordinat valid (Yogyakarta).
3. ``POST /api/predict``                   — koordinat di luar Pulau Jawa → 422.
4. ``GET  /api/mangsa/current``            — mangsa aktif hari ini.
5. ``GET  /api/mangsa/{id}`` (id=7 valid)  — Kapitu.
6. ``GET  /api/mangsa/{id}`` (id=13 invalid) → 404.

Jalankan dari direktori ``backend/``::

    pytest tests/ -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """TestClient terikat ke instance FastAPI utama (scope module)."""
    return TestClient(app)


# ---------- 1) Health check ----------

def test_health_check(client: TestClient) -> None:
    """``GET /health`` mengembalikan 200 dengan ``status=healthy``."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


# ---------- 2) Predict valid (Yogyakarta) ----------

def test_predict_valid_yogyakarta(client: TestClient) -> None:
    """``POST /api/predict`` dengan koordinat Yogyakarta mengembalikan payload lengkap."""
    response = client.post(
        "/api/predict", json={"lat": -7.7956, "lon": 110.3695}
    )
    assert response.status_code == 200

    data = response.json()
    for key in ("location", "current", "forecast_7d", "risk_level", "anomaly"):
        assert key in data, f"missing key {key}"

    # Forecast wajib tepat 7 hari
    assert isinstance(data["forecast_7d"], list)
    assert len(data["forecast_7d"]) == 7

    # Enum values valid
    assert data["risk_level"] in {"low", "medium", "high", "critical"}
    assert data["anomaly"] in {
        "normal", "el_nino", "la_nina", "drought", "flood", "heatwave",
    }

    # Lokasi terdeteksi DI Yogyakarta
    assert data["location"]["province"] == "DI Yogyakarta"


# ---------- 3) Predict outside Java -> 422 ----------

def test_predict_outside_java_returns_422(client: TestClient) -> None:
    """``POST /api/predict`` dengan koordinat di luar Pulau Jawa → 422."""
    response = client.post("/api/predict", json={"lat": -3.5, "lon": 110.0})
    assert response.status_code == 422

    detail = response.json()["detail"]
    assert isinstance(detail, list) and detail
    # Pesan validator menyebut Pulau Jawa
    assert any("Pulau Jawa" in str(item) for item in detail)


# ---------- 4) Mangsa current ----------

def test_get_current_mangsa(client: TestClient) -> None:
    """``GET /api/mangsa/current`` mengembalikan ``MangsaInfo`` valid."""
    response = client.get("/api/mangsa/current")
    assert response.status_code == 200

    data = response.json()
    assert 1 <= data["number"] <= 12
    assert isinstance(data["name"], str) and data["name"]
    assert data["season"] in {"kemarau", "pancaroba", "hujan", "umum"}
    assert isinstance(data["characteristics"], list)
    assert len(data["characteristics"]) > 0


# ---------- 5) Mangsa by id valid ----------

def test_mangsa_by_id_valid(client: TestClient) -> None:
    """``GET /api/mangsa/7`` mengembalikan mangsa Kapitu."""
    response = client.get("/api/mangsa/7")
    assert response.status_code == 200

    data = response.json()
    assert data["number"] == 7
    assert data["name"] == "Kapitu"
    assert data["period_start"] == "12-22"
    assert data["period_end"] == "02-02"


# ---------- 6) Mangsa by id invalid -> 404 ----------

def test_mangsa_by_id_invalid_returns_404(client: TestClient) -> None:
    """``GET /api/mangsa/13`` mengembalikan 404 (id di luar 1..12)."""
    response = client.get("/api/mangsa/13")
    assert response.status_code == 404

    detail = response.json()["detail"]
    assert isinstance(detail, str)
    assert "tidak ditemukan" in detail.lower()
