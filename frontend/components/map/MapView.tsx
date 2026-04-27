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
import { useCallback } from "react";
import Map, {
  NavigationControl,
  type MapLayerMouseEvent,
} from "react-map-gl";

import { MapMarker } from "@/components/map/MapMarker";
import { VulnerabilityLayer } from "@/components/map/VulnerabilityLayer";
import { isInsideJavaBounds } from "@/lib/constants";
import {
  INITIAL_VIEW_STATE,
  MAP_STYLE,
  MAX_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  assertMapboxToken,
} from "@/lib/mapbox-config";
import { useAgrowthStore } from "@/store/useAgrowthStore";

export function MapView() {
  const setCoordinate = useAgrowthStore((state) => state.setCoordinate);
  const selectedCoordinate = useAgrowthStore(
    (state) => state.selectedCoordinate,
  );
  // risk_level ikut hidup dari single recommendation fetch (sumber tunggal).
  const riskLevel = useAgrowthStore(
    (state) => state.recommendationData?.risk_level ?? null,
  );

  const token = assertMapboxToken();

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
    <div className="h-full w-full overflow-hidden rounded-2xl border border-white/10">
      <Map
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
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
    </div>
  );
}
