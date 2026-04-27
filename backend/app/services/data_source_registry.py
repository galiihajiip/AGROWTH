"""Registry sumber data AGROWTH beserta status integrasi.

Menyediakan metadata per field cuaca (primary source, endpoint,
status integrasi, alasan fallback, estimasi waktu produksi).

Digunakan oleh:
- ``GET /api/data-sources`` untuk transparansi juri / auditor
- Dokumentasi pipeline data di DEMO_SCRIPT.md
"""
from __future__ import annotations

from typing import Any, Dict, List

# ---------- Types ----------

DataSourceEntry = Dict[str, Any]

# ---------- Registry ----------

DATA_SOURCES: Dict[str, DataSourceEntry] = {
    "temperature_c": {
        "primary": "BMKG Open API",
        "endpoint": "https://api.bmkg.go.id/publik/prakiraan-cuaca",
        "status": "mock",
        "fallback_reason": "Rate limit & demo stability",
        "integration_complexity": "medium",
        "estimated_prod_date": "Q3 2025",
        "description": (
            "Suhu udara real-time dari stasiun klimatologi BMKG. "
            "Saat ini disimulasikan dengan model sinusoidal musiman "
            "berbasis Day-of-Year dan koordinat."
        ),
    },
    "rainfall_mm": {
        "primary": "NASA POWER API",
        "endpoint": "https://power.larc.nasa.gov/api/temporal/daily/point",
        "status": "mock",
        "fallback_reason": "Rate limit & demo stability",
        "integration_complexity": "medium",
        "estimated_prod_date": "Q3 2025",
        "description": (
            "Curah hujan harian dari NASA POWER (Prediction of Worldwide "
            "Energy Resources). Saat ini disimulasikan dengan profil "
            "bimodal musiman Jawa (puncak Jan-Feb & Nov-Des)."
        ),
    },
    "humidity_pct": {
        "primary": "BMKG Open API",
        "endpoint": "https://api.bmkg.go.id/publik/prakiraan-cuaca",
        "status": "mock",
        "fallback_reason": "Rate limit & demo stability",
        "integration_complexity": "low",
        "estimated_prod_date": "Q3 2025",
        "description": (
            "Kelembapan relatif dari BMKG. Saat ini diturunkan secara "
            "deterministik dari suhu simulasi dengan noise terkontrol."
        ),
    },
    "wind_speed_ms": {
        "primary": "Open-Meteo API",
        "endpoint": "https://api.open-meteo.com/v1/forecast",
        "status": "active",
        "fallback_reason": None,
        "integration_complexity": "low",
        "estimated_prod_date": None,
        "description": (
            "Kecepatan angin real-time dari Open-Meteo (gratis, tanpa API key). "
            "Sudah terintegrasi di weather_openmeteo.py; fallback ke mock "
            "saat provider offline."
        ),
    },
    "solar_radiation": {
        "primary": "NASA POWER API",
        "endpoint": "https://power.larc.nasa.gov/api/temporal/daily/point",
        "status": "active",
        "fallback_reason": None,
        "integration_complexity": "medium",
        "estimated_prod_date": None,
        "description": (
            "Estimasi radiasi matahari (ALLSKY_SFC_SW_DWN) dari NASA POWER. "
            "Sudah diintegrasikan via nasa_power.py sebagai fitur ML."
        ),
    },
    "greenhouse_gas": {
        "primary": "Data histori emisi regional BPS",
        "endpoint": None,
        "status": "planned",
        "fallback_reason": "Data BPS belum tersedia via API publik",
        "integration_complexity": "high",
        "estimated_prod_date": "Q4 2025",
        "description": (
            "Konteks emisi gas rumah kaca per provinsi Jawa dari BPS. "
            "Saat ini menggunakan estimasi statis per provinsi untuk "
            "fitur ML (GHG regional context)."
        ),
    },
    "anomaly_detection": {
        "primary": "Multi-ML Ensemble (RF + GB + SVM)",
        "endpoint": None,
        "status": "active",
        "fallback_reason": None,
        "integration_complexity": "high",
        "estimated_prod_date": None,
        "description": (
            "Deteksi anomali iklim menggunakan ensemble 3 model ML "
            "(Random Forest, Gradient Boosting, SVM) yang dilatih "
            "dari gabungan data BMKG historis, NASA POWER, dan GHG regional."
        ),
    },
    "recommendation_narrative": {
        "primary": "Google Gemini 2.5 Flash",
        "endpoint": "https://generativelanguage.googleapis.com/v1beta/models",
        "status": "active",
        "fallback_reason": None,
        "integration_complexity": "low",
        "estimated_prod_date": None,
        "description": (
            "Narasi rekomendasi Bahasa Jawa dihasilkan oleh Gemini LLM "
            "dengan prompt yang mengandung konteks Pranata Mangsa. "
            "Fallback otomatis ke template statis bila API key kosong."
        ),
    },
}


def get_active_sources() -> List[str]:
    """Daftar sumber data dengan status 'active'."""
    return [
        entry["primary"]
        for entry in DATA_SOURCES.values()
        if entry["status"] == "active"
    ]


def get_mock_sources() -> List[str]:
    """Daftar sumber data yang masih mock/simulasi."""
    return [
        entry["primary"]
        for entry in DATA_SOURCES.values()
        if entry["status"] == "mock"
    ]


def get_registry_summary() -> Dict[str, Any]:
    """Summary registry lengkap untuk endpoint /api/data-sources."""
    return {
        "demo_mode": True,
        "disclaimer": (
            "Data cuaca (suhu, curah hujan, kelembapan) disimulasikan "
            "secara deterministik untuk stabilitas demo. Pipeline integrasi "
            "ke BMKG Open API dan NASA POWER API sudah disiapkan di "
            "backend/app/services/ dan dapat diaktifkan dengan konfigurasi "
            "environment variable."
        ),
        "total_sources": len(DATA_SOURCES),
        "active_count": sum(
            1 for e in DATA_SOURCES.values() if e["status"] == "active"
        ),
        "mock_count": sum(
            1 for e in DATA_SOURCES.values() if e["status"] == "mock"
        ),
        "planned_count": sum(
            1 for e in DATA_SOURCES.values() if e["status"] == "planned"
        ),
        "sources": DATA_SOURCES,
    }
