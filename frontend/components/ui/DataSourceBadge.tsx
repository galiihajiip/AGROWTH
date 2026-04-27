"use client";

/**
 * Badge pill kecil yang menunjukkan status sumber data cuaca.
 *
 * Tampil di pojok kanan bawah ``WeatherMetricsCard``:
 * - Icon database (16px) + teks "Simulasi Demo"
 * - Warna: amber background muted, amber text
 * - Tooltip saat hover menjelaskan pipeline data yang sudah disiapkan
 *
 * Dirancang untuk transparansi kepada juri hackathon bahwa data
 * disimulasikan tapi pipeline ke sumber real sudah ada.
 */
import { Database } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface DataSourceBadgeProps {
  className?: string;
}

export function DataSourceBadge({ className }: DataSourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full",
          "border border-amber-500/25 bg-amber-500/10",
          "px-2 py-0.5",
          "text-[11px] font-medium text-amber-300/90",
          "transition-colors duration-200",
          "hover:bg-amber-500/15 hover:text-amber-200",
          "cursor-help",
        )}
        aria-label="Info sumber data"
      >
        <Database className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        <span>Simulasi Demo</span>
      </button>

      {showTooltip ? (
        <div
          role="tooltip"
          className={cn(
            "absolute bottom-full right-0 z-50 mb-2",
            "w-64 rounded-lg px-3 py-2",
            "bg-[#1a1a2e]/95 backdrop-blur-md",
            "border border-white/10 shadow-xl",
            "text-[11px] leading-relaxed text-white/80",
            "animate-in fade-in slide-in-from-bottom-1 duration-150",
          )}
        >
          Data cuaca disimulasikan secara deterministik untuk stabilitas
          demo. Pipeline integrasi ke BMKG Open API &amp; NASA POWER API
          sudah disiapkan di{" "}
          <span className="font-mono text-amber-300/80">
            backend/app/services/
          </span>{" "}
          dan dapat diaktifkan dengan konfigurasi environment.
        </div>
      ) : null}
    </div>
  );
}
