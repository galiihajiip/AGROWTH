"use client";

/**
 * Kartu metrik cuaca utama untuk dashboard AGROWTH.
 *
 * Menampilkan 4 metrik real-time dari ``recommendationData.current``
 * dalam grid 2×2:
 *
 *  ┌──────────────┬──────────────┐
 *  │ Suhu  (°C)   │ Kelembapan(%)│
 *  ├──────────────┼──────────────┤
 *  │ Curah(mm)    │ Angin(km/h)  │
 *  └──────────────┴──────────────┘
 *
 * Tiap angka dianimasikan dari nilai sebelumnya → nilai baru via
 * :class:`AnimatedNumber` (framer-motion ``useSpring``). Saat user pertama
 * kali memilih koordinat, animasi akan berjalan 0 → final supaya
 * perubahan terasa "hidup", bukan terlompat.
 *
 * Angin dikonversi dari ``m/s`` (unit backend) ke ``km/h`` (× 3.6) supaya
 * lebih intuitif untuk audiens umum (BMKG juga melaporkan km/h di app).
 *
 * Loading state:
 * - Frame ``BentoCard`` (judul "Kondisi Cuaca" + ikon ``CloudSun``) tetap
 *   tampil supaya layout grid tidak shift saat data datang.
 * - Konten 2×2 di-replace dengan empat ``CardSkeleton`` ringan
 *   (``showHeader={false} lines={1}``) yang di-tone-down agar tidak
 *   terlihat seperti glass-panel bersarang ke dalam glass-panel.
 *
 * Empty state (belum klik koordinat): subtitle berubah jadi
 * "Belum ada lokasi" dan grid menampilkan skeleton statis (efek shimmer
 * tetap menyala — petunjuk visual bahwa kartu sedang menunggu input).
 */
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  CloudRain,
  CloudSun,
  Droplets,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { DataSourceBadge } from "@/components/ui/DataSourceBadge";
import { cn } from "@/lib/utils";
import { useAgrowthStore, useWeatherData } from "@/store/useAgrowthStore";

// ============================================================================
// AnimatedNumber: spring-tween counter via framer-motion
// ============================================================================

interface AnimatedNumberProps {
  /** Nilai target. Setiap perubahan memicu spring animation. */
  value: number;
  /** Jumlah angka di belakang koma untuk display. Default 1. */
  decimals?: number;
  className?: string;
}

/**
 * Span ber-animasi smooth dari nilai lama ke nilai baru menggunakan
 * spring physics. Dirancang untuk angka metrik (1-4 digit, 0..2 desimal).
 *
 * Implementasi: ``useSpring`` mengembalikan ``MotionValue<number>`` yang
 * mengikuti perubahan ``set()`` dengan kurva spring (stiffness 90,
 * damping 22). ``useTransform`` mem-format jadi string desimal lalu
 * diteruskan sebagai child ``motion.span`` — framer-motion meng-update
 * teks tanpa memicu re-render React, sehingga performa tetap halus
 * walau nilai berubah cepat.
 *
 * Reduced motion: jika user mengaktifkan ``prefers-reduced-motion``,
 * ``spring.jump(value)`` di-pakai sebagai pengganti ``set()`` supaya
 * counter langsung menampilkan nilai final tanpa animasi.
 */
function AnimatedNumber({ value, decimals = 1, className }: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.6 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (reduced) {
      spring.jump(value);
    } else {
      spring.set(value);
    }
  }, [reduced, spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}

// ============================================================================
// Metric tile (single cell di grid 2×2)
// ============================================================================

/** Warna icon per metrik. Value tetap putih agar kontras maksimal. */
type MetricTint = "emerald" | "sky" | "blue" | "violet";

const TINT_ICON: Record<MetricTint, string> = {
  emerald: "text-agrowth-400",
  sky: "text-sky-400",
  blue: "text-blue-400",
  violet: "text-violet-400",
};

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  tint?: MetricTint;
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  decimals = 1,
  tint = "emerald",
}: MetricProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border border-glass-border bg-glass p-3",
        "transition-colors duration-300",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn("h-3.5 w-3.5 shrink-0", TINT_ICON[tint])}
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          className="text-2xl font-semibold tabular-nums leading-none text-foreground"
        />
        <span className="text-[11px] font-medium text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// WeatherMetricsCard
// ============================================================================

export interface WeatherMetricsCardProps {
  className?: string;
  /** Override grid placement; default ``{ col: 5, row: 2 }``. */
  span?: BentoCardSpan;
}

/** Class override supaya ``CardSkeleton`` cukup ringan untuk dipakai
 *  sebagai inner-tile di dalam ``BentoCard`` (bukan sebagai card mandiri).
 */
const SKELETON_TILE_CLASSES = cn(
  "rounded-xl border-glass-border/40 bg-glass p-3",
  "shadow-none backdrop-blur-none",
);

export function WeatherMetricsCard({ className, span }: WeatherMetricsCardProps) {
  const weather = useWeatherData();
  const isLoading = useAgrowthStore((s) => s.isLoadingRecommendation);
  const hasCoordinate = useAgrowthStore(
    (s) => s.selectedCoordinate !== null,
  );

  const showSkeleton = isLoading || weather === null;

  // Subtitle adaptif: tunjukkan kondisi cuaca saat data ada,
  // pesan ramah saat menunggu / belum ada koordinat.
  const subtitle = weather
    ? weather.current.condition
    : isLoading
      ? "Memuat data cuaca…"
      : hasCoordinate
        ? "Memuat data cuaca…"
        : "Belum ada lokasi";

  return (
    <BentoCard
      title="Kondisi Cuaca"
      subtitle={subtitle}
      icon={CloudSun}
      glow="emerald"
      span={span ?? { col: 5, row: 2 }}
      className={className}
    >
      <div className="grid flex-1 grid-cols-2 gap-3">
        {showSkeleton ? (
          <>
            <CardSkeleton
              showHeader={false}
              lines={1}
              className={SKELETON_TILE_CLASSES}
            />
            <CardSkeleton
              showHeader={false}
              lines={1}
              className={SKELETON_TILE_CLASSES}
            />
            <CardSkeleton
              showHeader={false}
              lines={1}
              className={SKELETON_TILE_CLASSES}
            />
            <CardSkeleton
              showHeader={false}
              lines={1}
              className={SKELETON_TILE_CLASSES}
            />
          </>
        ) : (
          <>
            <Metric
              icon={Thermometer}
              label="Suhu"
              value={weather.current.temperature_c}
              unit="°C"
              decimals={1}
              tint="emerald"
            />
            <Metric
              icon={Droplets}
              label="Kelembapan"
              value={weather.current.humidity_pct}
              unit="%"
              decimals={0}
              tint="sky"
            />
            <Metric
              icon={CloudRain}
              label="Curah Hujan"
              value={weather.current.rainfall_mm}
              unit="mm"
              decimals={1}
              tint="blue"
            />
            <Metric
              icon={Wind}
              label="Angin"
              // Backend menyimpan dalam m/s; konversi ke km/h (× 3.6)
              // supaya selaras format laporan BMKG dan lebih intuitif.
              value={weather.current.wind_speed_ms * 3.6}
              unit="km/h"
              decimals={1}
              tint="violet"
            />
          </>
        )}
      </div>

      {/* Data source transparency badge */}
      {!showSkeleton ? (
        <div className="flex justify-end">
          <DataSourceBadge />
        </div>
      ) : null}
    </BentoCard>
  );
}
