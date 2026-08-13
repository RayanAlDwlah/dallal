"use client";

import { useRouter } from "next/navigation";

import { BidPanel } from "@/components/bidding/bid-panel";
import type { Auction } from "@/lib/auction";

/**
 * AUC-15 — viewer-type rendering.
 *
 * The ownership seam made explicit: **Mohammed decides which of the four
 * viewer states applies; Rayan's BidPanel renders it.** Neither edits the
 * other's file (TEAM.md §11).
 *
 * It also exists for a mechanical reason. The detail page is a Server
 * Component and BidPanel is a Client Component, so a callback cannot be
 * passed across that boundary — functions are not serializable. This thin
 * client wrapper owns the callback.
 *
 * SC-07 is a matrix test, so the four cases are enumerated rather than
 * derived from a chain of conditionals.
 */
export function BidSlot({
  auction,
  viewerId,
  isEnded,
}: {
  auction: Auction;
  /** From Abdulrahman's server-verified identity. `null` = signed out. */
  viewerId: string | null;
  isEnded: boolean;
}) {
  const router = useRouter();

  // FR-DETAIL-17 — an ended auction shows no bid control to anyone. The
  // outcome banner takes this space instead.
  if (isEnded) return null;

  // FR-DETAIL-15 / FR-AUTH-11 — prompt to sign in, and return the visitor to
  // this auction afterwards. The bid amount is deliberately NOT carried
  // through; it must be re-entered as a deliberate action.
  if (viewerId === null) {
    return (
      <BidPanel
        state="guest"
        onSignIn={() => router.push(`/login?next=/auctions/${auction.id}`)}
      />
    );
  }

  // FR-DETAIL-16 / BR-02 — the owner gets no usable control and a message
  // explaining why. The server rejects an owner's bid by any route regardless.
  if (viewerId === auction.ownerId) {
    return <BidPanel state="owner" />;
  }

  return (
    <BidPanel
      state="bidder"
      auction={{
        startingPrice: auction.startingPrice,
        currentPrice: auction.currentPrice,
        bidCount: auction.bidCount,
      }}
      submitBid={async () => {
        // TODO(BID-02): call Rayan's single serialized bid operation. Until it
        // exists, submitting must not pretend to succeed — FR-BID-16 requires
        // a definitive answer, so the honest placeholder is a rejection.
        return { status: "rejected", reason: "auction-not-found" };
      }}
    />
  );
}
