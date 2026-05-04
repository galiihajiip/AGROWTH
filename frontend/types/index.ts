/**
 * Type definitions yang mencerminkan skema backend AGROWTH
 * (`backend/app/models/schemas.py`).
 *
 * SUMBER KEBENARAN: Pydantic models di backend. Bila skema backend
 * berubah, perbarui file ini sehingga compile-time types tetap selaras.
 *
 * Konvensi:
 * - Tanggal/datetime dari backend selalu string ISO 8601 setelah JSON
 *   serialization. Frontend menyimpannya sebagai ``string`` lalu konversi
 *   ke ``Date`` di tempat presentasi (mis. format relatif).
 * - Enum di-encode sebagai string union supaya literal-narrow dan
 *   serializable lewat JSON tanpa konversi tambahan.
 */

// ============================================================================
// Enums (mirror RiskLevel & AnomalyType di backend)
// ============================================================================

/** Tingkat risiko cuaca/iklim terhadap pertanian. */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Konstanta runtime untuk iterasi & switch yang exhaustive. */
export const RISK_LEVELS: readonly RiskLevel[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

/** Jenis anomali iklim yang terdeteksi. */
export type AnomalyType =
  | "normal"
  | "el_nino"
  | "la_nina"
  | "drought"
  | "flood"
  | "heatwave";

export const ANOMALY_TYPES: readonly AnomalyType[] = [
  "normal",
  "el_nino",
  "la_nina",
  "drought",
  "flood",
  "heatwave",
] as const;

// ============================================================================
// Input
// ============================================================================

/**
 * Koordinat geografis input.
 *
 * Validasi backend membatasi input ke Pulau Jawa:
 * `lat ∈ [-9, -5]`, `lon ∈ [105, 115]`. Di luar batas → HTTP 422.
 */
export interface Coordinate {
  /** Latitude (Pulau Jawa: -9..-5). */
  lat: number;
  /** Longitude (Pulau Jawa: 105..115). */
  lon: number;
}

// ============================================================================
// Lokasi & Cuaca
// ============================================================================

/** Informasi lokasi geografis (hasil reverse-geocode bbox per provinsi). */
export interface LocationInfo {
  lat: number;
  lon: number;
  /** Nama lokasi/desa/kota (opsional). */
  name?: string | null;
  /** Provinsi (opsional). */
  province?: string | null;
  /** Region/kabupaten (opsional). */
  region?: string | null;
  /** Elevasi (meter, opsional). */
  elevation_m?: number | null;
}

/** Cuaca saat ini di sebuah titik. */
export interface WeatherCurrent {
  /** ISO 8601 datetime. */
  timestamp: string;
  /** Suhu udara (°C). */
  temperature_c: number;
  /** Kelembapan (%). 0..100. */
  humidity_pct: number;
  /** Curah hujan terakhir (mm). >= 0. */
  rainfall_mm: number;
  /** Kecepatan angin (m/s). >= 0. */
  wind_speed_ms: number;
  /** Tekanan (hPa, opsional). */
  pressure_hpa?: number | null;
  /** Deskripsi kondisi cuaca (mis. "hujan ringan"). */
  condition: string;
}

/** Prakiraan cuaca untuk 1 hari. */
export interface ForecastPoint {
  /** ISO 8601 date (YYYY-MM-DD). */
  date: string;
  temp_min_c: number;
  temp_max_c: number;
  /** 0..100. */
  humidity_pct: number;
  /** >= 0. */
  rainfall_mm: number;
  /** >= 0. */
  wind_speed_ms: number;
  condition: string;
}

// ============================================================================
// ML Variables (diproses via Multi-ML Pipeline)
// ============================================================================

/** Arah tren nilai variabel ML dibandingkan baseline. */
export type MLVariableTrend = "up" | "down" | "stable";

/**
 * Satu variabel ML yang digunakan oleh pipeline prediksi risiko.
 * Setiap variabel berkontribusi sebagian (``modelContribution``) ke
 * skor risiko akhir yang dihasilkan ensemble RF + LSTM.
 */
export interface MLVariable {
  /** Identifier unik variabel. */
  id: string;
  /** Label singkat yang ditampilkan di UI. */
  label: string;
  /** Nilai numerik saat ini. */
  value: number;
  /** Satuan pengukuran (mis. "ton CO₂eq/ha", "MJ/m²", "σ", "%"). */
  unit: string;
  /** Sumber data asal variabel ini. */
  source: string;
  /**
   * Bobot kontribusi fitur ini ke model prediksi risiko (0..1).
   * Contoh: 0.28 = 28% pengaruh ke risk score final.
   */
  modelContribution: number;
  /** Tren relatif terhadap baseline historis. */
  trend: MLVariableTrend;
  /** Deskripsi singkat variabel untuk tooltip/info. */
  description: string;
}

/**
 * Variabel ML raw dari backend (field ``ml_variables`` di PredictionResponse).
 * Semua field optional karena mode mock/live mungkin tidak selalu mengisinya.
 */
export interface MLVariablesRaw {
  ghg_emission?: number | null;
  solar_radiation?: number | null;
  historical_deviation?: number | null;
  drought_probability?: number | null;
  model_confidence?: number | null;
  model_version?: string | null;
}

// ============================================================================
// Prediction
// ============================================================================

/**
 * Hasil prediksi cuaca + risiko + anomali untuk sebuah lokasi.
 * Endpoint: `POST /api/predict[?days=N]`.
 */
export interface PredictionResponse {
  location: LocationInfo;
  current: WeatherCurrent;
  /** Forecast harian (1..14 entri tergantung query `days`). */
  forecast: ForecastPoint[];
  risk_level: RiskLevel;
  anomaly: AnomalyType;
  /** Metadata sumber data: mode (mock/live), daftar sumber aktif. */
  data_source_info?: {
    mode: string;
    sources: string[];
  } | null;
  /**
   * Variabel ML yang diproses oleh pipeline prediksi.
   * Tersedia saat backend mengisi field ini (mock atau live).
   */
  ml_variables?: MLVariablesRaw | null;
}

// ============================================================================
// Pranata Mangsa
// ============================================================================

/** Informasi sebuah mangsa dalam Pranata Mangsa (kalender pertanian Jawa). */
export interface MangsaInfo {
  /** Nomor mangsa (1..12). */
  number: number;
  /** Nama mangsa (Kasa, Karo, ..., Sadha). */
  name: string;
  /** Tanggal mulai mangsa (format MM-DD). */
  period_start: string;
  /** Tanggal akhir mangsa (format MM-DD). */
  period_end: string;
  /** Durasi mangsa (hari). */
  duration_days: number;
  /** Musim umum: "kemarau" | "pancaroba" | "hujan" | "umum". */
  season: string;
  /** Deskripsi singkat mangsa. */
  description: string;
  /** Ciri-ciri alam pada mangsa ini. */
  characteristics: string[];
  /** Aktivitas pertanian yang direkomendasikan. */
  recommended_activities: string[];
  /** Aktivitas yang sebaiknya dihindari. */
  avoid_activities: string[];
}

// ============================================================================
// Recommendation
// ============================================================================

/**
 * Permintaan rekomendasi pertanian.
 * Endpoint: `POST /api/recommendation`.
 */
export interface RecommendationRequest {
  coordinates: Coordinate;
  /** Jenis tanaman (mis. "padi", "jagung"). */
  crop_type?: string | null;
  /** Tanggal tanam (ISO 8601 date YYYY-MM-DD). */
  planting_date?: string | null;
  /** Catatan bebas dari petani. */
  notes?: string | null;
}

/** Respons rekomendasi: cuaca + mangsa + LLM + crops. */
export interface RecommendationResponse {
  location: LocationInfo;
  current: WeatherCurrent;
  forecast: ForecastPoint[];
  mangsa: MangsaInfo;
  risk_level: RiskLevel;
  anomaly: AnomalyType;
  /** Daftar tindakan praktis siap pakai (action items). */
  recommendations: string[];
  /**
   * Tanaman yang direkomendasikan (≤10), prioritas hybrid mangsa
   * + anomali iklim. Field terstruktur — JANGAN merge ke teks
   * `recommendations` saat menampilkan; render terpisah sebagai chip/tag.
   */
  crops: string[];
  /** Saran cuaca naratif (1-2 kalimat). */
  weather_advice: string;
  /** Peringatan risiko relevan. */
  risk_warnings: string[];
  /** Ringkasan naratif Bahasa Jawa 80-120 kata. */
  summary?: string | null;
  /** Sapaan pembuka Jawa krama terkait mangsa aktif. */
  mangsa_greeting?: string;
  /** Peribahasa/ungkapan Jawa relevan dengan kondisi anomali. */
  traditional_proverb?: string;
  /**
   * ISO 8601 datetime saat rekomendasi dibuat. Selalu UTC dengan offset
   * eksplisit (`+00:00` / `Z`); aman di-pass ke `new Date(...)`.
   */
  generated_at: string;
  /**
   * Daftar sumber data aktif yang berkontribusi ke rekomendasi.
   * Contoh: ["Open-Meteo", "BMKG Klimatologis", "NASA POWER", ...].
   */
  data_sources?: string[];
  /** Probabilitas per kelas anomali dari ML ensemble. */
  ml_anomaly_probs?: Record<string, number> | null;
  /** Probabilitas per kelas risk dari ML ensemble. */
  ml_risk_probs?: Record<string, number> | null;
  /**
   * Variabel ML yang diproses pipeline prediksi.
   * Selaras dengan ``PredictionResponse.ml_variables`` — backend mengisi
   * keduanya secara bersamaan sehingga nilai selalu konsisten.
   */
  ml_variables?: MLVariablesRaw | null;
}

// ============================================================================
// Vulnerability (spatial risk grid)
// ============================================================================

/** Properti sebuah titik grid kerentanan. */
export interface VulnerabilityPointProps {
  risk_level: RiskLevel;
  anomaly_type: AnomalyType;
  risk_score: number;
  risk_color: string;
  anomaly_probs: Record<string, number>;
  risk_probs: Record<string, number>;
}

/** GeoJSON Feature untuk grid kerentanan. */
export interface VulnerabilityFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lon, lat]
  };
  properties: VulnerabilityPointProps;
}

/** Response GeoJSON FeatureCollection dari `GET /api/vulnerability/grid`. */
export interface VulnerabilityGrid {
  type: "FeatureCollection";
  features: VulnerabilityFeature[];
  metadata: {
    generated_date: string;
    grid_resolution_deg: number;
    total_points: number;
    ml_enabled: boolean;
    coverage: {
      lat_range: [number, number];
      lon_range: [number, number];
    };
  };
}

// ============================================================================
// Health & Meta
// ============================================================================

/** Respons `GET /health`. */
export interface HealthResponse {
  status: "healthy" | string;
  app: string;
  version: string;
  environment: string;
  llm_enabled: boolean;
  llm_model: string | null;
  ml_enabled?: boolean;
  ml_status?: string;
  data_sources?: string[];
  ml_models?: string[];
  /** ISO 8601 datetime UTC. */
  timestamp: string;
}

// ============================================================================
// Errors
// ============================================================================

/** 1 entri detail validasi pydantic (FastAPI 422). */
export interface ValidationErrorDetail {
  type: string;
  /** Path lokasi error, mis. ["body", "lat"]. */
  loc: (string | number)[];
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

/**
 * Body error JSON yang dikembalikan backend.
 *
 * Bisa berupa string (handler kustom AGROWTH) atau array detail
 * (validasi pydantic FastAPI).
 */
export interface ApiErrorBody {
  detail: string | ValidationErrorDetail[];
  /** Kode kustom AGROWTH: "value_error" | "not_found" | "internal_error". */
  code?: string;
}

/**
 * Error tersrukrut dari API client. Selalu di-throw oleh `lib/api.ts`
 * setelah interceptor menerjemahkan AxiosError.
 */
export class ApiError extends Error {
  /** HTTP status code (0 bila network/timeout). */
  public readonly status: number;
  /** Detail mentah dari response body. */
  public readonly detail: string | ValidationErrorDetail[];
  /** Kode kustom backend, mis. "value_error". */
  public readonly code?: string;
  /** ID korelasi server-side (`X-Request-ID`) bila ada. */
  public readonly requestId?: string;
  /** True kalau request gagal sebelum sampai ke server (network/timeout). */
  public readonly isNetworkError: boolean;

  constructor(params: {
    message: string;
    status: number;
    detail: string | ValidationErrorDetail[];
    code?: string;
    requestId?: string;
    isNetworkError?: boolean;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.detail = params.detail;
    this.code = params.code;
    this.requestId = params.requestId;
    this.isNetworkError = params.isNetworkError ?? false;
  }

  /** Pesan ramah-pengguna (flatten validation errors → 1 string). */
  public get friendlyMessage(): string {
    if (typeof this.detail === "string") return this.detail;
    if (Array.isArray(this.detail) && this.detail.length > 0) {
      return this.detail
        .map((d) => `${d.loc.join(".")}: ${d.msg}`)
        .join("; ");
    }
    return this.message;
  }
}
