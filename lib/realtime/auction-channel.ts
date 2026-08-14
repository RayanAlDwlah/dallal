import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

/**
 * The realtime foundation — BID-08. FR-RT-01, ARCH §14.1/§14.2, ADR-9, BR-22.
 *
 * Clients subscribe **directly to Supabase**; Vercel is not in this path and
 * cannot be, given its execution model (§14.1). One channel per auction, never
 * a global one (§14.2) — that scoping is what makes twenty concurrent viewers
 * inexpensive (NFR-RT-02): a bid fans out to the viewers of one auction, not
 * to everyone on the platform.
 *
 * ## The one design decision in this file
 *
 * `onChange` takes **no argument**, and that is not an oversight to be tidied
 * up later. `RT-R6` and `ADR-9` require the event to be a signal to re-read and
 * never a display source, and a rule of that shape is one a future session
 * forgets. Here it cannot be forgotten: there is no parameter to read. A
 * consumer that writes `onChange: (payload) => ...` does not compile.
 *
 * The database side matches — the payload it authors carries an auction id the
 * subscriber already had, and nothing else. See
 * `supabase/migrations/20260814140000_bid08_realtime_foundation.sql` §1 for why
 * it is a broadcast rather than `postgres_changes`, and
 * `docs/BID-08-realtime-verification.md` for the measurement that decided it.
 *
 * ## Realtime never gates bidding
 *
 * `RT-R7`: the bid path and the broadcast path are independent, in both
 * directions. Nothing here throws into its caller and nothing here is awaited
 * by a bid. Whatever goes wrong, the worst outcome is `"unavailable"` and a
 * page that still works by reading (`EC-09`, §14.5).
 */

/** What the consumer is allowed to tell the user. Nothing about the data. */
export type AuctionChannelStatus =
  /** Joining. Loaded data is current as of load and stays readable. */
  | "connecting"
  /** Joined. Changes to this auction will arrive. */
  | "live"
  /**
   * Not joined, for any reason. FR-RT-11 and RT-R2 want this surfaced calmly
   * within 10 seconds, with loaded data still readable and the bid control
   * marked stale — presentation is Mohammed's (CLAUDE.md §1); the state is ours.
   */
  | "unavailable";

export interface AuctionChannelHandlers {
  /**
   * The auction changed — price, a new bid in history, the status, the
   * outcome, or the end time after a BR-36 extension. Re-read all of it from
   * the database; that read is the authority (BR-22).
   *
   * Deliberately takes no argument. See the note at the top of this file.
   */
  onChange: () => void;
  onStatus?: (status: AuctionChannelStatus) => void;
}

/** Must match the topic the database trigger writes to, byte for byte. */
export function auctionTopic(auctionId: string): string {
  return `auction:${auctionId}`;
}

/** Must match the event name the database trigger writes. */
const CHANGE_EVENT = "auction_changed";

/**
 * Subscribe to one auction. Returns an unsubscribe function; calling it more
 * than once is safe, and calling it before the join completes cancels the join.
 *
 * The status starts at `"connecting"` **by contract** — `onStatus` is called
 * only on transitions away from it, never synchronously on the way in. That is
 * deliberate: a synchronous callback here lands in the caller's render pass and
 * costs a cascading render for information they already had.
 */
export function subscribeToAuction(
  auctionId: string,
  { onChange, onStatus }: AuctionChannelHandlers,
): () => void {
  let cancelled = false;
  let teardown: (() => void) | null = null;

  const report = (status: AuctionChannelStatus) => {
    if (!cancelled) onStatus?.(status);
  };

  // Async because the private-channel handshake is: set the token, THEN join.
  // The caller gets a synchronous unsubscribe regardless, so a component that
  // unmounts mid-handshake is handled by `cancelled` rather than by a race.
  void (async () => {
    try {
      const supabase = createClient();

      // Private channels are authorized by RLS on realtime.messages, and the
      // policy runs as the role in this token. Without it the join is refused
      // and no event ever arrives — measured, and the reason the first spike
      // saw zero events. For a signed-out visitor the token is the anon key,
      // which is correct: an auction and its bid history are public (SC-75).
      await supabase.realtime.setAuth();
      if (cancelled) return;

      const channel = supabase
        .channel(auctionTopic(auctionId), { config: { private: true } })
        .on("broadcast", { event: CHANGE_EVENT }, () => {
          // No parameter is read, deliberately. RT-R6.
          //
          // Duplicates are expected rather than tolerated: a bid inside the
          // final 15 seconds updates the auction twice (the extension, then
          // the price), so two events arrive for one bid. FR-RT-09 and RT-R5
          // require that to be invisible, and it is — re-reading twice yields
          // the same state. Out-of-order delivery is a non-event for the same
          // reason: there is no order in a signal that carries nothing, so a
          // price can never appear to move down (RT-X5).
          if (!cancelled) onChange();
        })
        .subscribe((state) => {
          report(
            state === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED ? "live" : "unavailable",
          );
        });

      teardown = () => {
        void supabase.removeChannel(channel);
      };
      if (cancelled) teardown();
    } catch {
      // RT-R7. A missing environment variable, a blocked websocket, a browser
      // that refuses the connection — none of it may reach the caller, because
      // the caller is a page whose bid control has to keep working.
      report("unavailable");
    }
  })();

  return () => {
    cancelled = true;
    teardown?.();
    teardown = null;
  };
}
