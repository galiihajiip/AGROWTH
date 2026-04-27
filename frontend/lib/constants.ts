/**
 * Konstanta yang dipakai lintas komponen frontend AGROWTH.
 *
 * Semua nilai di sini adalah single source of truth — JANGAN duplikasi
 * literal di komponen lain. Bounding box & center harus selaras dengan
 * validator backend (`CoordinateInput` di `backend/app/models/schemas.py`).
 */
import type { AnomalyType, RiskLevel } from "@/types";

// ============================================================================
// Geografi Pulau Jawa
// ============================================================================

/**
 * Bounding box validasi backend untuk koordinat di Pulau Jawa.
 *
 * - Latitude: `-9.0 .. -5.0`
 * - Longitude: `105.0 .. 115.0`
 *
 * Koordinat di luar batas ini → backend mengembalikan **HTTP 422**.
 */
export const JAVA_BOUNDS = {
  minLat: -9.0,
  maxLat: -5.0,
  minLon: 105.0,
  maxLon: 115.0,
  /** [lat, lon] pojok barat-daya (untuk Leaflet/MapLibre). */
  southWest: [-9.0, 105.0] as [number, number],
  /** [lat, lon] pojok timur-laut (untuk Leaflet/MapLibre). */
  northEast: [-5.0, 115.0] as [number, number],
} as const;

/** Titik pusat default peta (sekitar Jawa Tengah). */
export const JAVA_CENTER: [number, number] = [-7.5, 110.0];

/** Zoom default untuk view Pulau Jawa penuh. */
export const DEFAULT_ZOOM = 7;

/** Cek apakah sebuah koordinat berada di dalam bounding box Pulau Jawa. */
export function isInsideJavaBounds(lat: number, lon: number): boolean {
  return (
    lat >= JAVA_BOUNDS.minLat &&
    lat <= JAVA_BOUNDS.maxLat &&
    lon >= JAVA_BOUNDS.minLon &&
    lon <= JAVA_BOUNDS.maxLon
  );
}

// ============================================================================
// Risiko & Anomali — color tokens
// ============================================================================

/** 1 set warna lengkap untuk merepresentasikan status. */
export interface ColorToken {
  /** Hex value siap pakai (mis. untuk inline style / canvas / svg). */
  hex: string;
  /** Class background Tailwind. */
  bg: string;
  /** Class text Tailwind. */
  text: string;
  /** Class border Tailwind. */
  border: string;
  /** Class ring/outline Tailwind. */
  ring: string;
  /** Class glow shadow Tailwind (untuk emphasized state). */
  glow: string;
  /** Label ringkas Bahasa Indonesia. */
  label: string;
}

/**
 * Mapping `RiskLevel` → token warna lengkap.
 *
 * Skema gradien: hijau (low) → kuning (medium) → oranye (high) → merah (critical).
 */
export const RISK_COLORS: Readonly<Record<RiskLevel, ColorToken>> = {
  low: {
    hex: "#10b981", // agrowth-500
    bg: "bg-agrowth-500",
    text: "text-agrowth-500",
    border: "border-agrowth-500",
    ring: "ring-agrowth-500",
    glow: "shadow-glow-emerald",
    label: "Rendah",
  },
  medium: {
    hex: "#f59e0b", // amber-500
    bg: "bg-amber-500",
    text: "text-amber-500",
    border: "border-amber-500",
    ring: "ring-amber-500",
    glow: "shadow-glow-amber",
    label: "Sedang",
  },
  high: {
    hex: "#ea580c", // orange-600 (Tailwind built-in)
    bg: "bg-orange-600",
    text: "text-orange-500",
    border: "border-orange-600",
    ring: "ring-orange-600",
    glow: "shadow-glow-amber",
    label: "Tinggi",
  },
  critical: {
    hex: "#ef4444", // danger-500
    bg: "bg-danger-500",
    text: "text-danger-500",
    border: "border-danger-500",
    ring: "ring-danger-500",
    glow: "shadow-glow-danger",
    label: "Kritis",
  },
} as const;

/**
 * Mapping `AnomalyType` → label Bahasa Indonesia + warna ringan.
 *
 * NORMAL adalah baseline (hijau), sisanya warning/danger.
 */
export const ANOMALY_INFO: Readonly<
  Record<AnomalyType, { label: string; hex: string; emoji: string }>
> = {
  normal: { label: "Normal", hex: "#10b981", emoji: "🌱" },
  el_nino: { label: "El Niño", hex: "#f59e0b", emoji: "🌞" },
  la_nina: { label: "La Niña", hex: "#3b82f6", emoji: "🌧️" },
  drought: { label: "Kekeringan", hex: "#ea580c", emoji: "☀️" },
  flood: { label: "Banjir", hex: "#3b82f6", emoji: "🌊" },
  heatwave: { label: "Gelombang Panas", hex: "#ef4444", emoji: "🔥" },
} as const;

// ============================================================================
// Limits API (selaras backend)
// ============================================================================

/** Batas hari forecast yang diterima `POST /api/predict?days=N`. */
export const FORECAST_DAYS = {
  min: 1,
  max: 14,
  default: 7,
} as const;

/** Jumlah mangsa dalam Pranata Mangsa (1..12). */
export const TOTAL_MANGSA = 12;
