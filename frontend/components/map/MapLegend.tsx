"use client";

/**
 * Legend overlay untuk vulnerability layer di peta.
 *
 * Posisi: absolute pojok kiri bawah MapView, di atas kontrol navigasi.
 * Dua baris: dot biru "Rentan Banjir" + dot oranye "Rentan Kekeringan".
 * Background glassmorphism ringan. Hanya tampil saat
 * ``showVulnerabilityLayer`` = true.
 */
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

interface LegendItemProps {
  color: string;
  label: string;
}

function LegendItem({ color, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[11px] font-medium text-white/80">{label}</span>
    </div>
  );
}

export function MapLegend() {
  const show = useAgrowthStore((s) => s.showVulnerabilityLayer);

  if (!show) return null;

  return (
    <div className="absolute bottom-10 left-2.5 z-10">
      <div
        className={cn(
          "flex flex-col gap-1.5 rounded-lg px-3 py-2",
          "bg-black/50 backdrop-blur-md",
          "border border-white/10 shadow-lg",
        )}
      >
        <LegendItem color="#3B82F6" label="Rentan Banjir" />
        <LegendItem color="#F97316" label="Rentan Kekeringan" />
      </div>
    </div>
  );
}
