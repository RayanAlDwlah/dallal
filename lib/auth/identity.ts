import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * The identity contract in code — docs/identity-contract.md (S0-10).
 *
 * The contract names two separate things and warns that confusing them is the
 * single most likely mistake on this project:
 *
 *   (1) browser session state    — decides what is DISPLAYED
 *   (2) server-verified identity — decides what is ALLOWED
 *
 * Everything in this file is (2). It is read with getUser(), which revalidates
 * the token against the auth server on every call. getSession() is never used:
 * it decodes a cookie the client sent and would make (1) look like (2), which
 * is exactly the failure the contract is written to prevent.
 *
 * Callers that only need to decide what to render may use these values freely
 * — (2) is strictly stronger than (1). The reverse is never true.
 */

/** The public identity of the current user. Email is never a member of this type. */
export interface Viewer {
  /** FR-AUTH-19 — stable internal identifier. Attribution and authorization key. */
  id: string;
  /** FR-AUTH-20, BR-26 — the only public identity there is. */
  displayName: string;
}

/**
 * The verified user id, or null for a visitor.
 *
 * A visitor is a supported user, not an error (S0-10 §6, FR-AUTH-23) — null is
 * an ordinary answer here and every caller must handle it without breaking.
 *
 * Wrapped in cache() so the layout, the page and any action on the same
 * request share one revalidation instead of issuing three.
 */
export const getVerifiedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  /*
   * An error here is the normal no-session case as often as it is a real
   * fault, and the two are not worth distinguishing: both mean "not
   * authenticated", and both must degrade to the visitor state (S0-10 §7).
   */
  if (error || !data.user) return null;
  return data.user.id;
});

/**
 * Why the current request is not authenticated — `FR-AUTH-17`.
 *
 * The requirement is that an expired session leaves the user "told clearly and
 * prompted to sign in again, not left in a silently broken state". Dropping
 * them to the visitor state is correct (`S0-10` §7) but it is exactly the
 * silence the requirement forbids: their name disappears from the header and a
 * protected page bounces them to a login form with no explanation.
 *
 * `expired` and `anonymous` differ only in what the user is told. Neither
 * grants anything, and no caller may branch on this for authorization — it is
 * the identity contract's thing (1), display only.
 */
export type SessionState = "authenticated" | "expired" | "anonymous";

/*
 * Supabase's SSR client stores the session under `sb-<project-ref>-auth-token`,
 * split into `.0`, `.1`, … when it exceeds the per-cookie size limit.
 */
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Distinguishes "your session ended" from "you were never signed in".
 *
 * A cookie that is present but no longer yields a user is a session that has
 * expired or been revoked. That is a *best-effort* read: on the request where
 * the refresh finally fails, the proxy may already have cleared the cookie, and
 * the answer degrades to `anonymous`. That costs a more precise message and
 * nothing else — both states are unauthenticated, and both are told to sign in.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  if (await getVerifiedUserId()) return "authenticated";

  const cookieStore = await cookies();
  const hadSession = cookieStore.getAll().some((c) => AUTH_COOKIE.test(c.name));
  return hadSession ? "expired" : "anonymous";
});

/**
 * The current user's id and display name, or null for a visitor.
 *
 * Two round trips, because display_name lives in public.profiles and the id
 * lives in the session. profiles is publicly readable (BR-40), so this needs
 * no elevated credential.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const userId = await getVerifiedUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle<{ display_name: string }>();

  /*
   * No profile row for a verified user should be impossible — the signup
   * trigger creates it in the same transaction as the account, so an account
   * without a profile cannot be committed (FR-PROF-02). If it somehow
   * happens, treat the user as a visitor rather than inventing a name: a
   * fabricated display name would be attributed to them in public bid history.
   */
  if (!data) return null;

  return { id: userId, displayName: data.display_name };
});

/**
 * The email of the current user, for showing them their own account.
 *
 * FR-PROF-06 / SEC-P1: this is the ONLY legitimate use — a user seeing their
 * own address on their own profile. It must never be passed to a component
 * that renders another user's row, and it must never enter a public read.
 */
export async function getOwnEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.email ?? null;
}
