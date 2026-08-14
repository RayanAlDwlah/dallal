import { trySar, type Sar } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

/**
 * BID-03/BID-04 — the client half of the bid submission path.
 *
 * The server half is `public.place_bid` (BID-02) and it decides EVERYTHING:
 * eligibility, the amount rule, the winner of a race. This module only
 * transports — the typed string goes up untouched, the verdict comes back
 * typed. There is deliberately no client-side gate that can refuse to submit:
 * BR-08 makes client validation a convenience that must never be the sole
 * gate, and the reverse is just as true — a client that *blocks* on its own
 * stale copy of the price would reject bids the server accepts. The panel
 * shows a hint; the server owns yes and no.
 *
 * Identity travels as the session token attached by the Supabase client, never
 * as a parameter — place_bid reads auth.uid() internally (SEC-Z4, CLAUDE.md §6).
 */

/** ARCHITECTURE §13.5 — the eight product-level reasons, and only those. */
export const BID_REJECTION_REASONS = [
  "not_authenticated", //    1
  "auction_not_found", //    2
  "auction_ended", //        3
  "owner_cannot_bid", //     4
  "malformed_amount", //     5
  "below_starting_price", // 6
  "not_above_current", //    7
  "outbid_race", //          8
] as const;

export type BidRejectionReason = (typeof BID_REJECTION_REASONS)[number];

export type PlaceBidOutcome =
  | { kind: "accepted" }
  | {
      kind: "rejected";
      reason: BidRejectionReason;
      /** Attached by reason 6 — "bidding starts at X" (FR-BID-10). */
      startingPrice: Sar | null;
      /** Attached by reasons 7 and 8 — the price the message must name. */
      currentPrice: Sar | null;
    }
  /**
   * No product verdict arrived — network failure, or a payload this version
   * does not recognise. NOT one of the eight reasons, and the message for it
   * must be honest about the ambiguity: a request that died on the way back
   * may still have committed. The authoritative price/history re-read is what
   * resolves it, not this module (BR-22, EC-09).
   */
  | { kind: "no_verdict" };

function isRejectionReason(value: unknown): value is BidRejectionReason {
  return (
    typeof value === "string" &&
    (BID_REJECTION_REASONS as readonly string[]).includes(value)
  );
}

/**
 * Submit one bid. Never throws — a bid path that can throw into a render is a
 * bid path that can take the page down (RT-R7's spirit, client side).
 *
 * The amount is sent AS TYPED (trimmed): rejection of a malformed value is the
 * server's job and its answer is the product's answer (reason 5, REJECTED
 * never rounded). Parsing it here first would create a second validator that
 * can disagree with the real one.
 */
export async function placeBid(auctionId: string, amount: string): Promise<PlaceBidOutcome> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_bid", {
      p_auction_id: auctionId,
      p_amount: amount.trim(),
    });

    if (error) return { kind: "no_verdict" };

    const payload = data as { accepted?: unknown; reason?: unknown } | null;
    if (payload?.accepted === true) return { kind: "accepted" };

    if (payload?.accepted === false && isRejectionReason(payload.reason)) {
      const prices = payload as { starting_price?: unknown; current_price?: unknown };
      return {
        kind: "rejected",
        reason: payload.reason,
        /*
         * trySar, not sar(): a malformed price in a rejection payload must
         * degrade to a message without the number, not throw away the whole
         * verdict the user is waiting on.
         */
        startingPrice:
          typeof prices.starting_price === "string" ? trySar(prices.starting_price) : null,
        currentPrice:
          typeof prices.current_price === "string" ? trySar(prices.current_price) : null,
      };
    }

    // A shape this version does not know. Never guess a reason (TEAM.md 16).
    return { kind: "no_verdict" };
  } catch {
    return { kind: "no_verdict" };
  }
}
