"use client";

/**
 * Halaman utama AGROWTH Dashboard.
 *
 * Komposisi:
 * 1. ``<Header />``  sticky di atas (h-14)
 * 2. Grid 12-kolom × 6-baris yang mengisi sisa viewport:
 *    - Kolom 1-7 (col-span-7) × seluruh 6 baris → ``<MapView />``
 *    - Kolom 8-12 (5 kolom kanan) menampung 6 placeholder slot yang akan
 *      diisi komponen real pada iterasi berikutnya (cuaca, mangsa,
 *      forecast, anomaly, risk badge, summary LLM).
 *
 * ``useInitMangsa()`` di-call sekali di top component supaya store
 * langsung punya ``currentMangsa`` saat header pertama kali render.
 */
import {
  AlertTriangle,
  CloudSun,
  Leaf,
  Sparkles,
  Sprout,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Header } from "@/components/layout/Header";
import { MapView } from "@/components/map/MapView";
import { useInitMangsa } from "@/hooks/useInitMangsa";
import { cn } from "@/lib/utils";

interface PlaceholderSlotProps {
  className?: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
}

function PlaceholderSlot({
  className,
  icon: Icon,
  label,
  hint,
}: PlaceholderSlotProps) {
  return (
    <section
      className={cn(
        "glass-panel flex flex-col gap-2 overflow-hidden p-4",
        className,
      )}
    >
      <header className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-agrowth-400" aria-hidden strokeWidth={2.25} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em]">
          {label}
        </h2>
      </header>
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        {hint ?? "— placeholder —"}
      </div>
    </section>
  );
}

export default function HomePage() {
  // Pre-fetch mangsa aktif sehingga Header langsung punya pill terisi.
  useInitMangsa();

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />

      <main
        className={cn(
          "grid flex-1 gap-4 overflow-auto p-4",
          "grid-cols-12 grid-rows-6",
        )}
      >
        {/* ---------- Map (kiri besar) ---------- */}
        <div className="col-span-12 row-span-3 lg:col-span-7 lg:row-span-6">
          <MapView />
        </div>

        {/* ---------- 6 placeholder slot (kanan) ---------- */}
        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5 lg:row-span-2"
          icon={CloudSun}
          label="Cuaca Saat Ini"
          hint="Suhu, kelembapan, curah hujan, angin"
        />

        <PlaceholderSlot
          className="col-span-6 row-span-1 lg:col-span-3"
          icon={AlertTriangle}
          label="Risiko"
          hint="Risk badge"
        />

        <PlaceholderSlot
          className="col-span-6 row-span-1 lg:col-span-2"
          icon={TrendingUp}
          label="Anomali"
        />

        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5"
          icon={Sprout}
          label="Mangsa Aktif"
          hint="Detail Pranata Mangsa hari ini"
        />

        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5"
          icon={Leaf}
          label="Tanaman Direkomendasikan"
          hint="Crop matcher per anomaly"
        />

        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5"
          icon={Sparkles}
          label="Narasi Gemini (Bahasa Jawa)"
          hint="Ringkasan rekomendasi 80–120 kata"
        />
      </main>
    </div>
  );
}
