import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where every emailed link lands: confirming an address, and recovering a
 * password. Supabase sends one of two shapes depending on the template —
 * `?code=` (PKCE) or `?token_hash=&type=` — and both have to work, because
 * which one arrives depends on the project's email templates rather than on
 * anything this app controls.
 *
 * The session is established HERE, on the server, so the cookie is set before
 * the user's browser reaches the page that needs it. A recovery link that
 * redirected straight to /update-password would arrive with no session and
 * the password change would fail.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  /* Only ever redirect within this site — an open redirect on the one route
     that hands out a session is worth more to an attacker than most bugs. */
  const requested = searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(
        `${origin}${type === "recovery" ? "/update-password" : next}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?link=invalid`);
}
