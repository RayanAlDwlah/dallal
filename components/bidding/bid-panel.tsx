import { Alert } from "@/components/ui/alert";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Created empty by S0-13 (#22); filled by
 * BID-03, BID-04 and BID-06. Mohammed does not implement it.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TEAM.md §11 and ARCHITECTURE §14.6 split this component in half:
 *
 *   BEHAVIOUR — Rayan. What the input accepts, what submission does, which of
 *   the eight rejection reasons (ARCHITECTURE §13.5) comes back, and when.
 *
 *   PRESENTATION — Mohammed. How all of that looks. Per CLAUDE.md §1 he may
 *   restyle this file later without asking, provided behaviour and contracts
 *   are unchanged.
 *
 * `auctionId` is the ONLY prop S0-13 fixes, because it is the only one its
 * acceptance criteria name: "the page mounts Rayan's components and passes the
 * auction id". Every other prop — the current price, the minimum, the viewer's
 * relationship to the auction, the submit action — is Rayan's to declare. A
 * shape invented here would be Mohammed defining a bidding contract on his
 * behalf, which is exactly what commit 5adaad2 was reverted for.
 *
 * Two things this component must never grow, from CLAUDE.md §5 and §10.4:
 *
 *   - a realtime subscription of its own. One per-auction subscription is
 *     owned upstream (BID-08/BID-09); a second is a competing update mechanism.
 *   - a minimum-raise, maximum, reserve or leading-bidder check. Their ABSENCE
 *     is the requirement (BR-32, BR-21, BR-35, BR-24).
 *
 * There is deliberately no "use client" here yet. Whether this is a client
 * component is a consequence of the behaviour Rayan writes, so the directive
 * arrives with it.
 *
 * A styled, behaviour-free draft of this panel exists at
 * design/components/bidding/bid-panel.tsx. It is a FROZEN REFERENCE, imported
 * by nothing. Take from it or ignore it — it is not this file's history.
 */
export interface BidPanelProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
}

export function BidPanel({ auctionId }: BidPanelProps) {
  return (
    <Alert tone="info" title="لوحة المزايدة">
      <p>
        نقطة تركيب فارغة من <span className="num">S0-13</span>. السلوك ضمن{" "}
        <span className="num">BID-03</span> و<span className="num">BID-04</span> و{" "}
        <span className="num">BID-06</span>، ومالكها ريان.
      </p>
      <p className="sr-only">المزاد {auctionId}</p>
    </Alert>
  );
}
