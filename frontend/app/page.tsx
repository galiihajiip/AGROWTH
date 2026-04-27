"use client";

/**
 * Halaman utama AGROWTH Dashboard.
 *
 * Komposisi:
 * 1. ``<Header />``      sticky di atas (h-14)
 * 2. ``<BentoGrid />``   isi seluruh sisa viewport — 7 kartu widget
 *    diatur sebagai bento layout 12-kolom, masing-masing dengan
 *    entrance animation stagger.
 * 3. ``<ErrorToast />``  notifier global subscribe ke ``store.error``.
 *
 * Header h-14 (3.5rem). Main pakai ``flex-1 min-h-0 overflow-auto``
 * sehingga tinggi-nya = ``100vh - 3.5rem`` secara otomatis (lebih
 * akurat daripada hard-coded ``calc(100vh-4rem)`` yang tidak match
 * dengan h-14). ``min-h-0`` mencegah flex-item overflow weirdness saat
 * konten lebih tinggi dari viewport (tipikal di mobile + bento layout).
 *
 * ``useInitMangsa()`` di-call sekali di top component supaya store
 * langsung punya ``currentMangsa`` saat ``Header`` & ``PranataMangsaCard``
 * render pertama kali.
 */
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { ErrorToast } from "@/components/feedback/ErrorToast";
import { Header } from "@/components/layout/Header";
import { useInitMangsa } from "@/hooks/useInitMangsa";

export default function HomePage() {
  // Pre-fetch mangsa aktif sehingga Header langsung punya pill terisi.
  useInitMangsa();

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 min-h-0 overflow-auto p-4">
        <BentoGrid />
      </main>

      {/* Toast error global (subscribe ke state.error) */}
      <ErrorToast />
    </div>
  );
}
