export type SeasonalView = "7d" | "30d" | "3m";

export interface SeasonalDataPoint {
  date: string;
  label: string;
  baseline_rainfall: number;
  predicted_rainfall: number;
  deviation: number;
  confidence_upper: number;
  confidence_lower: number;
  std_error: number;
  spanDays: number;
}

export interface PlantingWindow {
  start: string;
  end: string;
  confidence: number;
}

type RainfallRegion = "north_coast" | "central_java" | "south_coast" | "east_java";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export const JAVA_RAINFALL_BASELINE: Readonly<Record<RainfallRegion, number[]>> = {
  north_coast: [170, 155, 135, 110, 85, 60, 35, 30, 45, 95, 145, 180],
  central_java: [240, 220, 190, 155, 120, 90, 60, 55, 75, 135, 205, 255],
  south_coast: [310, 290, 255, 215, 175, 135, 105, 95, 120, 190, 270, 325],
  east_java: [150, 140, 120, 95, 70, 50, 30, 28, 42, 82, 125, 155],
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pseudo(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 43758.5453123;
  return x - Math.floor(x);
}

function hashCoordinate(lat: number, lon: number): number {
  return Math.abs(Math.round(lat * 1000) * 1000 + Math.round(lon * 1000));
}

function getRainfallRegion(lat: number, lon: number): RainfallRegion {
  if (lon > 112.5 && lat < -7.2) return "east_java";
  if (lat < -7.6) return "south_coast";
  if (lat > -6.5) return "north_coast";
  return "central_java";
}

function formatDayLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT[date.getMonth()] ?? "";
  return `${day} ${month}`;
}

function monthBaseline(region: RainfallRegion, monthIndex: number): number {
  return JAVA_RAINFALL_BASELINE[region][monthIndex] ?? JAVA_RAINFALL_BASELINE.central_java[monthIndex] ?? 0;
}

function buildBaselineRainfall(
  region: RainfallRegion,
  monthIndex: number,
  seed: number,
  pointIndex: number,
  spanDays: number,
): number {
  const monthlyNormal = monthBaseline(region, monthIndex);
  const seasonalPhase = (monthIndex / 12) * Math.PI * 2 - Math.PI / 6;
  const seasonalWave = Math.sin(seasonalPhase + pointIndex / 11) * 0.16;
  const dailyEquivalent = monthlyNormal / 30;
  const adjusted = dailyEquivalent * (1 + seasonalWave);
  const jitter = (pseudo(seed, pointIndex + 1) - 0.5) * (spanDays === 3 ? 2.4 : 1.4);
  return clamp(adjusted * spanDays + jitter * spanDays, 0, 420);
}

export function generateSeasonalData(
  lat: number,
  lon: number,
  view: SeasonalView,
  startDate: Date = new Date(),
): SeasonalDataPoint[] {
  const seed = hashCoordinate(lat, lon);
  const region = getRainfallRegion(lat, lon);
  const count = view === "3m" ? 90 : view === "30d" ? 30 : 7;
  const spanDays = view === "3m" ? 3 : 1;
  const data: SeasonalDataPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    const monthIndex = date.getMonth();
    const baselineRainfall = buildBaselineRainfall(region, monthIndex, seed, index, spanDays);
    const anomalyWave = Math.sin((index / 9) + seed / 10_000) * (view === "3m" ? 7.5 : 5.5);
    const directionalBias = (pseudo(seed, index + 7) - 0.5) * (view === "3m" ? 14 : 10);
    const trendBias = view === "3m"
      ? Math.sin(index / 18 + seed / 5_000) * 9
      : Math.sin(index / 8 + seed / 5_000) * 5;
    const predictedRainfall = clamp(baselineRainfall + anomalyWave + directionalBias + trendBias, 0, 420);
    const stdError = clamp(baselineRainfall * (view === "3m" ? 0.11 : 0.08) + spanDays * 1.4, 3, 30);
    const deviation = predictedRainfall - baselineRainfall;

    data.push({
      date: date.toISOString(),
      label: formatDayLabel(date),
      baseline_rainfall: Number(baselineRainfall.toFixed(1)),
      predicted_rainfall: Number(predictedRainfall.toFixed(1)),
      deviation: Number(deviation.toFixed(1)),
      confidence_upper: Number((predictedRainfall + 1.96 * stdError).toFixed(1)),
      confidence_lower: Number(Math.max(0, predictedRainfall - 1.96 * stdError).toFixed(1)),
      std_error: Number(stdError.toFixed(1)),
      spanDays,
    });
  }

  return data;
}

export function getOptimalPlantingWindows(data: SeasonalDataPoint[]): PlantingWindow[] {
  if (data.length === 0) return [];

  const idealMin = 80;
  const idealMax = 150;
  const midpoint = (idealMin + idealMax) / 2;
  const halfRange = (idealMax - idealMin) / 2;

  const scores = data.map((point) => {
    const monthlyEquivalent = point.predicted_rainfall * (30 / Math.max(1, point.spanDays));
    const distance = Math.abs(monthlyEquivalent - midpoint);
    const score = clamp(1 - distance / (halfRange * 1.15), 0, 1);
    return { ...point, monthlyEquivalent, score };
  });

  const firstScore = scores[0]!;
  const lastScore = scores[scores.length - 1]!;

  const peaks = scores
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => {
      const prev = scores[index - 1]?.score ?? -1;
      const next = scores[index + 1]?.score ?? -1;
      return point.score > 0.32 && point.score >= prev && point.score >= next;
    })
    .sort((a, b) => b.point.score - a.point.score)
    .slice(0, 5);

  const windows: Array<{ startIndex: number; endIndex: number; confidence: number }> = [];

  const overlaps = (startIndex: number, endIndex: number) =>
    windows.some((window) => !(endIndex < window.startIndex || startIndex > window.endIndex));

  for (const { index, point } of peaks) {
    let startIndex = index;
    let endIndex = index;

    while (startIndex > 0 && (scores[startIndex - 1]?.score ?? 0) > 0.24) {
      startIndex -= 1;
    }
    while (endIndex < scores.length - 1 && (scores[endIndex + 1]?.score ?? 0) > 0.24) {
      endIndex += 1;
    }

    if (overlaps(startIndex, endIndex)) continue;

    const segment = scores.slice(startIndex, endIndex + 1);
    const averageScore = segment.reduce((sum, item) => sum + item.score, 0) / segment.length;
    const confidence = clamp((averageScore * 0.72 + Math.min(segment.length / 10, 0.28)) * 100, 42, 96);
    windows.push({ startIndex, endIndex, confidence: Number(confidence.toFixed(0)) });
  }

  if (windows.length === 0) {
    const best = scores.slice(1).reduce(
      (winner, candidate) => (candidate.score > winner.score ? candidate : winner),
      firstScore,
    );
    const startIndex = Math.max(0, scores.indexOf(best) - 1);
    const endIndex = Math.min(scores.length - 1, startIndex + 2);
    windows.push({ startIndex, endIndex, confidence: 58 });
  }

  return windows
    .slice(0, 3)
    .map((window) => ({
      start: scores[window.startIndex]?.label ?? firstScore.label,
      end: scores[window.endIndex]?.label ?? lastScore.label,
      confidence: window.confidence,
    }));
}

export function getSeasonalVerdict(avgDeviation: number): string {
  if (avgDeviation > 20) {
    return "Proyeksi di atas normal — waspadai risiko banjir musiman";
  }
  if (avgDeviation < -20) {
    return "Proyeksi di bawah normal — indikasi musim kering diperpanjang";
  }
  return "Proyeksi mendekati normal — Pranata Mangsa berlaku";
}