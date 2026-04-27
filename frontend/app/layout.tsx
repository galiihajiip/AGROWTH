import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "AGROWTH Dashboard",
    template: "%s · AGROWTH",
  },
  description:
    "Dashboard rekomendasi pertanian hybrid (Pranata Mangsa + cuaca + LLM) untuk Pulau Jawa.",
  applicationName: "AGROWTH",
  authors: [{ name: "AGROWTH" }],
  keywords: [
    "AGROWTH",
    "Pranata Mangsa",
    "pertanian",
    "Indonesia",
    "Jawa",
    "weather",
    "Gemini",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}

        {/*
          Global toast notifier (sonner). Subscribe-once dari layout root
          supaya bisa dipanggil dari mana saja via ``import { toast } from "sonner"``.
          - richColors: tipe error/success/info dapat warna kontekstual.
          - theme="dark": match dark dashboard (background slate-950).
          - position top-right: tidak menutupi map klik di kiri.
          - closeButton: user bisa dismiss manual (selain auto-dismiss).
          - duration 5s default — cukup baca, tidak menumpuk lama.
        */}
        <Toaster
          richColors
          theme="dark"
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
      </body>
    </html>
  );
}
