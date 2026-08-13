/**
 * The canonical public origin of this deployment.
 *
 * This exists as its own module rather than living beside its caller because
 * `app/(auth)/actions.ts` is a `"use server"` file, where every export must be
 * an async server action — a pure helper cannot be exported from there, and so
 * could not be exercised directly.
 */

/**
 * Resolves the origin a password-reset link is built from, or null.
 *
 * NOT taken from the request in production, deliberately. `Host` and
 * `X-Forwarded-Host` are supplied by the caller, and this value becomes the URL
 * inside the reset email — the URL the recovery token is handed to. A forged
 * header therefore sends a working reset link for a real account to a host the
 * attacker picked.
 *
 * Supabase's redirect allow-list does block that today, but it is a dashboard
 * setting maintained by hand, and the natural entry to add so preview
 * deployments work — `https://*.vercel.app/**` — removes the protection
 * entirely without looking like it did. Reading the origin from configuration
 * means no allow-list mistake can reach this path.
 *
 * `SITE_URL` carries no `NEXT_PUBLIC_` prefix on purpose: nothing in the
 * browser reads it, and per docs/environment-contract.md §6 the prefix IS the
 * publishing mechanism, not a naming convention.
 *
 * Returns null rather than falling back to the header when unset in
 * production. A missing configuration must fail visibly; falling back would
 * restore the exact hole this function exists to close.
 */
export function siteOrigin(requestHeaders: Headers): string | null {
  const configured = process.env.SITE_URL?.trim();

  if (configured) {
    try {
      const url = new URL(configured);
      /* Anything but http(s) is a malformed value, not a usable origin. */
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      /* `origin` normalises away any path, query, credentials or trailing slash. */
      return url.origin;
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV === "production") return null;

  /*
   * Development only. `next dev` has no fixed public URL, and on a local
   * machine the Host header is not an attack surface. `X-Forwarded-Host` is
   * still not consulted — there is no proxy in front of `next dev`, so a value
   * arriving in it would already be someone playing games.
   */
  const host = requestHeaders.get("host");
  return host ? `http://${host}` : null;
}
