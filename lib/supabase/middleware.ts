import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicSupabaseConfig } from "./config";

/**
 * Refreshes the session cookie on every request — FR-AUTH-16.
 *
 * Access tokens are short-lived. Without this pass a user who leaves a tab
 * open, or closes the browser and comes back, returns to an expired token and
 * is silently signed out — the "silently broken state" FR-AUTH-17 forbids.
 *
 * This function performs NO route protection, deliberately. FR-AUTH-24 makes
 * route-level gating a UX affordance only, so putting the gate here would put
 * it in the one place that cannot be the authority. The real check is
 * getVerifiedUserId() in lib/auth/identity.ts, called next to the operation,
 * and behind that the row policies in the database.
 *
 * Called from proxy.ts — Next 16's name for the middleware convention.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const { url, anonKey } = publicSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  /*
   * getUser(), not getSession(). getSession() decodes whatever cookie was
   * sent without asking the auth server whether it is still valid, so it
   * cannot refresh anything and cannot be trusted. This call is the refresh.
   */
  await supabase.auth.getUser();

  return response;
}
