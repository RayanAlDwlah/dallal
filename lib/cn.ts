import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting a later conflicting utility win.
 * `cn("p-4", "p-6")` → `"p-6"` rather than both.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
