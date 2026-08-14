import { Alert } from "@/components/ui/alert";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Created empty by S0-13 (#22); filled by
 * BID-07. Mohammed does not implement it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEHAVIOUR — Rayan: what is recorded, and in what order.
 * PRESENTATION — Mohammed: how the list looks (TEAM.md §11, ARCHITECTURE §14.6).
 *
 * `auctionId` is the only prop S0-13 fixes; see bid-panel.tsx for why.
 *
 * Three rules this file inherits before a line of it is written. They are
 * recorded here because each one fails silently — the page renders, nothing
 * throws, and the output is wrong:
 *
 *   1. ORDER BY bids.id, never by created_at. `created_at` defaults to now(),
 *      which is transaction start — when a bid began queueing, not the order it
 *      took the lock. Under contention the two disagree and the history renders
 *      DECREASING: measured at 2 of 12 contended auctions (S0-11 §6, BR-11).
 *      `created_at` is for display only (FR-BID-23).
 *
 *   2. Display names only, never an email. The guarantee is structural — email
 *      lives in the auth schema and public.bid_history joins only profiles, so
 *      it cannot be reached from here. Do not add a join that reintroduces it
 *      (CLAUDE.md §6, BR-26, FR-BID-22a).
 *
 *   3. Amounts arrive as TEXT. public.bid_history already routes them through
 *      public.sar_text(); a raw numeric column would be a JSON number and lose
 *      precision before any code runs (S0-12 §6). Format with lib/money.ts and
 *      nothing else (NFR-DAT-08).
 *
 * Public to unauthenticated visitors (BR-40, SC-75) and still visible after the
 * auction closes (FR-END-12).
 */
export interface BidHistoryProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
}

export function BidHistory({ auctionId }: BidHistoryProps) {
  return (
    <Alert tone="info" title="سجل المزايدات">
      <p>
        نقطة تركيب فارغة من <span className="num">S0-13</span>. المحتوى وترتيبه
        ضمن <span className="num">BID-07</span>، ومالكها ريان.
      </p>
      <p className="sr-only">المزاد {auctionId}</p>
    </Alert>
  );
}
