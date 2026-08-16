import Image from "next/image";
import Link from "next/link";

import { CardPill } from "@/components/auction/card-pill";
import { Countdown } from "@/components/auction/countdown";
import { Money } from "@/components/ui/money";
import { auctionImageUrl } from "@/lib/images";
import type { AuctionListItem } from "@/types/db";

/**
 * The one auction card, used everywhere (auction-card.html). The hairline
 * glows gold on hover — its thickness never changes.
 */
export function AuctionCard({ auction }: { auction: AuctionListItem }) {
  const ended = auction.status === "ended";
  const hasBids = auction.bid_count > 0;
  const cover = auction.images[0];

  return (
    <Link href={`/auctions/${auction.id}`} className="block">
      <article className="hairline card-glow overflow-hidden rounded-[20px] bg-surface">
        <div
          className="relative h-[158px]"
          style={{ background: "linear-gradient(135deg,#1B212C,#11151D)" }}
        >
          {cover ? (
            <Image
              src={auctionImageUrl(cover)}
              alt={auction.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
              className="object-cover"
            />
          ) : null}
          <span className="absolute start-3 top-3">
            <CardPill status={auction.status} endTime={auction.end_time} />
          </span>
        </div>

        <div className="p-4">
          <h3 className="mb-3 truncate text-[16px] font-semibold">{auction.title}</h3>
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="block text-[12px] text-ink3">
                {ended ? (hasBids ? "بِيع بـ" : "انتهى بدون مزايدات") : hasBids ? "السعر الحالي" : "يبدأ من"}
              </span>
              {ended && !hasBids ? null : (
                <Money
                  amount={auction.current_price ?? auction.starting_price}
                  className={`font-display text-[22px] font-bold leading-tight ${ended && hasBids ? "text-green" : "text-gold"}`}
                />
              )}
            </div>
            <div className="num text-end text-[12px] leading-relaxed text-ink2">
              {ended ? null : <Countdown endTime={auction.end_time} className="text-[14px]" />}
              <br />
              {ended && hasBids && auction.winner?.display_name ? (
                <>
                  الفائز <bdi>{auction.winner.display_name}</bdi> ·{" "}
                </>
              ) : null}
              {hasBids ? `${auction.bid_count} مزايدة` : ended ? null : "أول مزايدة مقبولة"}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
