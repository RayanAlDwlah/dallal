"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  getLiveAuctionView,
  getServerLiveAuctionView,
  subscribeLiveAuction,
  type LiveAuctionView,
} from "@/lib/bidding/live-snapshot";

/**
 * BID-09 — one auction's live state, for any component that renders it.
 *
 * ```tsx
 * const { snapshot, connection } = useLiveAuction(auctionId);
 * ```
 *
 * Every consumer of the same `auctionId` reads the SAME store: one channel,
 * one read per cue, one snapshot identity — so the price region and the
 * history can never disagree about the newest bid within one paint (SC-21),
 * and twenty components cost what one costs (NFR-RT-02 is about viewers, but
 * the same discipline is what keeps one viewer's page cheap).
 *
 * `useSyncExternalStore` rather than state-in-effect, deliberately: the store
 * outlives any one component, updates arrive outside React's lifecycle, and
 * this is the one primitive that reads such a source without tearing — two
 * components rendering in one pass cannot observe two different snapshots.
 *
 * On the server (and before the first client read lands) `snapshot` is null
 * and `connection` is `"connecting"`. The page's server-rendered content is
 * the bridge across that moment (ARCH §14.5: loaded data stays readable);
 * consumers render their own quiet placeholder, never a spinner takeover.
 */
export function useLiveAuction(auctionId: string): LiveAuctionView {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeLiveAuction(auctionId, onStoreChange),
    [auctionId],
  );
  return useSyncExternalStore(
    subscribe,
    () => getLiveAuctionView(auctionId),
    getServerLiveAuctionView,
  );
}
