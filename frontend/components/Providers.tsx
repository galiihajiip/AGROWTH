"use client";

/**
 * Client-side providers wrapper.
 *
 * ``ThemeProvider`` dari next-themes mengelola class ``dark`` di ``<html>``
 * saat user toggle tema. ``Toaster`` (sonner) di-mount sekali di sini
 * supaya bisa mengikuti tema aktif secara reaktif.
 *
 * Perlu wrapper terpisah karena ``app/layout.tsx`` adalah Server Component
 * — tidak boleh pakai hook / context secara langsung.
 */
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "border border-glass-border bg-glass-dark backdrop-blur-xl",
          title: "text-sm font-semibold",
          description: "text-xs text-muted-foreground",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <ThemedToaster />
    </ThemeProvider>
  );
}
