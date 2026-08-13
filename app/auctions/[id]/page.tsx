import { notFound } from "next/navigation";

import { BidSlot } from "@/components/auction/bid-slot";
import { Countdown } from "@/components/auction/countdown";
import { PriceBlock } from "@/components/auction/price-block";
import { ProductContent } from "@/components/auction/product-content";
import { BidHistory } from "@/components/bidding/bid-history";
import { ConnectionIndicator } from "@/components/bidding/connection-indicator";
import { OutcomeBanner } from "@/components/bidding/outcome-banner";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { ImageFrame } from "@/components/ui/image-frame";
import { StatusPill } from "@/components/ui/status-pill";
import { effectiveStatus, isAwaitingClose } from "@/lib/auction";
import { getAuction, serverNow } from "@/lib/auctions/repository";

/**
 * AUC-11 — the auction detail page SHELL.
 *
 * This is where all three workstreams meet, and TEAM.md §11 calls it the
 * project's worst recurring merge-conflict risk. The split is therefore
 * structural, not a convention:
 *
 *   Mohammed owns  — this shell, the layout, the data load, the product
 *                    content, the status label and countdown, and the region
 *                    the price is displayed in.
 *   Rayan owns     — everything under components/bidding/. This file mounts
 *                    them and passes the auction id. **Mohammed does not edit
 *                    Rayan's files, and Rayan does not edit this one.**
 *
 * Public: no authentication required (FR-DETAIL-01).
 *
 * A Server Component, so the price is in the first paint. Rayan's realtime
 * subscription lives inside his client components and updates from there —
 * there must be no second update mechanism here (TEAM.md §10.4).
 */
export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auction = await getAuction(id);

  // FR-DETAIL-25 / EC-13 — a clear not-found page, never a raw error.
  if (!auction) notFound();

  const now = serverNow();
  const status = effectiveStatus(auction, now);
  const awaitingClose = isAwaitingClose(auction, now);
  const ended = status === "ended";

  return (
    <Container as="main" className="py-6 sm:py-8">
      {/*
        375px is the base layer. In one column the order is deliberate —
        image, status, PRICE, bid panel, then product content and history —
        so the price and the bid control are reachable without scrolling
        (DESIGN_SYSTEM.md §10). From lg the rail moves to the inline end.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* --- inline-start: the item ------------------------------------ */}
        <div className="order-1 flex flex-col gap-6 lg:order-none">
          <ImageFrame
            src={auction.imageUrl}
            alt={auction.productName}
            ratio="wide"
            priority
            className="lg:order-none"
          />

          <ProductContent
            name={auction.productName}
            description={auction.productDescription}
            sellerDisplayName={auction.ownerDisplayName}
            className="order-4 lg:order-none"
          />
        </div>

        {/* --- inline-end rail: status, price, bidding -------------------- */}
        <aside className="order-2 flex flex-col gap-4 lg:order-none lg:sticky lg:top-6">
          {/* AUC-13 — status and countdown */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusPill tone={ended ? "ended" : "active"}>{ended ? "منتهي" : "نشط"}</StatusPill>
            {ended ? null : <Countdown endsAt={auction.endsAt} serverNow={now.toISOString()} />}
            <ConnectionIndicator auctionId={auction.id} />
          </div>

          {/*
            AUC-16 / EC-04 — the deadline has passed but the sweep has not run
            yet. Present it as ended immediately; no bid is accepted meanwhile
            because the server compares endsAt against the database clock,
            never the status flag (LC-03).
          */}
          {awaitingClose ? (
            <Alert tone="info">
              انتهى وقت هذا المزاد، ويجري الآن تحديد النتيجة. ستظهر خلال لحظات.
            </Alert>
          ) : null}

          {/* AUC-14 — the price region. Mohammed builds it, Rayan supplies
              the value; it is never computed here (ARCHITECTURE §9.4). */}
          {ended ? null : (
            <PriceBlock
              startingPrice={auction.startingPrice}
              currentPrice={auction.currentPrice}
              bidCount={auction.bidCount}
            />
          )}

          {/* Rayan's mount points. FR-DETAIL-17: when the auction has ended
              there is no bid control at all — the outcome takes its place. */}
          {ended ? (
            <OutcomeBanner auctionId={auction.id} />
          ) : (
            // TODO(S0-10): viewerId must come from Abdulrahman's SERVER-side
            // verified identity, never the client-side convenience
            // (ARCHITECTURE §10.4). Signed-out is the safe default until then:
            // it offers no bid control.
            <BidSlot auction={auction} viewerId={null} isEnded={ended} />
          )}

          <BidHistory auctionId={auction.id} />
        </aside>
      </div>
    </Container>
  );
}
