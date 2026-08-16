import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hand the realtime socket the user's access token before subscribing.
 *
 * postgres_changes evaluates RLS against the JWT the SOCKET carries, not the
 * one the REST calls carry. `notifications` is readable only by its owner, so
 * a socket that never receives the token sees nothing on that table — while
 * `auctions` and `bids`, whose read policy is `using (true)`, keep streaming.
 * That asymmetry is the trap: live prices would look perfectly healthy and
 * only the private stream would go quiet.
 *
 * **This call is belt-and-braces, not a bug fix, and the measurement says so.**
 * supabase-js already forwards the token to the realtime client on every auth
 * state change, so a client that restored its session from the cookie has an
 * authorized socket without any help from us. A control run — the same
 * subscription with this call deliberately removed — still received the
 * private INSERT. What this removes is the *ordering dependency*: the token
 * reaching the socket before `subscribe()` becomes something this code states
 * rather than something it inherits from the auth listener firing first.
 *
 * Recorded because the honest version is the useful one: a future reader who
 * deletes this call will not break notifications today, and should not be told
 * a scary story that sends them chasing a defect that was never there. The
 * reason to keep it is the invariant, not a past outage.
 */
export async function authorizeRealtime(supabase: SupabaseClient): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    await supabase.realtime.setAuth(token);
  }
}
