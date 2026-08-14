"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AuctionCard } from "@/components/auction/auction-card";
import type { AuctionListEntry } from "@/lib/auctions/listing";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-10 (#52). The listing grid, and what
 * happens to a card when its countdown reaches zero.
 *
 * FR-LIST-05b: **when an auction ends it leaves the listing, and the transition
 * does not look like a page error.** Without this the card stays on the
 * marketplace showing 00:00:00 until something else causes a reload — an
 * auction advertised as biddable that will reject every bid it attracts, which
 * is worse than it being gone.
 *
 * ── No subscription here, deliberately ────────────────────────────────────
 *
 * The end time is already known: it came from the same read as the row. So
 * "has it ended?" is a clock question, not a data question, and answering it
 * locally needs no channel. TEAM.md §10.4 and ARCHITECTURE §14.6 both name a
 * second update mechanism as Mohammed's specific hazard, and a per-card
 * subscription on a hundred-row listing would be exactly that. Live per-item
 * price push is separately Should Have (FR-LIST-10, FR-RT-16) and is not this.
 *
 * ── The clock is the SERVER's, offset once ────────────────────────────────
 *
 * `serverNow` came from the same response as the rows, so the difference
 * against `Date.now()` at mount is this browser's skew. Everything after is
 * measured through that offset (BR-19, EC-17). A device clock a day fast would
 * otherwise empty the entire marketplace.
 *
 * This is display only. It cannot end an auction, and it cannot keep one alive:
 * the row is closed by the sweep against the database clock, and a bid after
 * the end time is refused whatever this grid drew (LC-03, BID-15).
 *
 * ── What "leaves" means, and what it must not look like ───────────────────
 *
 * The card is dropped from the grid, and when the last one goes the ordinary
 * empty state takes its place — the same one a genuinely empty marketplace
 * shows (FR-LIST-08). Not an error, not a "this auction ended" tombstone, and
 * not a blank page. FR-LIST-05a and FR-END-12 keep the auction itself reachable
 * by direct link forever, with full outcome and history, so nothing is lost by
 * removing the card: only the invitation to bid goes away.
 */
export interface ActiveListingProps {
  entries: AuctionListEntry[];
  /** The server clock the rows were selected against (FR-LIST-05, BR-19). */
  serverNow: string;
  /**
   * FR-LIST-08's empty state, built by the server component so its create
   * prompt can depend on the verified session. Rendered here when the grid
   * empties — whether it arrived empty or emptied while being watched, which
   * must look identical.
   */
  empty: ReactNode;
}

export function ActiveListing({ entries, serverNow, empty }: ActiveListingProps) {
  /*
   * Seeded with the SERVER's instant, not Date.now(). The server render and the
   * first client render must agree or React reports a hydration mismatch, and
   * the mismatch would be a card that exists in the HTML and not in the DOM.
   * The interval takes over from the first tick.
   */
  const [now, setNow] = useState(() => Date.parse(serverNow));

  useEffect(() => {
    const skew = Date.parse(serverNow) - Date.now();
    /* Nested, not called in the effect body — see docs/design-system-notes.md
       §6.3; the set-state-in-effect rule is not disabled anywhere here. */
    const tick = () => setNow(Date.now() + skew);
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  /*
   * `>` and not `>=`: an auction is over AT its end time, and the server-side
   * filter that produced these rows used the same strict comparison
   * (lib/auctions/listing.ts). The two must agree or a card would flicker back
   * on the next server render.
   */
  const live = entries.filter((entry) => Date.parse(entry.endsAt) > now);

  if (live.length === 0) return <>{empty}</>;

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {live.map((auction) => (
        <li key={auction.id}>
          <AuctionCard auction={auction} serverNow={serverNow} />
        </li>
      ))}
    </ul>
  );
}
