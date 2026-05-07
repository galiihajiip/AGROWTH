"use client";

/**
 * Seasonal Intelligence Dashboard untuk curah hujan.
 *
 * Mempertahankan view 7 hari, tetapi menambahkan 30 hari dan 3 bulan
 * untuk menonjolkan baseline musiman vs proyeksi ML.
 */
import { useMemo, useState } from "react";
import { CloudRain, LineChart as LineChartIcon, Sparkles, Sprout, TrendingUp } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import { generateSeasonalData, getOptimalPlantingWindows, getSeasonalVerdict, type SeasonalDataPoint, type SeasonalView } from "@/lib/forecast-utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { ForecastPoint } from "@/types";

// ============================================================================
// Tokens
// ============================================================================


type ViewMode = SeasonalView;
const TEMP_COLOR = "#10b981";
const RAIN_COLOR = "#3b82f6";
const BASELINE_COLOR = "#9ca3af";
const POSITIVE_COLOR = "#16a34a";
const NEGATIVE_COLOR = "#ef4444";
const GRID_COLOR = "var(--chart-grid)";
const AXIS_COLOR = "var(--chart-axis)";
const TICK_COLOR = "var(--chart-tick)";

interface SevenDayPoint {
  date: string;
  temperature: number;
  rainfall: number;
  isAnomaly: boolean;
}

interface SeasonalTooltipPayloadEntry {
  name?: string;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: SeasonalDataPoint;
}

interface SevenDayTooltipPayloadEntry {
  name?: string;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: SevenDayPoint;
}

function formatDateDdMm(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatSeasonalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function dailyAnomalyScore(p: ForecastPoint): number {
  const meanTemp = (p.temp_max_c + p.temp_min_c) / 2;
  const rain = p.rainfall_mm;
  const wind = p.wind_speed_ms;

  let score = 0;
  if (meanTemp >= 35) score += 0.45;
  else if (meanTemp >= 33) score += 0.25;
  else if (meanTemp >= 31) score += 0.1;

  if (rain >= 80) score += 0.5;
  else if (rain >= 50) score += 0.3;
  else if (rain >= 30) score += 0.15;

  if (wind >= 12) score += 0.1;
  else if (wind >= 8) score += 0.05;

  if (rain < 0.5 && meanTemp >= 30) score += 0.2;
  if (rain < 0.5 && meanTemp >= 32) score += 0.2;

  return Math.min(1, score);
}

function getSeriesColor(deviation: number): string {
  return deviation >= 0 ? TEMP_COLOR : NEGATIVE_COLOR;
}

function getDeviationStatus(deviation: number): {
  label: string;
  className: string;
} {
  if (deviation > 20) {
    return { label: "Lebih Basah", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" };
  }
  if (deviation < -20) {
    return { label: "Lebih Kering", className: "border-red-500/30 bg-red-500/10 text-red-200" };
  }
  return { label: "Normal", className: "border-slate-500/30 bg-slate-500/10 text-slate-200" };
}

function getSeasonalVerdictStyle(avgDeviation: number): string {
  if (avgDeviation > 20) return "border-amber-300/60 bg-amber-50/80 text-amber-950";
  if (avgDeviation < -20) return "border-red-300/60 bg-red-50/80 text-red-950";
  return "border-emerald-300/60 bg-emerald-50/80 text-emerald-950";
}

function getSeasonalVerdictIcon(avgDeviation: number) {
  if (avgDeviation > 20) return CloudRain;
  if (avgDeviation < -20) return Sprout;
  return Sparkles;
}

function ChartSkeleton() {
  const heights = [40, 70, 55, 80, 45, 65, 50] as const;
  return (
    <div className="relative flex flex-1 flex-col gap-2 px-1 py-2" aria-busy="true">
      <div className="flex flex-1 items-end gap-1.5 px-2">
        {heights.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm bg-glass" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between gap-1.5 px-2">
        {heights.map((_, i) => (
          <div key={i} className="h-2 w-6 rounded bg-glass" />
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-shimmer bg-[length:200%_100%] animate-shimmer mix-blend-screen opacity-70" />
    </div>
  );
}

function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: SevenDayTooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className={cn("rounded-xl border border-glass-border bg-glass-dark backdrop-blur-xl px-3 py-2 shadow-glass") }>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-col gap-0.5 text-xs">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-foreground">
              {entry.name}: <span className="font-semibold tabular-nums">{typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}</span>
              <span className="ml-0.5 text-muted-foreground">{entry.dataKey === "temperature" ? "°C" : "mm"}</span>
            </span>
          </div>
        ))}
        {payload[0]?.payload?.isAnomaly ? <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-danger-400"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger-400" />Anomali tinggi</div> : null}
      </div>
    </div>
  );
}

function SeasonalTooltip({ active, payload, label, view }: { active?: boolean; payload?: SeasonalTooltipPayloadEntry[]; label?: string; view: ViewMode }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const status = getDeviationStatus(point.deviation);

  return (
    <div className={cn("rounded-xl border backdrop-blur-xl px-3 py-2 shadow-glass bg-glass-dark", status.className)}>
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 space-y-1 text-xs text-foreground">
        <div className="flex items-center justify-between gap-3">
          <span>Predicted</span>
          <span className="font-semibold tabular-nums">{point.predicted_rainfall.toFixed(1)} mm</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Baseline</span>
          <span className="font-semibold tabular-nums text-muted-foreground">{point.baseline_rainfall.toFixed(1)} mm</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Deviasi</span>
          <span className="font-semibold tabular-nums">{point.deviation >= 0 ? "+" : ""}{point.deviation.toFixed(1)} mm</span>
        </div>
      </div>
      <div className={cn("mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", status.className)}>
        {status.label}
      </div>
      {view === "3m" ? <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Update per 3 hari</div> : null}
    </div>
  );
}

interface SevenDayPoint {
  date: string;
  temperature: number;
  rainfall: number;
  isAnomaly: boolean;
}

interface ForecastChartCardProps {
  className?: string;
  span?: BentoCardSpan;
}

export function ForecastChartCard({ className, span }: ForecastChartCardProps) {
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const isLoading = useAgrowthStore((s) => s.isLoadingRecommendation);
  const hasCoordinate = useAgrowthStore((s) => s.selectedCoordinate !== null);
  const [activeView, setActiveView] = useState<ViewMode>("3m");

  const coordinate = recommendation?.location ?? null;
  const lat = coordinate?.lat ?? 0;
  const lon = coordinate?.lon ?? 0;

  const sevenDayData: SevenDayPoint[] = useMemo(() => {
    if (!recommendation) return [];
    return recommendation.forecast.map((point) => ({
      date: formatDateDdMm(point.date),
      temperature: Number(((point.temp_max_c + point.temp_min_c) / 2).toFixed(1)),
      rainfall: Number(point.rainfall_mm.toFixed(1)),
      isAnomaly: dailyAnomalyScore(point) > 0.5,
    }));
  }, [recommendation]);

  const seasonalData = useMemo<Record<Exclude<ViewMode, "7d">, SeasonalDataPoint[]>>(() => {
    if (!recommendation) return { "30d": [] as SeasonalDataPoint[], "3m": [] as SeasonalDataPoint[] };
    return {
      "30d": generateSeasonalData(lat, lon, "30d", new Date()),
      "3m": generateSeasonalData(lat, lon, "3m", new Date()),
    };
  }, [lat, lon, recommendation]);

  const activeSeasonalData: SeasonalDataPoint[] = activeView === "7d"
    ? []
    : seasonalData[activeView as Exclude<ViewMode, "7d">];
  const avgDeviation = activeSeasonalData.length > 0
    ? activeSeasonalData.reduce((sum: number, point: SeasonalDataPoint) => sum + point.deviation, 0) / activeSeasonalData.length
    : 0;
  const verdict = getSeasonalVerdict(avgDeviation);
  const verdictStyle = getSeasonalVerdictStyle(avgDeviation);
  const VerdictIcon = getSeasonalVerdictIcon(avgDeviation);

  const plantingWindows = activeView === "7d" ? [] : getOptimalPlantingWindows(activeSeasonalData);
  const seasonalLineColor = getSeriesColor(avgDeviation);

  const showSkeleton = isLoading || (recommendation === null && hasCoordinate);
  const showEmpty = !isLoading && recommendation === null && !hasCoordinate;

  const subtitle = recommendation
    ? "ML Seasonal Intelligence · Baseline BMKG 10 Tahun"
    : isLoading || hasCoordinate
      ? "Memuat proyeksi musiman…"
      : "Belum ada lokasi";

  const renderChart = () => {
    if (activeView === "7d") {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={sevenDayData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" stroke={AXIS_COLOR} tick={{ fill: TICK_COLOR, fontSize: 11 }} tickLine={false} axisLine={{ stroke: AXIS_COLOR }} />
            <YAxis yAxisId="temp" orientation="left" stroke={TEMP_COLOR} tick={{ fill: TICK_COLOR, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} width={36} label={{ value: "°C", position: "insideTopLeft", offset: 8, style: { fill: TEMP_COLOR, fontSize: 10, fontWeight: 600 } }} />
            <YAxis yAxisId="rain" orientation="right" stroke={RAIN_COLOR} tick={{ fill: TICK_COLOR, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} width={36} label={{ value: "mm", position: "insideTopRight", offset: 8, style: { fill: RAIN_COLOR, fontSize: 10, fontWeight: 600 } }} />
            <Tooltip cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1 }} content={<DailyTooltip />} />
            <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Suhu" stroke={TEMP_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: TEMP_COLOR, stroke: "var(--bg-base)", strokeWidth: 1 }} animationDuration={900} animationEasing="ease-out" />
            <Line yAxisId="rain" type="monotone" dataKey="rainfall" name="Hujan" stroke={RAIN_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 5, fill: RAIN_COLOR, stroke: "var(--bg-base)", strokeWidth: 1 }} animationDuration={900} animationEasing="ease-out" />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={activeSeasonalData} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={AXIS_COLOR} tick={{ fill: TICK_COLOR, fontSize: 11 }} tickLine={false} axisLine={{ stroke: AXIS_COLOR }} interval={activeView === "3m" ? 8 : 3} />
          <YAxis yAxisId="rain" orientation="left" stroke={seasonalLineColor} tick={{ fill: TICK_COLOR, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} width={48} label={{ value: "mm", position: "insideTopLeft", offset: 8, style: { fill: seasonalLineColor, fontSize: 10, fontWeight: 600 } }} />
          <YAxis yAxisId="dev" orientation="right" stroke={TICK_COLOR} tick={{ fill: TICK_COLOR, fontSize: 10 }} tickLine={false} axisLine={{ stroke: GRID_COLOR }} width={42} label={{ value: "Δ mm", position: "insideTopRight", offset: 8, style: { fill: TICK_COLOR, fontSize: 10, fontWeight: 600 } }} />
          <Tooltip cursor={{ stroke: "var(--chart-cursor)", strokeWidth: 1 }} content={<SeasonalTooltip view={activeView} />} />
          <Legend
            verticalAlign="top"
            align="left"
            wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
            formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
          />
          {plantingWindows.map((window, index) => {
            const start = activeSeasonalData.find((point: SeasonalDataPoint) => point.label === window.start)?.label ?? window.start;
            const end = activeSeasonalData.find((point: SeasonalDataPoint) => point.label === window.end)?.label ?? window.end;
            return (
              <ReferenceArea
                key={`${window.start}-${window.end}-${index}`}
                x1={start}
                x2={end}
                yAxisId="rain"
                strokeOpacity={0}
                fill="#22c55e"
                fillOpacity={0.08}
                ifOverflow="extendDomain"
                label={{ value: "🌱 Window Tanam Optimal", position: "insideTop", fill: "#16a34a", fontSize: 10, fontWeight: 600 }}
              />
            );
          })}
          <ReferenceLine yAxisId="dev" y={0} stroke={TICK_COLOR} strokeDasharray="3 3" />
          <Area
            yAxisId="rain"
            type="monotone"
            dataKey="confidence_upper"
            name="Confidence Upper"
            stroke={activeView === "3m" ? "rgba(16,185,129,0.35)" : "rgba(59,130,246,0.35)"}
            fill={activeView === "3m" ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)"}
            baseLine={activeSeasonalData.map((entry) => ({ x: entry.label, y: entry.confidence_lower })) as any}
            strokeWidth={1}
            isAnimationActive
            animationDuration={800}
          />
          <Line yAxisId="rain" type="monotone" dataKey="predicted_rainfall" name="Prediksi ML" stroke={seasonalLineColor} strokeWidth={2.4} dot={false} activeDot={{ r: 5, fill: seasonalLineColor, stroke: "var(--bg-base)", strokeWidth: 1 }} animationDuration={900} animationEasing="ease-out" />
          <Line yAxisId="rain" type="monotone" dataKey="baseline_rainfall" name="Normal Historis" stroke={BASELINE_COLOR} strokeWidth={1.8} strokeDasharray="6 4" dot={false} activeDot={false} animationDuration={900} animationEasing="ease-out" />
          <Bar yAxisId="dev" dataKey="deviation" name="Deviasi" barSize={6} radius={[4, 4, 0, 0]} fill={POSITIVE_COLOR}>
            {activeSeasonalData.map((entry: SeasonalDataPoint, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.deviation >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const footerText = "Proyeksi berbasis ensemble Random Forest + LSTM · Update tiap 6 jam · Sumber baseline: BMKG 2014-2024";

  return (
    <BentoCard
      title="Proyeksi Musiman 3 Bulan"
      subtitle={subtitle}
      icon={TrendingUp}
      glow="emerald"
      span={span ?? { col: 12, row: 2 }}
      className={className}
    >
      <div className="flex w-full flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: "7d", label: "7 Hari", icon: LineChartIcon },
            { key: "30d", label: "30 Hari", icon: CloudRain },
            { key: "3m", label: "3 Bulan", icon: TrendingUp },
          ] as const).map((tab) => {
            const active = activeView === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveView(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all",
                  active
                    ? "border-agrowth-500/30 bg-agrowth-500/10 text-agrowth-300"
                    : "border-glass-border/60 bg-glass text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>

        {showSkeleton ? (
          <ChartSkeleton />
        ) : showEmpty ? (
          <div className="flex h-[320px] items-center justify-center text-xs text-muted-foreground/60">
            Pilih lokasi untuk melihat proyeksi musiman.
          </div>
        ) : (
          <>
            {activeView !== "7d" ? (
              <div className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2 text-[13px] font-medium", verdictStyle)}>
                <VerdictIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{verdict}</span>
              </div>
            ) : null}

            <div className="h-[320px] w-full">
              {renderChart()}
            </div>

            {activeView !== "7d" ? (
              <div className="flex flex-wrap gap-2 pt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border/60 bg-glass px-2.5 py-1">Prediksi ML</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border/60 bg-glass px-2.5 py-1">Normal Historis</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-glass-border/60 bg-glass px-2.5 py-1">Window Tanam</span>
              </div>
            ) : null}

            <div className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              {footerText}
            </div>
          </>
        )}
      </div>
    </BentoCard>
  );
}
