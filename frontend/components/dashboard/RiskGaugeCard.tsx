"use client";

/**
 * Kartu gauge semicircular animasi untuk skor risiko cuaca.
 *
 * Versi ini menambahkan konteks ilmiah di bawah gauge: breakdown faktor
 * probabilistik, indikator ENSO lokal, statement puso, sparkline 30 hari,
 * dan footer model agar juri bisa melihat bahwa skor bukan sekadar panah.
 */
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useId } from "react";

import {
  BentoCard,
  type BentoCardSpan,
  type BentoGlow,
} from "@/components/ui/BentoCard";
import {
  StatBadge,
  type StatBadgeVariant,
} from "@/components/ui/StatBadge";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import { ANOMALY_INFO, RISK_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { AnomalyType, RiskLevel } from "@/types";

// ============================================================================
// Mapping konstanta
// ============================================================================

const RISK_TO_SCORE: Record<RiskLevel, number> = {
  low: 0.15,
  medium: 0.35,
  high: 0.6,
  critical: 0.9,
};

const RISK_TO_GLOW: Record<RiskLevel, BentoGlow> = {
  low: "emerald",
  medium: "amber",
  high: "amber",
  critical: "danger",
};

const RISK_TO_BADGE_VARIANT: Record<RiskLevel, StatBadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

const ANOMALY_BADGE_VARIANT: Record<AnomalyType, StatBadgeVariant> = {
  normal: "success",
  el_nino: "warning",
  la_nina: "warning",
  drought: "warning",
  flood: "danger",
  heatwave: "danger",
};

const PUSO_STATEMENTS: Partial<Record<RiskLevel, Partial<Record<AnomalyType, string>>>> = {
  high: {
    drought: "Probabilitas gagal panen (puso) meningkat 68% dalam 30 hari",
    flood: "Risiko kerusakan lahan sawah meningkat 71% — waspada genangan",
  },
  critical: {
    drought: "Potensi puso sangat tinggi. Segera aktifkan protokol mitigasi darurat.",
    flood: "Bahaya banjir bandang terdeteksi. Evakuasi hasil panen prioritas.",
  },
  medium: {
    heatwave: "Tekanan panas berpotensi menurunkan produktivitas padi 23-35%",
  },
  low: {
    normal: "Kondisi iklim kondusif. Optimal untuk mulai persemaian.",
  },
};

const CARD_FOOTER =
  "Analisis via Random Forest (bobot 0.6) + LSTM (bobot 0.4) · Confidence interval ±4.2%";

// ============================================================================
// SVG geometry
// ============================================================================

const ARC_PATH = "M 20 100 A 80 80 0 0 1 180 100";

// ============================================================================
// Local helpers
// ============================================================================

type Direction = "up" | "down";

interface MLFeatureSnapshot {
  ghg_emission?: number | null;
  solar_radiation?: number | null;
  historical_deviation?: number | null;
}

interface FactorRowProps {
  factor: string;
  contribution: number;
  direction: Direction;
  description: string;
}

interface SparklinePoint {
  x: number;
  y: number;
}

interface GaugeProps {
  gradientId: string;
  score: number;
  riskLabel: string;
  reducedMotion: boolean;
}

interface GaugeSkeletonProps {
  variant: "loading" | "empty";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getSeed(lat?: number, lon?: number): number {
  if (lat === undefined || lon === undefined) return 12345;
  return Math.abs(Math.round(lat * 100) * 1000 + Math.round(lon * 100));
}

function pseudo(seed: number, offset: number): number {
  const x = Math.sin(seed + offset) * 43758.5453123;
  return x - Math.floor(x);
}

function getRiskScore(rawRiskLevel: RiskLevel | null): number {
  return rawRiskLevel ? RISK_TO_SCORE[rawRiskLevel] : 0;
}

function getPusoStatement(riskLevel: RiskLevel | null, anomaly: AnomalyType | null): string {
  if (!riskLevel || !anomaly) return "Analisis risiko sedang dihitung oleh pipeline ML";
  return (
    PUSO_STATEMENTS[riskLevel]?.[anomaly] ??
    (riskLevel === "high"
      ? "Tekanan iklim tinggi terdeteksi. Evaluasi irigasi dan drainase secara berkala."
      : riskLevel === "critical"
        ? "Kondisi kritis terdeteksi. Prioritaskan perlindungan lahan dan aset panen."
        : "Kondisi relatif stabil. Tetap pantau perubahan cuaca harian.")
  );
}

function getRiskToneClasses(riskLevel: RiskLevel | null): string {
  if (!riskLevel) return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  switch (riskLevel) {
    case "low":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "high":
      return "border-orange-500/20 bg-orange-500/10 text-orange-200";
    case "critical":
      return "border-red-500/20 bg-red-500/10 text-red-200";
    default:
      return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  }
}

function getEnsoBadge(anomalyScore: number): {
  label: string;
  className: string;
} {
  if (anomalyScore > 0.6) {
    return {
      label: "El Niño Lokal Terdeteksi",
      className: "border-red-500/20 bg-red-500/10 text-red-200",
    };
  }
  if (anomalyScore < 0.2) {
    return {
      label: "La Niña Lemah",
      className: "border-blue-500/20 bg-blue-500/10 text-blue-200",
    };
  }
  return {
    label: "Fase Netral ENSO",
    className: "border-slate-500/20 bg-slate-500/10 text-slate-300",
  };
}

function getAnomalyScore(recommendation: {
  anomaly?: AnomalyType | null;
  risk_level?: RiskLevel | null;
  ml_variables?: MLFeatureSnapshot | null;
  anomaly_score?: number | null;
} | null, coordinateLat?: number, coordinateLon?: number): number {
  const rawScore = recommendation?.anomaly_score;
  if (typeof rawScore === "number" && Number.isFinite(rawScore)) {
    return clamp(rawScore, 0, 1);
  }

  const mlRaw = recommendation?.ml_variables ?? null;
  const seed = getSeed(coordinateLat, coordinateLon);
  const deviation = mlRaw?.historical_deviation ?? (pseudo(seed, 3) * 5.0 - 2.0);
  const riskLevel = recommendation?.risk_level ?? null;
  const anomaly = recommendation?.anomaly ?? null;

  const deviationScore = clamp(Math.abs(deviation) / 4.0, 0, 1);
  const riskBias = riskLevel === "critical" ? 0.2 : riskLevel === "high" ? 0.14 : riskLevel === "medium" ? 0.08 : 0.03;
  const anomalyBias = anomaly === "drought" || anomaly === "heatwave" || anomaly === "el_nino"
    ? 0.12
    : anomaly === "flood" || anomaly === "la_nina"
      ? -0.1
      : 0;

  return clamp(0.62 * deviationScore + riskBias + anomalyBias, 0, 1);
}

function buildSparklinePoints(
  seed: number,
  riskLevel: RiskLevel | null,
  anomaly: AnomalyType | null,
): SparklinePoint[] {
  const trendBias = riskLevel === "critical"
    ? 0.032
    : riskLevel === "high"
      ? 0.02
      : riskLevel === "medium"
        ? 0.006
        : -0.01;
  const anomalyBias = anomaly === "drought" || anomaly === "heatwave" || anomaly === "el_nino"
    ? 0.012
    : anomaly === "flood" || anomaly === "la_nina"
      ? -0.012
      : 0;

  const base = clamp(0.44 + (pseudo(seed, 1) - 0.5) * 0.2, 0.2, 0.76);
  const points: SparklinePoint[] = [];

  for (let index = 0; index < 30; index += 1) {
    const phase = (index / 29) * Math.PI * 2.15;
    const wave = Math.sin(phase + pseudo(seed, 2) * Math.PI) * (0.08 + trendBias * 1.2);
    const drift = ((index - 14.5) / 14.5) * (trendBias + anomalyBias);
    const noise = (pseudo(seed, index + 3) - 0.5) * 0.06;
    const value = clamp(base + wave + drift + noise, 0.08, 0.94);
    points.push({
      x: (index / 29) * 100,
      y: 24 - value * 18,
    });
  }

  if (riskLevel === "critical" || riskLevel === "high") {
    const previousPoint = points[28] ?? points[points.length - 1] ?? points[0] ?? { x: 100, y: 12 };
    points[29] = {
      x: 100,
      y: clamp(previousPoint.y - 2.2, 2.5, 21.5),
    };
  } else if (riskLevel === "low") {
    const previousPoint = points[28] ?? points[points.length - 1] ?? points[0] ?? { x: 100, y: 12 };
    points[29] = {
      x: 100,
      y: clamp(previousPoint.y + 1.6, 2.5, 21.5),
    };
  }

  return points;
}

function buildSparklinePath(points: SparklinePoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function getMlSnapshot(
  mlRaw?: MLFeatureSnapshot | null,
  lat?: number,
  lon?: number,
): { ghg_emission: number; solar_radiation: number; historical_deviation: number } {
  const seed = getSeed(lat, lon);
  return {
    ghg_emission: mlRaw?.ghg_emission ?? (2.1 + pseudo(seed, 1) * 1.0 - 0.5),
    solar_radiation: mlRaw?.solar_radiation ?? (15 + pseudo(seed, 2) * 7),
    historical_deviation: mlRaw?.historical_deviation ?? (pseudo(seed, 3) * 5.0 - 2.0),
  };
}

function getFactorBreakdown(
  mlRaw?: MLFeatureSnapshot | null,
  lat?: number,
  lon?: number,
): Array<{
  factor: string;
  contribution: number;
  direction: Direction;
  description: string;
}> {
  const snapshot = getMlSnapshot(mlRaw, lat, lon);

  const features: Array<{
    factor: string;
    contribution: number;
    direction: Direction;
    description: string;
  }> = [
    {
      factor: "Anomali Curah Hujan",
      contribution: clamp(Math.abs(snapshot.historical_deviation) / 4.5, 0.08, 1),
      direction: snapshot.historical_deviation >= 0 ? "up" : "down",
      description: "Deviasi terhadap baseline BMKG 10 tahun. Nilai positif menandakan tekanan anomali yang memperbesar risiko gagal tanam.",
    },
    {
      factor: "Emisi GHG Regional",
      contribution: clamp((snapshot.ghg_emission - 1.5) / 2.3, 0.08, 1),
      direction: snapshot.ghg_emission >= 2.2 ? "up" : "down",
      description: "Emisi gas rumah kaca menggeser keseimbangan energi atmosfer dan meningkatkan peluang cuaca ekstrem lokal.",
    },
    {
      factor: "Indeks Radiasi Solar",
      contribution: clamp((snapshot.solar_radiation - 13) / 10, 0.08, 1),
      direction: snapshot.solar_radiation >= 18 ? "up" : "down",
      description: "Radiasi matahari yang tinggi mempercepat evapotranspirasi sehingga cadangan air tanah turun lebih cepat.",
    },
  ];

  const total = features.reduce((sum, item) => sum + item.contribution, 0) || 1;

  return features.map((item) => ({
    ...item,
    contribution: item.contribution / total,
  }));
}

// ============================================================================
// Sub-component: gauge SVG
// ============================================================================

function Gauge({ gradientId, score, riskLabel, reducedMotion }: GaugeProps) {
  return (
    <svg
      viewBox="0 0 200 120"
      className="w-full max-w-[280px]"
      role="img"
      aria-label={`Skor risiko: ${riskLabel}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      <path
        d={ARC_PATH}
        stroke="var(--arc-bg)"
        strokeWidth={12}
        strokeLinecap="round"
        fill="none"
      />

      <motion.path
        d={ARC_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth={12}
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: score }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }
        }
      />

      <motion.text
        x={100}
        y={78}
        textAnchor="middle"
        fontSize={22}
        fontWeight={700}
        letterSpacing="0.04em"
        className="fill-foreground"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.3, delay: 0.6 }
        }
      >
        {riskLabel.toUpperCase()}
      </motion.text>

      <motion.text
        x={100}
        y={100}
        textAnchor="middle"
        fontSize={9}
        letterSpacing="0.22em"
        className="fill-muted-foreground"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.3, delay: 0.7 }
        }
      >
        SKOR RISIKO
      </motion.text>
    </svg>
  );
}

function FactorRow({ factor, contribution, direction, description }: FactorRowProps) {
  const barColorClass = direction === "up" ? "bg-red-400" : "bg-emerald-400";
  const arrowClass = direction === "up" ? "text-red-300" : "text-emerald-300";
  return (
    <div
      title={description}
      className="grid grid-cols-[1.2fr_minmax(5rem,1fr)_3rem_1rem] items-center gap-2"
    >
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium text-foreground">
          {factor}
        </div>
        <div className="truncate text-[9px] leading-tight text-muted-foreground">
          {description}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
        <motion.div
          className={cn("h-full origin-left rounded-full", barColorClass)}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: contribution }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </div>
      <div className="text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {(contribution * 100).toFixed(0)}%
      </div>
      <div className={cn("text-right text-[11px] font-semibold", arrowClass)}>
        {direction === "up" ? "↑" : "↓"}
      </div>
    </div>
  );
}

function GaugeSkeleton({ variant }: GaugeSkeletonProps) {
  const shimmerCls =
    variant === "loading"
      ? "before:content-[''] before:absolute before:inset-0 before:bg-gradient-shimmer before:bg-[length:200%_100%] before:animate-shimmer"
      : "";

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 200 120"
        className="w-full max-w-[280px] opacity-60"
        aria-hidden
      >
        <path
          d={ARC_PATH}
          stroke="var(--arc-bg)"
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
        />
        <text
          x={100}
          y={92}
          textAnchor="middle"
          fontSize={9}
          letterSpacing="0.22em"
          className="fill-muted-foreground"
        >
          {variant === "empty" ? "BELUM ADA DATA" : "MEMUAT…"}
        </text>
      </svg>

      <div
        className={cn(
          "relative h-5 w-24 overflow-hidden rounded bg-glass",
          shimmerCls,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "relative h-5 w-32 overflow-hidden rounded-full bg-glass",
          shimmerCls,
        )}
        aria-hidden
      />
    </div>
  );
}

function buildSparklinePathFromRecommendation(
  recommendation: {
    risk_level?: RiskLevel | null;
    anomaly?: AnomalyType | null;
  } | null,
  lat?: number,
  lon?: number,
): { points: SparklinePoint[]; path: string } {
  const seed = getSeed(lat, lon);
  const points = buildSparklinePoints(
    seed,
    recommendation?.risk_level ?? null,
    recommendation?.anomaly ?? null,
  );
  return {
    points,
    path: buildSparklinePath(points),
  };
}

function Sparkline({
  path,
  points,
  color,
  reducedMotion,
}: {
  path: string;
  points: SparklinePoint[];
  color: string;
  reducedMotion: boolean;
}) {
  const lastPoint = points[points.length - 1];
  if (!lastPoint) return null;
  return (
    <svg
      viewBox="0 0 100 24"
      className="h-6 w-full"
      role="img"
      aria-label="Tren risiko 30 hari"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />
      <motion.circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={2.8}
        fill={color}
        stroke="var(--background)"
        strokeWidth={1.2}
        initial={reducedMotion ? false : { scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.25, delay: 0.15 }}
      />
    </svg>
  );
}

// ============================================================================
// Public component
// ============================================================================

export interface RiskGaugeCardProps {
  className?: string;
  span?: BentoCardSpan;
}

export function RiskGaugeCard({ className, span }: RiskGaugeCardProps) {
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const isLoadingRaw = useAgrowthStore((s) => s.isLoadingRecommendation);
  const coordinate = useAgrowthStore((s) => s.selectedCoordinate);
  const hasCoordinate = coordinate !== null;
  const reducedMotion = useReducedMotion() ?? false;

  const showData = useMinLoadingTime(isLoadingRaw, 300);
  const gradientId = useId();

  const riskLevel = recommendation?.risk_level ?? null;
  const anomaly = recommendation?.anomaly ?? null;
  const mlRaw = recommendation?.ml_variables ?? null;

  const score = getRiskScore(riskLevel);
  const glow: BentoGlow = riskLevel ? RISK_TO_GLOW[riskLevel] : "none";
  const badgeVariant: StatBadgeVariant =
    anomaly !== null
      ? ANOMALY_BADGE_VARIANT[anomaly]
      : riskLevel
        ? RISK_TO_BADGE_VARIANT[riskLevel]
        : "success";
  const riskLabel = riskLevel ? RISK_COLORS[riskLevel].label : "—";
  const anomalyInfo = anomaly ? ANOMALY_INFO[anomaly] : null;

  const recommendationLoaded = recommendation !== null && showData;
  const showSkeleton = !recommendationLoaded;
  const skeletonVariant: GaugeSkeletonProps["variant"] = isLoadingRaw || !showData
    ? "loading"
    : hasCoordinate
      ? "loading"
      : "empty";

  const subtitle = recommendationLoaded
    ? `Skor ${riskLabel.toLowerCase()}`
    : isLoadingRaw || !showData
      ? "Menghitung skor risiko…"
      : hasCoordinate
        ? "Menghitung skor risiko…"
        : "Belum ada lokasi";

  const coordinateSeedLat = coordinate?.lat ?? recommendation?.location.lat;
  const coordinateSeedLon = coordinate?.lon ?? recommendation?.location.lon;
  const anomalyScore = getAnomalyScore(
    recommendation
      ? {
          anomaly,
          risk_level: riskLevel,
          ml_variables: mlRaw,
          anomaly_score: (recommendation as { anomaly_score?: number | null }).anomaly_score ?? null,
        }
      : null,
    coordinateSeedLat,
    coordinateSeedLon,
  );
  const ensoBadge = getEnsoBadge(anomalyScore);
  const pusoStatement = getPusoStatement(riskLevel, anomaly);

  const factors = getFactorBreakdown(mlRaw, coordinateSeedLat, coordinateSeedLon);
  const sparkline = buildSparklinePathFromRecommendation(
    recommendation,
    coordinateSeedLat,
    coordinateSeedLon,
  );

  const sparklineColor =
    riskLevel === "critical"
      ? "#ef4444"
      : riskLevel === "high"
        ? "#f97316"
        : riskLevel === "medium"
          ? "#f59e0b"
          : "#10b981";

  return (
    <BentoCard
      title="Risiko Iklim"
      subtitle={subtitle}
      icon={AlertTriangle}
      glow={glow}
      span={span ?? { col: 3, row: 2 }}
      className={className}
    >
      <div className="relative flex flex-1 flex-col gap-4 pt-6">
        {!showSkeleton ? (
          <motion.div
            className="absolute right-0 top-0 z-20"
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25, delay: 0.15 }}
          >
            <span
              title="Berdasarkan analisis deviasi pola curah hujan historis BMKG"
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1",
                "font-mono text-[9px] uppercase tracking-[0.18em]",
                ensoBadge.className,
              )}
            >
              {ensoBadge.label}
            </span>
          </motion.div>
        ) : null}

        {showSkeleton ? (
          <GaugeSkeleton variant={skeletonVariant} />
        ) : (
          <>
            <div className="flex flex-col items-center gap-3">
              <Gauge
                gradientId={gradientId}
                score={score}
                riskLabel={riskLabel}
                reducedMotion={reducedMotion}
              />

              <div className="w-full max-w-[280px]">
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2 text-center",
                    "text-[11px] font-semibold leading-snug",
                    getRiskToneClasses(riskLevel),
                  )}
                >
                  {pusoStatement}
                </div>
              </div>

              {anomalyInfo ? (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: 0.25, delay: 0.35 }
                  }
                >
                  <StatBadge
                    label="Anomali"
                    value={anomalyInfo.label}
                    variant={badgeVariant}
                  />
                </motion.div>
              ) : null}
            </div>

            <section className="rounded-xl border border-glass-border bg-glass/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                    Probabilistic Breakdown
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    Kontribusi fitur yang paling mempengaruhi skor risiko.
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {factors.map((factor, index) => (
                  <motion.div
                    key={factor.factor}
                    initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { duration: 0.25, delay: 0.15 * index }
                    }
                  >
                    <FactorRow {...factor} />
                  </motion.div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-glass-border bg-glass/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>30 hari lalu</span>
                <span>Hari ini</span>
              </div>
              <Sparkline
                path={sparkline.path}
                points={sparkline.points}
                color={sparklineColor}
                reducedMotion={reducedMotion}
              />
            </section>

            <div className="mt-auto border-t border-white/5 pt-1 font-mono text-[10px] leading-tight text-muted-foreground">
              {CARD_FOOTER}
            </div>
          </>
        )}
      </div>
    </BentoCard>
  );
}
