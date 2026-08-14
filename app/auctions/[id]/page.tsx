import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BidSlot, type ViewerRole } from "@/components/auction/detail/bid-slot";
import { ProductContent } from "@/components/auction/detail/product-content";
import { OutcomePendingNote } from "@/components/auction/detail/outcome-pending-note";
import { SellerOutcome } from "@/components/auction/detail/seller-outcome";
import { StatusCountdown } from "@/components/auction/detail/status-countdown";
import { BidHistory } from "@/components/bidding/bid-history";
import { LivePriceRegion } from "@/components/bidding/live-price-region";
import { OutcomeBanner } from "@/components/bidding/outcome-banner";
import { Container, Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { getVerifiedUserId } from "@/lib/auth/identity";
import { readAuctionDetail } from "@/lib/auctions/detail";
import { outcomePending, presentedStatus } from "@/lib/auctions/presentation";

/**
 * Auction detail — the page shell. AUC-11 (#53), AUC-15 (#57), AUC-16 (#58),
 * AUC-17 (#59).
 *
 * This is the one surface all three workstreams render on, so it is split by
 * owner (TEAM.md §11, ARCHITECTURE §14.6, S0-13). The table of who owns what is
 * in README.md and repeated in each component's header. This file owns the
 * frame: the read, the layout, and where the other six mount.
 *
 * FR-DETAIL-01 — public. No auth guard, and there must not be one; a visitor is
 * a supported user (S0-10 §6, FR-AUTH-23). What a viewer is SHOWN does depend
 * on who they are, and that matrix is AUC-15 — resolved here into a single
 * ViewerRole and handed to components/auction/detail/bid-slot.tsx, which owns
 * the four cells of SC-07.
 *
 * The identity used is the SERVER-VERIFIED one (S0-10 thing (2)), and the role
 * it produces still decides only what is drawn. Nothing on this page is an
 * authorization control: the server rejects an owner's bid, an anonymous bid
 * and a late bid on every route, including one that never renders this file
 * (BR-02, EC-07, FR-SEC-16, SEC-V6).
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

  /*
   * Both reads issued together. getVerifiedUserId revalidates the token with
   * the auth server and is cache()d for the request, so the layout's own call
   * and this one share one revalidation rather than issuing two.
   */
  const [result, viewerId] = await Promise.all([
    readAuctionDetail(id),
    getVerifiedUserId(),
  ]);

  /*
   * AUC-16 (#58) — FR-DETAIL-25 / EC-13. A non-existent auction gets a clear
   * not-found page, never a raw error. An id that is not even a UUID lands here
   * too, so a mistyped URL reads as "no such auction" rather than as a fault.
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

  /*
   * AUC-16 (#58) — the other half of that issue, and the reason it is a
   * function rather than an inline comparison: an auction past its end time
   * whose row still says `active` must be PRESENTED as ended, before the
   * closing sweep has run (FR-DETAIL-24, EC-04). Measured against the SERVER
   * clock carried by the same read (BR-19, EC-17), never the viewer's.
   *
   * It decides nothing. A late bid is rejected inside the database against
   * clock_timestamp() regardless of what was drawn here (LC-03).
   */
  const status = presentedStatus(auction, result.serverNow);
  const ended = status === "ended";

  /*
   * AUC-15 (#57) — the whole viewer matrix collapses to one value here, and the
   * four cells of SC-07 live in bid-slot.tsx. Compared against the
   * server-verified id (S0-10 thing (2)); a client-supplied id would make this
   * an authorization decision taken on the caller's word.
   */
  const role: ViewerRole = !viewerId
    ? "visitor"
    : viewerId === auction.ownerId
      ? "owner"
      : "bidder";

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
          {/*
            AUC-13 (#55), fed the PRESENTED status from AUC-16 rather than the
            stored one — which is exactly the seam this component's header said
            it was waiting for.
          */}
          <StatusCountdown
            status={status}
            endsAt={auction.endsAt}
            serverNow={result.serverNow}
          />

          {/*
            AUC-14 (#56). bidCount, not a price comparison: BR-29 lets the first
            bid equal the starting price, so the two prices are equal both
            before any bid and immediately after the first one.

            leadingBidder and lastRaise are Rayan's values and are not passed
            yet — they arrive through this same seam with BID-05 and BID-09.
            Nothing here invents a placeholder for them.

            BID-09 (#125), Rayan — the ONLY behavioural line in this file.
            LivePriceRegion is not a second price component: it renders this
            exact PriceRegion, with these exact props, and changes nothing but
            where currentPrice and bidCount come from — a server read frozen at
            render, or the live BID-08 store. No wrapper element, no class, no
            string, no layout. Mohammed's presentation is untouched by
            construction, which is why CLAUDE.md §1's "Rayan may implement
            bidding behaviour inside a component Mohammed presents" applies
            rather than its "must not redesign that presentation" (@m7ya505 —
            say so on the PR if you read it the other way).

            startingPrice stays the server value deliberately: it is immutable
            for the auction's life (auctions_immutable_terms), so subscribing it
            to a live store would imply a mutability that does not exist.
          */}
          <LivePriceRegion
            auctionId={auction.id}
            startingPrice={auction.startingPrice}
            currentPrice={auction.currentPrice}
            bidCount={auction.bidCount}
            status={status}
          />

          {/*
            AUC-15 (#57) — the bid-control slot. All four cells of SC-07 are in
            bid-slot.tsx, including the one that mounts Rayan's BidPanel; it
            still receives the auction id and nothing else (S0-13).
          */}
          <BidSlot auctionId={auction.id} role={role} status={status} />

          {/*
            AUC-17 (#59) — the seller's own view of their completed auction,
            from the outcome finalization RECORDED (BID-16). Nothing here
            recomputes it, and it presents no next step: no payment, no contact,
            no shipping (FR-DETAIL-21a, SC-67, PRD §19.0).

            Owner-only and ended-only. This gate is MINE to set: which blocks a
            seller sees is presentation, and FR-DETAIL-21 wants the seller told a
            different sentence from every other viewer.

            Note for BID-18 (#79), raised by @Dem4t in review: once Rayan's
            banner has content, an owner on an ended auction will read the
            outcome twice — once in the seller's sentence and once in the
            general one. Deliberately left for then rather than pre-empted now,
            because the answer depends on what that banner actually says, and it
            is a decision for the two of us together.
          */}
          {ended && role === "owner" ? (
            <SellerOutcome
              winnerName={auction.winnerName}
              finalPrice={auction.finalPrice}
              pending={outcomePending(auction, result.serverNow)}
            />
          ) : null}

          {/*
            AUC-16 (#58) — the other half of EC-04, for everyone who is not the
            seller.

            EC-04 asks for the outcome to be "marked as being finalized" during
            the FR-END-03 window, and it does not scope that to the seller. #110
            delivered the sentence only inside SellerOutcome, which is
            owner-gated — so a bidder saw the status flip to ended, the bid
            control disappear, and then nothing where the outcome belongs. Found
            while reviewing @RayanAlDwlah's BID-17 (#122); the gap is mine, from
            #110, not his.

            His banner is correctly silent here and must stay silent: it renders
            from the STORED status, and `ended` is written in the same UPDATE as
            the winner and the final price, so it has nothing to say until the
            sweep lands. This window is the server render's to cover, and the
            two never coexist.
          */}
          {ended && role !== "owner" && outcomePending(auction, result.serverNow) ? (
            <OutcomePendingNote />
          ) : null}

          {/*
            Rayan's outcome banner (BID-18). MOUNTED UNCONDITIONALLY, and it
            must stay that way.

            It was briefly gated on `ended` here. That was wrong, and @RayanAlDwlah
            caught it: `ended` is computed from presentedStatus at SERVER RENDER,
            so it is frozen in the HTML. A page that loads while the auction is
            still active would never mount the component at all, and there would
            be nothing on the client for BID-17 (#78) to reveal when the auction
            closes under the viewer — which is exactly what SC-23 and FR-RT-08
            require ("status changes, bid control disappears, outcome appears,
            with no refresh").

            The gate also took a decision that is not mine. This file has said
            since #105 that Rayan's mount points render unconditionally and that
            WHEN each becomes visible is his (S0-13, TEAM.md §6, ARCHITECTURE
            §14.6). Hard-coding "only after a reload" is answering his half.

            BidSlot's `ended → null` is a different case and stays: hiding a
            control that would collect only guaranteed rejections is
            FR-DETAIL-17's own requirement, and BID-17 makes a MOUNTED control
            disappear from inside — removal it can do, appearance of something
            never mounted it cannot.
          */}
          <OutcomeBanner auctionId={auction.id} />
        </aside>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {/* AUC-12 (#54). The name goes only to the image's alt — the <h1> above is the page's one heading. */}
          <ProductContent
            name={auction.name}
            description={auction.description}
            imageUrl={auction.imageUrl}
            sellerName={auction.sellerName}
          />

          {/* BID-07 (#68) — public to unauthenticated visitors (BR-40, SC-75). */}
          <BidHistory auctionId={auction.id} />
        </div>
      </div>
    </Container>
  );
}
