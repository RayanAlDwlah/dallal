import { Alert } from "@/components/ui/alert";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Created empty by S0-13 (#22); filled by
 * BID-18, and BID-17 for the live transition. Mohammed does not implement it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEHAVIOUR — Rayan: the outcome values and WHEN they become visible.
 * PRESENTATION — Mohammed: how the outcome reads (TEAM.md §11, §6 row "Winner
 * Display", ARCHITECTURE §14.6).
 *
 * `auctionId` is the only prop S0-13 fixes; see bid-panel.tsx for why.
 *
 * Neither owner recomputes the outcome. It is determined once by finalization
 * (BID-16) and recorded on the auction row; this banner and Mohammed's seller
 * view (AUC-17) both READ that same record (TEAM.md §6, BR-06, FR-SEC-07).
 *
 * Two cases, not one — and the second is a normal outcome, never an error:
 *   - at least one bid → winner display name and final price (FR-DETAIL-18)
 *   - no bids at all   → ended with no winner and no final price (BR-09, EC-05)
 *
 * And the hard boundary, which is a product decision rather than a design one:
 * this banner may NOT present, imply or link to a next step — no payment, no
 * contact control, no shipping, no "complete your purchase". The result display
 * IS the end of the flow (FR-DETAIL-21a, FR-END-17a, PRD §19.0, SC-67).
 */
export interface OutcomeBannerProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
}

export function OutcomeBanner({ auctionId }: OutcomeBannerProps) {
  return (
    <Alert tone="info" title="نتيجة المزاد">
      <p>
        نقطة تركيب فارغة من <span className="num">S0-13</span>. قيم النتيجة
        وتوقيت ظهورها ضمن <span className="num">BID-18</span> و{" "}
        <span className="num">BID-17</span>، ومالكها ريان.
      </p>
      <p className="sr-only">المزاد {auctionId}</p>
    </Alert>
  );
}
