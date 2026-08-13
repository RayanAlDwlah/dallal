import type { Sar } from "@/lib/money";

/**
 * The auction record, exactly as agreed in docs/contracts/S0-11-auction-record.md.
 *
 * Mohammed owns this shape. Rayan reads seven fields and writes five; nobody
 * writes anything else. Renaming or removing a read field requires telling
 * Rayan first (ARCHITECTURE §10.3).
 */

/** Persisted status. **Never** the bidding gate — see `effectiveStatus`. */
export type AuctionStatus = "active" | "ended";

export interface Auction {
  // --- system-assigned at creation ---
  readonly id: string;
  /** From the verified session, never a request payload (FR-CREATE-02). */
  readonly ownerId: string;
  /** Display name only. The seller's email is never exposed (SEC-P1). */
  readonly ownerDisplayName: string;
  readonly createdAt: string;
  readonly status: AuctionStatus;

  // --- user-supplied at creation, then immutable (BR-31) ---
  readonly productName: string;
  readonly productDescription: string;
  readonly startingPrice: Sar;
  /** Fixed at creation and never extended — no anti-sniping (BR-36). */
  readonly endsAt: string;
  /** `undefined` renders the placeholder; the auction stays usable (EC-18). */
  readonly imageUrl?: string;

  // --- derived, written only by the bid operation (Rayan) ---
  /** Highest accepted bid, or the starting price when there are none (BR-13). */
  readonly currentPrice: Sar;
  /**
   * The only reliable answer to "does this auction have bids?".
   *
   * `currentPrice === startingPrice` does NOT mean zero bids: BR-29 lets the
   * first bid equal the starting price. See the contract §1.
   */
  readonly bidCount: number;

  // --- outcome, written only by finalization (Rayan) ---
  /** Null when the auction closed with zero bids — normal, not an error (BR-09). */
  readonly finalPrice: Sar | null;
  readonly winnerId: string | null;
  readonly winnerDisplayName: string | null;
  readonly closedAt: string | null;
}

/**
 * What the viewer should be shown, which is not always what the row says.
 *
 * PRD LC-03: from the end time onward an auction is over, even if the sweep
 * has not yet flipped `status`. FR-DETAIL-24 and EC-04 require the page to
 * present it as ended immediately rather than showing a stale Active auction
 * for up to 30 seconds.
 *
 * This is presentation only. Bid eligibility is decided server-side by
 * comparing `endsAt` against the DATABASE clock, never by this function and
 * never by the stored flag (BR-04, BR-19).
 */
export function effectiveStatus(auction: Auction, now: Date): AuctionStatus {
  if (auction.status === "ended") return "ended";
  return Date.parse(auction.endsAt) <= now.getTime() ? "ended" : "active";
}

/** True while the row still says active but the deadline has passed. */
export function isAwaitingClose(auction: Auction, now: Date): boolean {
  return auction.status === "active" && effectiveStatus(auction, now) === "ended";
}

/** Ended with at least one bid, so there is a winner to display. */
export function hasWinner(auction: Auction): boolean {
  return auction.winnerId !== null && auction.finalPrice !== null;
}
