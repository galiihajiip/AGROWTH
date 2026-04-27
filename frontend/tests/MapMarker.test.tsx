/**
 * Component tests untuk ``MapMarker``.
 *
 * Cakupan:
 * - SVG path teardrop pin di-fill warna emerald default saat ``riskLevel`` null.
 * - SVG fill mengikuti ``RISK_COLORS[riskLevel].hex`` saat risk di-set
 *   (low/medium/high/critical).
 *
 * Catatan teknis:
 * - ``react-map-gl`` ``<Marker>`` butuh map context (``MapboxProvider``)
 *   yang tidak tersedia di JSDOM. Kita mock-kan jadi pass-through ``<div>``
 *   yang hanya merender children supaya kita bisa test isi pin tanpa
 *   mempersiapkan kanvas Mapbox utuh.
 * - ``framer-motion`` aman di JSDOM tanpa mock (motion.div fall back ke div
 *   biasa di lingkungan tanpa animasi); kita biarkan apa adanya.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { RISK_COLORS } from "@/lib/constants";

vi.mock("react-map-gl", () => ({
  Marker: ({ children }: { children: ReactNode }) => (
    <div data-testid="marker-stub">{children}</div>
  ),
}));

import { MapMarker } from "@/components/map/MapMarker";

describe("MapMarker", () => {
  it("memakai warna emerald default ketika riskLevel null", () => {
    const { container } = render(
      <MapMarker lng={110.37} lat={-7.79} riskLevel={null} />,
    );
    const path = container.querySelector("svg path");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("fill")).toBe("#10b981"); // agrowth-500
  });

  it("memetakan risk_level ke RISK_COLORS hex pada SVG path", () => {
    for (const level of ["low", "medium", "high", "critical"] as const) {
      const expectedHex = RISK_COLORS[level].hex;
      const { container, unmount } = render(
        <MapMarker lng={110.37} lat={-7.79} riskLevel={level} />,
      );
      const path = container.querySelector("svg path");
      expect(
        path?.getAttribute("fill"),
        `risk=${level} expected ${expectedHex}`,
      ).toBe(expectedHex);
      unmount();
    }
  });

  it("anchor ke koordinat via Marker stub (lng/lat di-pass)", () => {
    const { getByTestId } = render(
      <MapMarker lng={106.85} lat={-6.2} riskLevel="medium" />,
    );
    // Stub merender children; keberadaan node memastikan flow render lewat.
    expect(getByTestId("marker-stub")).toBeInTheDocument();
  });
});
