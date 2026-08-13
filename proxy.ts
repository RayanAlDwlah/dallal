import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16 renamed the `middleware` file convention to `proxy`; the old name
 * builds with a deprecation warning. Same request hook, same matcher.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Everything except static assets. The session must refresh on ordinary
   * page navigations, which is most of what is left after these exclusions —
   * narrowing this matcher to a handful of routes would leave the rest of the
   * app unable to refresh (see the comment in lib/supabase/server.ts).
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2)$).*)",
  ],
};
