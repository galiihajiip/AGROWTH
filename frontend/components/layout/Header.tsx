"use client";

/**
 * Header sticky AGROWTH dashboard.
 *
 * Layout:
 * - Kiri  : ikon ``Sprout`` + brand "AGROWTH" + tagline
 * - Tengah: pill mangsa aktif (live dari Zustand store) + ikon Calendar
 * - Kanan : badge "IYREF 2026" + tautan GitHub
 *
 * Glass effect: ``backdrop-blur-xl`` + ``bg-glass-dark`` + border bawah.
 * Sticky di top dengan ``z-40`` agar tetap di atas kanvas peta Mapbox.
 */
import { Calendar, Github, Sprout } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

const GITHUB_URL = "https://github.com/galiihajiip/AGROWTH";

export interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const currentMangsa = useAgrowthStore((state) => state.currentMangsa);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-14 w-full border-b border-glass-border",
        "bg-glass-dark backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex h-full items-center justify-between gap-4 px-4 md:px-6">
        {/* ---------- LEFT: Logo + tagline ---------- */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-agrowth-500/15 ring-1 ring-agrowth-500/30">
            <Sprout
              className="h-5 w-5 text-agrowth-400"
              aria-hidden
              strokeWidth={2.25}
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-foreground">
              AGROWTH
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Pranata Mangsa Dashboard
            </span>
          </div>
        </div>

        {/* ---------- CENTER: Mangsa pill ---------- */}
        <div className="hidden flex-1 justify-center md:flex">
          {currentMangsa ? (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5",
                "border border-agrowth-500/30 bg-agrowth-500/10",
                "shadow-glow-emerald",
              )}
              role="status"
              aria-label={`Mangsa aktif: ${currentMangsa.name}`}
            >
              <Calendar
                className="h-4 w-4 text-agrowth-400"
                aria-hidden
                strokeWidth={2.25}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Mangsa #{currentMangsa.number}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {currentMangsa.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {currentMangsa.period_start} – {currentMangsa.period_end}
              </span>
            </div>
          ) : (
            // Skeleton ringan saat data belum siap
            <div
              aria-hidden
              className="h-8 w-64 animate-pulse rounded-full border border-glass-border bg-glass"
            />
          )}
        </div>

        {/* ---------- RIGHT: IYREF + GitHub ---------- */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "hidden rounded-md border border-amber-500/30 bg-amber-500/10",
              "px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-400",
              "sm:inline-block",
            )}
          >
            IYREF 2026
          </span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md",
              "text-muted-foreground transition",
              "hover:bg-glass hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label="Repositori AGROWTH di GitHub"
          >
            <Github className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}
