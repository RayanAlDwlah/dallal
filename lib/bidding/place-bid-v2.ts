import { trySar, type Sar } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

/**
 * V2 — the client half of the ONE-BUTTON bid (place_bid_v2).
 *
 * The server computes the only legal amount inside the row lock; what travels
 * up is `expected` — the amount the button DISPLAYED when the user pressed it,
 * so the server can refuse (as a race, not an error) rather than silently
 * charge more than the user consented to. Same transport discipline as
 * place-bid.ts: amounts are strings both directions, the session token is the
 * identity, and this module never throws into a render.
 *
 * V1's placeBid and its eight §13.5 reasons are untouched — this is a separate
 * operation with one extra reason (`amount_required`, returned when the
 * auction is a legacy V1 row and the caller should be using the amount form).
 */

export const BID_V2_REJECTION_REASONS = [
  "not_authenticated",
  "auction_not_found",
  "auction_ended",
  "owner_cannot_bid",
  "malformed_amount",
  "amount_required",
  "outbid_race",
] as const;

export type BidV2RejectionReason = (typeof BID_V2_REJECTION_REASONS)[number];

export type PlaceBidV2Outcome =
  | { kind: "accepted"; amount: Sar | null; nextOffer: Sar | null }
  | {
      kind: "rejected";
      reason: BidV2RejectionReason;
      /** Attached by outbid_race — the offer the button should re-arm with. */
      nextOffer: Sar | null;
    }
  /** No product verdict — network death or an unknown payload shape. The bid
   *  may still have committed; the live price/history is what resolves it. */
  | { kind: "no_verdict" };

function isRejectionReason(value: unknown): value is BidV2RejectionReason {
  return (
    typeof value === "string" &&
    (BID_V2_REJECTION_REASONS as readonly string[]).includes(value)
  );
}

export async function placeBidV2(
  auctionId: string,
  expected: Sar,
): Promise<PlaceBidV2Outcome> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_bid_v2", {
      p_auction_id: auctionId,
      p_expected: expected,
    });

    if (error) return { kind: "no_verdict" };

    const payload = data as {
      accepted?: unknown;
      reason?: unknown;
      amount?: unknown;
      next_offer?: unknown;
    } | null;

    /* trySar, never sar(): a malformed amount in a verdict must degrade to a
     * message without the number, not throw away the verdict itself. */
    const nextOffer =
      typeof payload?.next_offer === "string" ? trySar(payload.next_offer) : null;

    if (payload?.accepted === true) {
      return {
        kind: "accepted",
        amount: typeof payload.amount === "string" ? trySar(payload.amount) : null,
        nextOffer,
      };
    }

    if (payload?.accepted === false && isRejectionReason(payload.reason)) {
      return { kind: "rejected", reason: payload.reason, nextOffer };
    }

    return { kind: "no_verdict" };
  } catch {
    return { kind: "no_verdict" };
  }
}
