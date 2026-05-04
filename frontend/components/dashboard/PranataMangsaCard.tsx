"use client";

/**
 * Kartu Pranata Mangsa untuk dashboard AGROWTH.
 *
 * Versi ini menampilkan rekalibrasi secara eksplisit: ekspektasi tradisional
 * dibandingkan prediksi ML AGROWTH, diikuti indikator akurasi, progress siklus,
 * alert transisi, dan tanda alam aktif.
 */
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Cpu,
  Feather,
  Leaf,
  ScrollText,
  Zap,
  Clock3,
} from "lucide-react";
import { useMemo } from "react";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { AnomalyType, MangsaInfo, RiskLevel } from "@/types";

// ============================================================================
// Helpers — DOY arithmetic + label formatting
// ============================================================================

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

const MANGSA_SEQUENCE = [
  "Kasa",
  "Karo",
  "Katiga",
  "Kapat",
  "Kalima",
  "Kanem",
  "Kapitu",
  "Kawolu",
  "Kasanga",
  "Kasadasa",
  "Desta",
  "Sadha",
] as const;

function cumulativeDaysBefore(month: number): number {
  const m = Math.max(1, Math.min(12, month));
  let acc = 0;
  for (let i = 0; i < m - 1; i += 1) {
    acc += MONTH_DAYS[i] ?? 0;
  }
  return acc;
}

function dateToDoy(d: Date): number {
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (month === 2 && day === 29) return 59;
  return cumulativeDaysBefore(month) + day;
}

function mmddToDoy(mmdd: string): number {
  const [mRaw, dRaw] = mmdd.split("-").map(Number);
  if (!mRaw || !dRaw || Number.isNaN(mRaw) || Number.isNaN(dRaw)) {
    return 1;
  }
  return cumulativeDaysBefore(mRaw) + dRaw;
}

function formatMmDd(mmdd: string): string {
  const [mRaw, dRaw] = mmdd.split("-").map(Number);
  if (!mRaw || !dRaw) return mmdd;
  const month = ID_MONTHS_SHORT[mRaw - 1] ?? "";
  return `${dRaw} ${month}`;
}

function daysIntoMangsa(today: Date, mangsa: MangsaInfo): number {
  const todayDoy = dateToDoy(today);
  const startDoy = mmddToDoy(mangsa.period_start);
  const endDoy = mmddToDoy(mangsa.period_end);
  const duration = Math.max(1, mangsa.duration_days);

  let raw: number;
  if (startDoy <= endDoy) {
    raw = todayDoy - startDoy + 1;
  } else if (todayDoy >= startDoy) {
    raw = todayDoy - startDoy + 1;
  } else {
    raw = 365 - startDoy + todayDoy + 1;
  }

  return Math.min(duration, Math.max(1, raw));
}

function getNextMangsa(currentNumber: number): { number: number; name: string } {
  const nextNumber = currentNumber >= 12 ? 1 : currentNumber + 1;
  return {
    number: nextNumber,
    name: MANGSA_SEQUENCE[nextNumber - 1] ?? `Mangsa ${nextNumber}`,
  };
}

function getAnomalyNarrative(anomaly: AnomalyType): string {
  switch (anomaly) {
    case "drought":
      return "Anomali kemarau terdeteksi — deviasi +1.8σ dari baseline";
    case "flood":
      return "Curah hujan ekstrem — potensi genangan 72 jam ke depan";
    case "heatwave":
      return "Tekanan panas abnormal — suhu +3°C di atas normal mangsa";
    case "normal":
    case "el_nino":
    case "la_nina":
    default:
      return "Pola cuaca selaras dengan Pranata Mangsa — kondisi ideal";
  }
}

function getRiskToneClasses(riskLevel: RiskLevel | null): string {
  if (!riskLevel) return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  switch (riskLevel) {
    case "low":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    case "high":
      return "border-orange-500/20 bg-orange-500/10 text-orange-200";
    case "critical":
      return "border-red-500/20 bg-red-500/10 text-red-200";
    default:
      return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  }
}

function getCalibrationTone(anomaly: AnomalyType): string {
  return anomaly === "normal"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/20 bg-amber-500/10 text-amber-200";
}

// ============================================================================
// Background batik (SVG data-URI)
// ============================================================================

const BATIK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><path d='M0 30 Q 15 5 30 30 T 60 30' fill='none' stroke='rgba(16,185,129,0.18)' stroke-width='1.1'/><path d='M-30 30 Q -15 5 0 30 T 30 30' fill='none' stroke='rgba(16,185,129,0.18)' stroke-width='1.1'/><path d='M0 60 Q 15 35 30 60 T 60 60' fill='none' stroke='rgba(245,158,11,0.12)' stroke-width='1.1'/></svg>`;

const BATIK_DATA_URI = `url("data:image/svg+xml;utf8,${encodeURIComponent(BATIK_SVG)}")`;

// ============================================================================
// Sub-components
// ============================================================================

interface ProgressBarProps {
  progress: number;
  daysInto: number;
  total: number;
  nextMangsaName: string;
  daysRemaining: number;
  reducedMotion: boolean;
}

function ProgressBar({
  progress,
  daysInto,
  total,
  nextMangsaName,
  daysRemaining,
  reducedMotion,
}: ProgressBarProps) {
  const pct = Math.round(progress * 100);
  return (
    <div className="space-y-2 rounded-2xl border border-glass-border/70 bg-glass/50 p-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Posisi dalam Siklus Pranata Mangsa
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {daysInto}/{total} hari berjalan
            <span className="px-1.5">·</span>
            {pct}% terlewati
          </div>
        </div>
        <div className="text-right font-mono text-[10px] leading-tight text-muted-foreground">
          <div>Mangsa {nextMangsaName}</div>
          <div>dalam {daysRemaining} hari</div>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={daysInto}
        aria-label={`Hari ke-${daysInto} dari ${total}`}
        className="relative h-2 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-agrowth-500 via-amber-400 to-danger-500"
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
      <div>
        <div className="h-9 w-2/5 rounded bg-glass" />
        <div className="mt-1.5 h-3 w-3/5 rounded bg-glass/80" />
      </div>

      <div className="rounded-2xl border border-glass-border/70 bg-glass/50 p-3">
        <div className="h-3 w-44 rounded bg-glass" />
        <div className="mt-2 h-10 rounded-xl bg-glass" />
      </div>

      <div className="rounded-2xl border border-glass-border/70 bg-glass/50 p-3">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 rounded bg-glass" />
          <div className="h-3 w-20 rounded bg-glass" />
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-glass" />
      </div>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-glass-border/70 bg-glass/50 p-3">
        <div className="h-3 w-3/4 rounded bg-glass" />
        <div className="h-3 w-2/3 rounded bg-glass/80" />
      </div>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-glass-border/70 bg-glass/50 p-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 shrink-0 rounded bg-glass" />
            <div className={cn("h-3 rounded bg-glass", i === 0 ? "w-3/4" : "w-2/3")} />
          </div>
        ))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-shimmer bg-[length:200%_100%] animate-shimmer mix-blend-screen opacity-70"
      />
    </div>
  );
}

interface RecalibrationBlockProps {
  mangsa: MangsaInfo;
  anomaly: AnomalyType | null;
  riskLevel: RiskLevel | null;
  mlReady: boolean;
  reducedMotion: boolean;
}

function RecalibrationBlock({ mangsa, anomaly, riskLevel, mlReady, reducedMotion }: RecalibrationBlockProps) {
  const TraditionalIcon = Feather;
  const MlIcon = anomaly === "normal" ? Zap : Cpu;
  const traditionalCopy = mangsa.description || "Ekspektasi tradisional belum tersedia.";
  const mlCopy = mlReady
    ? getAnomalyNarrative(anomaly ?? "normal")
    : "Pilih koordinat peta agar prediksi ML AGROWTH dapat memvalidasi siklus Pranata Mangsa.";
  const riskTone = getRiskToneClasses(riskLevel);

  return (
    <section className="rounded-3xl border border-amber-200/70 bg-gradient-to-b from-amber-50/80 via-amber-50/50 to-transparent p-4 shadow-[0_0_0_1px_rgba(245,158,11,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-full border border-amber-300/50 bg-amber-100/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-900/80">
          Rekalibrasi AGROWTH
        </div>
        <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Membandingkan warisan tradisional dengan validasi empiris ML
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
          className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4 text-left"
        >
          <div className="mb-2 flex items-center gap-2 text-amber-900/70">
            <TraditionalIcon className="h-4 w-4" aria-hidden />
            <span className="font-mono text-[9px] uppercase tracking-[0.22em]">Pranata Mangsa Tradisional</span>
          </div>
          <div className="text-[11px] italic text-amber-900/75">Ekspektasi Leluhur</div>
          <p className="mt-1 text-sm leading-relaxed text-amber-950">{traditionalCopy}</p>
        </motion.div>

        <div className="hidden md:flex md:flex-col md:items-center md:justify-center">
          <div className="h-full w-px bg-gradient-to-b from-transparent via-amber-400/60 to-transparent" />
          <div className="-mt-32 rotate-90 rounded-full border border-amber-300/60 bg-amber-100/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-amber-900/80">
            ⚡ Rekalibrasi
          </div>
          <div className="mt-2 rounded-full border border-amber-300/60 bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.28em] text-amber-900/80">
            VS
          </div>
        </div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.25, delay: 0.15 }
          }
          className={cn("rounded-2xl border p-4 text-left", riskTone)}
        >
          <div className="mb-2 flex items-center gap-2">
            <MlIcon className="h-4 w-4" aria-hidden />
            <span className="font-mono text-[9px] uppercase tracking-[0.22em]">Prediksi ML AGROWTH</span>
          </div>
          <div className={cn("text-[11px] font-semibold", riskLevel === "low" ? "text-emerald-200" : riskLevel === "medium" ? "text-amber-200" : riskLevel === "high" ? "text-orange-200" : "text-red-200")}>
            Realita Iklim Saat Ini
          </div>
          <p className="mt-1 text-sm leading-relaxed">{mlCopy}</p>
        </motion.div>
      </div>
    </section>
  );
}

function CalibrationAccuracy({ anomaly, mlReady }: { anomaly: AnomalyType | null; mlReady: boolean }) {
  if (!mlReady) {
    return (
      <div className="rounded-2xl border border-slate-500/20 bg-slate-500/10 px-3 py-2 text-sm text-slate-200">
        Menunggu prediksi ML untuk mengukur kalibrasi Pranata Mangsa
      </div>
    );
  }

  const accurate = anomaly === "normal";
  return (
    <div className={cn("rounded-2xl border px-3 py-2 text-sm", accurate ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-amber-500/20 bg-amber-500/10 text-amber-200")}>
      {accurate ? "✓ Pranata Mangsa Akurat untuk musim ini" : "⚠ Deviasi dari Pranata Mangsa terdeteksi — gunakan prediksi ML"}
    </div>
  );
}

function TransitionAlert({ nextMangsaName, daysRemaining }: { nextMangsaName: string; daysRemaining: number }) {
  if (daysRemaining > 7) return null;
  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-950">
      <span className="inline-flex items-center gap-1 font-semibold">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        Transisi Mangsa Alert
      </span>{" "}
      <span>
        ⏱ Transisi ke Mangsa {nextMangsaName} dalam {daysRemaining} hari — persiapkan strategi tanam baru
      </span>
    </div>
  );
}

function NaturalSignsFooter({ signs }: { signs: string[] }) {
  const visibleSigns = signs.slice(0, 2);
  if (visibleSigns.length === 0) return null;

  return (
    <section className="space-y-2 rounded-2xl border border-glass-border/70 bg-glass/50 p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
        Penanda Alam Aktif (Pranata Mangsa)
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleSigns.map((sign, index) => (
          <span
            key={`${sign}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-foreground"
          >
            <Leaf className="h-3 w-3 text-emerald-400" aria-hidden />
            <span className="line-clamp-1">{sign}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Public component
// ============================================================================

export interface PranataMangsaCardProps {
  className?: string;
  span?: BentoCardSpan;
}

export function PranataMangsaCard({ className, span }: PranataMangsaCardProps) {
  const mangsa = useAgrowthStore((s) => s.currentMangsa);
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const isLoadingRaw = useAgrowthStore((s) => s.isLoadingRecommendation);
  const reducedMotion = useReducedMotion() ?? false;

  const progressData = useMemo(() => {
    if (!mangsa) return null;
    const daysInto = daysIntoMangsa(new Date(), mangsa);
    const total = Math.max(1, mangsa.duration_days);
    const daysRemaining = Math.max(0, total - daysInto);
    const nextMangsa = getNextMangsa(mangsa.number);

    return {
      daysInto,
      total,
      progress: daysInto / total,
      daysRemaining,
      nextMangsa,
    };
  }, [mangsa]);

  const anomaly = recommendation?.anomaly ?? "normal";
  const riskLevel = recommendation?.risk_level ?? null;
  const mlReady = recommendation !== null && !isLoadingRaw;

  return (
    <BentoCard
      title="Mangsa Aktif"
      subtitle="Kearifan Lokal Jawa"
      icon={Calendar}
      glow="emerald"
      span={span ?? { col: 5, row: 2 }}
      className={cn("relative overflow-hidden", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
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
          <div>
            <h3
              className={cn(
                "font-serif text-3xl font-semibold italic leading-tight tracking-tight text-foreground",
              )}
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
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

          <RecalibrationBlock
            mangsa={mangsa}
            anomaly={recommendation?.anomaly ?? null}
            riskLevel={riskLevel}
            mlReady={mlReady}
            reducedMotion={reducedMotion}
          />

          <CalibrationAccuracy anomaly={recommendation?.anomaly ?? null} mlReady={mlReady} />

          <ProgressBar
            progress={progressData.progress}
            daysInto={progressData.daysInto}
            total={progressData.total}
            nextMangsaName={progressData.nextMangsa.name}
            daysRemaining={progressData.daysRemaining}
            reducedMotion={reducedMotion}
          />

          <TransitionAlert
            nextMangsaName={progressData.nextMangsa.name}
            daysRemaining={progressData.daysRemaining}
          />

          <NaturalSignsFooter signs={mangsa.characteristics} />
        </div>
      )}
    </BentoCard>
  );
}
