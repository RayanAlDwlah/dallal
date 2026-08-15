import type { NextConfig } from "next";

/**
 * Dalal — Next.js configuration
 *
 * Deliberately minimal. ARCHITECTURE.md §18.5 constrains the app to Vercel's
 * stateless execution model: no long-running process, no in-memory state.
 * Nothing here should introduce either.
 */

/**
 * AUC-09 (#148) — where product images may be optimised from.
 *
 * V-4 (docs/V-4-image-transformation.md) ruled out Supabase's own transform
 * endpoint: it is Pro-plan gated, and NFR-PERF-05 has no environment carve-out,
 * so binding a hard requirement to a plan tier makes dev and prod differ. The
 * platform doing the resizing is Vercel's optimiser instead, which is already
 * the deploy target.
 *
 * Two things bound what it will fetch, and the second is the tight one:
 *
 *   - the HOST is this project's Supabase host when NEXT_PUBLIC_SUPABASE_URL is
 *     present at build time, and `*.supabase.co` when it is not. The fallback
 *     matters because the build must not require credentials — it does not
 *     today, and a config that throws without them would make `next build` a
 *     credentialled operation.
 *   - the PATHNAME is exactly the public-object route for the one bucket. That
 *     is what `publicImageUrl` produces and nothing else.
 *
 * A seller cannot reach this even with the looser host. `image_path` is a
 * storage KEY, never a URL, and `auctions_image_path_shape` rejects anything
 * carrying a scheme (`image_path !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'`), an absolute
 * path, or `..`. The URL is assembled server-side by lib/auctions/image-url.ts
 * from that key, so the origin is never seller-controlled.
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
        port: "",
        pathname: "/storage/v1/object/public/auction-images/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
