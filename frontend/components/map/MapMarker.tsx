"use client";

/**
 * Custom SVG pin marker untuk peta Mapbox AGROWTH.
 *
 * Visual:
 * - Teardrop pin SVG dengan stroke putih + double inner circle.
 *   Warna fill = ``RISK_COLORS[riskLevel].hex`` (emerald default bila ``null``).
 * - Outer ring ber-``animate-pulse-glow`` + ``scale-150`` untuk efek nadi
 *   (rhythm emerald khas brand) dengan tint dinamis sesuai risk.
 *
 * Animasi (framer-motion):
 * - Entrance: scale 0 → 1 + fade-in (overshoot easing, sekali pakai).
 * - Continuous: bob vertikal y antara -2 ↔ 2 (loop infinite, easeInOut).
 *
 * Pin di-anchor ke ``bottom`` sehingga ujung tail menunjuk tepat ke
 * koordinat ``(lng, lat)``.
 */
import { motion } from "framer-motion";
import { Marker } from "react-map-gl";

import { RISK_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

export interface MapMarkerProps {
  /** Longitude koordinat (derajat). */
  lng: number;
  /** Latitude koordinat (derajat). */
  lat: number;
  /**
   * Tingkat risiko untuk warna pin. ``null`` / undefined → emerald
   * default (saat data weather belum siap).
   */
  riskLevel?: RiskLevel | null;
  /** Class tambahan untuk wrapper terluar. */
  className?: string;
}

/** Warna emerald default (agrowth-500) saat risk belum diketahui. */
const DEFAULT_HEX = "#10b981";

export function MapMarker({
  lng,
  lat,
  riskLevel,
  className,
}: MapMarkerProps) {
  const color = riskLevel ? RISK_COLORS[riskLevel].hex : DEFAULT_HEX;

  return (
    <Marker longitude={lng} latitude={lat} anchor="bottom">
      {/* Wrapper entrance: scale 0 → 1 (one-shot, overshoot). */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className={cn("relative", className)}
        aria-label="Marker koordinat terpilih"
      >
        {/* Continuous float: y -2 ↔ 2 (loop infinite). */}
        <motion.div
          animate={{ y: [-2, 2, -2] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          {/* Outer pulse-glow ring (emerald rhythm + dynamic tint). */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[18px] h-9 w-9 -translate-x-1/2 -translate-y-1/2 scale-150 animate-pulse-glow rounded-full"
            style={{ backgroundColor: `${color}1f` /* ~12% opacity tint */ }}
          />

          {/* SVG teardrop pin — fill berdasarkan risk level. */}
          <svg
            viewBox="0 0 32 44"
            width="36"
            height="49"
            className="relative drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]"
            role="img"
            aria-hidden
          >
            <path
              d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z"
              fill={color}
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {/* Inner halo (white). */}
            <circle cx={16} cy={16} r={6} fill="#ffffff" fillOpacity={0.95} />
            {/* Inner dot (risk color). */}
            <circle cx={16} cy={16} r={3} fill={color} />
          </svg>
        </motion.div>
      </motion.div>
    </Marker>
  );
}
