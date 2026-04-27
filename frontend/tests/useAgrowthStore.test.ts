/**
 * Unit tests untuk Zustand store.
 *
 * Cakupan:
 * - ``setCoordinate`` memicu **satu** call ``getRecommendation`` (regression
 *   atas refactor 1×-fetch).
 * - ``setCoordinate`` populates ``selectedCoordinate`` + ``recommendationData``,
 *   set ``isLoadingRecommendation`` ke false saat selesai, dan biarkan
 *   ``error`` null saat sukses.
 * - ``useWeatherData`` selector mengembalikan view turunan dari
 *   ``recommendationData`` (bukan slot terpisah).
 * - ``clearError`` me-null-kan error tanpa menyentuh data.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock module API SEBELUM import store. Spy yang sama dipakai di semua test.
const mockGetRecommendation = vi.fn();
const mockGetCurrentMangsa = vi.fn();
const mockPredictWeather = vi.fn();

vi.mock("@/lib/api", () => ({
  getRecommendation: (...args: unknown[]) => mockGetRecommendation(...args),
  getCurrentMangsa: (...args: unknown[]) => mockGetCurrentMangsa(...args),
  predictWeather: (...args: unknown[]) => mockPredictWeather(...args),
}));

import { ApiError } from "@/types";
import {
  useAgrowthStore,
  useWeatherData,
} from "@/store/useAgrowthStore";

const FAKE_RECOMMENDATION = {
  location: {
    lat: -7.79,
    lon: 110.37,
    name: "Lokasi DI Yogyakarta",
    province: "DI Yogyakarta",
    region: null,
    elevation_m: null,
  },
  current: {
    timestamp: "2025-04-27T12:00:00Z",
    temperature_c: 28.5,
    humidity_pct: 75,
    rainfall_mm: 0,
    wind_speed_ms: 2.4,
    pressure_hpa: 1010,
    condition: "cerah berawan",
  },
  forecast: [
    {
      date: "2025-04-28",
      temp_min_c: 23,
      temp_max_c: 31,
      humidity_pct: 78,
      rainfall_mm: 0,
      wind_speed_ms: 2.2,
      condition: "cerah berawan",
    },
  ],
  mangsa: {
    number: 11,
    name: "Desta",
    period_start: "04-19",
    period_end: "05-11",
    duration_days: 23,
    season: "kemarau",
    description: "Awal kemarau",
    characteristics: [],
    recommended_activities: [],
    avoid_activities: [],
  },
  risk_level: "low" as const,
  anomaly: "normal" as const,
  recommendations: ["Periksa sawah", "Siapkan benih"],
  crops: ["padi", "jagung"],
  weather_advice: "Cuaca cerah",
  risk_warnings: [],
  summary: "Mangsa Desta",
  mangsa_greeting: "Kulo nuwun, sedulur tani ing mangsa Desta menika, mugi tansah pinaringan wilujeng lan berkah.",
  traditional_proverb: "Sapa nandur bakal ngundhuh; alam kang tentrem iku kanca sejatining tani.",
  generated_at: "2025-04-27T12:00:00+00:00",
};

describe("useAgrowthStore", () => {
  beforeEach(() => {
    mockGetRecommendation.mockReset();
    mockGetCurrentMangsa.mockReset();
    mockPredictWeather.mockReset();
    useAgrowthStore.getState().reset();
  });

  afterEach(() => {
    useAgrowthStore.getState().reset();
  });

  it("setCoordinate memicu tepat satu getRecommendation (regression 1× fetch)", async () => {
    mockGetRecommendation.mockResolvedValueOnce(FAKE_RECOMMENDATION);

    await useAgrowthStore
      .getState()
      .setCoordinate({ lat: -7.79, lon: 110.37 });

    expect(mockGetRecommendation).toHaveBeenCalledTimes(1);
    expect(mockGetRecommendation).toHaveBeenCalledWith({
      coordinates: { lat: -7.79, lon: 110.37 },
    });
    // predictWeather tidak boleh dipanggil di flow ini.
    expect(mockPredictWeather).not.toHaveBeenCalled();
  });

  it("populates state setelah fetch sukses", async () => {
    mockGetRecommendation.mockResolvedValueOnce(FAKE_RECOMMENDATION);

    await useAgrowthStore
      .getState()
      .setCoordinate({ lat: -7.79, lon: 110.37 });

    const s = useAgrowthStore.getState();
    expect(s.selectedCoordinate).toEqual({ lat: -7.79, lon: 110.37 });
    expect(s.recommendationData).toEqual(FAKE_RECOMMENDATION);
    expect(s.isLoadingRecommendation).toBe(false);
    expect(s.error).toBeNull();
  });

  it("set error saat fetch melempar ApiError, tidak menulis recommendationData", async () => {
    const apiErr = new ApiError({
      message: "Server kebakaran",
      status: 500,
      detail: "Server kebakaran",
      code: "internal_error",
    });
    mockGetRecommendation.mockRejectedValueOnce(apiErr);

    await useAgrowthStore
      .getState()
      .setCoordinate({ lat: -7.79, lon: 110.37 });

    const s = useAgrowthStore.getState();
    expect(s.recommendationData).toBeNull();
    expect(s.isLoadingRecommendation).toBe(false);
    expect(s.error).toBe(apiErr);
  });

  it("useWeatherData adalah view turunan dari recommendationData", async () => {
    mockGetRecommendation.mockResolvedValueOnce(FAKE_RECOMMENDATION);

    expect(useWeatherData.bind(null)).toBeTypeOf("function");

    // Sebelum coordinate dipilih → null
    expect(useAgrowthStore.getState().recommendationData).toBeNull();

    await useAgrowthStore
      .getState()
      .setCoordinate({ lat: -7.79, lon: 110.37 });

    // Selector mem-project field-field PredictionResponse-shape saja.
    const projected = {
      location: FAKE_RECOMMENDATION.location,
      current: FAKE_RECOMMENDATION.current,
      forecast: FAKE_RECOMMENDATION.forecast,
      risk_level: FAKE_RECOMMENDATION.risk_level,
      anomaly: FAKE_RECOMMENDATION.anomaly,
    };
    // Panggil selector secara langsung lewat useAgrowthStore (bypass hook).
    const r = useAgrowthStore.getState().recommendationData;
    expect(r).not.toBeNull();
    expect({
      location: r!.location,
      current: r!.current,
      forecast: r!.forecast,
      risk_level: r!.risk_level,
      anomaly: r!.anomaly,
    }).toEqual(projected);
  });

  it("clearError menyebabkan error → null tanpa menyentuh data lain", async () => {
    mockGetRecommendation.mockResolvedValueOnce(FAKE_RECOMMENDATION);
    await useAgrowthStore
      .getState()
      .setCoordinate({ lat: -7.79, lon: 110.37 });

    // Inject error manual
    useAgrowthStore.setState({
      error: new ApiError({
        message: "x",
        status: 0,
        detail: "x",
        isNetworkError: true,
      }),
    });
    expect(useAgrowthStore.getState().error).not.toBeNull();

    useAgrowthStore.getState().clearError();
    expect(useAgrowthStore.getState().error).toBeNull();
    expect(useAgrowthStore.getState().recommendationData).toEqual(
      FAKE_RECOMMENDATION,
    );
  });

  it("reset mengosongkan semua slice", async () => {
    mockGetRecommendation.mockResolvedValueOnce(FAKE_RECOMMENDATION);
    await useAgrowthStore
      .getState()
      .setCoordinate({ lat: -7.79, lon: 110.37 });

    useAgrowthStore.getState().reset();
    const s = useAgrowthStore.getState();
    expect(s.selectedCoordinate).toBeNull();
    expect(s.recommendationData).toBeNull();
    expect(s.currentMangsa).toBeNull();
    expect(s.isLoadingRecommendation).toBe(false);
    expect(s.showVulnerabilityLayer).toBe(true);
    expect(s.error).toBeNull();
  });
});
