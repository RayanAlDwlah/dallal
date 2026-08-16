import type { NextConfig } from "next";

/**
 * AUC-09 (#148) — where product images may be optimised from.
 *
 * V-4 (docs/V-4-image-transformation.md) ruled out Supabase's own transform
 * endpoint: it is Pro-plan gated, and NFR-PERF-05 has no environment carve-out,
 * so binding a hard requirement to a plan tier makes dev and prod differ. The
 * platform doing the resizing is Vercel's optimiser instead, which is already
 * the deploy target.
 *
 * Two things bound what it will fetch:
 *
 *   - the HOST is this project's Supabase host when NEXT_PUBLIC_SUPABASE_URL is
 *     present at build time, and `*.supabase.co` when it is not. The fallback
 *     matters because the build must not require credentials — it does not
 *     today, and a config that throws without them would make `next build` a
 *     credentialled operation.
 *   - the PATHNAME is the public-object route, and nothing else.
 *
 * ── Two deliberate widenings for V2, and why each is safe ─────────────────
 *
 * V1 pinned the pathname to `/auction-images/**` and set `port: ""` /
 * `search: ""`. V2 changes both, and the reasoning is recorded because a
 * loosened allowlist is exactly the diff that should not pass unexamined.
 *
 * 1. The bucket segment is now `**`. V2 has a SECOND public bucket — `avatars`
 *    — and profile pictures go through `next/image` on the same path
 *    (components/navigation/user-menu.tsx, components/profile/profile-editor.tsx).
 *    Pinning one bucket would mean either an un-optimised raw `<img>` for
 *    avatars, which INT-06 forbids, or a second near-identical entry. Both
 *    buckets are public by construction, so the segment carries no authority
 *    that the pathname prefix was enforcing.
 *
 * 2. `http://127.0.0.1` and `http://localhost` are admitted so the local
 *    Supabase stack works in development. They are unroutable from the
 *    deployed origin, so they widen nothing in production.
 *
 * A seller cannot reach the optimiser through either. `images` holds storage
 * KEYS, never URLs, and V2's `valid_image_paths` (core_schema.sql:96) is an
 * ALLOWLIST — `^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$` plus a `..` rejection. A colon
 * cannot appear at all, so no scheme is expressible; the leading character must
 * be alphanumeric, so no absolute path is either. That is strictly tighter than
 * V1's denylist, which had to enumerate the schemes it refused. The URL is
 * assembled by `publicImageUrl` (lib/images.ts:7) from that key, so the origin
 * is never seller-controlled.
 */
function storageHostname(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "*.supabase.co";
  try {
    return new URL(url).hostname;
  } catch {
    /* A malformed value fails loudly where it is USED (lib/supabase/config.ts),
       with a message naming both variables. Failing here instead would turn a
       missing env var into an unexplained build error. */
    return "*.supabase.co";
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: storageHostname(),
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
