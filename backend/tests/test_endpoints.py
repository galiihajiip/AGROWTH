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
    """``GET /health`` mengembalikan 200 dengan info app + status=healthy."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    for k in ("app", "version", "environment", "llm_enabled", "timestamp"):
        assert k in data, f"missing key {k}"
    # llm_enabled adalah bool
    assert isinstance(data["llm_enabled"], bool)


# ---------- 2) Predict valid (Yogyakarta) ----------

def test_predict_valid_yogyakarta(client: TestClient) -> None:
    """``POST /api/predict`` dengan koordinat Yogyakarta mengembalikan payload lengkap."""
    response = client.post(
        "/api/predict", json={"lat": -7.7956, "lon": 110.3695}
    )
    assert response.status_code == 200

    data = response.json()
    for key in ("location", "current", "forecast", "risk_level", "anomaly"):
        assert key in data, f"missing key {key}"

    # Default forecast 7 hari
    assert isinstance(data["forecast"], list)
    assert len(data["forecast"]) == 7

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


# ---------- 7) Recommendation pipeline (weather + mangsa + LLM + crops) ----------

def test_recommendation_full_pipeline(client: TestClient) -> None:
    """``POST /api/recommendation`` mengembalikan response gabungan lengkap."""
    response = client.post(
        "/api/recommendation",
        json={
            "coordinates": {"lat": -7.7956, "lon": 110.3695},
            "crop_type": "padi",
        },
    )
    assert response.status_code == 200
    data = response.json()

    expected_keys = {
        "location", "current", "forecast", "mangsa",
        "risk_level", "anomaly", "recommendations", "crops",
        "weather_advice", "risk_warnings", "summary",
        "mangsa_greeting", "traditional_proverb", "generated_at",
    }
    assert expected_keys.issubset(data.keys()), f"missing: {expected_keys - data.keys()}"

    # Forecast tetap default 7 hari pada endpoint rekomendasi
    assert len(data["forecast"]) == 7

    # Mangsa harus valid
    assert 1 <= data["mangsa"]["number"] <= 12

    # Recommendations & summary terisi (fallback statis maupun LLM)
    assert isinstance(data["recommendations"], list) and data["recommendations"]
    assert isinstance(data["summary"], str) and data["summary"]
    assert isinstance(data["weather_advice"], str) and data["weather_advice"]

    # Field crops terstruktur, tidak dimerge ke recommendations
    assert isinstance(data["crops"], list) and data["crops"], "crops kosong"
    assert len(data["crops"]) <= 10
    for c in data["crops"]:
        assert isinstance(c, str) and c
    # Pastikan tidak ada string "Pilihan tanaman direkomendasikan" yang
    # bocor ke recommendations (regression atas refactor crops field).
    for r in data["recommendations"]:
        assert "tanaman direkomendasikan" not in r.lower()


def test_recommendation_generated_at_is_timezone_aware(
    client: TestClient,
) -> None:
    """``generated_at`` harus ISO datetime ber-offset UTC (tidak naive)."""
    from datetime import datetime

    response = client.post(
        "/api/recommendation",
        json={"coordinates": {"lat": -7.7956, "lon": 110.3695}},
    )
    assert response.status_code == 200
    iso = response.json()["generated_at"]

    # Harus parseable sebagai aware datetime
    parsed = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None, f"generated_at naive: {iso}"
    # Offset 0 (UTC) — implementasi pakai timezone.utc
    assert parsed.utcoffset().total_seconds() == 0, (
        f"expected UTC offset, got {parsed.utcoffset()}"
    )


def test_recommendation_outside_java_returns_422(client: TestClient) -> None:
    """Koordinat di luar Pulau Jawa pada /api/recommendation → 422."""
    response = client.post(
        "/api/recommendation",
        json={"coordinates": {"lat": -3.5, "lon": 110.0}},
    )
    assert response.status_code == 422


# ---------- 8) Mangsa by-date ----------

def test_mangsa_by_date_kapitu(client: TestClient) -> None:
    """``GET /api/mangsa/by-date?date=2025-01-15`` di tengah musim hujan → Kapitu."""
    response = client.get("/api/mangsa/by-date", params={"date": "2025-01-15"})
    assert response.status_code == 200
    assert response.json()["name"] == "Kapitu"


def test_mangsa_by_date_kasa_summer(client: TestClient) -> None:
    """``GET /api/mangsa/by-date?date=2025-06-22`` → Kasa (awal kemarau)."""
    response = client.get("/api/mangsa/by-date", params={"date": "2025-06-22"})
    assert response.status_code == 200
    assert response.json()["name"] == "Kasa"


def test_mangsa_by_date_leap_day(client: TestClient) -> None:
    """29 Februari (leap day) dipetakan ke 28 Februari → Kawolu."""
    response = client.get("/api/mangsa/by-date", params={"date": "2024-02-29"})
    assert response.status_code == 200
    assert response.json()["name"] == "Kawolu"


def test_mangsa_by_date_invalid_format(client: TestClient) -> None:
    """Format tanggal salah → 422."""
    response = client.get("/api/mangsa/by-date", params={"date": "not-a-date"})
    assert response.status_code == 422


# ---------- 9) Mangsa /all ----------

def test_mangsa_all_returns_twelve(client: TestClient) -> None:
    """``GET /api/mangsa/all`` → tepat 12 mangsa berurutan id 1..12."""
    response = client.get("/api/mangsa/all")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 12
    assert [m["number"] for m in data] == list(range(1, 13))
    assert data[0]["name"] == "Kasa"
    assert data[6]["name"] == "Kapitu"
    assert data[11]["name"] == "Sadha"


# ---------- 10) Predict dengan days param ----------

@pytest.mark.parametrize("days", [1, 3, 7, 14])
def test_predict_with_days_param(client: TestClient, days: int) -> None:
    """``POST /api/predict?days=N`` (1..14) menyesuaikan panjang forecast."""
    response = client.post(
        f"/api/predict?days={days}",
        json={"lat": -7.7956, "lon": 110.3695},
    )
    assert response.status_code == 200
    assert len(response.json()["forecast"]) == days


@pytest.mark.parametrize("days", [0, 15, -1])
def test_predict_days_out_of_range(client: TestClient, days: int) -> None:
    """``days`` di luar 1..14 → 422."""
    response = client.post(
        f"/api/predict?days={days}",
        json={"lat": -7.7956, "lon": 110.3695},
    )
    assert response.status_code == 422


# ---------- 11) X-Request-ID middleware ----------

def test_request_id_header_is_set(client: TestClient) -> None:
    """Setiap respons memiliki header ``X-Request-ID``."""
    response = client.get("/health")
    assert "x-request-id" in {k.lower() for k in response.headers.keys()}


def test_request_id_header_is_echoed(client: TestClient) -> None:
    """Bila klien mengirim ``X-Request-ID``, server harus mem-echo nilai sama."""
    response = client.get("/health", headers={"X-Request-ID": "test-trace-xyz"})
    assert response.headers.get("x-request-id") == "test-trace-xyz"
