/**
 * Zustand store untuk state dashboard AGROWTH.
 *
 * Mengelola:
 * - Koordinat terpilih (peta klik / form input)
 * - Hasil prediksi cuaca (PredictionResponse)
 * - Hasil rekomendasi hybrid (RecommendationResponse)
 * - Mangsa aktif hari ini (MangsaInfo)
 * - Flag loading per operasi async (weather + recommendation)
 * - Error terakhir (ApiError, harmonis dengan interceptor di lib/api.ts)
 *
 * Action ``setCoordinate`` adalah ENTRY UTAMA dari interaksi user — sekali
 * koordinat di-set, store memicu chain fetch (prediction + recommendation
 * paralel) sehingga komponen UI hanya perlu observe state, tidak perlu
 * orchestrate multiple panggilan.
 *
 * Devtools middleware aktif di development; setiap mutasi diberi label
 * action sehingga mudah diinspeksi via Redux DevTools extension.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import {
  getCurrentMangsa,
  getRecommendation,
  predictWeather,
} from "@/lib/api";
import { FORECAST_DAYS } from "@/lib/constants";
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
  /** Hasil terbaru `POST /api/predict`. */
  weatherData: PredictionResponse | null;
  /** Hasil terbaru `POST /api/recommendation`. */
  recommendationData: RecommendationResponse | null;
  /** Mangsa aktif berdasarkan tanggal hari ini. */
  currentMangsa: MangsaInfo | null;

  // ---------- Loading flags ----------
  isLoadingWeather: boolean;
  isLoadingRecommendation: boolean;

  // ---------- Error ----------
  /** Error terakhir dari operasi async manapun. ``null`` jika sehat. */
  error: ApiError | null;

  // ---------- Actions ----------
  /**
   * Set koordinat aktif lalu memicu chain fetch:
   * `predictWeather` + `getRecommendation` secara paralel.
   *
   * @param coord Koordinat baru (harus dalam Pulau Jawa per backend validator).
   * @param days  Panjang forecast (1..14, default 7).
   */
  setCoordinate: (coord: Coordinate, days?: number) => Promise<void>;

  /**
   * Refresh prediksi cuaca tanpa mengganti koordinat.
   * Pakai `coord` opsional untuk override; default pakai `selectedCoordinate`.
   */
  fetchPrediction: (coord?: Coordinate, days?: number) => Promise<void>;

  /**
   * Refresh rekomendasi tanpa mengganti koordinat.
   * Pakai `request` opsional untuk override penuh (mis. tambah crop_type,
   * planting_date, notes); default pakai `selectedCoordinate` saja.
   */
  fetchRecommendation: (request?: RecommendationRequest) => Promise<void>;

  /** Refresh mangsa aktif (idempotent). */
  fetchCurrentMangsa: () => Promise<void>;

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
  | "weatherData"
  | "recommendationData"
  | "currentMangsa"
  | "isLoadingWeather"
  | "isLoadingRecommendation"
  | "error"
> = {
  selectedCoordinate: null,
  weatherData: null,
  recommendationData: null,
  currentMangsa: null,
  isLoadingWeather: false,
  isLoadingRecommendation: false,
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
      setCoordinate: async (coord, days = FORECAST_DAYS.default) => {
        set(
          { selectedCoordinate: coord, error: null },
          false,
          "setCoordinate",
        );
        // Chain fetch paralel; biarkan masing-masing handle errornya sendiri.
        await Promise.all([
          get().fetchPrediction(coord, days),
          get().fetchRecommendation({ coordinates: coord }),
        ]);
      },

      // ---------- fetchPrediction ----------
      fetchPrediction: async (coord, days = FORECAST_DAYS.default) => {
        const target = coord ?? get().selectedCoordinate;
        if (!target) return;

        set({ isLoadingWeather: true }, false, "fetchPrediction:start");
        try {
          const data = await predictWeather(target, days);
          set(
            { weatherData: data, isLoadingWeather: false, error: null },
            false,
            "fetchPrediction:success",
          );
        } catch (err) {
          set(
            { error: toApiError(err), isLoadingWeather: false },
            false,
            "fetchPrediction:error",
          );
        }
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
        } catch (err) {
          set(
            { error: toApiError(err), isLoadingRecommendation: false },
            false,
            "fetchRecommendation:error",
          );
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
          set(
            { error: toApiError(err) },
            false,
            "fetchCurrentMangsa:error",
          );
        }
      },

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

/** Subset selector aman untuk komponen yang hanya butuh data weather. */
export const useWeatherData = () =>
  useAgrowthStore((state) => state.weatherData);

/** Subset selector untuk recommendation. */
export const useRecommendationData = () =>
  useAgrowthStore((state) => state.recommendationData);

/** Subset selector untuk mangsa aktif. */
export const useCurrentMangsa = () =>
  useAgrowthStore((state) => state.currentMangsa);

/** Gabungan loading flag (true bila salah satu sedang in-flight). */
export const useIsAnyLoading = () =>
  useAgrowthStore(
    (state) => state.isLoadingWeather || state.isLoadingRecommendation,
  );

/** Subset selector untuk error terakhir. */
export const useStoreError = () => useAgrowthStore((state) => state.error);
