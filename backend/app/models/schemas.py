"""Pydantic v2 data models untuk komunikasi API AGROWTH."""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional

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
    name: Optional[str] = Field(default=None, description="Nama lokasi/desa/kelurahan")
    kelurahan: Optional[str] = Field(default=None, description="Kelurahan / desa")
    kecamatan: Optional[str] = Field(default=None, description="Kecamatan")
    province: Optional[str] = Field(default=None, description="Provinsi")
    region: Optional[str] = Field(default=None, description="Kabupaten / Kota")
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

class MLVariables(BaseModel):
    """Variabel ML yang diproses oleh pipeline prediksi risiko AGROWTH.

    Setiap field merepresentasikan satu fitur yang digunakan oleh ensemble
    Random Forest + LSTM untuk menghasilkan skor risiko akhir.
    """

    ghg_emission: Optional[float] = Field(
        default=None,
        description="Emisi GHG regional (ton CO₂eq/ha). Sumber: BPS Regional Emission Data.",
    )
    solar_radiation: Optional[float] = Field(
        default=None,
        description="Indeks radiasi matahari (MJ/m²). Sumber: NASA POWER API.",
    )
    historical_deviation: Optional[float] = Field(
        default=None,
        description=(
            "Deviasi dari baseline cuaca 10 tahun terakhir (σ, sigma). "
            "Sumber: BMKG 10-year climatological baseline."
        ),
    )
    drought_probability: Optional[float] = Field(
        default=None,
        description=(
            "Probabilitas kekeringan 30 hari ke depan (%). "
            "Output: Ensemble Random Forest + LSTM."
        ),
    )
    model_confidence: Optional[float] = Field(
        default=None,
        description="Kepercayaan model prediksi risiko (0..1). Rerata confidence ensemble.",
    )
    model_version: Optional[str] = Field(
        default=None,
        description="Versi pipeline ML yang digunakan (mis. 'AGROWTH-ML-v1.2.0').",
    )


class PredictionResponse(BaseModel):
    """Hasil prediksi cuaca + risiko + anomali untuk sebuah lokasi.
    
    CRITICAL-C-005: Menambahkan `ml_status` untuk transparansi fallback.
    """

    location: LocationInfo
    current: WeatherCurrent
    forecast: List[ForecastPoint] = Field(
        ..., min_length=1, max_length=14,
        description="Prakiraan cuaca harian (1-14 hari ke depan)",
    )
    risk_level: RiskLevel
    anomaly: AnomalyType
    ml_status: str = Field(
        default="success",
        description=(
            "Status ML pipeline: 'success' (ensemble berhasil), "
            "'fallback' (rule-based fallback digunakan), "
            "'error' (gagal total, gunakan data statis)"
        ),
    )
    ml_confidence: Optional[float] = Field(
        default=None,
        description="Confidence score ML (0..1), null jika fallback",
    )
    data_source_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Metadata sumber data: mode (mock/live), daftar sumber aktif. "
            "Digunakan frontend untuk badge transparansi data."
        ),
    )
    ml_variables: Optional[MLVariables] = Field(
        default=None,
        description=(
            "Variabel ML yang diproses pipeline prediksi. "
            "Tersedia saat backend mengisi field ini (mock atau live). "
            "Digunakan frontend untuk panel 'ML Predictive Variables'."
        ),
    )


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
    """Permintaan rekomendasi pertanian berdasarkan koordinat & konteks.
    
    CRITICAL-H-001: Menambahkan validators untuk input fields LLM context.
    """

    coordinates: CoordinateInput
    crop_type: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Jenis tanaman (padi, jagung, kedelai, dll)",
    )
    planting_date: Optional[date] = Field(
        default=None, description="Tanggal tanam (jika sudah)"
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Catatan tambahan dari petani"
    )

    @field_validator("crop_type")
    @classmethod
    def validate_crop_type(cls, v: Optional[str]) -> Optional[str]:
        """Validasi crop_type: hanya alphanumeric + spaces, max 50 chars."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        # Allow alphanumeric, spaces, dan beberapa karakter khusus (-, /)
        if not all(c.isalnum() or c in ' -/' for c in v):
            raise ValueError(
                "crop_type hanya boleh alphanumeric, spaces, dash, slash"
            )
        if len(v) > 50:
            raise ValueError("crop_type max 50 karakters")
        return v

    @field_validator("planting_date")
    @classmethod
    def validate_planting_date(cls, v: Optional[date]) -> Optional[date]:
        """Validasi planting_date: harus dalam ±1 tahun dari hari ini."""
        if v is None:
            return v
        from datetime import timedelta
        today = date.today()
        delta = abs((v - today).days)
        if delta > 365:
            raise ValueError(
                "planting_date harus dalam ±1 tahun dari hari ini"
            )
        return v

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        """Validasi notes: sanitize HTML entities, max 500 chars."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) > 500:
            raise ValueError("notes max 500 karakters")
        # Sanitize basic HTML entities (prevent prompt injection)
        import html
        v = html.unescape(v)
        return v


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
    ml_variables: Optional[MLVariables] = Field(
        default=None,
        description=(
            "Variabel ML yang diproses pipeline prediksi. "
            "Selaras dengan PredictionResponse.ml_variables — backend "
            "mengisi keduanya secara bersamaan."
        ),
    )
