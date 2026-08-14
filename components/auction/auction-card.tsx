import Link from "next/link";

import { Countdown } from "@/components/auction/countdown";
import { Card, CardBody } from "@/components/ui/card";
import { ImageFrame } from "@/components/ui/image-frame";
import { Money } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import type { AuctionListEntry } from "@/lib/auctions/listing";

/**
 * One entry in the marketplace listing — AUC-09, FR-LIST-02.
 *
 * Mohammed's issue (#51); see the header of app/auctions/new/actions.ts.
 *
 * Built on Card / ImageFrame / Money / Countdown / StatusPill rather than on
 * its own markup, which is what card.tsx already says the listing card must do.
 * Nothing here formats a price itself (NFR-DAT-08, CLAUDE.md §4.6) and nothing
 * here derives a lifecycle state (status-pill.tsx: "this component contains no
 * lifecycle logic").
 */
export interface AuctionCardProps {
  auction: AuctionListEntry;
  /**
   * The server clock at read time, from the same response as the rows. Passed
   * down rather than read here so every countdown on the page measures skew
   * against one value (BR-19, EC-17).
   */
  serverNow: string;
}

export function AuctionCard({ auction, serverNow }: AuctionCardProps) {
  /*
   * FR-LIST-03 — labelled unambiguously, and the two labels use DIFFERENT
   * words, not the same noun with a different adjective. price-block.tsx
   * explains why this is a requirement rather than copywriting: with no bids
   * the amount is inclusive (BR-29, a bid of exactly this is accepted), and
   * with bids it is exclusive (BR-03, the next must be strictly greater). A
   * user must not have to read carefully to tell which applies (NFR-USA-11).
   *
   * Derived from bidCount, never from comparing the two prices — they are equal
   * after the first bid at the starting price.
   */
  const hasBids = auction.bidCount > 0;

  return (
    <Card as="article" interactive className="overflow-hidden">
      {/*
        The whole card is the link (FR-LIST-07). One tab stop and one 44px+
        target per auction, rather than a separate link on the image and the
        title (NFR-USA-08).
      */}
      <Link
        href={`/auctions/${auction.id}`}
        className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ImageFrame
          src={auction.imageUrl}
          /*
           * The product name IS the alt text: for a listing thumbnail the image
           * carries no information the name does not. A user-supplied string
           * lands here, which is fine in an attribute — nothing is interpreted.
           */
          alt={auction.name}
          ratio="square"
          className="rounded-b-none border-0 border-b"
        />

        <CardBody className="gap-2">
          <div className="flex items-start justify-between gap-2">
            {/*
              A product name is user-supplied and may be Latin, Arabic or mixed.
              Unisolated it reorders the line it sits in (CLAUDE.md §3).
              line-clamp keeps a 100-character name from setting the card's
              height (FR-CREATE-04 allows one).
            */}
            <h2 className="line-clamp-2 text-base font-bold">
              <bdi>{auction.name}</bdi>
            </h2>
            {/*
              Active, always — the listing is active-only by construction
              (FR-LIST-05), so there is no state to compute here and no
              "ending soon" threshold invented. Urgency is the countdown's job,
              and it already has one.
            */}
            <StatusPill tone="active" className="shrink-0">
              نشط
            </StatusPill>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-ink-3 text-xs font-bold">
              {hasBids ? "المزايدة الحالية" : "سعر البداية"}
            </span>
            <Money amount={hasBids ? auction.currentPrice : auction.startingPrice} size="md" />
          </div>

          {/* FR-LIST-04 — a live countdown, not a static "ends at". */}
          <Countdown endsAt={auction.endsAt} serverNow={serverNow} />
        </CardBody>
      </Link>
    </Card>
  );
}
