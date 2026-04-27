"use client";

/**
 * Kartu Pranata Mangsa untuk dashboard AGROWTH.
 *
 * Konten:
 * - Nama mangsa besar font-serif italic (highlight kearifan lokal).
 * - Periode mangsa "22 Des – 2 Feb · 43 hari · hujan" (muted text).
 * - Mini progress bar: hari ke-X dari total durasi, dihitung dari
 *   ``today vs DOY`` (mendukung wrap-around Kapitu 22 Des – 2 Feb).
 * - Deskripsi singkat (``mangsa.description``) di-clamp 2 baris.
 * - 3 tanda alam (``mangsa.characteristics``) dengan ikon ``Sparkles``.
 * - Background batik subtle: SVG data-URI parang-style wavy lines,
 *   tile-able 60×60, opacity ~25% supaya nyatu sebagai tekstur tanpa
 *   melawan konten.
 *
 * Catatan kontrak data:
 * Backend memetakan JSON ``natural_signs`` → field
 * ``MangsaInfo.characteristics`` dan JSON ``characteristics`` →
 * ``MangsaInfo.description``. Lihat
 * ``backend/app/services/pranata_mangsa.py``::``_to_mangsa_info``.
 *
 * Sumber state: ``useAgrowthStore.currentMangsa`` (di-populate sekali
 * di mount oleh ``useInitMangsa()``). Tidak bergantung pada
 * ``selectedCoordinate`` — mangsa aktif berbasis tanggal hari ini.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { MangsaInfo } from "@/types";

// ============================================================================
// Helpers — DOY arithmetic + label formatting
// ============================================================================

/** Hari kumulatif per bulan untuk tahun non-kabisat (selaras backend). */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const ID_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

/**
 * Sum hari kumulatif dari bulan 1 sampai (``month - 1``) inklusif,
 * berbasis tahun non-kabisat.
 *
 * Helper kecil supaya akses ``MONTH_DAYS[i]`` aman terhadap
 * ``noUncheckedIndexedAccess`` (default ``0`` bila out-of-range).
 */
function cumulativeDaysBefore(month: number): number {
  const m = Math.max(1, Math.min(12, month));
  let acc = 0;
  for (let i = 0; i < m - 1; i++) {
    acc += MONTH_DAYS[i] ?? 0;
  }
  return acc;
}

/** ``Date`` → DOY (1..365). 29 Feb di-collapse ke 28 Feb (DOY 59). */
function dateToDoy(d: Date): number {
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (month === 2 && day === 29) return 59;
  return cumulativeDaysBefore(month) + day;
}

/** "MM-DD" → DOY (1..365). */
function mmddToDoy(mmdd: string): number {
  const parts = mmdd.split("-").map(Number);
  const m = parts[0];
  const d = parts[1];
  if (m === undefined || d === undefined || Number.isNaN(m) || Number.isNaN(d)) {
    return 1;
  }
  return cumulativeDaysBefore(m) + d;
}

/** "MM-DD" → "22 Des" (Bahasa Indonesia, bulan singkat). */
function formatMmDd(mmdd: string): string {
  const parts = mmdd.split("-").map(Number);
  const m = parts[0];
  const d = parts[1];
  if (!m || !d) return mmdd;
  const month = ID_MONTHS_SHORT[m - 1] ?? "";
  return `${d} ${month}`;
}

/**
 * Hitung hari ke-X user berada dalam mangsa (1..duration_days).
 *
 * Mendukung wrap-around (Kapitu: start_doy=356, end_doy=33). Bila
 * ``today`` di luar periode mangsa (mis. backend mengembalikan
 * mangsa stale), hasilnya di-clamp ke ``[1, duration_days]`` supaya
 * progress bar tetap valid 0..1.
 */
function daysIntoMangsa(today: Date, mangsa: MangsaInfo): number {
  const todayDoy = dateToDoy(today);
  const startDoy = mmddToDoy(mangsa.period_start);
  const endDoy = mmddToDoy(mangsa.period_end);
  const duration = Math.max(1, mangsa.duration_days);

  let raw: number;
  if (startDoy <= endDoy) {
    raw = todayDoy - startDoy + 1;
  } else if (todayDoy >= startDoy) {
    // Masih di sisi tahun lama (mis. 25 Des untuk Kapitu).
    raw = todayDoy - startDoy + 1;
  } else {
    // Sudah lewat pergantian tahun (mis. 5 Jan untuk Kapitu).
    raw = 365 - startDoy + todayDoy + 1;
  }

  return Math.min(duration, Math.max(1, raw));
}

// ============================================================================
// Background batik (SVG data-URI)
// ============================================================================

/**
 * Pola batik mini: 3 ``S-curve`` (parang-style) yang tile 60×60.
 * Stroke pakai brand emerald + amber dengan opacity rendah supaya
 * cuma terasa sebagai tekstur subtle, tidak mengganggu legibility teks.
 */
const BATIK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><path d='M0 30 Q 15 5 30 30 T 60 30' fill='none' stroke='rgba(16,185,129,0.22)' stroke-width='1.2'/><path d='M-30 30 Q -15 5 0 30 T 30 30' fill='none' stroke='rgba(16,185,129,0.22)' stroke-width='1.2'/><path d='M0 60 Q 15 35 30 60 T 60 60' fill='none' stroke='rgba(245,158,11,0.18)' stroke-width='1.2'/></svg>`;

const BATIK_DATA_URI = `url("data:image/svg+xml;utf8,${encodeURIComponent(BATIK_SVG)}")`;

// ============================================================================
// Sub-components
// ============================================================================

interface ProgressBarProps {
  /** 0..1, sudah di-clamp. */
  progress: number;
  daysInto: number;
  total: number;
  reducedMotion: boolean;
}

function ProgressBar({ progress, daysInto, total, reducedMotion }: ProgressBarProps) {
  const pct = Math.round(progress * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Hari berjalan
        </span>
        <span className="font-mono text-xs tabular-nums text-foreground">
          {daysInto}/{total} <span className="text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={daysInto}
        aria-label={`Hari ke-${daysInto} dari ${total}`}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-glass"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-agrowth-500 to-agrowth-300"
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }
          }
        />
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="relative flex flex-1 flex-col gap-3" aria-busy="true">
      {/* Mangsa name */}
      <div>
        <div className="h-9 w-2/5 rounded bg-glass" />
        <div className="mt-1.5 h-3 w-3/5 rounded bg-glass/80" />
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="h-3 w-12 rounded bg-glass" />
          <div className="h-3 w-16 rounded bg-glass" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-glass" />
      </div>

      {/* Description (2 lines) */}
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-full rounded bg-glass" />
        <div className="h-3 w-4/5 rounded bg-glass/80" />
      </div>

      {/* 3 natural signs */}
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 shrink-0 rounded bg-glass" />
            <div className={cn("h-3 rounded bg-glass", i === 1 ? "w-3/5" : "w-3/4")} />
          </div>
        ))}
      </div>

      {/* Single shimmer overlay nutupin semua placeholder. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-shimmer bg-[length:200%_100%] animate-shimmer mix-blend-screen opacity-70"
      />
    </div>
  );
}

// ============================================================================
// Public component
// ============================================================================

export interface PranataMangsaCardProps {
  className?: string;
  /** Override grid placement; default ``{ col: 5, row: 2 }``. */
  span?: BentoCardSpan;
}

export function PranataMangsaCard({ className, span }: PranataMangsaCardProps) {
  const mangsa = useAgrowthStore((s) => s.currentMangsa);
  const reducedMotion = useReducedMotion() ?? false;

  // Memo supaya kalkulasi DOY tidak jalan tiap render (cuma saat mangsa
  // berubah, yaitu ~sekali per session karena mangsa update harian).
  const progressData = useMemo(() => {
    if (!mangsa) return null;
    const daysInto = daysIntoMangsa(new Date(), mangsa);
    return {
      daysInto,
      total: mangsa.duration_days,
      progress: daysInto / Math.max(1, mangsa.duration_days),
    };
  }, [mangsa]);

  return (
    <BentoCard
      title="Mangsa Aktif"
      subtitle="Kearifan Lokal Jawa"
      icon={Calendar}
      glow="emerald"
      span={span ?? { col: 5, row: 2 }}
      className={cn("relative", className)}
    >
      {/* Batik backdrop — di-render sebagai child pertama supaya stack di
          bawah konten. ``pointer-events-none`` agar tidak mencegat klik. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: BATIK_DATA_URI,
          backgroundRepeat: "repeat",
          backgroundSize: "60px 60px",
        }}
      />

      {mangsa === null || progressData === null ? (
        <ContentSkeleton />
      ) : (
        <div className="relative flex flex-1 flex-col gap-3">
          {/* ----- Nama mangsa + period label ----- */}
          <div>
            <h3
              className={cn(
                "font-serif text-3xl font-semibold italic leading-tight tracking-tight text-foreground",
              )}
            >
              {mangsa.name}
              <span className="ml-2 align-middle font-mono text-xs not-italic text-muted-foreground">
                #{mangsa.number}
              </span>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMmDd(mangsa.period_start)} – {formatMmDd(mangsa.period_end)}
              <span className="px-1">·</span>
              {mangsa.duration_days} hari
              <span className="px-1">·</span>
              <span className="capitalize">{mangsa.season}</span>
            </p>
          </div>

          {/* ----- Mini progress bar ----- */}
          <ProgressBar
            progress={progressData.progress}
            daysInto={progressData.daysInto}
            total={progressData.total}
            reducedMotion={reducedMotion}
          />

          {/* ----- Deskripsi singkat (2 baris) ----- */}
          {mangsa.description ? (
            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {mangsa.description}
            </p>
          ) : null}

          {/* ----- Natural signs (max 3) ----- */}
          {mangsa.characteristics.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {mangsa.characteristics.slice(0, 3).map((sign, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                >
                  <Sparkles
                    className="mt-0.5 h-3 w-3 shrink-0 text-agrowth-400"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span className="line-clamp-2">{sign}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </BentoCard>
  );
}
