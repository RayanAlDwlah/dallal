import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

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
 */
export const ui = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

export const num = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-num",
  display: "swap",
});
