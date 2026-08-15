/**
 * Tiny in-memory sliding-window limiter for the AI routes. Per-instance and
 * best-effort by design: the model behind these routes is the expensive part,
 * not correctness of the count. Survives hot reload, resets on deploy.
 */

const windows = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    windows.set(key, hits);
    return false;
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 5000) windows.clear();
  return true;
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${scope}:${fwd ?? "local"}`;
}
