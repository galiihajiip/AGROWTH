"use client";

/**
 * Loading skeleton untuk widget BentoCard.
 *
 * Visual:
 * - Glass-panel base (sama dengan BentoCard) supaya transisi loading →
 *   loaded tidak meng-shift layout.
 * - Beberapa baris ``bg-glass`` dengan lebar bervariasi sebagai
 *   placeholder teks / metric.
 * - Overlay shimmer: ``bg-gradient-shimmer`` (gradient putih transparan
 *   90deg) di atas baseline, di-animasikan via ``animate-shimmer``
 *   keyframes (background-position bergeser -200% → 200%, 2.4s linear,
 *   loop). Pakai ``bg-[length:200%_100%]`` supaya geseran cukup panjang
 *   untuk efek "wave melintas" yang halus.
 *
 * Aksesibilitas:
 * - ``role="status"`` + ``aria-busy="true"`` + ``aria-label="Memuat data…"``
 *   sehingga screen reader tahu konten masih loading. Konten visual
 *   diberi ``aria-hidden`` supaya tidak ramai dibacakan.
 *
 * Tidak menerima ikon/title — saat data sudah siap, parent akan
 * meng-replace skeleton dengan BentoCard isi sesungguhnya. Memisahkan
 * skeleton dari BentoCard mempermudah parent untuk swap antar mode
 * tanpa men-leak prop loading ke BentoCard sendiri.
 */
import { cn } from "@/lib/utils";

export interface CardSkeletonProps {
  /** Class tambahan untuk container (mis. grid placement). */
  className?: string;
  /**
   * Jumlah baris placeholder (default 3). Cocok untuk slot kecil (1-2)
   * atau slot besar (3-4 baris).
   */
  lines?: number;
  /** Tampilkan placeholder header (icon chip + title bar). Default ``true``. */
  showHeader?: boolean;
}

/**
 * Lebar acak-tampak konsisten supaya skeleton tidak terlihat
 * "perfect rectangle". Diiterasi modulo per index supaya stabil
 * antar render (tidak random tiap mount → bebas hydration mismatch).
 */
const LINE_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3"] as const;

export function CardSkeleton({
  className,
  lines = 3,
  showHeader = true,
}: CardSkeletonProps) {
  const safeLines = Math.max(1, Math.min(6, lines));

  return (
    <section
      role="status"
      aria-busy="true"
      aria-label="Memuat data…"
      className={cn(
        "relative isolate overflow-hidden",
        "rounded-2xl border border-glass-border bg-glass-dark backdrop-blur-xl",
        "bg-gradient-to-b from-white/[0.04] to-transparent",
        "shadow-glass",
        "flex flex-col gap-3 p-4",
        className,
      )}
    >
      {/* ---------- Header skeleton ---------- */}
      {showHeader ? (
        <div aria-hidden className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-glass ring-1 ring-glass-border" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-1/3 rounded bg-glass" />
            <div className="h-2 w-1/4 rounded bg-glass/70" />
          </div>
        </div>
      ) : null}

      {/* ---------- Content lines ---------- */}
      <div aria-hidden className="flex flex-1 flex-col justify-end gap-2">
        {Array.from({ length: safeLines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 rounded bg-glass",
              LINE_WIDTHS[i % LINE_WIDTHS.length],
            )}
          />
        ))}
      </div>

      {/* ---------- Shimmer overlay ----------
          ``animate-shimmer`` keyframes meng-geser background-position;
          ``bg-[length:200%_100%]`` memperlebar gradient supaya gerakan
          terlihat melintang penuh. ``mix-blend-screen`` membuat overlay
          membaur ringan dengan baseline glass tanpa menggelapkan. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          "bg-gradient-shimmer bg-[length:200%_100%]",
          "animate-shimmer",
          "mix-blend-screen opacity-70",
        )}
      />
    </section>
  );
}
