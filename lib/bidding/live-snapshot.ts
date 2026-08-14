import { sar, type Sar } from "@/lib/money";
import {
  subscribeToAuction,
  type AuctionChannelStatus,
} from "@/lib/realtime/auction-channel";
import { createClient } from "@/lib/supabase/client";

/**
 * BID-09 — the authoritative re-read behind every realtime update. FR-RT-03/04,
 * SC-20, SC-21, NFR-RT-02, ARCH §14.5, ADR-9, BR-22.
 *
 * BID-08 delivers a content-free cue; this module is the read the cue triggers.
 * The division is deliberate and it is the whole realtime contract: the event
 * says *something changed*, the database says *what*. Nothing in this file ever
 * takes a value from a payload, because the payload does not carry one.
 *
 * ## One store per auction, however many components are watching
 *
 * §14.6 mounts the price region, the bid panel, the history and the outcome
 * banner as SEPARATE components on one page, and S0-13 fixes `auctionId` as the
 * only prop each receives. If each of them re-read on its own cue, one bid
 * would cost four identical round trips — and worse, four *independently timed*
 * reads that can interleave with a second bid and disagree with each other on
 * one screen. The store makes the page converge by construction: one read per
 * cue, one committed snapshot, every consumer repaints from the same object.
 * That is also what SC-21 means by "the new history entry arrives in the same
 * update" — price and history are one state, not two fetches.
 *
 * ## Money crosses this boundary as text, or not at all
 *
 * `::text` on every `sar_amount` column, and `bid_history` (which routes
 * amounts through `public.sar_text()`) for the list. PostgREST serialises bare
 * `numeric` as an unquoted JSON number, and `JSON.parse` inside the Supabase
 * client corrupts it above ~9×10^15 before a line of this repository runs —
 * measured, #103. BR-21 forbids a ceiling, so "amounts that large won't
 * happen" is not available as an argument.
 *
 * ## The re-read never orders `bid_history` itself
 *
 * The view's own `order by auction_id, id desc` is the definitive order
 * (BR-11): `bids.id` is lock order, the order bids actually took effect.
 * The projection deliberately omits `id` (internal identifiers stay internal),
 * so the only column a PostgREST `order=` could reach is `created_at` — which
 * is transaction start, disagrees with lock order under contention, and
 * renders a DECREASING history (measured at 2 of 12 contended auctions,
 * S0-11 §6). Adding `.order("created_at")` here would look like tidiness and
 * be that bug. The absence of an `.order()` call is load-bearing.
 */

/** The two persisted states. There is no Cancelled and no Draft (BR-30, BR-14). */
export type LiveAuctionStatus = "active" | "ended";

/**
 * What a bid can change, and nothing it cannot. Name, description, image and
 * starting price are immutable after creation (BR-31) — re-reading them on
 * every bid would be traffic spent proving the database still agrees with
 * itself, so the server-rendered values stay authoritative for those.
 */
export interface LiveAuctionState {
  status: LiveAuctionStatus;
  /** ISO instant, and it MOVES (BR-36 as amended; extensions push it forward). */
  endsAt: string;
  currentPrice: Sar;
  /**
   * Counted from the bid table, not inferred from prices: BR-29 lets the first
   * bid equal the starting price, so equality proves nothing (FR-DETAIL-06).
   */
  bidCount: number;
  /** Recorded once by finalization; null while running. Read, never derived. */
  winnerName: string | null;
  finalPrice: Sar | null;
  closedAt: string | null;
}

export interface BidHistoryEntry {
  /**
   * Per-auction lock-order rank: 1 is the first bid the row lock admitted.
   * Stable forever — bids are append-only (BR-05), so a rank over `bids.id`
   * can never change under an existing row — which also makes it a correct
   * React key. Deliberately NOT `bids.id` itself (FR-BID-22a: internal
   * identifiers stay internal). This field IS the ordering contract; see the
   * sort in readLiveSnapshot.
   */
  seq: number;
  /** The bidder's ONLY public identity (BR-26). Never an email, structurally. */
  displayName: string;
  /** Canonical text from sar_text(). Format with lib/money and nothing else. */
  amount: Sar;
  /** Display only (FR-BID-23) — never an ordering key (BR-11). */
  createdAt: string;
}

/**
 * Price and history as ONE value. Committed together or not at all — a
 * snapshot where they disagree about the newest bid never exists (SC-21).
 * Delivery order inside `history`: newest first (FR-BID-29), by lock order.
 */
export interface LiveSnapshot {
  auction: LiveAuctionState;
  history: BidHistoryEntry[];
}

/** What a consumer sees. `snapshot` is null only before the first read lands. */
export interface LiveAuctionView {
  snapshot: LiveSnapshot | null;
  connection: AuctionChannelStatus;
}

/*
 * The winner embed is disambiguated by constraint name because auctions has two
 * foreign keys to profiles (owner_id, winner_id) — same reason as detail.ts.
 * The owner is NOT re-read: it is immutable, and the seller's name is already
 * on the server-rendered page.
 */
const AUCTION_SELECT = [
  "status",
  "end_time",
  "current_price::text",
  "final_price::text",
  "closed_at",
  "winner:profiles!auctions_winner_id_fkey(display_name)",
  "bids(count)",
].join(", ");

/*
 * `amount` is sar_text() output; the view's `amount_sar` (format_sar) is
 * deliberately NOT selected. The client formats with lib/money because the
 * bidi rule needs the number and the suffix as separate nodes — the digits go
 * inside the isolate and `SAR` stays outside (CLAUDE.md §3, BR-42/43) — and a
 * preformatted single string cannot be split without parsing it back.
 */
const HISTORY_SELECT = "seq, display_name, amount, created_at";

interface LiveAuctionRow {
  status: LiveAuctionStatus;
  end_time: string;
  current_price: string;
  final_price: string | null;
  closed_at: string | null;
  winner: { display_name: string } | null;
  bids: { count: number }[] | null;
}

interface HistoryRow {
  seq: number;
  display_name: string;
  amount: string;
  created_at: string;
}

/**
 * One authoritative read: auction row and history, in parallel, mapped into a
 * single snapshot. Returns null on ANY failure — a half-updated screen where
 * the price moved and the history did not would violate the one thing SC-21
 * guarantees, so the previous consistent snapshot is kept instead. The next
 * cue (or a refresh) recovers; the page never breaks for want of an event
 * (RT-R7, EC-09).
 */
export async function readLiveSnapshot(auctionId: string): Promise<LiveSnapshot | null> {
  try {
    const supabase = createClient();
    const [auctionRes, historyRes] = await Promise.all([
      supabase
        .from("auctions")
        .select(AUCTION_SELECT)
        .eq("id", auctionId)
        .maybeSingle<LiveAuctionRow>(),
      supabase
        .from("bid_history")
        .select(HISTORY_SELECT)
        .eq("auction_id", auctionId)
        /*
         * Transport-level ordering, for politeness not for correctness: this
         * travels through PostgREST's json_agg over a subquery, whose input
         * order PostgreSQL documents as unspecified — @Dem4t's #109 review
         * question, and he was right. The sort below is the contract.
         */
        .order("seq", { ascending: false })
        .returns<HistoryRow[]>(),
    ]);

    if (auctionRes.error || historyRes.error || !auctionRes.data) return null;
    const row = auctionRes.data;

    return {
      auction: {
        status: row.status,
        endsAt: row.end_time,
        /*
         * sar() throws on anything that is not an exact decimal string. Inside
         * this try that surfaces as a kept-previous-snapshot rather than a
         * crashed page: a live viewer mid-endgame must not lose the screen to
         * a value the money contract already rejects (RT-R7). The server
         * render still fails loudly on the same value, so the violation is
         * not silent — it is just not allowed to take the page down here.
         */
        currentPrice: sar(row.current_price),
        bidCount: row.bids?.[0]?.count ?? 0,
        winnerName: row.winner?.display_name ?? null,
        finalPrice: row.final_price === null ? null : sar(row.final_price),
        closedAt: row.closed_at,
      },
      /*
       * THE ordering guarantee, and the only unconditional one on this path
       * (FR-BID-29 newest first, BR-11 lock order). Every upstream ordering —
       * the view's internal ORDER BY, the .order() param above — reaches the
       * client through an aggregate whose input order is planner behaviour,
       * not contract. A local sort on a monotonic public rank closes that for
       * good, at the cost of one O(n log n) over an already-nearly-sorted
       * array. Raised by @Dem4t on #109; this is the settled answer.
       */
      history: historyRes.data
        .map((h) => ({
          seq: h.seq,
          displayName: h.display_name,
          amount: sar(h.amount),
          createdAt: h.created_at,
        }))
        .sort((a, b) => b.seq - a.seq),
    };
  } catch {
    return null;
  }
}

/**
 * One live store per auction id, reference-counted exactly like the channel
 * registry underneath it (auction-channel.ts) — created for the first
 * subscribing component, torn down when the last one leaves.
 */
interface LiveStore {
  view: LiveAuctionView;
  listeners: Set<() => void>;
  /**
   * Read sequence. Only the LATEST issued read may commit: two cues arrive
   * close together (the BR-36 endgame guarantees a pair), both reads race, and
   * without this the older response can land second and publish yesterday's
   * price over today's. Dropping the stale read — rather than comparing values
   * — is what makes convergence unconditional: viewers end on the last read's
   * state no matter how responses interleave (RT-X5's data half; the visual
   * half is BID-10).
   */
  seq: number;
  leaveChannel: () => void;
}

const stores = new Map<string, LiveStore>();

/** Stable server/initial value — useSyncExternalStore requires one identity. */
const NO_VIEW: LiveAuctionView = { snapshot: null, connection: "connecting" };

function publish(store: LiveStore, view: LiveAuctionView): void {
  store.view = view;
  for (const listener of Array.from(store.listeners)) {
    if (store.listeners.has(listener)) listener();
  }
}

function issueRead(auctionId: string, store: LiveStore): void {
  const seq = ++store.seq;
  void readLiveSnapshot(auctionId).then((snapshot) => {
    if (seq !== store.seq) return; // a newer read owns the screen
    if (!snapshot) return; // keep the previous consistent snapshot
    if (stores.get(auctionId) !== store) return; // torn down while in flight
    publish(store, { ...store.view, snapshot });
  });
}

/**
 * Subscribe a consumer to one auction's live view. Returns unsubscribe.
 * `getLiveAuctionView` is the matching read — together they are the
 * `useSyncExternalStore` pair that `useLiveAuction` wraps.
 */
export function subscribeLiveAuction(auctionId: string, onChange: () => void): () => void {
  let store = stores.get(auctionId);
  if (!store) {
    const created: LiveStore = {
      view: NO_VIEW,
      listeners: new Set(),
      seq: 0,
      leaveChannel: () => undefined,
    };
    stores.set(auctionId, created);
    /*
     * First read immediately, not on the first cue: the join takes a second or
     * two and these components have no server-rendered data of their own to
     * bridge it. The join's own onChange (BID-08 fires it on every SUBSCRIBED)
     * then re-reads, which also covers a bid landing in between — the seq
     * guard makes the pair converge instead of race.
     */
    issueRead(auctionId, created);
    created.leaveChannel = subscribeToAuction(auctionId, {
      onChange: () => issueRead(auctionId, created),
      onStatus: (connection) => publish(created, { ...created.view, connection }),
    });
    store = created;
  }

  store.listeners.add(onChange);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    store.listeners.delete(onChange);
    if (store.listeners.size > 0) return;
    /*
     * Last consumer gone: leave the channel and drop the store. The channel
     * layer already defers its own teardown (GRACE_MS) so a Strict Mode
     * remount rejoins nothing; re-creating this store costs one re-read, which
     * a remount would owe anyway (FR-RT-12 — a fresh mount re-reads).
     */
    stores.delete(auctionId);
    store.leaveChannel();
  };
}

/** Current view for `useSyncExternalStore`. Stable NO_VIEW before/after life. */
export function getLiveAuctionView(auctionId: string): LiveAuctionView {
  return stores.get(auctionId)?.view ?? NO_VIEW;
}

/** The server-render value: nothing yet, honestly reported as connecting. */
export function getServerLiveAuctionView(): LiveAuctionView {
  return NO_VIEW;
}
