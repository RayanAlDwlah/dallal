"use client";

import { useSyncExternalStore } from "react";

/**
 * The client clock as an external store — the React-correct way to read a
 * ticking value during render (no setState-in-effect, no impure render call).
 * Snapshots are rounded to whole seconds so the value is stable between ticks.
 * Returns 0 during SSR; components render a placeholder until the first tick.
 */
function subscribe(callback: () => void): () => void {
  const id = setInterval(callback, 500);
  return () => clearInterval(id);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function getServerSnapshot(): number {
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
