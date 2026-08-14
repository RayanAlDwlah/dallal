import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PriceRegion } from "@/components/auction/detail/price-region";
import { ProductContent } from "@/components/auction/detail/product-content";
import { StatusCountdown } from "@/components/auction/detail/status-countdown";
import { BidHistory } from "@/components/bidding/bid-history";
import { BidPanel } from "@/components/bidding/bid-panel";
import { OutcomeBanner } from "@/components/bidding/outcome-banner";
import { Container, Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { readAuctionDetail } from "@/lib/auctions/detail";

/**
 * Auction detail — the page shell. AUC-11 (#53).
 *
 * This is the one surface all three workstreams render on, so it is split by
 * owner (TEAM.md §11, ARCHITECTURE §14.6, S0-13). The table of who owns what is
 * in README.md and repeated in each component's header. This file owns the
 * frame: the read, the layout, and where the other six mount.
 *
 * FR-DETAIL-01 — public. No auth guard, and there must not be one; a visitor is
 * a supported user (S0-10 §6, FR-AUTH-23). What a viewer is SHOWN does depend
 * on who they are — sign-in prompt, bid control, or the owner's "you cannot bid
 * on your own auction" — and that matrix is AUC-15 (#57, SC-07), not this
 * issue. Until then all three of Rayan's mount points render unconditionally,
 * which is what gives him somewhere to build against (TEAM §14).
 *
 * Two things this page must never grow:
 *
 *   1. A realtime subscription. One per-auction subscription is owned by
 *      BID-08/BID-09; a second is a competing update mechanism, and TEAM.md
 *      §10.4 and ARCHITECTURE §14.6 both name it as Mohammed's specific hazard.
 *
 *   2. A re-derivation of anything Rayan owns. The current price, the accepted/
 *      rejected outcome of a bid, the recorded order of history, and the winner
 *      all arrive already decided. This page renders them; it never recomputes
 *      them (ARCHITECTURE §9.4, TEAM.md §6).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await readAuctionDetail(id);

  /*
   * Shares one read with the page body through cache() — see detail.ts. Two
   * independent reads of a live auction can disagree, and the browser tab would
   * then describe a different auction from the one on screen.
   */
  return {
    title: result.state === "found" ? result.auction.name : "المزاد",
  };
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await readAuctionDetail(id);

  /*
   * FR-DETAIL-25 / EC-13 — a non-existent auction gets a clear not-found page,
   * never a raw error. An id that is not even a UUID lands here too, so a
   * mistyped URL reads as "no such auction" rather than as a fault.
   *
   * AUC-16 (#58) refines this presentation, and adds the other half of that
   * issue: an auction past its end time must PRESENT as ended even before the
   * closing sweep has run (FR-DETAIL-24, EC-04). That is deliberately not
   * decided here — this page reads `status` and `endsAt` and derives no
   * lifecycle state of its own.
   */
  if (result.state === "not-found") notFound();

  if (result.state === "failed") {
    /*
     * A failed read is NOT a missing auction, and the two must not look alike.
     * Nothing here can be cancelled or deleted (BR-30, BR-31), so telling a
     * seller their auction does not exist — when the truth is that a query
     * failed — would be alarming and false.
     */
    return (
      <Page title="تعذّر تحميل المزاد" width="narrow">
        <Alert tone="error">
          حدث خطأ أثناء قراءة بيانات المزاد. حدِّث الصفحة، وإن تكرّر الأمر
          فالمشكلة عندنا لا عندك.
        </Alert>
      </Page>
    );
  }

  const { auction } = result;

  return (
    <Container as="main" className="flex flex-col gap-6 py-6 sm:py-8">
      {/*
        The one <h1> on the page, so there is never a competing heading between
        the shell and ProductContent. A product name is user-supplied and may be
        Latin, Arabic or mixed — unisolated it reorders the line it sits in
        (CLAUDE.md §3). FR-DETAIL-02 asks for it in full, so no truncation here:
        FR-CREATE-04 allows 100 characters and all 100 are shown.
      */}
      <h1 className="text-xl font-bold sm:text-2xl">
        <bdi>{auction.name}</bdi>
      </h1>

      {/*
        375px is the base layer, not a breakpoint (DESIGN_SYSTEM.md §10): one
        column first, widening to content + rail at lg. `gap` is logical
        already, so the grid mirrors under dir="rtl" with no left/right anywhere.

        The rail is FIRST in the DOM on purpose. NFR-USA-04 makes the current
        price the most prominent element on the page, and at 375px source order
        is visual order — a rail declared second would put the price and the bid
        control below the description and image, off the first screen. At lg the
        two are placed explicitly into columns, which is direction-aware: under
        RTL column 1 is the right-hand one, so the content sits at the start and
        the rail at the end without a single physical property.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
          {/* AUC-13 (#55) — wires this to auction.status and auction.endsAt. */}
          <StatusCountdown />

          {/* AUC-14 (#56) — wires this to the prices and the bid count. */}
          <PriceRegion />

          {/*
            Rayan's mount points. They receive the auction id and nothing else:
            that is the only prop S0-13 fixes, and every other input — the
            minimum, the submit action, the outcome values — is his to declare
            (see components/bidding/bid-panel.tsx).

            Both are rendered unconditionally for now. Which one a given viewer
            sees, and when, is AUC-15 (#57) for the viewer matrix and BID-17
            (#78) for the live Active → Ended transition.
          */}
          <BidPanel auctionId={auction.id} />
          <OutcomeBanner auctionId={auction.id} />
        </aside>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {/* AUC-12 (#54) — wires this to the description, image and seller. */}
          <ProductContent />

          {/* BID-07 (#68) — public to unauthenticated visitors (BR-40, SC-75). */}
          <BidHistory auctionId={auction.id} />
        </div>
      </div>
    </Container>
  );
}
