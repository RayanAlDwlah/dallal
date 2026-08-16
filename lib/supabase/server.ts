import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicSupabaseConfig } from "./config";

/**
 * Server client — one per request, never a module-level singleton (a shared
 * client would carry one user's cookies into another user's response).
 * Runs as the user, not as an elevated role; RLS evaluates their session.
 */
export async function createClient() {
  /* cookies() first: touching it marks the route dynamic, so a build with no
     environment bails out here instead of failing over unused variables. */
  const cookieStore = await cookies();
  const { url, anonKey } = publicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* Server Components cannot write cookies. Safe to swallow: proxy.ts
             already refreshed the session on this same request. */
        }
      },
    },
  });
}
