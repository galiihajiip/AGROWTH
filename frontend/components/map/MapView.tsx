"use client";

/**
 * Komponen peta interaktif AGROWTH (Mapbox GL via react-map-gl).
 *
 * Behavior:
 * - Style ``dark-v11`` selaras tema dashboard.
 * - Pan & scroll-zoom diaktifkan; drag-rotate / pitch-rotate dimatikan
 *   supaya selalu top-down (sesuai use-case agrikultur).
 * - Click di mana saja di Pulau Jawa → memicu
 *   ``setCoordinate({ lat, lon })`` yang otomatis menjalankan chain
 *   ``fetchPrediction`` + ``fetchRecommendation`` di store.
 * - Kalau koordinat sudah dipilih, ditandai dengan pin emerald yang
 *   pulse-glow (lucide ``MapPin``).
 *
 * Token dibaca via :func:`assertMapboxToken` — komponen akan throw
 * (ditangkap React error boundary kalau dipasang) bila ``NEXT_PUBLIC_MAPBOX_TOKEN``
 * belum di-set di ``.env.local``.
 */
import { useTheme } from "next-themes";
import { useCallback } from "react";
import Map, {
  NavigationControl,
  type MapLayerMouseEvent,
} from "react-map-gl";

import { MapLegend } from "@/components/map/MapLegend";
import { MapMarker } from "@/components/map/MapMarker";
import { VulnerabilityLayer } from "@/components/map/VulnerabilityLayer";
import { VulnerabilityToggle } from "@/components/map/VulnerabilityToggle";
import { isInsideJavaBounds } from "@/lib/constants";
import {
  INITIAL_VIEW_STATE,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  MAX_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  assertMapboxToken,
} from "@/lib/mapbox-config";
import { useAgrowthStore } from "@/store/useAgrowthStore";

export function MapView() {
  const { resolvedTheme } = useTheme();
  const setCoordinate = useAgrowthStore((state) => state.setCoordinate);
  const selectedCoordinate = useAgrowthStore(
    (state) => state.selectedCoordinate,
  );
  const isLoadingRecommendation = useAgrowthStore(
    (state) => state.isLoadingRecommendation,
  );
  const recommendationData = useAgrowthStore(
    (state) => state.recommendationData,
  );
  // risk_level ikut hidup dari single recommendation fetch (sumber tunggal).
  const riskLevel = useAgrowthStore(
    (state) => state.recommendationData?.risk_level ?? null,
  );

  const mapStyle = resolvedTheme === "light" ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;

  const token = assertMapboxToken();

  const coordinateLabel = selectedCoordinate
    ? `${selectedCoordinate.lat.toFixed(4)}, ${selectedCoordinate.lon.toFixed(4)}`
    : null;
  const locationLabel = recommendationData?.location.name ?? "Koordinat dipilih";

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const { lng, lat } = event.lngLat;
      // Defensive: walau maxBounds membatasi pan, tepi bisa lolos sedikit.
      if (!isInsideJavaBounds(lat, lng)) return;
      void setCoordinate({ lat, lon: lng });
    },
    [setCoordinate],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-glass-border">
      <Map
        mapboxAccessToken={token}
        mapStyle={mapStyle}
        initialViewState={INITIAL_VIEW_STATE}
        maxBounds={MAX_BOUNDS}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollZoom
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        onClick={handleClick}
        cursor="crosshair"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl
          position="top-right"
          showCompass={false}
          showZoom
        />

        {/* Vulnerability heatmap: pemetaan kerentanan wilayah spasial */}
        <VulnerabilityLayer />

        {selectedCoordinate ? (
          <MapMarker
            lng={selectedCoordinate.lon}
            lat={selectedCoordinate.lat}
            riskLevel={riskLevel}
          />
        ) : null}
      </Map>

      {selectedCoordinate ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-6rem)] rounded-xl border border-glass-border bg-glass-dark/90 px-3 py-2 shadow-lg backdrop-blur-md">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-agrowth-300/90">
              {isLoadingRecommendation ? "Menganalisis koordinat" : "Lokasi aktif"}
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {locationLabel}
            </span>
            {coordinateLabel ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {coordinateLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Overlay controls (positioned outside <Map> for proper stacking) */}
      <VulnerabilityToggle />
      <MapLegend />
    </div>
  );
}
