/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vitest config untuk AGROWTH frontend.
 *
 * - JSDOM environment supaya Testing Library bisa render component React
 *   tanpa browser asli.
 * - Path alias `@/...` selaras dengan ``tsconfig.json`` agar import dalam
 *   test sama persis dengan kode produksi (mis. `@/store/useAgrowthStore`).
 * - `tests/setup.ts` di-load sebelum tiap file test untuk memasang
 *   `@testing-library/jest-dom` matchers (toHaveClass, toBeInTheDocument, ...).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: false,
    // Hindari mem-collect file dari .next / node_modules / e2e tooling.
    exclude: ["node_modules", ".next", "out", "build"],
    // Buat output ringkas untuk CI.
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: process.env.CI
      ? { junit: "./.next/vitest-junit.xml" }
      : undefined,
  },
});
