"use client";

import { PriceRegion } from "@/components/auction/detail/price-region";
import { useLiveAuction } from "@/lib/bidding/use-live-auction";
import type { AuctionPrice } from "@/lib/money";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. BID-09 / #125. FR-RT-05, RT-X1, SC-20,
 * SC-21, RT-R7.
 *
 * This file contains NO presentation. It renders Mohammed's PriceRegion
 * (`components/auction/detail/price-region.tsx`) exactly as `page.tsx` does
 * today — same component, same props, no wrapper element, no class, no
 * string, no layout. The ONLY thing that changes is where the number comes
 * from: a server read frozen at render, or the live BID-08/BID-09 store.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## Why a wrapper and not a subscription inside PriceRegion
 *
 * Making PriceRegion read the store would put my behaviour inside his
 * presentation file, and would make his component unmountable anywhere
 * without a live store — the listing card and the styleguide both render a
 * price region with no auction channel behind it. The wrapper keeps the line
 * exactly where TEAM.md §11 draws it: **Mohammed builds the region, Rayan
 * supplies the value and its updates.** It is the same shape `BidSlot` uses
 * to mount `BidPanel`.
 *
 * ## Why the server values are still props, and are still used
 *
 * `RT-R7`: bidding works without realtime, so the display must too. Until the
 * first snapshot lands — on the server render, during the channel join, and
 * for the whole of `connection === "unavailable"` — the viewer reads the
 * server's number, never a blank, a zero, or a skeleton (ARCH §14.5). The
 * fallback is the point of the component, not a defensive leftover.
 *
 * `startingPrice` deliberately does NOT come from the store. It is immutable
 * after creation (BR-31), so the live read never selects it; taking it from a
 * snapshot would be re-reading a constant to prove the database still agrees
 * with itself, and would make this component wrong the moment the snapshot is
 * null. It is forwarded from the server render, untouched.
 *
 * ## Money (CLAUDE.md §4)
 *
 * Nothing here formats, parses, compares or arithmetics an amount. Both
 * candidates are already `Sar` — branded strings — and one of the two is
 * chosen by identity, never combined. `live-snapshot.ts` reads
 * `current_price::text` so the value never touches `JSON.parse`'s float path
 * (#103), and `PriceBlock` renders it through the single `<Money>`
 * formatter. There is no second formatter on this path, and no `Number()`.
 *
 * `bidCount` is a count, not an amount — `??` on it is the fallback, not
 * arithmetic — and it is READ from the bid table by both sources, never
 * inferred from comparing prices (BR-29 makes equality prove nothing,
 * FR-DETAIL-06).
 *
 * ## What is deliberately absent
 *
 * `lastRaise` is a difference of two amounts. Computing it here would be
 * client-side arithmetic on money (CLAUDE.md §4) — `lib/money` has no
 * subtraction function and that absence is intentional. The delta must come
 * from SQL as text, like every other amount, and it has its own issue. This
 * component leaves `lastRaise` and `leadingBidder` unpassed, exactly as
 * `page.tsx` leaves them today, so behaviour is unchanged in that respect.
 *
 * No `status` gate either: what this renders is a price, and a price is
 * readable after the auction ends (FR-END-12). Eligibility to BID is decided
 * on the server clock against `end_time` and lives in `place_bid` (LC-03) —
 * never in a display component, and never off the stored flag.
 */
export interface LivePriceRegionProps extends AuctionPrice {
  /** Which auction to watch. Same store as the panel and the history (SC-21). */
  auctionId: string;
}

export function LivePriceRegion({
  auctionId,
  startingPrice,
  currentPrice,
  bidCount,
}: LivePriceRegionProps) {
  /*
   * Reads the SHARED per-auction store — it does not open a channel of its
   * own. One subscription serves the panel, the history and this region, so
   * one bid costs one read and all three repaint from the same committed
   * snapshot within one paint (SC-21, NFR-RT-02).
   */
  const { snapshot } = useLiveAuction(auctionId);

  return (
    <PriceRegion
      startingPrice={startingPrice}
      currentPrice={snapshot?.auction.currentPrice ?? currentPrice}
      bidCount={snapshot?.auction.bidCount ?? bidCount}
    />
  );
}
