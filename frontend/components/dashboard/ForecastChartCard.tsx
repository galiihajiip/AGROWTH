"use client";

/**
 * Line chart prakiraan 7 hari (recharts) dengan dual Y-axis
 * suhu+hujan dan highlight anomaly merah per hari.
 *
 * Visual:
 * - Garis emerald (solid)  → suhu rata-rata harian (°C, axis kiri)
 * - Garis biru     (dashed)→ curah hujan (mm, axis kanan)
 * - Dot merah dengan ring putih pada hari yang ``anomaly_score > 0.5``
 *   (mirror logika backend ``_anomaly_score`` di ``weather_mock.py``).
 *
 * Tooltip kustom: glassmorphism (``border + bg-glass-dark + backdrop-blur``)
 * yang menampilkan tanggal, dua nilai metrik, dan status "Anomali tinggi"
 * bila hari tersebut critical.
 *
 * Data source:
 * - ``recommendationData.forecast`` (1..14 ``ForecastPoint``).
 * - ``temperature`` mean diturunkan dari ``(temp_min_c + temp_max_c) / 2``
 *   karena backend ``ForecastPoint`` tidak mengekspos ``temp_mean_c``.
 *
 * Anomaly score derivation:
 * Backend menghitung skor per hari di ``generate_forecast`` lalu hanya
 * meng-export ``risk_level`` agregat. Helper :func:`dailyAnomalyScore`
 * di sini me-replikasi formula skor (heatwave + flood + wind boost +
 * drought) sehingga UI bisa flag tiap hari secara independen tanpa
 * perubahan API.
 *
 * State:
 * - Loading (``isLoadingRecommendation`` || coordinate dipilih tapi data
 *   belum ada): shimmer chart skeleton (7 bar tinggi bervariasi + axis
 *   placeholder).
 * - Empty (belum ada koordinat): teks ringan "Pilih lokasi…".
 * - Loaded: chart penuh dengan animasi line drawing (recharts internal
 *   ``animationDuration``).
 */
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { ForecastPoint } from "@/types";

// ============================================================================
// Tokens
// ============================================================================

const TEMP_COLOR = "#10b981"; // agrowth-500
const RAIN_COLOR = "#3b82f6"; // blue-500
const ANOMALY_COLOR = "#ef4444"; // danger-500
const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const AXIS_COLOR = "rgba(255, 255, 255, 0.4)";
const TICK_COLOR = "rgba(255, 255, 255, 0.55)";

// ============================================================================
// Anomaly score (mirror app/services/weather_mock.py::_anomaly_score)
// ============================================================================

/**
 * Score 0..1 berdasarkan threshold suhu/hujan/angin per hari.
 *
 * Threshold harus selaras dengan backend supaya badge anomali frontend
 * tidak bertentangan dengan ``risk_level``/``anomaly`` agregat dari
 * backend. Lihat ``backend/app/services/weather_mock.py``.
 */
function dailyAnomalyScore(p: ForecastPoint): number {
  const meanTemp = (p.temp_max_c + p.temp_min_c) / 2;
  const rain = p.rainfall_mm;
  const wind = p.wind_speed_ms;

  let score = 0;

  // Heatwave threshold
  if (meanTemp >= 35.0) score += 0.45;
  else if (meanTemp >= 33.0) score += 0.25;
  else if (meanTemp >= 31.0) score += 0.1;

  // Flood threshold
  if (rain >= 80.0) score += 0.5;
  else if (rain >= 50.0) score += 0.3;
  else if (rain >= 30.0) score += 0.15;

  // Wind boost saat badai
  if (wind >= 12.0) score += 0.1;
  else if (wind >= 8.0) score += 0.05;

  // Drought (kering + panas)
  if (rain < 0.5 && meanTemp >= 30.0) score += 0.2;
  if (rain < 0.5 && meanTemp >= 32.0) score += 0.2;

  return Math.min(1.0, score);
}

// ============================================================================
// Date formatter ISO → DD/MM
// ============================================================================

function formatDateDdMm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

// ============================================================================
// Chart point shape
// ============================================================================

interface ChartPoint {
  /** Label untuk X-axis (DD/MM). */
  date: string;
  /** Suhu rata-rata harian (°C). */
  temperature: number;
  /** Curah hujan (mm). */
  rainfall: number;
  /** True bila skor anomali > 0.5 (= "critical band" backend). */
  isAnomaly: boolean;
}

// ============================================================================
// Custom tooltip — glassmorphism
// ============================================================================

interface TooltipPayloadEntry {
  name?: string;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: ChartPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;

  return (
    <div
      className={cn(
        "rounded-xl border border-glass-border bg-glass-dark backdrop-blur-xl",
        "px-3 py-2 shadow-glass",
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex flex-col gap-0.5 text-xs">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground">
              {entry.name}
              {": "}
              <span className="font-semibold tabular-nums">
                {typeof entry.value === "number"
                  ? entry.value.toFixed(1)
                  : entry.value}
              </span>
              <span className="ml-0.5 text-muted-foreground">
                {entry.dataKey === "temperature" ? "°C" : "mm"}
              </span>
            </span>
          </div>
        ))}
        {point?.isAnomaly ? (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-danger-400">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-danger-400"
            />
            Anomali tinggi
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Custom dot — render hanya saat ``isAnomaly``, dengan ring putih merah
// ============================================================================

interface AnomalyDotProps {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}

function AnomalyDot({ cx, cy, payload }: AnomalyDotProps) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    !payload?.isAnomaly
  ) {
    // Recharts perlu komponen valid; <g/> kosong = invisible.
    return <g />;
  }
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={ANOMALY_COLOR}
        fillOpacity={0.15}
      />
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={ANOMALY_COLOR}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </g>
  );
}

// ============================================================================
// Loading skeleton
// ============================================================================

function ChartSkeleton() {
  // Tinggi bar deterministik (pseudo-data) supaya layout tidak
  // hydration-mismatch & terlihat seperti chart sungguhan.
  const heights = [40, 70, 55, 80, 45, 65, 50] as const;
  return (
    <div
      className="relative flex flex-1 flex-col gap-2 px-1 py-2"
      aria-busy="true"
    >
      <div className="flex flex-1 items-end gap-1.5 px-2">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-glass"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-1.5 px-2">
        {heights.map((_, i) => (
          <div key={i} className="h-2 w-6 rounded bg-glass" />
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-shimmer bg-[length:200%_100%] animate-shimmer mix-blend-screen opacity-70"
      />
    </div>
  );
}

// ============================================================================
// Public component
// ============================================================================

export interface ForecastChartCardProps {
  className?: string;
  /** Override grid placement; default ``{ col: 7, row: 2 }``. */
  span?: BentoCardSpan;
}

export function ForecastChartCard({ className, span }: ForecastChartCardProps) {
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const isLoading = useAgrowthStore((s) => s.isLoadingRecommendation);
  const hasCoordinate = useAgrowthStore(
    (s) => s.selectedCoordinate !== null,
  );

  const showSkeleton =
    isLoading || (recommendation === null && hasCoordinate);
  const showEmpty =
    !isLoading && recommendation === null && !hasCoordinate;

  const data: ChartPoint[] = recommendation
    ? recommendation.forecast.map((p) => ({
        date: formatDateDdMm(p.date),
        temperature: Number(
          ((p.temp_max_c + p.temp_min_c) / 2).toFixed(1),
        ),
        rainfall: Number(p.rainfall_mm.toFixed(1)),
        isAnomaly: dailyAnomalyScore(p) > 0.5,
      }))
    : [];

  const anomalyCount = data.filter((d) => d.isAnomaly).length;

  const subtitle = recommendation
    ? anomalyCount > 0
      ? `${data.length} hari · ${anomalyCount} anomali`
      : `${data.length} hari · semua stabil`
    : isLoading || hasCoordinate
      ? "Memuat prakiraan…"
      : "Belum ada lokasi";

  return (
    <BentoCard
      title="Prakiraan 7 Hari"
      subtitle={subtitle}
      icon={TrendingUp}
      glow="emerald"
      span={span ?? { col: 7, row: 2 }}
      className={className}
    >
      <div className="w-full" style={{ height: 240 }}>
        {showSkeleton ? (
          <ChartSkeleton />
        ) : showEmpty ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
            Pilih lokasi untuk melihat prakiraan.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                stroke={GRID_COLOR}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke={AXIS_COLOR}
                tick={{ fill: TICK_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: AXIS_COLOR }}
              />
              <YAxis
                yAxisId="temp"
                orientation="left"
                stroke={TEMP_COLOR}
                tick={{ fill: TICK_COLOR, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                width={36}
                label={{
                  value: "°C",
                  position: "insideTopLeft",
                  offset: 8,
                  style: {
                    fill: TEMP_COLOR,
                    fontSize: 10,
                    fontWeight: 600,
                  },
                }}
              />
              <YAxis
                yAxisId="rain"
                orientation="right"
                stroke={RAIN_COLOR}
                tick={{ fill: TICK_COLOR, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                width={36}
                label={{
                  value: "mm",
                  position: "insideTopRight",
                  offset: 8,
                  style: {
                    fill: RAIN_COLOR,
                    fontSize: 10,
                    fontWeight: 600,
                  },
                }}
              />
              <Tooltip
                cursor={{
                  stroke: "rgba(255, 255, 255, 0.12)",
                  strokeWidth: 1,
                }}
                content={<CustomTooltip />}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Suhu"
                stroke={TEMP_COLOR}
                strokeWidth={2}
                dot={<AnomalyDot />}
                activeDot={{
                  r: 5,
                  fill: TEMP_COLOR,
                  stroke: "#ffffff",
                  strokeWidth: 1,
                }}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="rain"
                type="monotone"
                dataKey="rainfall"
                name="Hujan"
                stroke={RAIN_COLOR}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={<AnomalyDot />}
                activeDot={{
                  r: 5,
                  fill: RAIN_COLOR,
                  stroke: "#ffffff",
                  strokeWidth: 1,
                }}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </BentoCard>
  );
}
