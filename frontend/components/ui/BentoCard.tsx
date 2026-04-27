"use client";

/**
 * Komponen kartu glassmorphism untuk semua widget bento di dashboard.
 *
 * Visual stack (top → bottom):
 * 1. ``::before`` pseudo-element (opsional, ``glow !== "none"``):
 *    radial-soft gradient warna brand di sudut kiri-atas, menambah depth
 *    tanpa menambahkan node DOM ekstra.
 * 2. Container utama: ``rounded-2xl`` + border glass + bg gradient subtle
 *    + ``backdrop-blur-xl`` + ``shadow-glass`` baseline.
 * 3. Header: icon (lucide) + title + subtitle, leading-none agar padat.
 * 4. ``children`` di-render di area konten dengan ``flex-1`` supaya panel
 *    selalu mengisi kotak grid penuh.
 *
 * Behaviour:
 * - Hover: container subtle lift (``-translate-y-0.5``) + outer
 *   ``shadow-glow-{color}`` mengikuti ``glow`` prop.
 * - ``span`` props memetakan ke utility ``lg:col-span-N`` &
 *   ``lg:row-span-N`` (literal class supaya Tailwind JIT mendeteksi).
 *   Mobile (<lg) default ``col-span-12`` agar layout collapse aman.
 *
 * Usage::
 *
 *     <BentoCard
 *       title="Cuaca Saat Ini"
 *       subtitle="DI Yogyakarta"
 *       icon={CloudSun}
 *       glow="emerald"
 *       span={{ col: 5, row: 2 }}
 *     >
 *       <WeatherDetail />
 *     </BentoCard>
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Warna inner-glow & hover-glow. ``"none"`` mematikan keduanya. */
export type BentoGlow = "none" | "emerald" | "amber" | "danger";

export interface BentoCardSpan {
  /** Lebar kolom di breakpoint ``lg`` (1..12). */
  col?: number;
  /** Tinggi baris di breakpoint ``lg`` (1..6). */
  row?: number;
  /**
   * Lebar kolom di mobile (<lg). Default 12 (full row) supaya layout
   * collapse aman di layar sempit.
   */
  colMobile?: number;
}

export interface BentoCardProps {
  /** Heading utama (1-2 kata). Optional supaya kartu standalone juga bisa. */
  title?: string;
  /** Subtitle ringan di bawah title; ``font-mono`` uppercase tracking. */
  subtitle?: string;
  /** Lucide icon component, ditampilkan di kiri header. */
  icon?: LucideIcon;
  /** Class tambahan untuk container terluar (mis. tweak grid placement manual). */
  className?: string;
  /** Konten utama kartu. */
  children?: ReactNode;
  /** Warna glow brand. Default ``"none"`` (tanpa glow). */
  glow?: BentoGlow;
  /** Grid span (col/row di lg + col di mobile). */
  span?: BentoCardSpan;
}

// ============================================================================
// Tailwind class maps (literal supaya JIT pickup; tidak boleh template string).
// ============================================================================

/** ``::before`` radial gradient — tanpa DOM ekstra, pakai pseudo-element. */
const GLOW_BEFORE: Record<BentoGlow, string> = {
  none: "",
  emerald: cn(
    "before:content-[''] before:absolute before:inset-0",
    "before:rounded-2xl before:pointer-events-none",
    "before:bg-gradient-to-br before:from-agrowth-500/15 before:via-transparent before:to-transparent",
    "before:opacity-90",
  ),
  amber: cn(
    "before:content-[''] before:absolute before:inset-0",
    "before:rounded-2xl before:pointer-events-none",
    "before:bg-gradient-to-br before:from-amber-500/15 before:via-transparent before:to-transparent",
    "before:opacity-90",
  ),
  danger: cn(
    "before:content-[''] before:absolute before:inset-0",
    "before:rounded-2xl before:pointer-events-none",
    "before:bg-gradient-to-br before:from-danger-500/15 before:via-transparent before:to-transparent",
    "before:opacity-90",
  ),
};

/** Drop-shadow saat hover; selaras tema brand color. */
const HOVER_SHADOW: Record<BentoGlow, string> = {
  none: "hover:shadow-glass-strong",
  emerald: "hover:shadow-glow-emerald",
  amber: "hover:shadow-glow-amber",
  danger: "hover:shadow-glow-danger",
};

/** Border tint untuk membedakan kartu glow vs neutral. */
const BORDER_TINT: Record<BentoGlow, string> = {
  none: "border-glass-border",
  emerald: "border-agrowth-500/25",
  amber: "border-amber-500/25",
  danger: "border-danger-500/25",
};

/** Warna icon mengikuti glow (atau emerald default kalau none). */
const ICON_TINT: Record<BentoGlow, string> = {
  none: "text-agrowth-400",
  emerald: "text-agrowth-400",
  amber: "text-amber-400",
  danger: "text-danger-400",
};

/**
 * Literal map untuk ``lg:col-span-N`` (1..12). Tailwind JIT hanya mendeteksi
 * string utuh, jadi kita hindari template ``lg:col-span-${n}``.
 */
const COL_SPAN_LG: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

const ROW_SPAN_LG: Record<number, string> = {
  1: "lg:row-span-1",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
  4: "lg:row-span-4",
  5: "lg:row-span-5",
  6: "lg:row-span-6",
};

const COL_SPAN_MOBILE: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

// ============================================================================
// Component
// ============================================================================

export function BentoCard({
  title,
  subtitle,
  icon: Icon,
  className,
  children,
  glow = "none",
  span,
}: BentoCardProps) {
  const colMobileClass = COL_SPAN_MOBILE[span?.colMobile ?? 12] ?? "col-span-12";
  const colLgClass = span?.col ? COL_SPAN_LG[span.col] : undefined;
  const rowLgClass = span?.row ? ROW_SPAN_LG[span.row] : undefined;

  return (
    <section
      className={cn(
        // ---------- Layout / grid placement ----------
        "relative isolate overflow-hidden",
        colMobileClass,
        colLgClass,
        rowLgClass,
        // ---------- Glass surface ----------
        "rounded-2xl border bg-glass-dark backdrop-blur-xl",
        "bg-gradient-to-b from-white/[0.04] to-transparent",
        BORDER_TINT[glow],
        "shadow-glass",
        // ---------- Hover ----------
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5",
        HOVER_SHADOW[glow],
        // ---------- Inner glow (::before) ----------
        GLOW_BEFORE[glow],
        // ---------- Content layout ----------
        "flex flex-col gap-3 p-4",
        className,
      )}
    >
      {(Icon || title || subtitle) && (
        <header className="relative z-10 flex items-start gap-3">
          {Icon ? (
            <div
              aria-hidden
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                "bg-glass ring-1 ring-glass-border",
              )}
            >
              <Icon
                className={cn("h-4 w-4", ICON_TINT[glow])}
                strokeWidth={2.25}
                aria-hidden
              />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
            {title ? (
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {subtitle}
              </span>
            ) : null}
          </div>
        </header>
      )}

      <div className="relative z-10 flex flex-1 flex-col gap-2 min-w-0">
        {children}
      </div>
    </section>
  );
}
