import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { sar, type Sar } from "@/lib/money";

import { publicImageUrl } from "./image-url";

/**
 * AUC-11 — the auction detail read.
 *
 * FR-DETAIL-01: public, no authentication. There is no guard here and there
 * must not be one — a visitor is a supported user (S0-10 §6), and the
 * auctions_public_read policy makes the row anonymously readable at the
 * database too, so this is not a UI-only courtesy.
 *
 * This module READS. It decides nothing:
 *
 *   - it does not compute the current price. That is the highest accepted bid,
 *     or the starting price when there are none, written only by place_bid
 *     (BR-13, SEC-Z5, ARCHITECTURE §9.4)
 *   - it does not determine or recompute an outcome. Finalization records it
 *     once and this reads that record (TEAM.md §6, BR-06, FR-SEC-07)
 *   - it does not decide whether the auction still accepts bids. Eligibility is
 *     settled on the server against clock_timestamp() inside the row lock, and
 *     never by a status flag or a clock on this side (LC-03, BR-19)
 *   - it does not derive a presentation status. An auction past its end time
 *     whose row still says `active` must PRESENT as ended (FR-DETAIL-24, EC-04)
 *     — that is AUC-16's decision to make, from `status` and `endsAt` below
 *
 * Privacy is structural, not careful: the only identity joined is
 * public.profiles, whose sole public column is display_name. Email lives in the
 * auth schema and nothing reachable from here contains one (CLAUDE.md §6,
 * SEC-P1, BR-26). Do not add a join that changes that.
 */

/** The two persisted states. There is no Cancelled and no Draft (BR-30, BR-14). */
export type AuctionStatus = "active" | "ended";

export interface AuctionDetail {
  id: string;
  name: string;
  /** Line breaks are significant and must survive to the DOM (FR-DETAIL-03). */
  description: string;
  /** Public URL, or undefined so ImageFrame renders its placeholder (EC-18). */
  imageUrl?: string;
  /** FR-DETAIL-13 — the seller's public identity. Never their email. */
  sellerName: string;
  /**
   * The owner's internal id. For comparing against the VERIFIED viewer id on
   * the server (AUC-15, BR-02) — never rendered, and never the basis of an
   * authorization decision on its own: the server rejects an owner's bid
   * regardless of what this page drew (EC-07, FR-SEC-16).
   */
  ownerId: string;
  /**
   * The stored flag. Written at close by finalization, displayed here — and
   * never used as a bidding gate (S0-11 §5, LC-03).
   */
  status: AuctionStatus;
  /**
   * ISO instant, and it MOVES. BR-36 was reversed on 2026-08-13: a bid accepted
   * in the final 15 seconds extends it by exactly 30 seconds, repeating, to a
   * hard cap of 20 extensions (CLAUDE.md §5, ARCHITECTURE §15.2). Anything
   * built on this must follow it when it changes and must not freeze a value
   * read once (RT-P3).
   */
  endsAt: string;
  startingPrice: Sar;
  currentPrice: Sar;
  /**
   * FR-DETAIL-06 needs the starting-price / current-bid distinction, and it
   * CANNOT be derived from the two prices: BR-29 lets the first bid equal the
   * starting price exactly, so currentPrice === startingPrice does not mean
   * there are no bids. Counted, not inferred — and derived from the bid table
   * rather than stored on the auction, per S0-11 §3.2.
   */
  bidCount: number;
  /** Recorded by finalization, or null while the auction is still running. */
  winnerName: string | null;
  finalPrice: Sar | null;
  closedAt: string | null;
  /**
   * V2 — the seller-set fixed increment, immutable, or null on a V1
   * legacy open-amount auction. This is the mode discriminator: null mounts
   * the amount input (BidPanel), non-null mounts the one-button control.
   */
  bidIncrement: Sar | null;
  /**
   * V2 — the only amount the button can offer, computed in SQL by
   * public.next_offer() and travelling as text (S0-12 §6). Null on V1 rows.
   * Ages the moment it is rendered; the live snapshot supersedes it.
   */
  nextOffer: Sar | null;
}

export type AuctionDetailResult =
  | { state: "found"; auction: AuctionDetail; serverNow: string }
  /** No such auction — a clear message, never an error page (FR-DETAIL-25, EC-13). */
  | { state: "not-found" }
  /** The read itself failed. Deliberately NOT the same as not-found. */
  | { state: "failed" };

/**
 * ::text ON EVERY sar_amount COLUMN — starting_price, current_price AND
 * final_price. This is transport correctness, not style.
 *
 * PostgREST serialises `numeric` as an unquoted JSON *number*, so a 30-digit
 * amount (BR-21 permits one; there is no ceiling) becomes 1.2345678901234568e+29
 * in JSON.parse before a line of TypeScript runs. The cast makes it a JSON
 * string, exact at any width. Measured on dallal-dev, 2026-08-14; the same
 * measurement is recorded in listing.ts.
 *
 * final_price is the one most likely to be dropped from this list. It is NULL
 * on every active auction, so omitting the cast looks harmless right up until
 * the first large auction closes — and then sar() throws on a value the
 * transport already corrupted, which reads as a contract bug rather than a
 * missing cast.
 *
 * The trailing comment at supabase/migrations/20260812120000 §3b calls
 * "bid_history / auctions select" the text path. Half of that is wrong: only
 * bid_history is, because it routes amounts through public.sar_text(). A plain
 * auctions select is not, and never was. Raised for the team rather than fixed
 * silently here — it also affects BID-09's realtime re-read.
 *
 * Two embeds of profiles, disambiguated by constraint name because auctions has
 * two foreign keys to it (owner_id and winner_id) and an unqualified
 * `profiles(...)` is ambiguous.
 */
const DETAIL_SELECT = [
  "id",
  "name",
  "description",
  "image_path",
  "owner_id",
  "status",
  "end_time",
  "starting_price::text",
  "current_price::text",
  "winner_id",
  "final_price::text",
  "closed_at",
  /*
   * V2 — bid_increment carries the ::text cast like every sar_amount column;
   * next_offer is the computed column (a function of the row) and is already
   * text by construction, so there is nothing to cast.
   */
  "bid_increment::text",
  "next_offer",
  "owner:profiles!auctions_owner_id_fkey(display_name)",
  "winner:profiles!auctions_winner_id_fkey(display_name)",
  "bids(count)",
].join(", ");

/** Row shape from PostgREST. `bids` is the embedded aggregate, always an array. */
interface AuctionDetailRow {
  id: string;
  name: string;
  description: string;
  image_path: string;
  owner_id: string;
  /** The auctions_status_valid CHECK admits exactly these two (BR-30). */
  status: AuctionStatus;
  end_time: string;
  starting_price: string;
  current_price: string;
  winner_id: string | null;
  final_price: string | null;
  closed_at: string | null;
  bid_increment: string | null;
  next_offer: string | null;
  owner: { display_name: string } | null;
  winner: { display_name: string } | null;
  bids: { count: number }[] | null;
}

/**
 * PostgreSQL's invalid_text_representation. An id that is not a UUID never
 * matches a row, so it is a not-found rather than a fault — without this it
 * surfaces as a failed read and the visitor gets "something went wrong" for
 * what is really a mistyped URL (FR-DETAIL-25).
 */
const INVALID_UUID = "22P02";

/**
 * Wrapped in cache() so generateMetadata and the page body share ONE read per
 * request rather than issuing two. It also makes them consistent with each
 * other: two independent reads of a live auction can disagree about the price
 * or even the status, and the browser tab would then describe a different
 * auction from the one on screen.
 */
export const readAuctionDetail = cache(async (id: string): Promise<AuctionDetailResult> => {
  const supabase = await createClient();

  /*
   * The clock the row was read against, handed to the countdown so a wrong or
   * manipulated browser clock changes only the display (BR-19, EC-17). It is
   * the APPLICATION server's clock, and that is a deliberate limit: every
   * decision that binds is taken in the database against clock_timestamp().
   */
  const serverNow = new Date().toISOString();

  const { data, error } = await supabase
    .from("auctions")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle<AuctionDetailRow>();

  if (error) {
    return error.code === INVALID_UUID ? { state: "not-found" } : { state: "failed" };
  }

  if (!data) return { state: "not-found" };

  /*
   * A missing owner profile is unreachable — owner_id is NOT NULL and
   * references profiles, and the signup trigger creates the profile in the same
   * transaction as the account (FR-PROF-02). If it somehow happens, this is a
   * failed read rather than an invented seller name: a fabricated name would be
   * attributed to a real person on a public page.
   */
  if (!data.owner) return { state: "failed" };

  return {
    state: "found",
    serverNow,
    auction: {
      id: data.id,
      name: data.name,
      description: data.description,
      imageUrl: publicImageUrl(supabase, data.image_path),
      sellerName: data.owner.display_name,
      ownerId: data.owner_id,
      status: data.status,
      endsAt: data.end_time,
      /*
       * sar() throws on anything that is not an exact decimal string. That is
       * the intent: these arrive as strings from sar_amount columns (S0-12 §6),
       * and a value that fails has already violated the money contract
       * upstream. Failing loudly beats rendering `NaN SAR`.
       */
      startingPrice: sar(data.starting_price),
      currentPrice: sar(data.current_price),
      bidCount: data.bids?.[0]?.count ?? 0,
      /*
       * Present together or not at all — the auctions_outcome_only_when_ended
       * CHECK guarantees it. Read straight through with no COALESCE and no
       * fallback: "ended with no bids and no winner" is a real, normal outcome
       * (BR-09, EC-05, FR-DETAIL-19), and a default would erase it.
       */
      winnerName: data.winner?.display_name ?? null,
      finalPrice: data.final_price === null ? null : sar(data.final_price),
      closedAt: data.closed_at,
      bidIncrement: data.bid_increment === null ? null : sar(data.bid_increment),
      nextOffer: data.next_offer === null ? null : sar(data.next_offer),
    },
  };
});
