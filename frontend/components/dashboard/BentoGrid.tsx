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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, MousePointer2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import { ForecastChartCard } from "@/components/dashboard/ForecastChartCard";
import { LocationInfoCard } from "@/components/dashboard/LocationInfoCard";
import { MLPredictivePanel } from "@/components/dashboard/MLPredictivePanel";
import { PranataMangsaCard } from "@/components/dashboard/PranataMangsaCard";
import { RecommendationCard } from "@/components/dashboard/RecommendationCard";
import { RiskGaugeCard } from "@/components/dashboard/RiskGaugeCard";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

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
  // 3. MLPredictivePanel — 4 metrik cuaca + 4 ML variables + pipeline ticker.
  {
    Component: MLPredictivePanel,
    gridClassLg: "lg:col-start-8 lg:col-span-5 lg:row-start-2 lg:row-span-2",
    label: "ML Predictive Variables",
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
// Onboarding overlay
// ============================================================================

/**
 * Overlay onboarding yang tampil saat user belum memilih koordinat.
 *
 * Visual:
 * - Glass-card panel di sisi kanan (di area widget yang sedang empty),
 *   pointer ``ArrowLeft`` ber-bobbing horizontal mengarah ke peta.
 * - Sub-icon ``MousePointer2`` kecil sebagai shorthand "klik".
 * - Teks utama besar + uppercase mono caption sebagai sub-instruksi.
 *
 * Interaksi:
 * - ``pointer-events-none`` di container utama supaya seluruh klik
 *   tetap pass-through ke peta. Map tidak ter-block sama sekali.
 * - Posisi ``absolute right-4 top-1/2 -translate-y-1/2`` (desktop),
 *   centered di mobile.
 *
 * Animasi:
 * - ``AnimatePresence`` di parent membuat overlay fade out smooth
 *   begitu ``selectedCoordinate`` menjadi non-null.
 * - ``ArrowLeft`` punya inner ``motion.div`` dengan ``x: [0, -12, 0]``
 *   loop infinite (1.8s easeInOut) → efek "tarikan" mengarah ke peta.
 * - ``prefers-reduced-motion`` aware: animasi pointer dimatikan, tapi
 *   panel tetap tampil (overlay penting untuk first-run UX).
 */
function OnboardingOverlay({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      key="onboarding"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 z-30",
        // Mobile: pusatkan; desktop: dorong ke kanan dekat area widget.
        "flex items-center justify-center p-4",
        "lg:items-center lg:justify-end lg:p-6",
      )}
    >
      <div
        className={cn(
          "flex max-w-sm flex-col items-center gap-4 text-center",
          "rounded-2xl border border-agrowth-500/40",
          "bg-glass-dark px-6 py-5 backdrop-blur-xl",
          "shadow-glow-emerald",
        )}
      >
        {/* Stack ikon: mouse-pointer kecil di atas arrow besar — narasi
            visual "klik (mouse) ke kiri (arrow) ke peta". */}
        <div className="flex flex-col items-center gap-1">
          <MousePointer2
            className="h-4 w-4 text-agrowth-300"
            strokeWidth={2.25}
            aria-hidden
          />
          <motion.div
            animate={reduced ? undefined : { x: [0, -12, 0] }}
            transition={
              reduced
                ? undefined
                : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            }
            aria-hidden
          >
            <ArrowLeft
              className="h-12 w-12 text-agrowth-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.65)]"
              strokeWidth={2.25}
            />
          </motion.div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold leading-relaxed text-foreground">
            Klik titik di peta Pulau Jawa untuk memulai analisis
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Pranata Mangsa · Cuaca · AI Gemini
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Variants untuk stagger entrance. ``containerVariants`` memicu
 * ``staggerChildren`` yang otomatis menerapkan delay bertingkat
 * ke setiap child ``itemVariants``. Mount-only — tidak re-trigger
 * saat data berubah karena parent ``motion.div`` hanya diberi
 * ``initial="hidden"`` + ``animate="visible"`` (bukan ``key``-change).
 */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export function BentoGrid() {
  const reduced = useReducedMotion() ?? false;
  const hasCoordinate = useAgrowthStore(
    (s) => s.selectedCoordinate !== null,
  );

  return (
    <motion.div
      variants={reduced ? undefined : containerVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
      className={cn(
        // ``relative`` supaya OnboardingOverlay bisa di-absolute di atas.
        "relative",
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
      {SLOTS.map((slot) => (
        <motion.div
          key={slot.label}
          aria-label={slot.label}
          variants={reduced ? undefined : itemVariants}
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

      {/* Onboarding overlay — only when no coordinate selected yet. */}
      <AnimatePresence>
        {hasCoordinate ? null : <OnboardingOverlay reduced={reduced} />}
      </AnimatePresence>
    </motion.div>
  );
}
