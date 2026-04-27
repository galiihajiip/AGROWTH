/**
 * Utility helpers untuk komposisi className Tailwind.
 *
 * - :func:`cn` menggabungkan output ``clsx`` (truthy/falsy → string) dengan
 *   ``tailwind-merge`` (resolve konflik utility seperti ``px-2 px-4``).
 *   Pakai ini untuk SEMUA komponen yang menerima ``className`` dari luar.
 *
 * Contoh::
 *
 *     <button className={cn("px-4 py-2", isActive && "bg-agrowth-500", className)} />
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
