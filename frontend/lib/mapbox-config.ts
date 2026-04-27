/**
 * Konfigurasi Mapbox GL untuk peta interaktif AGROWTH.
 *
 * Token dibaca dari `NEXT_PUBLIC_MAPBOX_TOKEN`. Pakai
 * :func:`assertMapboxToken` di runtime (dalam komponen ``"use client"``)
 * untuk fail-fast bila token belum di-set, alih-alih throw saat module
 * import (yang akan crash semua route).
 *
 * Style default: ``dark-v11`` (selaras tema dashboard AGROWTH).
 * Bounding box dibatasi ke Pulau Jawa supaya peta tidak mengembara
 * keluar wilayah validasi backend.
 */
import { DEFAULT_ZOOM, JAVA_BOUNDS, JAVA_CENTER } from "@/lib/constants";

/** Public token Mapbox; dibutuhkan agar tile dapat di-load. */
export const MAPBOX_TOKEN: string =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/**
 * Pastikan token tersedia. Throw bila kosong supaya komponen peta
 * tidak silent-fail dengan canvas hitam.
 */
export function assertMapboxToken(): string {
  if (!MAPBOX_TOKEN) {
    throw new Error(
      "NEXT_PUBLIC_MAPBOX_TOKEN belum diset. " +
        "Tambahkan token public Mapbox ke `.env.local` " +
        "(buat di https://account.mapbox.com/access-tokens/).",
    );
  }
  return MAPBOX_TOKEN;
}

/** Style URL Mapbox dark mode. */
export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11" as const;

/** Initial view state untuk react-map-gl (longitude/latitude/zoom). */
export const INITIAL_VIEW_STATE = {
  longitude: JAVA_CENTER[1],
  latitude: JAVA_CENTER[0],
  zoom: DEFAULT_ZOOM,
  pitch: 0,
  bearing: 0,
} as const;

/**
 * Maximum bounds Pulau Jawa untuk Mapbox.
 *
 * Format: ``[[lon_sw, lat_sw], [lon_ne, lat_ne]]`` (Mapbox pakai
 * urutan longitude-latitude, bukan latitude-longitude).
 */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [JAVA_BOUNDS.minLon, JAVA_BOUNDS.minLat],
  [JAVA_BOUNDS.maxLon, JAVA_BOUNDS.maxLat],
];

/** Zoom batas untuk mencegah over-zoom-out / over-zoom-in. */
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 14;
