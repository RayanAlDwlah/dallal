/**
 * OWNER: Rayan (`RayanAlDwlah`) — S0-13 placeholder. See bid-history.tsx.
 *
 * Requirements: FR-RT-11 → 13, RT-R2/R3, NFR-RT-06, EC-10.
 *
 * Three states: live, reconnecting, offline. Wording is informative and
 * calm — "التحديث المباشر غير متاح", never "انقطع الاتصال!". Loss must be
 * surfaced within 10 s, and reconnection resynchronises to authoritative
 * state rather than resuming a partial stream.
 */
export function ConnectionIndicator({ auctionId }: { auctionId: string }) {
  return <div data-auction-id={auctionId} />;
}
