"use client";

/**
 * ML Predictive Variables Panel — dashboard AGROWTH.
 *
 * Menampilkan dua kelompok data secara berdampingan:
 *
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ ML Predictive Variables · Model v1.2 · Acc. 94.3%  [●]  │
 *  │ Diproses via Multi-ML Pipeline · Scikit-Learn + NumPy   │
 *  ├──────────────────┬────────────────────────────────────────┤
 *  │ Input Sensor ⟶  │  ⟵ ML Features                        │
 *  │  Suhu   °C       │  GHG Emission   [bar 28%]             │
 *  │  Hum    %        │  Solar Radiation[bar 22%]             │
 *  │  Rain   mm       │  Hist. Anomaly  [bar 31%]             │
 *  │  Wind   km/h     │  Drought Prob   [bar 19%]             │
 *  ├──────────────────┴────────────────────────────────────────┤
 *  │ [ticker] Pipeline: Raw Sensor → Feature Engineering → …  │
 *  └──────────────────────────────────────────────────────────┘
 *
 * Sub-komponen:
 * - ``AnimatedNumber`` — spring counter, dari WeatherMetricsCard asli.
 * - ``WeatherMetric`` — tile compact versi baru (lebih kecil).
 * - ``ContributionBar`` — horizontal bar animasi lebar (framer-motion).
 * - ``MLVariableRow`` — satu baris variabel ML (icon | label | value | bar).
 * - ``PipelineTicker`` — marquee footer yang scrolling horizontal.
 *
 * Data:
 * - Cuaca (current) dari ``useWeatherData()`` — tetap.
 * - ML variables diambil langsung dari ``recommendationData.ml_variables``
 *   via selector baru ``useMLVariables()``. Fallback ke nilai mock
 *   deterministik berbasis koordinat saat field kosong.
 */

import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  Sun,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import { cn } from "@/lib/utils";
import { useAgrowthStore, useWeatherData } from "@/store/useAgrowthStore";
import type { MLVariable } from "@/types";

// ============================================================================
// AnimatedNumber — spring-tween counter (dipertahankan dari WeatherMetricsCard)
// ============================================================================

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  className?: string;
  resetKey?: string;
}

function AnimatedNumber({ value, decimals = 1, className, resetKey }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.6 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const prevResetKey = useRef(resetKey);

  useEffect(() => {
    const keyChanged = resetKey !== undefined && resetKey !== prevResetKey.current;
    prevResetKey.current = resetKey;
    if (reduced) {
      spring.jump(value);
    } else if (keyChanged) {
      spring.jump(0);
      requestAnimationFrame(() => spring.set(value));
    } else {
      spring.set(value);
    }
  }, [reduced, spring, value, resetKey]);

  return <motion.span className={className}>{display}</motion.span>;
}

// ============================================================================
// ContributionBar — horizontal progress bar animasi (framer-motion)
// ============================================================================

interface ContributionBarProps {
  /** Nilai 0..1 (mis. 0.28 = 28%). */
  value: number;
  /** Warna Tailwind class untuk bar fill (mis. "bg-amber-400"). */
  colorClass: string;
  /** Delay sebelum animasi mulai (detik). */
  delay?: number;
}

/**
 * Bar tipis (h-1.5) horizontal yang animasi width 0 → final saat mount.
 * Label persentase di kanan, tooltip menjelaskan kontribusi ke model.
 */
function ContributionBar({ value, colorClass, delay = 0 }: ContributionBarProps) {
  const reduced = useReducedMotion();
  const pct = Math.round(value * 100);
  const title = `Kontribusi fitur ini ke model prediksi risiko: ${pct}%`;

  return (
    <div className="flex items-center gap-1.5" title={title} aria-label={title}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", colorClass)}
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

// ============================================================================
// WeatherMetric — tile kompak (versi ringkas dari Metric lama)
// ============================================================================

type MetricTint = "emerald" | "sky" | "blue" | "violet";

const TINT_ICON: Record<MetricTint, string> = {
  emerald: "text-agrowth-400",
  sky: "text-sky-400",
  blue: "text-blue-400",
  violet: "text-violet-400",
};

interface WeatherMetricProps {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  tint?: MetricTint;
  resetKey?: string;
}

function WeatherMetric({
  icon: Icon,
  label,
  value,
  unit,
  decimals = 1,
  tint = "emerald",
  resetKey,
}: WeatherMetricProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-glass-border/60 bg-glass px-2.5 py-2",
        "transition-colors duration-300",
      )}
    >
      <Icon
        className={cn("h-3 w-3 shrink-0", TINT_ICON[tint])}
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5 tabular-nums">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          resetKey={resetKey}
          className="text-sm font-semibold leading-none text-foreground"
        />
        <span className="text-[9px] font-medium text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

// ============================================================================
// MLVariableRow — satu baris variabel ML
// ============================================================================

interface MLVariableRowProps {
  variable: MLVariable;
  barColorClass: string;
  barDelay?: number;
  resetKey?: string;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: null,
} as const;

const TREND_COLORS = {
  up: "text-red-400",
  down: "text-sky-400",
  stable: "text-muted-foreground",
} as const;

function MLVariableRow({ variable, barColorClass, barDelay = 0, resetKey }: MLVariableRowProps) {
  const TrendIcon = TREND_ICONS[variable.trend];
  const trendColor = TREND_COLORS[variable.trend];

  return (
    <div
      className="flex flex-col gap-1"
      title={variable.description}
      aria-label={variable.description}
    >
      {/* Top row: label | value | trend | source badge */}
      <div className="flex items-center gap-1.5">
        {/* Source badge */}
        <span
          className={cn(
            "shrink-0 rounded px-1 py-0 font-mono text-[8px] uppercase tracking-wider",
            "border border-glass-border/60 bg-glass text-muted-foreground/70",
          )}
        >
          {variable.source}
        </span>

        {/* Label */}
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground/90">
          {variable.label}
        </span>

        {/* Trend icon */}
        {TrendIcon ? (
          <TrendIcon className={cn("h-2.5 w-2.5 shrink-0", trendColor)} strokeWidth={2.5} aria-hidden />
        ) : null}

        {/* Value + unit */}
        <div className="flex items-baseline gap-0.5 tabular-nums">
          <AnimatedNumber
            value={variable.value}
            decimals={variable.unit === "%" ? 0 : 2}
            resetKey={resetKey}
            className="text-xs font-semibold leading-none text-foreground"
          />
          <span className="text-[9px] font-medium text-muted-foreground">{variable.unit}</span>
        </div>
      </div>

      {/* Contribution bar */}
      <ContributionBar value={variable.modelContribution} colorClass={barColorClass} delay={barDelay} />
    </div>
  );
}

// ============================================================================
// PipelineTicker — marquee footer
// ============================================================================

const PIPELINE_TEXT =
  "Pipeline: Raw Sensor → Feature Engineering → Normalization → Random Forest → LSTM Sequence → Ensemble Voting → Risk Score → LLM Narrative   |   Model: AGROWTH-ML-v1.2.0   |   Stack: Scikit-Learn · NumPy · PyTorch · FastAPI   |   Data: Open-Meteo · BMKG · NASA POWER · BPS";

function PipelineTicker() {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-b-2xl border-t border-glass-border/40",
        "bg-black/20 dark:bg-black/30 py-1",
      )}
    >
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: "ticker-scroll 28s linear infinite",
        }}
      >
        {/* Repeat twice so the scroll loops seamlessly */}
        <span className="inline-block pr-16 font-mono text-[9px] text-muted-foreground/60">
          {PIPELINE_TEXT}
        </span>
        <span className="inline-block pr-16 font-mono text-[9px] text-muted-foreground/60">
          {PIPELINE_TEXT}
        </span>
      </div>

      {/* CSS animation keyframes injected via style tag — no Tailwind plugin needed */}
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// ML variable definitions (fallback values + metadata)
// ============================================================================

/**
 * Buat 4 variabel ML dari data backend (raw) atau fallback mock deterministik.
 * Nilai disesuaikan per koordinat untuk konsistensi demo.
 */
function buildMLVariables(
  mlRaw?: { ghg_emission?: number | null; solar_radiation?: number | null; historical_deviation?: number | null; drought_probability?: number | null } | null,
  lat?: number,
  lon?: number,
): MLVariable[] {
  // Seed sederhana berbasis koordinat untuk mock deterministik
  const seed = lat !== undefined && lon !== undefined
    ? Math.abs(Math.round(lat * 100) * 1000 + Math.round(lon * 100))
    : 12345;
  const pseudo = (offset: number) => {
    const x = Math.sin(seed + offset) * 43758.5453123;
    return x - Math.floor(x);
  };

  const ghg = mlRaw?.ghg_emission ?? (2.1 + pseudo(1) * 1.0 - 0.5);
  const solar = mlRaw?.solar_radiation ?? (15 + pseudo(2) * 7);
  const deviation = mlRaw?.historical_deviation ?? (pseudo(3) * 5.0 - 2.0);
  const drought = mlRaw?.drought_probability ?? (pseudo(4) * 60 + 20);

  return [
    {
      id: "ghg_emission",
      label: "GHG Emission Impact",
      value: Number(ghg.toFixed(2)),
      unit: "ton CO₂eq/ha",
      source: "BPS Regional",
      modelContribution: 0.28,
      trend: ghg > 2.3 ? "up" : ghg < 1.9 ? "down" : "stable",
      description: "Emisi gas rumah kaca regional mempengaruhi pola hujan lokal",
    },
    {
      id: "solar_radiation",
      label: "Solar Radiation Index",
      value: Number(solar.toFixed(1)),
      unit: "MJ/m²",
      source: "NASA POWER",
      modelContribution: 0.22,
      trend: solar > 19 ? "up" : solar < 17 ? "down" : "stable",
      description: "Radiasi matahari NASA POWER — proxy kekeringan lahan",
    },
    {
      id: "historical_deviation",
      label: "Historical Anomaly Deviation",
      value: Number(deviation.toFixed(2)),
      unit: "σ",
      source: "BMKG 10yr baseline",
      modelContribution: 0.31,
      trend: deviation > 0.5 ? "up" : deviation < -0.5 ? "down" : "stable",
      description: "Deviasi dari baseline cuaca 10 tahun terakhir BMKG",
    },
    {
      id: "drought_probability",
      label: "Drought Probability Index",
      value: Number(drought.toFixed(0)),
      unit: "%",
      source: "Ensemble RF+LSTM",
      modelContribution: 0.19,
      trend: drought > 60 ? "up" : drought < 30 ? "down" : "stable",
      description: "Probabilitas kekeringan 30 hari ke depan via Random Forest + LSTM ensemble",
    },
  ];
}

/** Warna bar dan icon per variabel ML (sesuai index order dari buildMLVariables). */
const ML_VAR_STYLES = [
  { barColorClass: "bg-amber-400", iconClass: "text-amber-400", Icon: Cloud },
  { barColorClass: "bg-yellow-400", iconClass: "text-yellow-400", Icon: Sun },
  { barColorClass: "bg-red-400", iconClass: "text-red-400", Icon: TrendingUp },
  { barColorClass: "bg-orange-400", iconClass: "text-orange-400", Icon: Droplets },
] as const;

// ============================================================================
// MLPredictivePanel
// ============================================================================

export interface MLPredictivePanelProps {
  className?: string;
  /** Override grid placement; default ``{ col: 5, row: 2 }``. */
  span?: BentoCardSpan;
}

/** Tile skeleton internal (dipakai saat isLoading). */
const SKELETON_TILE_CLASSES = cn(
  "rounded-xl border-glass-border/40 bg-glass p-3",
  "shadow-none backdrop-blur-none",
);

export function MLPredictivePanel({ className, span }: MLPredictivePanelProps) {
  const weather = useWeatherData();
  const recommendationData = useAgrowthStore((s) => s.recommendationData);
  const isLoadingRaw = useAgrowthStore((s) => s.isLoadingRecommendation);
  const hasCoordinate = useAgrowthStore((s) => s.selectedCoordinate !== null);
  const coordinate = useAgrowthStore((s) => s.selectedCoordinate);

  const showData = useMinLoadingTime(isLoadingRaw, 300);
  const showSkeleton = !showData || weather === null;

  const resetKey = coordinate
    ? `${coordinate.lat.toFixed(4)},${coordinate.lon.toFixed(4)}`
    : undefined;

  // ML variables: prefer backend data, fallback to deterministic mock
  const mlVariables = buildMLVariables(
    recommendationData?.ml_variables ?? null,
    coordinate?.lat,
    coordinate?.lon,
  );

  // Extract model metadata from backend response if available
  const mlRaw = recommendationData?.ml_variables;
  const modelVersion = mlRaw?.model_version ?? "v1.2.0";
  const modelConfidence = mlRaw?.model_confidence != null
    ? `${(mlRaw.model_confidence * 100).toFixed(1)}%`
    : "94.3%";

  // Subtitle adaptif
  const subtitle = weather && !showSkeleton
    ? "Diproses via Multi-ML Pipeline · Scikit-Learn + NumPy"
    : isLoadingRaw || !showData
      ? "Memuat data pipeline…"
      : hasCoordinate
        ? "Memuat data pipeline…"
        : "Belum ada lokasi";

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <BentoCard
        title="ML Predictive Variables"
        subtitle={subtitle}
        icon={CloudSun}
        glow="emerald"
        span={span ?? { col: 5, row: 2 }}
        className={cn("flex-1 pb-0 rounded-b-none border-b-0", className)}
        isLoading={showSkeleton}
        animateIn
        skeletonProps={{ lines: 2 }}
      >
        {/* Model version chip — pojok kanan header */}
        {!showSkeleton && (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5",
                "border border-agrowth-500/30 bg-agrowth-500/10",
                "font-mono text-[9px] text-agrowth-400",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-agrowth-400 animate-pulse"
                aria-hidden
              />
              Model {modelVersion} · Acc. {modelConfidence}
            </span>
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="flex gap-0 min-h-0">
          {/* LEFT column — 4 weather metrics (compact) */}
          <div className="flex flex-col gap-1.5 min-w-0 flex-shrink-0 w-[47%]">
            <WeatherMetric
              icon={Thermometer}
              label="Suhu"
              value={weather?.current.temperature_c ?? 0}
              unit="°C"
              decimals={1}
              tint="emerald"
              resetKey={resetKey}
            />
            <WeatherMetric
              icon={Droplets}
              label="Kelembapan"
              value={weather?.current.humidity_pct ?? 0}
              unit="%"
              decimals={0}
              tint="sky"
              resetKey={resetKey}
            />
            <WeatherMetric
              icon={CloudRain}
              label="Curah Hujan"
              value={weather?.current.rainfall_mm ?? 0}
              unit="mm"
              decimals={1}
              tint="blue"
              resetKey={resetKey}
            />
            <WeatherMetric
              icon={Wind}
              label="Angin"
              value={(weather?.current.wind_speed_ms ?? 0) * 3.6}
              unit="km/h"
              decimals={1}
              tint="violet"
              resetKey={resetKey}
            />
          </div>

          {/* CENTER separator */}
          <div className="flex flex-col items-center mx-2 flex-shrink-0 pt-1">
            <div className="h-full w-px bg-glass-border/50" />
          </div>

          {/* RIGHT column — 4 ML feature variables */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {mlVariables.map((variable, i) => {
              const style = ML_VAR_STYLES[i] ?? ML_VAR_STYLES[0];
              return (
                <MLVariableRow
                  key={variable.id}
                  variable={variable}
                  barColorClass={style.barColorClass}
                  barDelay={i * 0.1}
                  resetKey={resetKey}
                />
              );
            })}
          </div>
        </div>
      </BentoCard>

      {/* Pipeline ticker footer — pinned below card, no gap */}
      {!showSkeleton && <PipelineTicker />}
    </div>
  );
}
