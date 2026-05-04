/**
 * API client AGROWTH — Axios instance + typed wrapper functions.
 *
 * - `baseURL` dari env `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).
 * - Timeout 60 detik untuk seluruh request, configurable via
 *   `NEXT_PUBLIC_API_TIMEOUT_MS`.
 * - Header default `Accept: application/json`.
 * - Request interceptor menambah `X-Request-ID` (uuid) untuk tracing.
 * - Response interceptor menerjemahkan AxiosError → `ApiError` (lihat `types`).
 *
 * Wrapper yang di-export selaras 1:1 dengan endpoint backend FastAPI dan
 * TYPED penuh — semua return value sudah di-narrow dari `unknown` ke skema.
 */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import {
  ApiError,
  ApiErrorBody,
  Coordinate,
  HealthResponse,
  MangsaInfo,
  PredictionResponse,
  RecommendationRequest,
  RecommendationResponse,
  VulnerabilityGrid,
} from "@/types";
import { FORECAST_DAYS } from "@/lib/constants";

// ============================================================================
// Helper: generate request ID (12-char hex, kompat dengan middleware backend)
// ============================================================================

function genRequestId(): string {
  // Pakai crypto.randomUUID bila tersedia (browser modern + Node 19+).
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  // Fallback acak biasa.
  return Math.random().toString(36).slice(2, 14).padEnd(12, "0");
}

// ============================================================================
// Axios instance
// ============================================================================

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Timeout default (ms) untuk seluruh request. */
const DEFAULT_TIMEOUT_MS = 60_000;

function getTimeoutMs(): number {
  const rawTimeout = process.env.NEXT_PUBLIC_API_TIMEOUT_MS;
  if (!rawTimeout) return DEFAULT_TIMEOUT_MS;

  const parsedTimeout = Number(rawTimeout);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsedTimeout;
}

const REQUEST_TIMEOUT_MS = getTimeoutMs();

/**
 * Singleton Axios instance untuk seluruh app.
 * Pakai `apiClient` langsung kalau perlu config khusus (headers, signal, dll).
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// ----- Request interceptor: tambah X-Request-ID -----

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const headers = config.headers;
    if (headers && !headers.get?.("X-Request-ID")) {
      headers.set?.("X-Request-ID", genRequestId());
    }
    return config;
  },
);

// ----- Response interceptor: AxiosError → ApiError -----

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiErrorBody>): Promise<never> => {
    // Network / timeout / aborted: tidak ada response.
    if (!error.response) {
      const isTimeout = error.code === "ECONNABORTED";
      throw new ApiError({
        message: isTimeout
          ? `Request timeout setelah ${REQUEST_TIMEOUT_MS / 1000}s`
          : (error.message || "Network error: tidak bisa menghubungi server"),
        status: 0,
        detail: error.message ?? "network error",
        isNetworkError: true,
      });
    }

    const { status, data, headers } = error.response;
    const detail = data?.detail ?? error.message ?? "Unknown error";
    const code = data?.code;
    const requestId =
      typeof headers?.["x-request-id"] === "string"
        ? (headers["x-request-id"] as string)
        : undefined;

    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail.length > 0
          ? detail.map((d) => d.msg).join("; ")
          : `HTTP ${status}`;

    throw new ApiError({
      message,
      status,
      detail,
      code,
      requestId,
      isNetworkError: false,
    });
  },
);

// ============================================================================
// Typed wrappers
// ============================================================================

/**
 * `POST /api/predict[?days=N]` — prediksi cuaca + risiko + anomali.
 *
 * @param coords Koordinat target (harus dalam Pulau Jawa, lihat `JAVA_BOUNDS`).
 * @param days   Panjang forecast (1..14). Default 7.
 * @throws {ApiError} 422 bila koordinat di luar Jawa atau days di luar 1..14.
 */
export async function predictWeather(
  coords: Coordinate,
  days: number = FORECAST_DAYS.default,
): Promise<PredictionResponse> {
  const { data } = await apiClient.post<PredictionResponse>(
    "/api/predict",
    coords,
    { params: { days } },
  );
  return data;
}

/**
 * `POST /api/recommendation` — rekomendasi hybrid Mangsa + cuaca + LLM.
 *
 * @throws {ApiError} 422 bila koordinat di luar Pulau Jawa.
 */
export async function getRecommendation(
  request: RecommendationRequest,
): Promise<RecommendationResponse> {
  const { data } = await apiClient.post<RecommendationResponse>(
    "/api/recommendation",
    request,
  );
  return data;
}

/** `GET /api/mangsa/current` — mangsa aktif berdasarkan tanggal hari ini. */
export async function getCurrentMangsa(): Promise<MangsaInfo> {
  const { data } = await apiClient.get<MangsaInfo>("/api/mangsa/current");
  return data;
}

/** `GET /api/mangsa/all` — daftar lengkap 12 mangsa. */
export async function getAllMangsa(): Promise<MangsaInfo[]> {
  const { data } = await apiClient.get<MangsaInfo[]>("/api/mangsa/all");
  return data;
}

/**
 * `GET /api/mangsa/{id}` — detail mangsa berdasarkan id (1..12).
 * @throws {ApiError} 404 bila id di luar 1..12.
 */
export async function getMangsaById(id: number): Promise<MangsaInfo> {
  const { data } = await apiClient.get<MangsaInfo>(`/api/mangsa/${id}`);
  return data;
}

/**
 * `GET /api/mangsa/by-date?date=YYYY-MM-DD` — mangsa aktif untuk tanggal arbitrer.
 *
 * @param date `Date` object atau string ISO `YYYY-MM-DD`.
 * @throws {ApiError} 422 bila format tanggal salah.
 */
export async function getMangsaByDate(date: Date | string): Promise<MangsaInfo> {
  const iso =
    typeof date === "string" ? date : date.toISOString().slice(0, 10);
  const { data } = await apiClient.get<MangsaInfo>("/api/mangsa/by-date", {
    params: { date: iso },
  });
  return data;
}

/**
 * `GET /api/vulnerability/grid` -- grid kerentanan wilayah Pulau Jawa.
 *
 * @param resolution Grid resolution in degrees (0.25-1.0). Default 0.5.
 * @returns GeoJSON FeatureCollection dengan risk assessment per titik.
 */
export async function getVulnerabilityGrid(
  resolution: number = 0.5,
): Promise<VulnerabilityGrid> {
  const { data } = await apiClient.get<VulnerabilityGrid>(
    "/api/vulnerability/grid",
    { params: { resolution } },
  );
  return data;
}

/** `GET /health` -- health check + identitas app + status LLM + ML. */
export async function getHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>("/health");
  return data;
}
