/**
 * Vitest setup global — di-load lewat ``setupFiles`` di ``vitest.config.ts``.
 *
 * Memasang matcher Testing Library (``toBeInTheDocument`` dst.) supaya
 * test bisa pakai assertion DOM-spesifik tanpa import per-file.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
