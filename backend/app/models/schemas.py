"""Pydantic v2 data models untuk komunikasi API AGROWTH."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------- Enums ----------

class RiskLevel(str, Enum):
    """Tingkat risiko cuaca/iklim terhadap pertanian."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyType(str, Enum):
    """Jenis anomali iklim yang terdeteksi."""

    NORMAL = "normal"
    EL_NINO = "el_nino"
    LA_NINA = "la_nina"
    DROUGHT = "drought"
    FLOOD = "flood"
    HEATWAVE = "heatwave"


# ---------- Input ----------

class CoordinateInput(BaseModel):
    """Koordinat lat/lon dengan validator batas Pulau Jawa."""

    model_config = ConfigDict(json_schema_extra={
        "example": {"lat": -7.7956, "lon": 110.3695}
    })

    lat: float = Field(..., description="Latitude (Pulau Jawa: -9 .. -5)")
    lon: float = Field(..., description="Longitude (Pulau Jawa: 105 .. 115)")

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not -9.0 <= v <= -5.0:
            raise ValueError(
                "Latitude di luar batas Pulau Jawa (harus antara -9 dan -5)"
            )
        return v

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, v: float) -> float:
        if not 105.0 <= v <= 115.0:
            raise ValueError(
                "Longitude di luar batas Pulau Jawa (harus antara 105 dan 115)"
            )
        return v


# ---------- Weather & Location ----------

class LocationInfo(BaseModel):
    """Informasi lokasi geografis."""

    lat: float
    lon: float
    name: Optional[str] = Field(default=None, description="Nama lokasi/desa/kota")
    province: Optional[str] = Field(default=None, description="Provinsi")
    region: Optional[str] = Field(default=None, description="Region/kabupaten")
    elevation_m: Optional[float] = Field(default=None, description="Elevasi (meter)")


class WeatherCurrent(BaseModel):
    """Cuaca saat ini di sebuah titik."""

    timestamp: datetime
    temperature_c: float = Field(..., description="Suhu udara (Celsius)")
    humidity_pct: float = Field(..., ge=0, le=100, description="Kelembapan (%)")
    rainfall_mm: float = Field(..., ge=0, description="Curah hujan terakhir (mm)")
    wind_speed_ms: float = Field(..., ge=0, description="Kecepatan angin (m/s)")
    pressure_hpa: Optional[float] = Field(default=None, description="Tekanan (hPa)")
    condition: str = Field(..., description="Deskripsi kondisi cuaca")


class ForecastPoint(BaseModel):
    """Prakiraan cuaca untuk 1 hari."""

    date: date
    temp_min_c: float
    temp_max_c: float
    humidity_pct: float = Field(..., ge=0, le=100)
    rainfall_mm: float = Field(..., ge=0)
    wind_speed_ms: float = Field(..., ge=0)
    condition: str


# ---------- Prediction ----------

class PredictionResponse(BaseModel):
    """Hasil prediksi cuaca + risiko + anomali untuk sebuah lokasi."""

    location: LocationInfo
    current: WeatherCurrent
    forecast: List[ForecastPoint] = Field(
        ..., min_length=1, max_length=14,
        description="Prakiraan cuaca harian (1-14 hari ke depan)",
    )
    risk_level: RiskLevel
    anomaly: AnomalyType


# ---------- Mangsa (Pranata Mangsa Jawa) ----------

class MangsaInfo(BaseModel):
    """Informasi sebuah mangsa dalam Pranata Mangsa (kalender pertanian Jawa)."""

    number: int = Field(..., ge=1, le=12, description="Nomor mangsa (1-12)")
    name: str = Field(..., description="Nama mangsa, contoh: Kasa, Karo, Katelu")
    period_start: str = Field(
        ..., description="Tanggal mulai mangsa (format MM-DD)"
    )
    period_end: str = Field(
        ..., description="Tanggal akhir mangsa (format MM-DD)"
    )
    duration_days: int = Field(..., ge=1, description="Durasi mangsa (hari)")
    season: str = Field(..., description="Musim umum: kemarau / pancaroba / hujan")
    description: str = Field(..., description="Deskripsi singkat mangsa")
    characteristics: List[str] = Field(
        default_factory=list,
        description="Ciri-ciri alam pada mangsa ini",
    )
    recommended_activities: List[str] = Field(
        default_factory=list,
        description="Aktivitas pertanian yang direkomendasikan",
    )
    avoid_activities: List[str] = Field(
        default_factory=list,
        description="Aktivitas yang sebaiknya dihindari",
    )


# ---------- Recommendation ----------

class RecommendationRequest(BaseModel):
    """Permintaan rekomendasi pertanian berdasarkan koordinat & konteks."""

    coordinates: CoordinateInput
    crop_type: Optional[str] = Field(
        default=None,
        description="Jenis tanaman (padi, jagung, kedelai, dll)",
    )
    planting_date: Optional[date] = Field(
        default=None, description="Tanggal tanam (jika sudah)"
    )
    notes: Optional[str] = Field(
        default=None, description="Catatan tambahan dari petani"
    )


class RecommendationResponse(BaseModel):
    """Respons rekomendasi pertanian: cuaca, mangsa, dan saran tindakan."""

    location: LocationInfo
    current: WeatherCurrent
    forecast: List[ForecastPoint] = Field(..., min_length=1, max_length=14)
    mangsa: MangsaInfo
    risk_level: RiskLevel
    anomaly: AnomalyType
    recommendations: List[str] = Field(
        default_factory=list,
        description="Daftar tindakan praktis siap pakai (action items)",
    )
    crops: List[str] = Field(
        default_factory=list,
        max_length=10,
        description=(
            "Tanaman yang direkomendasikan (≤10), prioritas hybrid mangsa "
            "+ anomali iklim. Field terstruktur — JANGAN merge ke teks "
            "``recommendations`` di sisi konsumen."
        ),
    )
    weather_advice: str = Field(..., description="Saran terkait kondisi cuaca")
    risk_warnings: List[str] = Field(
        default_factory=list, description="Peringatan risiko relevan"
    )
    summary: Optional[str] = Field(
        default=None, description="Ringkasan naratif (LLM-generated)"
    )
    mangsa_greeting: str = Field(
        default="",
        description="Sapaan pembuka Jawa krama terkait mangsa aktif",
    )
    traditional_proverb: str = Field(
        default="",
        description="Peribahasa/ungkapan Jawa relevan dengan kondisi anomali",
    )
    generated_at: datetime = Field(
        ...,
        description=(
            "Waktu rekomendasi dibuat. Selalu UTC dengan offset eksplisit "
            "(``+00:00`` / ``Z``) sehingga konsumen lintas zona waktu bisa "
            "format ulang tanpa ambiguitas."
        ),
    )
    data_sources: List[str] = Field(
        default_factory=list,
        description=(
            "Daftar sumber data aktif yang berkontribusi ke rekomendasi ini. "
            "Contoh: ['Open-Meteo', 'BMKG Klimatologis', 'NASA POWER', "
            "'GHG Regional', 'Multi-ML Ensemble']."
        ),
    )
    ml_anomaly_probs: Optional[Dict[str, float]] = Field(
        default=None,
        description="Probabilitas per kelas anomali dari ML ensemble.",
    )
    ml_risk_probs: Optional[Dict[str, float]] = Field(
        default=None,
        description="Probabilitas per kelas risk dari ML ensemble.",
    )
