"use client";

/**
 * Hook yang menjamin skeleton tampil minimal ``minMs`` milidetik.
 *
 * Problem: pada koneksi cepat (fiber / localhost), fetch selesai dalam
 * <100 ms sehingga skeleton cuma muncul sekilas lalu langsung swap ke
 * konten — terlihat "flicker" yang unprofessional di mata juri UI/UX.
 *
 * Solusi: catat waktu mulai loading, dan baru set ``showData = true``
 * setelah KEDUA kondisi terpenuhi:
 *   1. Data sudah tersedia (``isLoading === false``)
 *   2. Minimal ``minMs`` telah berlalu sejak loading dimulai
 *
 * Jika data belum datang setelah ``minMs``, skeleton tetap tampil —
 * hook ini **tidak** memperpendek loading, hanya memperpanjangnya
 * agar transisi skeleton→data selalu terasa halus.
 *
 * Test checklist:
 * - [ ] Chrome DevTools → Network → Fast 3G: skeleton tampil min 300ms, tidak flicker
 *
 * @param isLoading True saat fetch sedang in-flight.
 * @param minMs     Durasi minimum skeleton ditampilkan (default 300ms).
 * @returns ``true`` jika data boleh ditampilkan (loading selesai + minMs tercapai).
 */
import { useEffect, useRef, useState } from "react";

export function useMinLoadingTime(isLoading: boolean, minMs: number = 300): boolean {
  const [showData, setShowData] = useState(!isLoading);
  const loadStartRef = useRef<number>(0);

  useEffect(() => {
    if (isLoading) {
      // Loading baru dimulai — catat timestamp, sembunyikan data.
      loadStartRef.current = Date.now();
      setShowData(false);
      return;
    }

    // Loading selesai — hitung sisa waktu minimum.
    const elapsed = Date.now() - loadStartRef.current;
    const remaining = Math.max(0, minMs - elapsed);

    if (remaining <= 0) {
      setShowData(true);
      return;
    }

    // Tahan skeleton sampai minMs tercapai.
    const timer = setTimeout(() => setShowData(true), remaining);
    return () => clearTimeout(timer);
  }, [isLoading, minMs]);

  return showData;
}
