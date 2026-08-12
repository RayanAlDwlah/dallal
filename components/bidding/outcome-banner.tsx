/**
 * OWNER: Rayan (`RayanAlDwlah`) — S0-13 placeholder. See bid-history.tsx.
 *
 * Requirements: FR-END-14/16, FR-DETAIL-18 → 21a, BR-09, SC-66, SC-67.
 *
 * Three outcomes only: a winner, no bids, or "you won". There is no
 * "reserve not met" case (BR-35). The banner must present NO next step —
 * no payment, contact, shipping or collection (BR-34, FR-END-17a).
 */
export function OutcomeBanner({ auctionId }: { auctionId: string }) {
  return <div data-auction-id={auctionId} />;
}
