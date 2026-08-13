import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/validation";

/**
 * Where an emailed authentication link lands — AUTH-13.
 *
 * The link in the reset email points at Supabase, which verifies it and
 * forwards here. Exchanging it for a session is what proves the person
 * holds the mailbox (FR-AUTH-28); nothing before this point does.
 *
 * Two shapes are accepted because Supabase sends either depending on how the
 * project's email template is configured: `code` (PKCE) or
 * `token_hash` + `type`. Handling only one of them produces a reset flow that
 * works until somebody edits the template.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next")) ?? "/";
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  }

  /*
   * Cloned from nextUrl rather than rebuilt from request.url so the redirect
   * keeps the externally visible origin when running behind Vercel's proxy.
   */
  const destination = request.nextUrl.clone();
  destination.search = "";

  if (verified) {
    destination.pathname = next;
    return NextResponse.redirect(destination);
  }

  /*
   * FR-AUTH-29 / EC-28 — expired, already used, or tampered with. All three
   * land on the request screen, which offers a new link. The three are not
   * distinguished: the remedy is identical and telling someone which one
   * applies to a link they did not request is an enumeration channel.
   */
  destination.pathname = "/reset-password";
  destination.searchParams.set("expired", "1");
  return NextResponse.redirect(destination);
}
