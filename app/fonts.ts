import localFont from "next/font/local";

/**
 * design/STACK.md §5 — two faces from one superfamily.
 *
 * `ui`  Arabic interface text.
 * `num` Money and countdowns only. Money is Latin digits, and this face has
 *       genuine tabular figures — which is what keeps bid-history columns
 *       aligned so a strictly-increasing price sequence (FR-BID-15) stays
 *       scannable.
 *
 * The CSS variables are consumed by the --font-ui / --font-num entries in
 * app/globals.css, which already carry system-font fallbacks.
 *
 * Loaded with `next/font/local` from the @fontsource packages rather than
 * `next/font/google`. The Google loader fetches fonts.googleapis.com during
 * `next build`, so a build host that cannot reach it fails the whole build
 * — which is exactly how the Vercel deployment broke. The font files now
 * arrive with `npm ci`, so the build makes no third-party network call and
 * the same bytes are pinned in package-lock.json. Both packages are the
 * upstream IBM Plex releases under OFL-1.1.
 *
 * One subset per weight, deliberately: `next/font/local` emits an @font-face
 * per `src` entry with no `unicode-range`, so two entries sharing a
 * weight/style would shadow each other rather than combine by coverage.
 * `ui` therefore carries the Arabic subset — the interface is Arabic — and
 * every Latin numeral run is already routed to `num` by the `.num` utility.
 */
export const ui = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-ui",
  display: "swap",
});

export const num = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-num",
  display: "swap",
});
