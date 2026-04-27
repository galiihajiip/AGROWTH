import type { Config } from "tailwindcss";

/**
 * Tailwind v3 design tokens untuk AGROWTH frontend.
 *
 * Tema utama: hijau sawah Pranata Mangsa (emerald-based) dengan aksen
 * amber (matahari) dan glassmorphism untuk panel data. Dark mode pakai
 * strategi ``class`` (`<html class="dark">` di app/layout.tsx).
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ========== COLORS ==========
      colors: {
        // Token shadcn-style berbasis CSS variables (light/dark via .dark).
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",

        // Palette utama AGROWTH (hijau sawah, emerald-based 50..950).
        agrowth: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981", // primary brand
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },

        // Aksen amber (matahari) untuk highlight & call-to-action sekunder.
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },

        // Status warning/critical (anomaly: heatwave, flood, etc.).
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },

        // Permukaan glassmorphism (rgba semi-transparan).
        glass: {
          subtle: "rgba(255, 255, 255, 0.04)",
          DEFAULT: "rgba(255, 255, 255, 0.06)",
          strong: "rgba(255, 255, 255, 0.10)",
          border: "rgba(255, 255, 255, 0.12)",
          "border-strong": "rgba(255, 255, 255, 0.18)",
          dark: "rgba(2, 6, 23, 0.55)",
          "dark-strong": "rgba(2, 6, 23, 0.75)",
        },
      },

      // ========== FONTS ==========
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },

      // ========== BACKDROP BLUR (untuk glassmorphism) ==========
      backdropBlur: {
        xs: "2px",
        xl: "24px",
        "2xl": "40px",
        "3xl": "64px",
      },

      // ========== SHADOWS ==========
      boxShadow: {
        glass:
          "0 8px 32px 0 rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        "glass-strong":
          "0 12px 48px 0 rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.10)",
        "glow-emerald":
          "0 0 24px rgba(16, 185, 129, 0.45), 0 0 48px rgba(16, 185, 129, 0.18)",
        "glow-amber":
          "0 0 24px rgba(245, 158, 11, 0.45), 0 0 48px rgba(245, 158, 11, 0.18)",
        "glow-danger":
          "0 0 24px rgba(239, 68, 68, 0.45), 0 0 48px rgba(239, 68, 68, 0.18)",
      },

      // ========== RADIUS ==========
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },

      // ========== KEYFRAMES & ANIMATIONS ==========
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 24px rgba(16, 185, 129, 0.45)",
          },
          "50%": {
            opacity: "0.85",
            boxShadow: "0 0 36px rgba(16, 185, 129, 0.7)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        // Pakai keyframes ``spin`` bawaan Tailwind (360°, linear) dengan
        // durasi panjang supaya cocok untuk ikon dekoratif (mis. Sparkles
        // di RecommendationCard) tanpa mendistraksi mata.
        "spin-slow": "spin 6s linear infinite",
      },

      // ========== BACKGROUND IMAGES (gradient siap pakai) ==========
      backgroundImage: {
        "gradient-shimmer":
          "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%)",
        "gradient-emerald":
          "linear-gradient(135deg, #10b981 0%, #047857 100%)",
        "gradient-amber":
          "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
