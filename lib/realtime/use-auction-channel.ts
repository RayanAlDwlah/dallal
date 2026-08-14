"use client";

import { useEffect, useState } from "react";

import {
  subscribeToAuction,
  type AuctionChannelStatus,
} from "@/lib/realtime/auction-channel";

export interface AuctionChannelState {
  /** Whether live updating is working. Presentation of it is Mohammed's. */
  status: AuctionChannelStatus;
  /**
   * Increments once per change signal. It is a **dependency, not data**: put it
   * in a `useEffect` dependency list and re-read the auction when it moves.
   *
   * It carries no meaning of its own — not a version, not an ordering, not a
   * count of bids. Two signals arrive for one bid inside the final 15 seconds
   * (the BR-36 extension, then the price), and a reconnect re-reads without
   * moving it. Rendering this number would be rendering an implementation
   * detail of the transport.
   */
  revision: number;
}

/**
 * BID-08 — subscribe to one auction for as long as it is on screen.
 *
 * This hook is the whole client surface of the realtime foundation. It
 * delivers no auction data, by design: the signal says *something changed*,
 * and the authoritative read is what says *what* (ADR-9, BR-22, RT-R6). BID-09
 * does that read, through the `::text` money path — the payload's own number
 * would already be wrong (S0-12 §6, #103), which is exactly why there is no
 * payload here to be tempted by.
 *
 * ```tsx
 * const { status, revision } = useAuctionChannel(auctionId);
 * useEffect(() => { void refresh(); }, [revision]);
 * ```
 *
 * Pass `null` to subscribe to nothing — for a page that has not resolved an
 * auction yet, rather than making the caller branch around the hook.
 */
export function useAuctionChannel(auctionId: string | null): AuctionChannelState {
  const [live, setLive] = useState<AuctionChannelStatus>("connecting");
  const [revision, setRevision] = useState(0);

  // Resetting the status when the auction changes happens **during render**,
  // not in an effect. React documents this shape for exactly this case, and it
  // is the one that behaves: an effect would first paint the previous
  // auction's `"live"` next to the new auction's data, then correct itself —
  // telling the viewer that a channel they have already left is carrying this
  // auction. Here there is no such frame, and no cascading render.
  const [subscribedTo, setSubscribedTo] = useState(auctionId);
  if (subscribedTo !== auctionId) {
    setSubscribedTo(auctionId);
    setLive("connecting");
  }

  useEffect(() => {
    if (!auctionId) return;

    // The unsubscribe returned here is what makes this correct under React
    // Strict Mode's deliberate double mount, and on navigation between two
    // auctions: the old channel is left before the new one is joined, so a
    // viewer never receives a signal for an auction they are no longer on.
    return subscribeToAuction(auctionId, {
      onChange: () => setRevision((n) => n + 1),
      onStatus: setLive,
    });
  }, [auctionId]);

  // `revision` deliberately survives an auction change without resetting. It
  // is a dependency, not data: what a consumer needs is that it *moved*, and a
  // reset to 0 is a move backwards that a `useEffect` dependency list reads as
  // a change anyway. Keeping it monotonic makes it useless as data, which is
  // the point.
  return { status: auctionId ? live : "unavailable", revision };
}
