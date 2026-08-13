import type { NextConfig } from "next";

/**
 * Dalal — Next.js configuration
 *
 * Deliberately minimal. ARCHITECTURE.md §18.5 constrains the app to Vercel's
 * stateless execution model: no long-running process, no in-memory state.
 * Nothing here should introduce either.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
