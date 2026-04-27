/**
 * Flat ESLint config (ESLint 9 + eslint-config-next 16+).
 *
 * Mengikuti rekomendasi terbaru Next.js untuk App Router. Memuat dua preset:
 * - ``next/core-web-vitals`` (perf + a11y umum)
 * - ``next/typescript`` (rule khusus TypeScript)
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
