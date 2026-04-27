"use client";

/**
 * Toast error global untuk dashboard AGROWTH.
 *
 * Subscribe langsung ke ``state.error`` Zustand. Begitu ``error`` non-null,
 * toast slide-in di pojok kanan-bawah dengan:
 * - Pesan ramah-pengguna (``ApiError.friendlyMessage``)
 * - Badge HTTP status (atau ``NET`` untuk timeout/offline)
 * - Tombol close (``clearError``) — toast juga auto-dismiss setelah
 *   :const:`AUTO_DISMISS_MS` kecuali ``error.isNetworkError === true``
 *   (network/timeout sengaja sticky karena user perlu tahu backend mati).
 *
 * Visual:
 * - Glass panel + border merah (``danger-500/40``)
 * - Animasi slide-up + fade-in via framer-motion (``AnimatePresence``)
 *
 * Aksesibilitas:
 * - ``role="alert"`` + ``aria-live="assertive"`` supaya screen reader
 *   langsung membacakan saat muncul.
 */
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useAgrowthStore } from "@/store/useAgrowthStore";

/** Auto-dismiss untuk error non-network (HTTP error). */
const AUTO_DISMISS_MS = 6_000;

export function ErrorToast() {
  const error = useAgrowthStore((state) => state.error);
  const clearError = useAgrowthStore((state) => state.clearError);

  // Auto-dismiss timer untuk error HTTP biasa (bukan network/timeout).
  useEffect(() => {
    if (error === null) return;
    if (error.isNetworkError) return; // Sengaja sticky.
    const id = window.setTimeout(clearError, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [error, clearError]);

  return (
    <AnimatePresence>
      {error ? (
        <motion.div
          key={`${error.requestId ?? "noid"}-${error.status}`}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          role="alert"
          aria-live="assertive"
          className={cn(
            "pointer-events-auto fixed bottom-4 right-4 z-50",
            "max-w-sm rounded-xl border border-danger-500/40",
            "bg-glass-dark-strong backdrop-blur-xl",
            "shadow-glow-danger",
          )}
        >
          <div className="flex items-start gap-3 p-3.5">
            <div
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger-500/15 ring-1 ring-danger-500/35"
            >
              <AlertTriangle
                className="h-4 w-4 text-danger-400"
                strokeWidth={2.25}
              />
            </div>

            <div className="flex-1 leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-danger-400">
                  {error.isNetworkError ? "Koneksi" : "Galat"}
                </span>
                <span className="rounded-md border border-glass-border bg-glass px-1.5 py-px font-mono text-[10px] text-muted-foreground">
                  {error.isNetworkError ? "NET" : `HTTP ${error.status}`}
                </span>
                {error.requestId ? (
                  <span
                    className="font-mono text-[10px] text-muted-foreground/70"
                    title="X-Request-ID"
                  >
                    {error.requestId.slice(0, 8)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-foreground">
                {error.friendlyMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={clearError}
              aria-label="Tutup notifikasi"
              className={cn(
                "shrink-0 rounded-md p-1 text-muted-foreground transition",
                "hover:bg-glass hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
