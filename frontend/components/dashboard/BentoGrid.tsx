"use client";

/**
 * Komposisi final 7 kartu dashboard AGROWTH dalam grid 12-kolom.
 *
 * Layout (lg breakpoint, ``grid-cols-12`` minimum 6 baris):
 *
 * ```
 *           col 1 — 7                    | col 8 — 12
 *  row 1:   MapView (col 1-7, row 1-4)   | LocationInfo (col 8-12, row 1)
 *  row 2:   MapView                      | WeatherMetrics (col 8-12, row 2-3)
 *  row 3:   MapView                      | WeatherMetrics
 *  row 4:   MapView                      | RecommendationCard (col 8-12, row 4-6)
 *  row 5:   PranataMangsa (col 1-4, row 5-6)
 *           + RiskGauge (col 5-7, row 5-6) | (Recommendation cont.)
 *  row 6:   PranataMangsa + RiskGauge      | (Recommendation cont.)
 *  row 7:   ForecastChart (col 1-7, row 7-8)
 *  row 8:   ForecastChart                | (kosong, scroll-friendly)
 * ```
 *
 * Mobile (<lg): seluruh kartu collapse ke ``col-span-12`` dan stack
 * vertikal mengikuti urutan source (``SLOTS``).
 *
 * Animation:
 * - Setiap kartu fade-in + slide-up via ``motion.div`` wrapper
 *   (``opacity 0→1``, ``y 8→0``) dengan ``delay = index * 0.05`` (50ms
 *   stagger). Easing out-expo. ``prefers-reduced-motion`` aware.
 * - Animasi bersifat one-shot saat mount; widget yang punya animasi
 *   internal (counter, path drawing, FadeInWords) menangani perubahan
 *   data berikutnya secara mandiri.
 *
 * Map module di-load via ``next/dynamic`` dengan ``ssr: false`` karena
 * ``mapbox-gl`` mengakses ``window``/``document`` saat init dan
 * ``assertMapboxToken`` throw bila ``NEXT_PUBLIC_MAPBOX_TOKEN`` belum
 * di-set.
 */
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { ForecastChartCard } from "@/components/dashboard/ForecastChartCard";
import { LocationInfoCard } from "@/components/dashboard/LocationInfoCard";
import { PranataMangsaCard } from "@/components/dashboard/PranataMangsaCard";
import { RecommendationCard } from "@/components/dashboard/RecommendationCard";
import { RiskGaugeCard } from "@/components/dashboard/RiskGaugeCard";
import { WeatherMetricsCard } from "@/components/dashboard/WeatherMetricsCard";
import { cn } from "@/lib/utils";

// MapView client-only (mapbox-gl + assertMapboxToken).
const MapView = dynamic(
  () => import("@/components/map/MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Memuat peta…"
        className="h-full w-full animate-pulse rounded-2xl border border-glass-border bg-glass-dark backdrop-blur-xl"
      />
    ),
  },
);

// ============================================================================
// Layout descriptor
// ============================================================================

interface CardSlot {
  /** React component to render. */
  Component: ComponentType<{ className?: string }>;
  /**
   * Tailwind utility classes untuk grid placement pada lg+ breakpoint.
   * Mobile (<lg): wrapper otomatis pakai ``col-span-12`` (stack vertical).
   *
   * Pakai literal class strings supaya Tailwind JIT mendeteksi
   * (template string tidak dipick up).
   */
  gridClassLg: string;
  /** Aria-label wrapper motion.div untuk a11y + debug. */
  label: string;
}

/**
 * Source order = stagger animation order (index 0 muncul paling awal).
 * Visual placement di lg+ dikontrol via ``gridClassLg`` sehingga urutan
 * DOM bebas dari urutan visual.
 */
const SLOTS: readonly CardSlot[] = [
  // 1. MapView — fokus utama, muncul paling awal.
  {
    Component: MapView as ComponentType<{ className?: string }>,
    gridClassLg: "lg:col-start-1 lg:col-span-7 lg:row-start-1 lg:row-span-4",
    label: "Peta interaktif",
  },
  // 2. LocationInfoCard — status singkat di pojok kanan-atas.
  {
    Component: LocationInfoCard,
    gridClassLg: "lg:col-start-8 lg:col-span-5 lg:row-start-1 lg:row-span-1",
    label: "Informasi lokasi",
  },
  // 3. WeatherMetricsCard — 4 metrik cuaca.
  {
    Component: WeatherMetricsCard,
    gridClassLg: "lg:col-start-8 lg:col-span-5 lg:row-start-2 lg:row-span-2",
    label: "Metrik cuaca",
  },
  // 4. RecommendationCard — hero AI narrative.
  {
    Component: RecommendationCard,
    gridClassLg: "lg:col-start-8 lg:col-span-5 lg:row-start-4 lg:row-span-3",
    label: "Rekomendasi AI",
  },
  // 5. PranataMangsaCard — kearifan lokal.
  {
    Component: PranataMangsaCard,
    gridClassLg: "lg:col-start-1 lg:col-span-4 lg:row-start-5 lg:row-span-2",
    label: "Mangsa aktif",
  },
  // 6. RiskGaugeCard — gauge skor risiko.
  {
    Component: RiskGaugeCard,
    gridClassLg: "lg:col-start-5 lg:col-span-3 lg:row-start-5 lg:row-span-2",
    label: "Risiko iklim",
  },
  // 7. ForecastChartCard — chart 7-hari.
  {
    Component: ForecastChartCard,
    gridClassLg: "lg:col-start-1 lg:col-span-7 lg:row-start-7 lg:row-span-2",
    label: "Prakiraan 7 hari",
  },
];

// ============================================================================
// Component
// ============================================================================

export function BentoGrid() {
  const reduced = useReducedMotion();

  return (
    <div
      className={cn(
        // Mobile: single column flow via col-span-12 default per slot.
        "grid grid-cols-12 gap-4",
        // Tinggi baris auto sesuai konten dengan minimum 120px supaya
        // chart/canvas punya ruang yang masuk akal.
        "auto-rows-[minmax(120px,auto)]",
        // Di lg+, definisikan 6 baris awal sama tinggi (1fr) supaya
        // kartu yang dirancang untuk row-span tertentu konsisten;
        // baris ke-7 dan ke-8 dipakai oleh ForecastChartCard via
        // auto-rows ekstensi.
        "lg:grid-rows-[repeat(6,minmax(120px,1fr))]",
        "lg:auto-rows-[minmax(120px,1fr)]",
      )}
    >
      {SLOTS.map((slot, i) => (
        <motion.div
          key={slot.label}
          aria-label={slot.label}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  duration: 0.5,
                  delay: i * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }
          }
          className={cn(
            // Mobile default: full width.
            "col-span-12",
            // Desktop: explicit grid placement.
            slot.gridClassLg,
          )}
        >
          <slot.Component className="h-full" />
        </motion.div>
      ))}
    </div>
  );
}
