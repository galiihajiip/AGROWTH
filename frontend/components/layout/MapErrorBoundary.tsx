"use client";

/**
 * HIGH-H-007: Error Boundary khusus untuk MapView component.
 * Menangkap error (mis. Mapbox token tidak tersedia) dan menampilkan
 * friendly fallback UI bukan white screen crash.
 */
import { MapPinOff } from "lucide-react";
import React, { PropsWithChildren } from "react";

interface MapErrorBoundaryProps extends PropsWithChildren {}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MapErrorBoundary extends React.Component<
  MapErrorBoundaryProps,
  State
> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[MapErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isTokenError =
        this.state.error?.message.includes("Mapbox") ||
        this.state.error?.message.includes("token");

      return (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-glass-border bg-glass-dark p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-500/15 ring-1 ring-warning-500/35">
              <MapPinOff className="h-8 w-8 text-warning-400" strokeWidth={2} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {isTokenError ? "Peta Tidak Tersedia" : "Terjadi Kesalahan"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isTokenError
                  ? "Token Mapbox tidak dikonfigurasi. Tambahkan NEXT_PUBLIC_MAPBOX_TOKEN di .env.local"
                  : "Gagal memuat komponen peta. Silakan refresh halaman."}
              </p>
            </div>

            {!isTokenError && this.state.error && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Detail error
                </summary>
                <pre className="mt-2 max-w-sm overflow-auto rounded bg-glass-light p-2 text-left">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
