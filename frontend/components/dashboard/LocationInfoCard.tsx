"use client";

/**
 * Kartu ringkas info lokasi terpilih.
 *
 * Konten saat ada koordinat:
 * - Region name (provinsi dari ``recommendation.location.province``)
 * - Lat/lon dengan presisi 5 desimal (~1 m), font-mono muted, tabular
 *   nums supaya tidak "jumping" saat angka berubah.
 * - "X menit lalu" relatif dari ``recommendation.generated_at``,
 *   diawali ikon ``Clock``. Auto-refresh tiap 5 detik via interval
 *   sehingga timestamp tetap akurat tanpa user interaction.
 * - Tombol "Reset" yang memanggil ``store.reset()`` — clears
 *   selectedCoordinate, recommendationData, dan error sekaligus.
 *
 * State transisi (selectedCoordinate set tapi recommendation belum
 * datang):
 * - Region name: placeholder "Memuat lokasi…"
 * - Lat/lon tetap tampil (sudah ada di store)
 * - Timestamp tersembunyi
 * - Reset tetap aktif
 *
 * Empty state (sebelum klik peta):
 * - Ikon ``ArrowUpLeft`` ber-``animate-float`` mengarah ke peta (kiri)
 *   sebagai affordance visual.
 * - Subtle text "Klik di peta untuk memilih lokasi".
 *
 * BentoCard subtitle adaptif: "Koordinat aktif" saat ada lokasi,
 * "Belum dipilih" saat empty.
 */
import { ArrowUpLeft, Clock, MapPin, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format selisih waktu jadi label Bahasa Indonesia ringkas.
 *
 * Threshold:
 * - <5s     → "baru saja"
 * - <60s    → "X detik lalu"
 * - <60min  → "X menit lalu"
 * - <24h    → "X jam lalu"
 * - selain  → "X hari lalu"
 */
function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const diffSec = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (diffSec < 5) return "baru saja";
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

/**
 * Hook: ``Date`` yang re-render tiap ``intervalMs``.
 *
 * Default 5s — cukup responsif supaya "X menit lalu" pindah ke
 * "X+1 menit lalu" dalam 5 detik setelah threshold tercapai, tanpa
 * memboroskan render budget.
 */
function useTickingNow(intervalMs = 5_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ============================================================================
// Public component
// ============================================================================

export interface LocationInfoCardProps {
  className?: string;
  /** Override grid placement; default ``{ col: 3, row: 2 }``. */
  span?: BentoCardSpan;
}

export function LocationInfoCard({ className, span }: LocationInfoCardProps) {
  const coordinate = useAgrowthStore((s) => s.selectedCoordinate);
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const reset = useAgrowthStore((s) => s.reset);

  const now = useTickingNow();

  const hasCoordinate = coordinate !== null;
  const loc = recommendation?.location ?? null;
  const kelurahan = loc?.kelurahan ?? null;
  const kecamatan = loc?.kecamatan ?? null;
  const kabupaten = loc?.region ?? null;
  const provinsi   = loc?.province ?? null;
  const generatedAt = recommendation?.generated_at ?? null;

  const locationReady = !!(kelurahan || kecamatan || kabupaten || provinsi);

  return (
    <BentoCard
      title="Lokasi"
      subtitle={hasCoordinate ? "Koordinat aktif" : "Belum dipilih"}
      icon={MapPin}
      glow="emerald"
      span={span ?? { col: 3, row: 2 }}
      className={className}
    >
      {hasCoordinate ? (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          {/* Kiri: hierarki lokasi */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {locationReady ? (
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {[kelurahan, kecamatan ? `Kec. ${kecamatan}` : null, kabupaten]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : (
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                Memuat lokasi…
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {provinsi && (
                <span className="text-[11px] font-medium text-agrowth-400/80">
                  {provinsi}
                </span>
              )}
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                {coordinate.lat.toFixed(4)}°, {coordinate.lon.toFixed(4)}°
              </span>
              {generatedAt && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
                  {relativeTime(generatedAt, now)}
                </span>
              )}
            </div>
          </div>

          {/* Kanan: reset */}
          <button
            type="button"
            onClick={reset}
            aria-label="Reset lokasi terpilih"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md",
              "border border-glass-border bg-glass px-2.5 py-1",
              "text-xs font-medium text-muted-foreground",
              "transition-colors duration-200",
              "hover:bg-glass-strong hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
            )}
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Reset
          </button>
        </div>
      ) : (
        // Empty state
        <div className="flex flex-1 items-center gap-3">
          <ArrowUpLeft
            className="h-6 w-6 animate-float text-muted-foreground/50"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-muted-foreground/70">
            Klik di peta untuk memilih lokasi koordinat.
          </p>
        </div>
      )}
    </BentoCard>
  );
}
