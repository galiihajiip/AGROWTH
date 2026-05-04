"use client";

/**
 * MEDIUM-M-001: Empty state UI ketika belum ada koordinat terpilih.
 * Menampilkan animated guidance dengan pointer + helpful messaging.
 */
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

export function EmptyState() {
  const [isVisible, setIsVisible] = useState(false);

  // Delay mounting untuk smooth fade-in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-glass-dark/40 to-glass-dark/60 backdrop-blur-sm transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        {/* Animated pointer icon */}
        <div className="relative h-16 w-16">
          <div
            className="absolute inset-0 flex items-center justify-center animate-bounce"
            style={{ animationDuration: "2s", animationDelay: "0s" }}
          >
            <MapPin className="h-8 w-8 text-primary-400 drop-shadow-lg" />
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary-400/30 animate-pulse" />
        </div>

        {/* Text guidance */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            Pilih Lokasi Anda
          </h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Klik di mana saja di peta Pulau Jawa untuk melihat rekomendasi
            pertanian, prakiraan cuaca, dan nasihat tradisional Pranata Mangsa.
          </p>
        </div>

        {/* Secondary CTA */}
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary-500/10 px-4 py-2 ring-1 ring-primary-500/20">
          <span className="inline-block animate-pulse text-primary-400">●</span>
          <span className="text-xs font-medium text-primary-300">
            Menunggu pemilihan lokasi...
          </span>
        </div>
      </div>
    </div>
  );
}
