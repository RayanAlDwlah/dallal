import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

import { CONNECT_DEADLINE_MS } from "./connection-timing";

/**
 * The realtime foundation — BID-08. FR-RT-01, ARCH §14.1/§14.2/§14.5, ADR-9, BR-22.
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
 *
 * ## Two things this file learned the hard way — do not undo either
 *
 * Both were found by an adversarial review of the first version, written up in
 * `docs/BID-08-realtime-verification.md` §7. Both had shipped, and both looked
 * fine.
 *
 * 1. **Joining fires `onChange`.** A signal that is only sent while you are
 *    connected is not enough to satisfy `RT-R3` / `FR-RT-12`, which require
 *    resynchronizing to authoritative state **on reconnect**. See the note at
 *    the `subscribe` callback.
 * 2. **Subscribers to one auction share one channel, by reference count.**
 *    `supabase-js` already returns the *same* channel object for a repeated
 *    topic, so the naive version let the first component to unmount call
 *    `removeChannel` and silently kill delivery for every other component on
 *    the page — while they went on displaying `"live"`. §14.6 puts the price
 *    region, the bid control, the history and the outcome banner in separate
 *    components on one auction, so that is the normal case, not an edge one.
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
   *
   * BID-11 made the ten seconds true rather than intended. **There is
   * deliberately no fourth state**: "reconnecting" would be a new word for
   * Mohammed's screens to say and a new branch for every consumer, to describe
   * a situation in which the advice to the viewer is identical — your copy may
   * be stale, bidding still works. See `connection-timing.ts`.
   */
  | "unavailable";

export interface AuctionChannelHandlers {
  /**
   * Re-read this auction from the database — price, history, status, outcome,
   * end time. That read is the authority (BR-22); this call is only the cue.
   *
   * Called when the auction changes **and on every successful join**, which is
   * what makes reconnection correct rather than merely quiet. Treat it as
   * "your copy may be stale", never as "exactly one thing happened": it fires
   * twice for one bid in the final 15 seconds (the BR-36 extension, then the
   * price), and duplicates are required to be invisible (FR-RT-09, RT-R5).
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
 * One entry per auction being watched, however many components are watching it.
 *
 * Keyed by auction id rather than by channel, because the channel does not
 * exist yet while the private-channel handshake is in flight and subscribers
 * can arrive during that window.
 */
interface Watch {
  handlers: Set<AuctionChannelHandlers>;
  channel: RealtimeChannel | null;
  status: AuctionChannelStatus;
  /** Set when the watch is actually torn down, so a join in flight is discarded. */
  closed: boolean;
  /** Pending teardown — see GRACE_MS. Cleared if a subscriber returns first. */
  reaper: ReturnType<typeof setTimeout> | null;
  /** BID-11 — see CONNECT_DEADLINE_MS. Cleared by the first status of any kind. */
  deadline: ReturnType<typeof setTimeout> | null;
}

const watches = new Map<string, Watch>();

/**
 * How long an unwatched auction keeps its channel before it is torn down.
 *
 * Not a performance tweak — a correctness one. Teardown is asynchronous, while
 * React unmounts and remounts **synchronously**: Strict Mode does it on every
 * mount in development, and so does any parent re-key. Closing immediately
 * means the remount calls `supabase.channel(topic)` while the old channel of
 * that same topic is still in the client's list mid-`unsubscribe`, gets handed
 * that dying object back (`RealtimeClient.channel` returns an existing topic
 * rather than creating a second one), and lands on a channel that closes under
 * it and never rejoins — because a channel that was deliberately left is not
 * one Phoenix retries. The symptom would be a permanent `"unavailable"` that
 * only reproduces in development.
 *
 * A remount inside the grace window reuses the live channel and does not
 * rejoin at all, which is also simply better.
 */
const GRACE_MS = 250;

/** Copy before iterating: a handler may unsubscribe from inside its own call. */
const each = (watch: Watch, run: (h: AuctionChannelHandlers) => void) => {
  for (const handler of Array.from(watch.handlers)) {
    if (watch.handlers.has(handler)) run(handler);
  }
};

/**
 * Record a status and tell everyone watching. The single place `watch.status`
 * is written, so the connect deadline cannot be left running by a path that
 * forgot about it — which is the only way this could go wrong.
 */
function settle(watch: Watch, status: AuctionChannelStatus): void {
  if (watch.deadline !== null) {
    clearTimeout(watch.deadline);
    watch.deadline = null;
  }
  watch.status = status;
  each(watch, (h) => h.onStatus?.(status));
}

/**
 * BID-11 / FR-RT-11 — a join that never answers is loss, and must be said so.
 *
 * The heartbeat cannot cover this case: there is no established socket to send
 * a heartbeat on, so nothing times out and nothing errors. `"connecting"` is
 * honest for a second and a lie after ten, and the bid control stays unmarked
 * the whole time.
 */
function armConnectDeadline(watch: Watch): void {
  watch.deadline = setTimeout(() => {
    watch.deadline = null;
    if (watch.closed || watch.status !== "connecting") return;
    settle(watch, "unavailable");
  }, CONNECT_DEADLINE_MS);
}

function join(auctionId: string, watch: Watch): void {
  armConnectDeadline(watch);
  // Async because the private-channel handshake is: set the token, THEN join.
  // The caller gets a synchronous unsubscribe regardless, so a component that
  // unmounts mid-handshake is handled by `watch.closed` rather than by a race.
  void (async () => {
    try {
      const supabase = createClient();

      // Private channels are authorized by RLS on realtime.messages, and the
      // policy runs as the role in this token. Without it the join is refused
      // and no event ever arrives — measured, and the reason the first spike
      // saw zero events. For a signed-out visitor the token is the anon key,
      // which is correct: an auction and its bid history are public (SC-75).
      //
      // Expiry is not our problem to solve: supabase-js registers an
      // onAuthStateChange listener at construction and pushes the refreshed
      // token to every live channel (verified in the installed
      // @supabase/supabase-js, dist/index.mjs:673 and :836). A signed-in user
      // on a long auction page keeps receiving after their access token rolls.
      await supabase.realtime.setAuth();
      if (watch.closed) return;

      const channel = supabase
        .channel(auctionTopic(auctionId), { config: { private: true } })
        .on("broadcast", { event: CHANGE_EVENT }, () => {
          // No parameter is read, deliberately. RT-R6.
          //
          // Out-of-order delivery is a non-event, and that is a consequence of
          // the payload being empty rather than a separate guarantee: there is
          // no order in a signal that carries nothing, so a late event can
          // never make a price appear to move down (RT-X5). It only ever
          // causes one more read of the authoritative row.
          if (!watch.closed) each(watch, (h) => h.onChange());
        })
        .subscribe((state) => {
          if (watch.closed) return;
          const live = state === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;

          // CHANNEL_ERROR arrives here when the heartbeat gives up on a socket
          // that died without closing — `heartbeatTimeout()` calls
          // `triggerChanError` on every channel (BID-11). That path is why the
          // heartbeat interval, set in lib/supabase/client.ts, is part of this
          // module's behaviour even though it is written somewhere else.
          settle(watch, live ? "live" : "unavailable");

          // ================================================================
          // A JOIN IS A REASON TO RE-READ. This is §14.5's "Reconnected →
          // resynchronize to authoritative current state" (FR-RT-12, RT-R3),
          // and it is the whole reason that row is a Must.
          //
          // The library re-fires SUBSCRIBED on every rejoin, not only the
          // first: Phoenix resends the join push and `Push.reset()` keeps its
          // `recHooks`, so the 'ok' hook runs again (verified in the installed
          // @supabase/phoenix, assets/js/phoenix/push.js:73). Without this
          // call the sequence CHANNEL_ERROR → rejoin → SUBSCRIBED restores the
          // word "live" on screen and nothing else: the viewer sits on the
          // price from before the drop, permanently, being told it is current.
          // That is the worst failure this module can have — not missing data,
          // but stale data wearing a fresh badge.
          //
          // It fires on the FIRST join too, and that is also deliberate: the
          // page is read on the server and the channel joins a second or two
          // later, so a bid landing in that gap would otherwise never be
          // signalled at all. One extra read per mount closes it. Re-reading
          // when nothing changed is free by construction (FR-RT-09, RT-R5).
          // ================================================================
          if (live) each(watch, (h) => h.onChange());
        });

      watch.channel = channel;
      if (watch.closed) leave(watch);
    } catch {
      // RT-R7. A missing environment variable, a blocked websocket, a browser
      // that refuses the connection — none of it may reach the caller, because
      // the caller is a page whose bid control has to keep working.
      if (watch.closed) return;
      settle(watch, "unavailable");
    }
  })();
}

function leave(watch: Watch): void {
  const channel = watch.channel;
  watch.channel = null;
  if (channel) void createClient().removeChannel(channel);
}

/**
 * Watch one auction for as long as anyone is watching it.
 *
 * Returns an unsubscribe function; calling it more than once is safe, and
 * calling it before the join completes cancels the join. The channel is torn
 * down when the **last** subscriber leaves, never the first.
 *
 * `onStatus` is never called synchronously from here — a callback landing in
 * the caller's render pass costs a cascading render. A subscriber that arrives
 * after the channel is already up is told so on a microtask instead, because
 * otherwise it would sit on `"connecting"` until the next reconnect.
 */
export function subscribeToAuction(
  auctionId: string,
  handlers: AuctionChannelHandlers,
): () => void {
  const existing = watches.get(auctionId);
  const watch: Watch = existing ?? {
    handlers: new Set(),
    channel: null,
    status: "connecting",
    closed: false,
    reaper: null,
    deadline: null,
  };
  watch.handlers.add(handlers);

  // A subscriber arriving inside the grace window cancels the teardown and
  // inherits the still-live channel. This is the Strict Mode remount path.
  if (watch.reaper !== null) {
    clearTimeout(watch.reaper);
    watch.reaper = null;
  }

  if (!existing) {
    watches.set(auctionId, watch);
    join(auctionId, watch);
  } else if (watch.status !== "connecting") {
    // Joining a channel that is already up. Without this the newcomer would
    // show "connecting" until the next reconnect — which on a healthy
    // connection is never.
    const { status } = watch;
    queueMicrotask(() => {
      if (watch.handlers.has(handlers)) handlers.onStatus?.(status);
    });
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    watch.handlers.delete(handlers);
    if (watch.handlers.size > 0) return;

    // Deferred, not immediate — see GRACE_MS. `watches` keeps the entry for the
    // window so a remount finds it here rather than reaching for the channel
    // that is about to be removed from the client.
    watch.reaper = setTimeout(() => {
      watch.reaper = null;
      if (watch.handlers.size > 0) return;
      watch.closed = true;
      if (watch.deadline !== null) {
        clearTimeout(watch.deadline);
        watch.deadline = null;
      }
      // Guard the delete: a later subscriber may already have replaced this
      // entry, and deleting by key alone would evict a healthy watch.
      if (watches.get(auctionId) === watch) watches.delete(auctionId);
      leave(watch);
    }, GRACE_MS);
  };
}
