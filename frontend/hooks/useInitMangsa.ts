"use client";

/**
 * Hook untuk auto-fetch mangsa aktif saat komponen pertama kali ter-mount.
 *
 * Idempotent: kalau ``currentMangsa`` sudah ada di store, tidak akan
 * memicu fetch ulang. Cocok dipanggil sekali di komponen layout client
 * level atas (mis. di ``ClientLayout`` atau halaman utama).
 *
 * @returns ``MangsaInfo`` dari store (``null`` saat masih loading).
 *
 * @example
 *     "use client";
 *     export function DashboardShell() {
 *       const mangsa = useInitMangsa();
 *       if (!mangsa) return <Skeleton />;
 *       return <MangsaCard mangsa={mangsa} />;
 *     }
 */
import { useEffect } from "react";

import { useAgrowthStore } from "@/store/useAgrowthStore";
import type { MangsaInfo } from "@/types";

export function useInitMangsa(): MangsaInfo | null {
  const currentMangsa = useAgrowthStore((state) => state.currentMangsa);
  const fetchCurrentMangsa = useAgrowthStore(
    (state) => state.fetchCurrentMangsa,
  );

  useEffect(() => {
    // Hanya fetch bila belum ada data — selector mengambil snapshot saat ini
    // tanpa perlu re-run effect tiap state lain berubah.
    if (currentMangsa === null) {
      void fetchCurrentMangsa();
    }
    // Action zustand stabil → effect tetap berjalan sekali per mount.
  }, [currentMangsa, fetchCurrentMangsa]);

  return currentMangsa;
}
