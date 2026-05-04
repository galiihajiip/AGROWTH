"use client";

/**
 * Tombol toggle light/dark mode.
 *
 * Ikon: Sun (light aktif) / Moon (dark aktif) — crossfade animasi via
 * framer-motion. Menggunakan ``next-themes`` useTheme() untuk membaca
 * & mengganti tema.
 *
 * Render null saat mounted = false (SSR) untuk menghindari hydration
 * mismatch karena next-themes membutuhkan client-side untuk menentukan
 * tema aktif.
 */
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Placeholder dengan ukuran sama agar layout tidak shift.
    return (
      <div
        className={cn(
          "h-8 w-8 rounded-md",
          className,
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md",
        "text-muted-foreground transition-colors",
        "hover:bg-glass hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="h-4 w-4" strokeWidth={2.25} />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="h-4 w-4" strokeWidth={2.25} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
