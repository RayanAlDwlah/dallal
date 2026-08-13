import Link from "next/link";

import { Countdown } from "@/components/auction/countdown";
import { Card, CardBody } from "@/components/ui/card";
import { ImageFrame } from "@/components/ui/image-frame";
import { Money } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import type { Auction } from "@/lib/auction";

/**
 * One entry in the listing — FR-LIST-02, FR-LIST-03, FR-LIST-07.
 *
 * The price is **labelled**, not bare: FR-LIST-03 requires the viewer to know
 * whether they are looking at a starting price or a current bid, and the two
 * mean different things for the next bid they can place (BR-28, BR-29).
 *
 * No bidder identities and no email addresses appear here (FR-LIST-11).
 */
export function AuctionCard({ auction, serverNow }: { auction: Auction; serverNow: string }) {
  const hasBids = auction.bidCount > 0;

  return (
    <Card as="article" interactive className="overflow-hidden">
      <Link href={`/auctions/${auction.id}`} className="block">
        <ImageFrame src={auction.imageUrl} alt={auction.productName} ratio="square" />

        <CardBody>
          <h2 className="text-md font-bold text-balance">{auction.productName}</h2>

          <div className="flex flex-col gap-0.5">
            <Money amount={hasBids ? auction.currentPrice : auction.startingPrice} size="md" />
            <p className="text-ink-3 text-xs">
              {hasBids ? "المزايدة الحالية" : "سعر البداية · لا توجد مزايدات"}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill tone="active">نشط</StatusPill>
            <Countdown endsAt={auction.endsAt} serverNow={serverNow} />
          </div>
        </CardBody>
      </Link>
    </Card>
  );
}
