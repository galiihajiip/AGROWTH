"use client";

/**
 * Kartu gauge semicircular animasi untuk skor risiko cuaca.
 *
 * Visual:
 *
 *      ╭────────╮
 *     ╱  TINGGI  ╲    ← big risk label (centered)
 *    ╱  60%      ╲
 *   ━━━━━━━━━━━━━━━   ← progress arc (gradient stroke)
 *   [Anomali · Banjir] ← StatBadge variant mengikuti risk
 *
 * SVG semicircle (viewBox 200×120, arc cx=100 cy=100 r=80):
 * - Background arc abu-abu transparan (rgba(255,255,255,0.08)).
 * - Progress arc memakai linear-gradient ``emerald → amber → red`` di
 *   sumbu horizontal bbox arc, di-animasikan via ``motion.path`` +
 *   ``pathLength`` (0 → score) dengan easing "out-expo" 1.2s. Saat
 *   ``prefers-reduced-motion`` aktif, durasi di-set 0 → langsung muncul.
 *
 * Score derivation:
 * - Backend (``classify_risk``) menghitung ``avg`` skor float 0..1 lalu
 *   memetakan ke 4 ``RiskLevel`` enum, namun tidak meng-expose ``avg``-nya
 *   sebagai field response. Untuk gauge ini kita derive titik representatif
 *   per band (lihat ``RISK_TO_SCORE`` di bawah). Jika kelak backend
 *   menambah ``anomaly_score: float``, ganti ``score`` source dengan
 *   field tersebut tanpa perlu ubah struktur komponen.
 *
 * Mapping warna (selaras palet brand):
 * - Glow BentoCard:   low→emerald, medium→amber, high→amber, critical→danger.
 * - Badge anomaly:    success / warning / danger sesuai severity tipe.
 * - Stroke gradient:  fixed (emerald 0% → amber 50% → red 100%) — perubahan
 *   risk muncul dari panjang arc, bukan warna stroke (mempertahankan
 *   konsistensi visual).
 *
 * Loading state: arc bg saja + 2 shimmer placeholder (untuk big text +
 * badge). Empty state (belum ada koordinat): subtitle berubah ke
 * "Belum ada lokasi" dan label center jadi "—".
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
import { ANOMALY_INFO, RISK_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { AnomalyType, RiskLevel } from "@/types";

// ============================================================================
// Mapping konstanta
// ============================================================================

/**
 * Titik representatif per band untuk visualisasi gauge.
 *
 * Backend thresholds (lihat ``classify_risk`` di ``weather_mock.py``):
 *   low    : avg < 0.15
 *   medium : 0.15 ≤ avg < 0.30
 *   high   : 0.30 ≤ avg < 0.50
 *   critical: avg ≥ 0.50
 *
 * Nilai di bawah dipilih supaya progresi arc terlihat dramatis di mata
 * (15% → 35% → 60% → 90% panjang arc) bukan presisi numerik —
 * implementasi yang akurat akan datang setelah backend meng-expose
 * ``anomaly_score`` di response.
 */
const RISK_TO_SCORE: Record<RiskLevel, number> = {
  low: 0.15,
  medium: 0.35,
  high: 0.6,
  critical: 0.9,
};

/** Glow BentoCard sesuai severity. ``BentoGlow`` hanya punya 3 tingkat. */
const RISK_TO_GLOW: Record<RiskLevel, BentoGlow> = {
  low: "emerald",
  medium: "amber",
  high: "amber",
  critical: "danger",
};

/** Variant ``StatBadge`` selaras dengan glow card. */
const RISK_TO_BADGE_VARIANT: Record<RiskLevel, StatBadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

/** Anomaly severity → variant badge (lebih granular dari risk_level). */
const ANOMALY_BADGE_VARIANT: Record<AnomalyType, StatBadgeVariant> = {
  normal: "success",
  el_nino: "warning",
  la_nina: "warning",
  drought: "warning",
  flood: "danger",
  heatwave: "danger",
};

// ============================================================================
// SVG geometry
// ============================================================================

/**
 * Top-half semicircle path:
 *   - Center (100, 100), radius 80
 *   - Start (20, 100) → end (180, 100)
 *   - sweep-flag = 1 → arc berjalan di atas (positive angle direction
 *     dengan Y-axis SVG yang flipped, sehingga visualnya naik dulu).
 */
const ARC_PATH = "M 20 100 A 80 80 0 0 1 180 100";

// ============================================================================
// Sub-component: gauge SVG
// ============================================================================

interface GaugeProps {
  gradientId: string;
  score: number; // 0..1
  riskLabel: string;
  reducedMotion: boolean;
}

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

      {/* Background arc — selalu tampil, abu-abu tipis. */}
      <path
        d={ARC_PATH}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={12}
        strokeLinecap="round"
        fill="none"
      />

      {/* Progress arc — gradient stroke, animasi path drawing.
          framer-motion setting pathLength otomatis menyetel
          strokeDasharray="1 1" + animasi strokeDashoffset 1→(1-score). */}
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
            : { duration: 1.2, ease: [0.16, 1, 0.3, 1] }
        }
      />

      {/* Big risk label — di dalam mangkuk arc, centered. */}
      <text
        x={100}
        y={78}
        textAnchor="middle"
        fontSize={22}
        fontWeight={700}
        letterSpacing="0.04em"
        className="fill-foreground"
      >
        {riskLabel.toUpperCase()}
      </text>

      {/* Sub-label di bawah label utama, mono uppercase. */}
      <text
        x={100}
        y={100}
        textAnchor="middle"
        fontSize={9}
        letterSpacing="0.22em"
        className="fill-muted-foreground"
      >
        SKOR RISIKO
      </text>
    </svg>
  );
}

// ============================================================================
// Sub-component: skeleton (loading + empty)
// ============================================================================

interface GaugeSkeletonProps {
  /** "loading" → shimmer aktif; "empty" → static placeholder bersih. */
  variant: "loading" | "empty";
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
          stroke="rgba(255,255,255,0.08)"
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

      {/* 2 shimmer pill placeholder (big label + badge). */}
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

// ============================================================================
// Public component
// ============================================================================

export interface RiskGaugeCardProps {
  className?: string;
  /** Override grid placement; default ``{ col: 3, row: 2 }``. */
  span?: BentoCardSpan;
}

export function RiskGaugeCard({ className, span }: RiskGaugeCardProps) {
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const isLoading = useAgrowthStore((s) => s.isLoadingRecommendation);
  const hasCoordinate = useAgrowthStore(
    (s) => s.selectedCoordinate !== null,
  );
  const reducedMotion = useReducedMotion() ?? false;

  // useId() menghasilkan id stabil per render-tree, aman dari collision
  // bila >1 RiskGaugeCard di-mount pada halaman yang sama.
  const gradientId = useId();

  const riskLevel = recommendation?.risk_level ?? null;
  const anomaly = recommendation?.anomaly ?? null;

  const score = riskLevel ? RISK_TO_SCORE[riskLevel] : 0;
  const glow: BentoGlow = riskLevel ? RISK_TO_GLOW[riskLevel] : "none";
  const badgeVariant: StatBadgeVariant =
    anomaly !== null
      ? ANOMALY_BADGE_VARIANT[anomaly]
      : riskLevel
        ? RISK_TO_BADGE_VARIANT[riskLevel]
        : "success";

  const riskLabel = riskLevel ? RISK_COLORS[riskLevel].label : "—";
  const anomalyInfo = anomaly ? ANOMALY_INFO[anomaly] : null;

  const showSkeleton = isLoading || recommendation === null;
  const skeletonVariant: GaugeSkeletonProps["variant"] = isLoading
    ? "loading"
    : hasCoordinate
      ? "loading"
      : "empty";

  // Subtitle adaptif: kondisi/anomali aktif vs status tunggu.
  const subtitle = recommendation
    ? `Skor ${riskLabel.toLowerCase()}`
    : isLoading
      ? "Menghitung skor risiko…"
      : hasCoordinate
        ? "Menghitung skor risiko…"
        : "Belum ada lokasi";

  return (
    <BentoCard
      title="Risiko Iklim"
      subtitle={subtitle}
      icon={AlertTriangle}
      glow={glow}
      span={span ?? { col: 3, row: 2 }}
      className={className}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        {showSkeleton ? (
          <GaugeSkeleton variant={skeletonVariant} />
        ) : (
          <>
            <Gauge
              gradientId={gradientId}
              score={score}
              riskLabel={riskLabel}
              reducedMotion={reducedMotion}
            />
            {anomalyInfo ? (
              <StatBadge
                label="Anomali"
                value={anomalyInfo.label}
                variant={badgeVariant}
              />
            ) : null}
          </>
        )}
      </div>
    </BentoCard>
  );
}
