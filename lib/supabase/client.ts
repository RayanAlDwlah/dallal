import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseConfig } from "./config";

/**
 * Browser client. Reads only the two NEXT_PUBLIC_ variables — anything this
 * client can do, a visitor can do by hand with the anon key, so it is never
 * an authorization boundary: the database RLS policies are.
 */
export function createClient() {
  const { url, anonKey } = publicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
