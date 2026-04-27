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
 *
 * ``MapView`` di-load via :func:`dynamic` dengan ``ssr: false`` karena
 * ``mapbox-gl`` mengakses ``window``/``document`` saat init dan token
 * Mapbox di-validasi di runtime (lihat ``assertMapboxToken``); render
 * di server akan throw saat token belum di-set. Pendekatan ini menjaga
 * ``next build`` tetap hijau dan halaman lain (Header + slot) tetap
 * di-prerender secara statis.
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
import dynamic from "next/dynamic";

import { ErrorToast } from "@/components/feedback/ErrorToast";
import { Header } from "@/components/layout/Header";
import { useInitMangsa } from "@/hooks/useInitMangsa";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

const MapView = dynamic(
  () => import("@/components/map/MapView").then((mod) => mod.MapView),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel h-full w-full animate-pulse"
        aria-label="Memuat peta…"
        role="status"
      />
    ),
  },
);

interface PlaceholderSlotProps {
  className?: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  /**
   * Pesan empty-state saat user belum memilih koordinat (mis. "Klik di
   * peta untuk mulai"). Akan menggantikan ``hint`` jika ``hasData`` false.
   */
  emptyHint?: string;
  /** True bila slot sudah punya data nyata (akan ditampilkan oleh widget). */
  hasData?: boolean;
  /** True bila fetch sedang berjalan; tampilkan shimmer skeleton. */
  isLoading?: boolean;
}

function PlaceholderSlot({
  className,
  icon: Icon,
  label,
  hint,
  emptyHint,
  hasData = false,
  isLoading = false,
}: PlaceholderSlotProps) {
  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="flex flex-1 flex-col gap-2" aria-label="Memuat data…">
        <div className="h-3 w-3/4 animate-pulse rounded bg-glass" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-glass" />
        <div className="mt-auto h-2.5 w-2/3 animate-pulse rounded bg-glass" />
      </div>
    );
  } else if (!hasData && emptyHint) {
    body = (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground/80">
        {emptyHint}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        {hint ?? "— placeholder —"}
      </div>
    );
  }

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
      {body}
    </section>
  );
}

export default function HomePage() {
  // Pre-fetch mangsa aktif sehingga Header langsung punya pill terisi.
  useInitMangsa();

  // State umum untuk semua slot placeholder (sebelum widget real terpasang).
  const hasCoordinate = useAgrowthStore(
    (state) => state.selectedCoordinate !== null,
  );
  const isLoading = useAgrowthStore(
    (state) => state.isLoadingRecommendation,
  );
  const hasRecommendation = useAgrowthStore(
    (state) => state.recommendationData !== null,
  );

  const slotState = {
    isLoading,
    hasData: hasRecommendation,
    emptyHint: hasCoordinate ? undefined : "Klik di peta untuk mulai",
  };

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
          {...slotState}
        />

        <PlaceholderSlot
          className="col-span-6 row-span-1 lg:col-span-3"
          icon={AlertTriangle}
          label="Risiko"
          hint="Risk badge"
          {...slotState}
        />

        <PlaceholderSlot
          className="col-span-6 row-span-1 lg:col-span-2"
          icon={TrendingUp}
          label="Anomali"
          {...slotState}
        />

        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5"
          icon={Sprout}
          label="Mangsa Aktif"
          hint="Detail Pranata Mangsa hari ini"
          // Mangsa tidak butuh koordinat — selalu treat as data-ready.
          hasData
          isLoading={false}
        />

        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5"
          icon={Leaf}
          label="Tanaman Direkomendasikan"
          hint="Crop matcher per anomaly"
          {...slotState}
        />

        <PlaceholderSlot
          className="col-span-12 row-span-1 lg:col-span-5"
          icon={Sparkles}
          label="Narasi Gemini (Bahasa Jawa)"
          hint="Ringkasan rekomendasi 80–120 kata"
          {...slotState}
        />
      </main>

      {/* Toast error global (subscribe ke state.error) */}
      <ErrorToast />
    </div>
  );
}
