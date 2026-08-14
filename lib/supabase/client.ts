import { createBrowserClient } from "@supabase/ssr";

import { REALTIME_HEARTBEAT_MS } from "@/lib/realtime/connection-timing";

import { publicSupabaseConfig } from "./config";

/**
 * The browser client — AUTH-01.
 *
 * Reads only the two NEXT_PUBLIC_ variables (docs/environment-contract.md).
 * Anything this client can do, a visitor can do by hand with the anon key, so
 * it is never an authorization boundary: the data layer's default-deny
 * policies are (ARCHITECTURE §11.1, §17.1).
 *
 * What it produces is the identity contract's thing (1) — browser session
 * state, display only. Never derive a permission from it (S0-10 §3.4).
 *
 * ## The `realtime` option — BID-11, and the one thing to know before editing
 *
 * `createBrowserClient` is a **singleton in the browser**: the options object
 * is read on the FIRST call of a page's life and every later call returns that
 * same client, options ignored (`@supabase/ssr`, `createBrowserClient.js` —
 * `shouldUseSingleton`). So this is the only place the heartbeat can be set,
 * and setting it anywhere else would appear to work and silently not.
 *
 * The interval is the whole of BID-11's detection budget; the derivation, the
 * cost and the measurement all live in `lib/realtime/connection-timing.ts`.
 * It affects nothing in the auth path — identity is unchanged by it.
 */
export function createClient() {
  const { url, anonKey } = publicSupabaseConfig();
  return createBrowserClient(url, anonKey, {
    realtime: { heartbeatIntervalMs: REALTIME_HEARTBEAT_MS },
  });
}
