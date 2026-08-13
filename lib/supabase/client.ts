import { createBrowserClient } from "@supabase/ssr";

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
 */
export function createClient() {
  const { url, anonKey } = publicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
