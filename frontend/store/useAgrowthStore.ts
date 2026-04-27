/**
 * Zustand store untuk state dashboard AGROWTH.
 *
 * Mengelola:
 * - Koordinat terpilih (peta klik / form input)
 * - Hasil rekomendasi hybrid (RecommendationResponse) — sumber kebenaran
 *   tunggal untuk cuaca + mangsa + risk + anomaly + LLM narrative
 * - Mangsa aktif hari ini (MangsaInfo) — independen, untuk Header pill
 * - Flag loading recommendation
 * - Error terakhir (ApiError, harmonis dengan interceptor di lib/api.ts)
 *
 * Arsitektur:
 * - ``setCoordinate`` adalah ENTRY UTAMA dari interaksi user. Sekali
 *   koordinat di-set, store memicu **satu** fetch ke
 *   ``POST /api/recommendation`` yang sudah berisi prediction +
 *   recommendation dalam satu round-trip. ``predictWeather`` di-eksport
 *   tetap tersedia untuk konsumen yang butuh prediksi tanpa LLM, tetapi
 *   tidak dipanggil otomatis di sini.
 * - Selector ``useWeatherData`` adalah view turunan dari
 *   ``recommendationData`` (current + forecast + risk_level + anomaly +
 *   location di-bungkus jadi ``PredictionResponse``-shape) supaya
 *   konsumen lama tetap kompatibel.
 *
 * Devtools middleware aktif di development; setiap mutasi diberi label
 * action sehingga mudah diinspeksi via Redux DevTools extension.
 */
import { toast } from "sonner";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

import { getCurrentMangsa, getRecommendation } from "@/lib/api";
import {
  ApiError,
  type Coordinate,
  type MangsaInfo,
  type PredictionResponse,
  type RecommendationRequest,
  type RecommendationResponse,
} from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface AgrowthState {
  // ---------- Data ----------
  /** Koordinat aktif yang dipilih user. ``null`` = belum memilih. */
  selectedCoordinate: Coordinate | null;
  /** Hasil terbaru `POST /api/recommendation` (cuaca + mangsa + LLM). */
  recommendationData: RecommendationResponse | null;
  /** Mangsa aktif berdasarkan tanggal hari ini (untuk Header pill). */
  currentMangsa: MangsaInfo | null;

  // ---------- Loading flags ----------
  /** True saat fetch ``POST /api/recommendation`` in-flight. */
  isLoadingRecommendation: boolean;

  // ---------- Map UI ----------
  /** Tampilkan vulnerability heatmap layer di peta. */
  showVulnerabilityLayer: boolean;

  // ---------- Error ----------
  /** Error terakhir dari operasi async manapun. ``null`` jika sehat. */
  error: ApiError | null;

  // ---------- Actions ----------
  /**
   * Set koordinat aktif dan fetch rekomendasi (cuaca + mangsa + LLM)
   * dalam SATU round-trip ke backend.
   *
   * Berbeda dari versi sebelumnya, action ini tidak lagi memicu
   * ``predictWeather`` paralel — ``recommendationData`` sudah berisi
   * semua field yang dibutuhkan UI.
   *
   * @param coord Koordinat baru (harus dalam Pulau Jawa per backend validator).
   */
  setCoordinate: (coord: Coordinate) => Promise<void>;

  /**
   * Refresh rekomendasi tanpa mengganti koordinat.
   * Pakai `request` opsional untuk override penuh (mis. tambah crop_type,
   * planting_date, notes); default pakai `selectedCoordinate` saja.
   */
  fetchRecommendation: (request?: RecommendationRequest) => Promise<void>;

  /** Refresh mangsa aktif (idempotent). */
  fetchCurrentMangsa: () => Promise<void>;

  /** Toggle visibility vulnerability heatmap layer. */
  toggleVulnerabilityLayer: () => void;

  /** Hapus error tanpa mengubah data. */
  clearError: () => void;

  /** Reset seluruh state ke nilai awal. */
  reset: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Bungkus error dari panggilan API ke `ApiError`. Menjaga kontrak store
 * walaupun fungsi non-axios lain ikut throw (mis. `globalThis.fetch`).
 */
function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError({
    message: err instanceof Error ? err.message : "Unknown error",
    status: 0,
    detail: err instanceof Error ? err.message : "unknown",
    isNetworkError: true,
  });
}

const INITIAL_STATE: Pick<
  AgrowthState,
  | "selectedCoordinate"
  | "recommendationData"
  | "currentMangsa"
  | "isLoadingRecommendation"
  | "showVulnerabilityLayer"
  | "error"
> = {
  selectedCoordinate: null,
  recommendationData: null,
  currentMangsa: null,
  isLoadingRecommendation: false,
  showVulnerabilityLayer: true,
  error: null,
};

// ============================================================================
// Store
// ============================================================================

export const useAgrowthStore = create<AgrowthState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      // ---------- setCoordinate (entry utama) ----------
      setCoordinate: async (coord) => {
        set(
          { selectedCoordinate: coord, error: null },
          false,
          "setCoordinate",
        );
        await get().fetchRecommendation({ coordinates: coord });
      },

      // ---------- fetchRecommendation ----------
      fetchRecommendation: async (request) => {
        const coord = get().selectedCoordinate;
        const finalRequest: RecommendationRequest | null =
          request ?? (coord ? { coordinates: coord } : null);
        if (!finalRequest) return;

        set(
          { isLoadingRecommendation: true },
          false,
          "fetchRecommendation:start",
        );
        try {
          const data = await getRecommendation(finalRequest);
          set(
            {
              recommendationData: data,
              isLoadingRecommendation: false,
              error: null,
            },
            false,
            "fetchRecommendation:success",
          );

          // Toast success singkat — tampilkan region untuk konteks.
          // ID stabil supaya cache hit / re-fetch cepat tidak menumpuk
          // toast (sonner replace by id).
          const region =
            data.location.province ??
            data.location.name ??
            "lokasi terpilih";
          toast.success(`Rekomendasi siap · ${region}`, {
            id: "recommendation-success",
            duration: 2200,
          });
        } catch (err) {
          const apiErr = toApiError(err);
          set(
            { error: apiErr, isLoadingRecommendation: false },
            false,
            "fetchRecommendation:error",
          );

          // Toast error: title singkat + description detail.
          // ID konsisten supaya retry cepat menggantikan toast lama,
          // bukan menumpuk.
          toast.error("Gagal memuat rekomendasi", {
            id: "recommendation-error",
            description: apiErr.friendlyMessage,
          });
        }
      },

      // ---------- fetchCurrentMangsa ----------
      fetchCurrentMangsa: async () => {
        try {
          const data = await getCurrentMangsa();
          set(
            { currentMangsa: data, error: null },
            false,
            "fetchCurrentMangsa:success",
          );
        } catch (err) {
          const apiErr = toApiError(err);
          set(
            { error: apiErr },
            false,
            "fetchCurrentMangsa:error",
          );

          // Mangsa fetch fail tidak memutus alur user (bukan blocking),
          // jadi toast lebih ringan + auto-dismiss biasa.
          toast.error("Gagal memuat mangsa aktif", {
            id: "mangsa-error",
            description: apiErr.friendlyMessage,
          });
        }
      },

      // ---------- toggleVulnerabilityLayer ----------
      toggleVulnerabilityLayer: () =>
        set(
          (s) => ({ showVulnerabilityLayer: !s.showVulnerabilityLayer }),
          false,
          "toggleVulnerabilityLayer",
        ),

      // ---------- clearError ----------
      clearError: () => set({ error: null }, false, "clearError"),

      // ---------- reset ----------
      reset: () => set(INITIAL_STATE, false, "reset"),
    }),
    {
      name: "AgrowthStore",
      enabled: process.env.NODE_ENV !== "production",
    },
  ),
);

// ============================================================================
// Selector hooks (opsional, agar konsumen lebih granular & re-render minimal)
// ============================================================================

/**
 * Subset selector untuk konsumen yang hanya butuh ``PredictionResponse``-
 * shape (cuaca + forecast + risk + anomaly + location). Diturunkan dari
 * ``recommendationData`` sehingga 1 fetch dipakai bersama; ``null`` saat
 * belum ada koordinat dipilih.
 */
export const useWeatherData = (): PredictionResponse | null =>
  useAgrowthStore(
    useShallow((state) => {
      const r = state.recommendationData;
      if (r === null) return null;
      return {
        location: r.location,
        current: r.current,
        forecast: r.forecast,
        risk_level: r.risk_level,
        anomaly: r.anomaly,
      };
    }),
  );

/** Subset selector untuk recommendation (full bundle). */
export const useRecommendationData = () =>
  useAgrowthStore((state) => state.recommendationData);

/** Subset selector untuk mangsa aktif. */
export const useCurrentMangsa = () =>
  useAgrowthStore((state) => state.currentMangsa);

/** Loading flag rekomendasi (chain fetch tunggal). */
export const useIsLoading = () =>
  useAgrowthStore((state) => state.isLoadingRecommendation);

/** Subset selector untuk error terakhir. */
export const useStoreError = () => useAgrowthStore((state) => state.error);
