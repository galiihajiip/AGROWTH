"use client";

/**
 * Hero recommendation card — narasi storytelling dari ``recommendationData``.
 *
 * Anatomi (4 section + footer):
 *
 * 1. ``traditional_wisdom``  : blockquote ``border-l-2`` agrowth, italic
 *    muted text. Mewakili kearifan Pranata Mangsa yang relevan.
 *
 * 2. ``narrative``           : paragraf utama 80–150 kata Bahasa Jawa,
 *    di-render via :class:`FadeInWords` — tiap kata muncul stagger
 *    (default 25 ms/kata) dengan tween blur+opacity+y, mengasosiasikan
 *    feel "AI sedang menulis langsung di depan mata".
 *
 * 3. ``modern_action``       : checklist dengan ikon ``CheckSquare``
 *    (lucide), satu baris per tindakan praktis dari LLM/fallback.
 *
 * 4. ``crops``               : badges rounded-full agrowth tint untuk
 *    daftar tanaman yang direkomendasikan.
 *
 * Footer:
 * - Risk warnings: bila ``risk_warnings.length > 0``, tampilkan amber
 *   warning bar dengan ikon ``AlertTriangle`` di atas chip.
 * - Chip "Powered by Gemini AI" — selalu tampil saat ada data, sebagai
 *   atribusi sumber narasi (chip jadi truthful indicator: kalau LLM
 *   gagal & jatuh ke fallback statis backend, format response tetap
 *   sama jadi chip masih akurat sebagai "AI hybrid pipeline").
 *
 * State variants:
 * - Loading (``isLoadingRecommendation``): 3 baris shimmer + 2 chip
 *   placeholder dengan single ``animate-shimmer`` overlay.
 * - Empty (belum ada koordinat): teks besar muted + sub-text ajakan,
 *   tanpa shimmer — eksplisit memberi affordance "klik peta dulu".
 * - Loaded: 4 section + footer.
 *
 * BentoCard glow tetap ``emerald`` (brand AGROWTH); icon ``Sparkles``
 * pakai ``animate-spin-slow`` (6s linear, ditambah ke tailwind config)
 * sebagai signature visual "AI hidup".
 */
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckSquare,
  Database,
  Leaf,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";

import { BentoCard, type BentoCardSpan } from "@/components/ui/BentoCard";
import { useMinLoadingTime } from "@/hooks/useMinLoadingTime";
import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

// ============================================================================
// FadeInWords — kata muncul stagger (storytelling effect)
// ============================================================================

interface FadeInWordsProps {
  text: string;
  className?: string;
  /** Stagger delay antar-kata (ms). Default 25 ms. */
  staggerMs?: number;
}

/**
 * Render ``text`` per kata dengan ``motion.span`` yang fade-in
 * stagger. Re-mount otomatis saat ``text`` berubah karena kita
 * pasangkan ``key={text}`` di paragraf pembungkus → animasi
 * berjalan ulang setiap rekomendasi baru datang.
 *
 * Stagger: opacity 0→1, x -4→0 per kata, delay = index * 0.025s.
 * Total durasi di-clamp max 2s agar kalimat panjang (>80 kata)
 * tidak terlalu lambat: ``perWordDelay = min(staggerMs, 2000 / wordCount)``.
 *
 * Reduced motion: respect ``prefers-reduced-motion`` (durasi & delay
 * di-set 0 → text muncul langsung tanpa transisi).
 */
function FadeInWords({ text, className, staggerMs = 25 }: FadeInWordsProps) {
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  // Clamp stagger sehingga total max 2s (2000ms / jumlah kata).
  const clampedStagger = useMemo(() => {
    if (words.length <= 1) return staggerMs;
    const maxPerWord = 2000 / words.length;
    return Math.min(staggerMs, maxPerWord);
  }, [words.length, staggerMs]);

  return (
    <motion.p key={text} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={{ opacity: 0, x: -4, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  duration: 0.4,
                  delay: i * (clampedStagger / 1000),
                  ease: [0.16, 1, 0.3, 1],
                }
          }
          className="inline-block"
        >
          {word}
          {i < words.length - 1 ? "\u00a0" : ""}
        </motion.span>
      ))}
    </motion.p>
  );
}

// ============================================================================
// Sub-components: chip + warning bar + skeleton
// ============================================================================

interface CropChipProps {
  label: string;
}

function CropChip({ label }: CropChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full",
        "border border-agrowth-500/30 bg-agrowth-500/10",
        "px-2.5 py-0.5 text-xs font-medium text-agrowth-700 dark:text-agrowth-300",
      )}
    >
      <Leaf className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}

function PoweredByGemini() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "border border-glass-border bg-glass",
        "px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        "text-muted-foreground",
      )}
    >
      <Sparkles
        className="h-3 w-3 text-agrowth-400"
        strokeWidth={2.25}
        aria-hidden
      />
      Powered by Multi-ML + Gemini AI
    </span>
  );
}

interface DataSourcesBarProps {
  sources: string[];
}

function DataSourcesBar({ sources }: DataSourcesBarProps) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sumber Data Terintegrasi
      </h3>
      <div className="flex flex-wrap gap-1">
        {sources.map((src, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1 rounded-full",
              "border border-sky-500/25 bg-sky-500/10",
              "px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-300",
            )}
          >
            <Database className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
            {src}
          </span>
        ))}
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="relative flex flex-1 flex-col gap-3" aria-busy="true">
      {/* 3 baris shimmer */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-full rounded bg-glass" />
        <div className="h-3 w-5/6 rounded bg-glass" />
        <div className="h-3 w-3/4 rounded bg-glass" />
      </div>
      {/* 2 chip placeholder */}
      <div className="mt-1 flex flex-wrap gap-1.5">
        <div className="h-5 w-20 rounded-full bg-glass" />
        <div className="h-5 w-24 rounded-full bg-glass" />
      </div>
      {/* Single shimmer overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-shimmer bg-[length:200%_100%] animate-shimmer mix-blend-screen opacity-70"
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 text-center">
      <p className="text-2xl font-semibold tracking-tight text-foreground/40">
        Pilih lokasi di peta.
      </p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground/60">
        Rekomendasi pertanian hibrida — Pranata Mangsa, prediksi cuaca,
        dan saran AI berbahasa Jawa — akan tampil di sini.
      </p>
    </div>
  );
}

// ============================================================================
// Section labels
// ============================================================================

interface SectionLabelProps {
  children: React.ReactNode;
}

function SectionLabel({ children }: SectionLabelProps) {
  return (
    <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </h3>
  );
}

// ============================================================================
// Public component
// ============================================================================

export interface RecommendationCardProps {
  className?: string;
  /** Override grid placement; default ``{ col: 7, row: 4 }``. */
  span?: BentoCardSpan;
}

export function RecommendationCard({ className, span }: RecommendationCardProps) {
  const recommendation = useAgrowthStore((s) => s.recommendationData);
  const isLoadingRaw = useAgrowthStore((s) => s.isLoadingRecommendation);
  const hasCoordinate = useAgrowthStore(
    (s) => s.selectedCoordinate !== null,
  );

  // Jamin skeleton tampil min 300ms — sinkron dengan card lain.
  const showData = useMinLoadingTime(isLoadingRaw, 300);

  // Tentukan visual mode.
  let mode: "loading" | "empty" | "loaded";
  if (recommendation && showData) {
    mode = "loaded";
  } else if (isLoadingRaw || !showData || hasCoordinate) {
    mode = "loading";
  } else {
    mode = "empty";
  }

  const summary = recommendation?.summary ?? "";
  const wisdom = recommendation?.weather_advice ?? "";
  const actions = recommendation?.recommendations ?? [];
  const crops = recommendation?.crops ?? [];
  const warnings = recommendation?.risk_warnings ?? [];
  const dataSources = recommendation?.data_sources ?? [];
  const mangsaGreeting = recommendation?.mangsa_greeting ?? "";

  return (
    <BentoCard
      title="Rekomendasi AI"
      subtitle="Hibrida Pranata Mangsa + Gemini"
      icon={Sparkles}
      iconClassName="animate-spin-slow"
      glow="emerald"
      span={span ?? { col: 5, row: 2 }}
      className={className}
    >
      {mode === "loading" ? <ContentSkeleton /> : null}

      {mode === "empty" ? <EmptyState /> : null}

      {mode === "loaded" ? (
        <div className="flex flex-1 flex-col gap-2">
          {/* ----- Mangsa greeting ----- */}
          {mangsaGreeting ? (
            <p className="text-xs italic leading-snug text-agrowth-700/80 dark:text-agrowth-300/80">
              {mangsaGreeting}
            </p>
          ) : null}

          {/* ----- Wisdom blockquote ----- */}
          {wisdom ? (
            <blockquote className="border-l-2 border-agrowth-500/60 pl-2.5 text-xs italic leading-snug text-muted-foreground">
              {wisdom}
            </blockquote>
          ) : null}

          {/* ----- Narasi (FadeInWords) ----- */}
          {summary ? (
            <FadeInWords
              text={summary}
              className="text-xs leading-relaxed text-foreground"
            />
          ) : null}

          {/* ----- Actions + crops in 2-col grid ----- */}
          {(actions.length > 0 || crops.length > 0) ? (
            <div className="grid grid-cols-2 gap-2">
              {actions.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <SectionLabel>Tindakan</SectionLabel>
                  <ul className="flex flex-col gap-1">
                    {actions.slice(0, 3).map((action, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground">
                        <CheckSquare className="mt-0.5 h-3 w-3 shrink-0 text-agrowth-400" strokeWidth={2.25} aria-hidden />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {crops.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <SectionLabel>Tanaman</SectionLabel>
                  <div className="flex flex-wrap gap-1">
                    {crops.map((crop, i) => (
                      <CropChip key={i} label={crop} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ----- Footer: warning + sources + powered-by ----- */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <DataSourcesBar sources={dataSources} />
              {warnings.length > 0 ? (
                <span className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                  <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
                  {warnings[0]}
                </span>
              ) : null}
            </div>
            <PoweredByGemini />
          </div>
        </div>
      ) : null}
    </BentoCard>
  );
}
