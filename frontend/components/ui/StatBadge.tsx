"use client";

/**
 * Pill kompak untuk status/metric kecil di dalam BentoCard.
 *
 * Bentuk: dot + label (mono uppercase) + value (semibold), satu baris,
 * rounded-full, padded ringan. Cocok untuk merepresentasikan:
 * - Tingkat risiko ("Rendah", "Sedang", "Tinggi", "Kritis")
 * - Anomali iklim ("Normal", "Banjir", "Drought")
 * - Mangsa aktif ("#7 Kapitu")
 * - Suhu / kelembapan ringkas
 *
 * Variant memetakan ke palet brand:
 * - ``success`` → emerald (agrowth)
 * - ``warning`` → amber
 * - ``danger``  → merah (danger)
 *
 * Default ``success`` supaya konsumen yang tidak men-set variant tetap
 * dapat tampilan netral-positif.
 *
 * Usage::
 *
 *     <StatBadge label="Risiko" value="Rendah" variant="success" />
 *     <StatBadge label="Anomali" value="Banjir" variant="danger" />
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatBadgeVariant = "success" | "warning" | "danger";

export interface StatBadgeProps {
  /** Label kiri (mis. "Risiko", "Mangsa", "Suhu"). */
  label: string;
  /** Value kanan (string atau number). */
  value: ReactNode;
  /** Warna variant. Default ``"success"``. */
  variant?: StatBadgeVariant;
  /** Class tambahan untuk pill terluar. */
  className?: string;
  /**
   * Aria label override; default akan men-gabungkan ``label`` + ``value``
   * supaya screen reader membaca ringkas.
   */
  "aria-label"?: string;
}

/** Border + bg per variant. */
const VARIANT_BG: Record<StatBadgeVariant, string> = {
  success: "border-agrowth-500/30 bg-agrowth-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  danger: "border-danger-500/30 bg-danger-500/10",
};

/** Warna dot accent per variant. */
const VARIANT_DOT: Record<StatBadgeVariant, string> = {
  success: "bg-agrowth-400",
  warning: "bg-amber-400",
  danger: "bg-danger-400",
};

/** Glow halus di sekeliling dot, mengikuti variant. */
const VARIANT_DOT_GLOW: Record<StatBadgeVariant, string> = {
  success: "shadow-[0_0_8px_rgba(16,185,129,0.55)]",
  warning: "shadow-[0_0_8px_rgba(245,158,11,0.55)]",
  danger: "shadow-[0_0_8px_rgba(239,68,68,0.55)]",
};

export function StatBadge({
  label,
  value,
  variant = "success",
  className,
  "aria-label": ariaLabel,
}: StatBadgeProps) {
  const a11y = ariaLabel ?? `${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}`;

  return (
    <span
      role="status"
      aria-label={a11y}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        "rounded-full border px-2.5 py-1",
        VARIANT_BG[variant],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          VARIANT_DOT[variant],
          VARIANT_DOT_GLOW[variant],
        )}
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-semibold leading-none text-foreground">
        {value}
      </span>
    </span>
  );
}
