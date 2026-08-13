import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicSupabaseConfig } from "./config";

/**
 * The server client — AUTH-01.
 *
 * Every request gets its own client. Never hoist this into a module-level
 * singleton: one client would then be shared between concurrent requests and
 * carry one user's cookies into another user's response.
 *
 * This is the client the identity contract's thing (2) is read through
 * (S0-10 §4). It still runs as the *user*, not as an elevated role — RLS
 * evaluates against their session exactly as it does in the browser.
 */
export async function createClient() {
  /*
   * cookies() first, deliberately. Touching it is what marks the route
   * dynamic, so on a build with no environment configured the route bails out
   * here rather than reaching publicSupabaseConfig() and failing the build
   * over variables a prerender was never going to need.
   */
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
          /*
           * Server Components cannot write cookies. That is not an error
           * here: proxy.ts has already refreshed the session on this same
           * request, so the tokens being written are ones the browser is
           * about to receive anyway. Swallowing it is only safe *because*
           * that matcher covers every page path — if it ever stops covering a
           * route, sessions on that route stop refreshing silently.
           */
        }
      },
    },
  });
}
