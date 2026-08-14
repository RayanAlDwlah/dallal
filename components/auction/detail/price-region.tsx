import { PriceBlock } from "@/components/auction/price-block";
import type { AuctionPrice, Sar } from "@/lib/money";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-14 (#56); the empty file came from S0-13.
 * The current-price display region.
 *
 * TEAM.md §11 states the split in one line: **Mohammed builds the region —
 * Rayan supplies the value and its updates.** Mohammed NEVER computes the
 * price. It is the highest accepted bid, or the starting price when there are
 * none, written only by the bid operation (BR-13, SEC-Z5, ARCHITECTURE §9.4).
 *
 * ── Why this file is thin, on purpose ─────────────────────────────────────
 *
 * components/auction/price-block.tsx already IS this region: it exports
 * StartingPrice and CurrentBid as two components rather than one with two
 * labels, renders the amount at `hero` scale, and carries the BR-29 sentence.
 * TEAM.md §11 says extending a primitive is preferred to rewriting it, so this
 * composes rather than reimplements. A second price layout here would be a
 * second thing to keep in step with the listing, and the first one to drift.
 *
 * What this region adds is placement, and that is AUC-14's real content:
 * NFR-USA-04 and FR-DETAIL-05 make the current price the most visually
 * prominent element on the page. The page shell puts this at the top of the
 * rail, which is first in the DOM — measured at 375px the amount sits ~270px
 * down, above the fold, where source order is visual order.
 *
 * ── The distinction the region exists to make ─────────────────────────────
 *
 * FR-DETAIL-06 asks for two different STATEMENTS, not one label with two
 * values, and PriceBlock branches on bidCount to produce them:
 *
 *   - no bids  → the starting price is INCLUSIVE. A first bid of exactly that
 *     amount is accepted, and the region says so in words (BR-29, SC-55).
 *   - has bids → the current price is EXCLUSIVE. The next bid must be strictly
 *     greater (BR-03, BR-28).
 *
 * It CANNOT be derived by comparing the two prices: BR-29 lets the first bid
 * equal the starting price, so currentPrice === startingPrice is true both
 * before any bid and immediately after the first. bidCount is read from the bid
 * table, never inferred and never stored on the auction (S0-11 §3.2).
 *
 * ── Money rules that reject a PR on sight (CLAUDE.md §4) ──────────────────
 *
 * Nothing here formats an amount. lib/money.ts is the only formatter in the
 * product and `1,250.00 SAR` is the only format (NFR-DAT-08, BR-43). Amounts
 * are strings end to end — no Number(), no parseFloat, no arithmetic — and
 * there is no ceiling and no length cap, so a 40-digit amount renders rather
 * than being truncated or rejected for size (BR-21, SEC-R3).
 */
export interface PriceRegionProps extends AuctionPrice {
  /**
   * Display name of the current highest bidder, and `lastRaise` the delta of
   * the most recent accepted bid. Both are RAYAN'S values and arrive through
   * this seam when BID-05 and BID-09 land (ARCHITECTURE §9.4). They are
   * forwarded untouched — nothing here computes, compares or defaults them.
   */
  leadingBidder?: string;
  lastRaise?: Sar | null;
}

export function PriceRegion({
  startingPrice,
  currentPrice,
  bidCount,
  leadingBidder,
  lastRaise,
}: PriceRegionProps) {
  return (
    <PriceBlock
      startingPrice={startingPrice}
      currentPrice={currentPrice}
      bidCount={bidCount}
      leadingBidder={leadingBidder}
      lastRaise={lastRaise}
    />
  );
}
