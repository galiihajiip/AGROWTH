"use client";

/**
 * Global error boundary untuk Next.js App Router.
 *
 * Otomatis dirender oleh Next ketika sebuah Server/Client Component di bawah
 * ``app/`` melempar exception yang tidak tertangkap (mis. ``MapView``
 * gagal load Mapbox karena token salah, atau Zustand store throw).
 *
 * Gaya: glass panel, ikon ``AlertTriangle`` merah, tombol Coba Lagi yang
 * memanggil :func:`reset` (re-render boundary children dari awal).
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  // Log ke console untuk Sentry/observability di kemudian hari.
  useEffect(() => {
    console.error("[AGROWTH] App error boundary:", error);
  }, [error]);

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="flex min-h-screen items-center justify-center bg-background p-4"
    >
      <section
        className={cn(
          "glass-panel-strong w-full max-w-md p-6",
          "flex flex-col gap-4 text-center",
        )}
      >
        <div
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-danger-500/15 ring-1 ring-danger-500/35"
        >
          <AlertTriangle
            className="h-6 w-6 text-danger-400"
            strokeWidth={2.25}
          />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Terjadi galat tak terduga
          </h1>
          <p className="text-sm text-muted-foreground">
            Komponen dashboard gagal dirender. Coba muat ulang halaman atau
            tekan tombol di bawah.
          </p>
        </div>

        {error?.message ? (
          <pre
            className={cn(
              "max-h-32 overflow-auto rounded-lg border border-glass-border",
              "bg-glass p-3 text-left font-mono text-[11px] text-muted-foreground",
            )}
          >
            {error.message}
          </pre>
        ) : null}

        {error?.digest ? (
          <p className="font-mono text-[11px] text-muted-foreground/70">
            digest: {error.digest}
          </p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg",
            "bg-agrowth-500/15 px-4 py-2 text-sm font-medium text-agrowth-400",
            "ring-1 ring-agrowth-500/35 transition",
            "hover:bg-agrowth-500/25 hover:text-agrowth-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          Coba lagi
        </button>
      </section>
    </main>
  );
}
