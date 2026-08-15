"use client";

import { StatusCountdown } from "@/components/auction/detail/status-countdown";
import { useLiveAuction } from "@/lib/bidding/use-live-auction";
import type { AuctionStatus } from "@/lib/auctions/detail";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. BID-17 / #160. SC-23 clause 1, FR-RT-08.
 *
 * This file contains NO presentation. It renders Mohammed's StatusCountdown
 * (`components/auction/detail/status-countdown.tsx`) exactly as `page.tsx` did
 * — same component, same props, no wrapper element, no class, no string, no
 * layout. The ONLY thing that changes is where `status` comes from: a server
 * read frozen at render, or the live BID-08/BID-09 store.
 *
 * It is the same shape as `live-price-region.tsx`, deliberately, because it is
 * the same problem: a value Mohammed presents and Rayan supplies.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ## The defect this closes
 *
 * `FR-RT-08` (`PRD.md:699`) and `SC-23` (`PRD.md:1678`) require three things of
 * an auction that ends while a viewer is watching: **the status changes**, the
 * bid control disappears, and the outcome appears — with no refresh.
 * `PRD.md:1295` grades the first of those **Must**.
 *
 * Two of the three already worked. The status did not. Measured in CP-3
 * (`docs/INT-03-CP3-lifecycle.md` §4, F-1) and re-measured on the delivery
 * branch on 2026-08-15: at the instant the outcome block entered the DOM, the
 * card above it still read `نشط`, on both the seller's and the bidder's open
 * page, while the same URL reloaded rendered `منتهي` correctly.
 *
 * The cause was never inside StatusCountdown. Its header already says a
 * subscription does not belong there, and it is right — one per-auction
 * subscription is owned by BID-08/BID-09 and a second would be a competing
 * update mechanism (`TEAM.md` §10.4). The gap was that **nothing delivered the
 * live status to the prop**, which `ARCHITECTURE.md:1003` says is mine to
 * deliver: *"Status label and countdown | Mohammed | Countdown ticks locally;
 * the status change arrives from Rayan's subscription."*
 *
 * ## Why the flip is one-way, and why that is not a detail
 *
 * `serverStatus` is `presentedStatus()` — AUC-16's clock-derived value, which
 * reads `ended` for an auction past its end time whose row still says `active`
 * (`FR-DETAIL-24`, EC-04). The snapshot carries the STORED flag, which inside
 * that window still says `active`.
 *
 * So the two sources disagree in the EC-04 window, and the naive
 * `snapshot?.auction.status ?? serverStatus` would resolve it the wrong way:
 * a page loaded inside the window renders `منتهي` from the server, then the
 * first snapshot lands and the badge goes **backwards** to `نشط` on an auction
 * whose time is up. A status that un-ends on screen is worse than one that
 * never changed.
 *
 * Ended is therefore a latch: either source saying `ended` is enough, and
 * nothing takes it back. `status` has exactly two values (`CLAUDE.md` §5) and
 * an auction never reopens, so the latch cannot lose information.
 *
 * ## What this deliberately does NOT do
 *
 * **It does not touch `endsAt`.** The snapshot carries it (`live-snapshot.ts`
 * `:208`) and threading it through here would be one more line — and that line
 * is #140, which is assigned to @m7ya505 and asks a question neither of us has
 * answered. Feeding it from here would settle #140 quietly, which is the one
 * thing `live-price-region.tsx:88` warns against and the reason that file left
 * `status` alone in the first place. It stays the server value.
 *
 * **It does not flip the badge off a client clock.** That is the "badge clock"
 * question inside #129 — whether the four EC-04 surfaces should agree — and it
 * is assigned to two people and open. Inside the EC-04 window an already-open
 * page still reads `نشط` under a countdown at zero, exactly as it did before
 * this file existed. Unchanged, not improved, and not decided.
 *
 * ## Governance (`CLAUDE.md` §1)
 *
 * #160 is mine and @m7ya505's, and I wrote on it: *"I will implement the
 * delivery half once you have said which shape you want to present."* He has
 * not answered, and §1 as amended on 2026-08-15 says a steward's absence must
 * not block a ready ticket — so this is candidate (1) of the two I offered him
 * there, chosen because it is the shape the codebase already uses for this
 * exact class of problem and the shape `ARCHITECTURE.md:1003` already records.
 * Review requested on the PR. Presentation is his, wholly: one word from him
 * changes the shape, and nothing below is presentation.
 */
export interface LiveStatusCountdownProps {
  /** Which auction to watch. Same store as the panel, price and history (SC-21). */
  auctionId: string;
  /**
   * `presentedStatus()` from the server render (AUC-16). Still used, and not a
   * defensive leftover: `RT-R7` says the product works without realtime, so
   * until the first snapshot lands the viewer reads the server's answer — never
   * a blank and never a wrong one.
   */
  serverStatus: AuctionStatus;
  /** Server-supplied, forwarded untouched. See "does NOT do" above — this is #140. */
  endsAt: string;
  /** The server clock at read time, so a wrong client clock cannot mislead. */
  serverNow: string;
}

export function LiveStatusCountdown({
  auctionId,
  serverStatus,
  endsAt,
  serverNow,
}: LiveStatusCountdownProps) {
  /*
   * Reads the SHARED per-auction store — it does not open a channel of its own.
   * The same snapshot that reveals OutcomeBanner flips this badge, so the two
   * can never disagree within one paint: `status = 'ended'` is written by
   * `close_ended_auctions` in the SAME UPDATE as winner_id and final_price
   * (BID-15 migration §4), and one broadcast carries both.
   */
  const { snapshot } = useLiveAuction(auctionId);

  const ended = serverStatus === "ended" || snapshot?.auction.status === "ended";

  return (
    <StatusCountdown
      status={ended ? "ended" : "active"}
      endsAt={endsAt}
      serverNow={serverNow}
    />
  );
}
