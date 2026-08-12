import { cn } from "@/lib/cn";
import { Money } from "@/components/ui/money";
import { formatSar, formatSarWithSuffix, type AuctionPrice, type Sar } from "@/lib/money";

/**
 * TWO components, not one component with two labels.
 *
 * The distinction is the product's most confusable rule: with no bids the
 * starting price is INCLUSIVE — a first bid of exactly 100.00 is accepted
 * (BR-29). Once there is a bid, the current price is EXCLUSIVE — the next bid
 * must be strictly greater (BR-03, BR-28). A user must never have to read
 * carefully to know which one applies to them (NFR-USA-11).
 *
 * Ownership (TEAM.md §11, ARCHITECTURE §9.4): Mohammed builds this region.
 * **Rayan supplies the value and its updates.** Mohammed never computes the
 * price — it is always the highest accepted bid, or the starting price when
 * there are none, written only by the bid operation (BR-13, SEC-Z5).
 *
 * This component is presentational and has no realtime dependency of its own.
 * A client wrapper owning the single per-auction subscription passes new
 * values in; do not add a second update mechanism here (TEAM.md §10.4).
 */

export interface PriceBlockProps extends AuctionPrice {
  /** Display name of the current highest bidder, when there is one. */
  leadingBidder?: string;
  /**
   * Set for ~4s after a live update so the ▲ and the delta render. The arrow
   * and the amount are the NON-COLOUR, NON-MOTION channel — under
   * `prefers-reduced-motion` they are all that is left (NFR-USA-10, RT-X1).
   */
  lastRaise?: Sar | null;
  className?: string;
}

export function PriceBlock({
  startingPrice,
  currentPrice,
  bidCount,
  leadingBidder,
  lastRaise,
  className,
}: PriceBlockProps) {
  return bidCount === 0 ? (
    <StartingPrice startingPrice={startingPrice} className={className} />
  ) : (
    <CurrentBid
      currentPrice={currentPrice}
      bidCount={bidCount}
      leadingBidder={leadingBidder}
      lastRaise={lastRaise}
      className={className}
    />
  );
}

/** Quieter: a dashed rule, muted caption. The amount is an invitation. */
export function StartingPrice({ startingPrice, className }: { startingPrice: Sar; className?: string }) {
  return (
    <section
      aria-label="سعر البداية"
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-dashed border-rule bg-surface px-5 py-4",
        className,
      )}
    >
      <h2 className="text-xs font-bold text-ink-3">سعر البداية</h2>
      <Money amount={startingPrice} size="hero" />
      <p className="text-sm text-ink-2">
        لا توجد مزايدات · أول مزايدة بمبلغ {formatSarWithSuffix(startingPrice)} بالضبط{" "}
        <strong className="text-ink">مقبولة</strong>
      </p>
    </section>
  );
}

/** Louder: brand ground, bid count, live region. The amount is a threshold. */
export function CurrentBid({
  currentPrice,
  bidCount,
  leadingBidder,
  lastRaise,
  className,
}: Omit<PriceBlockProps, "startingPrice">) {
  return (
    <section
      aria-label="المزايدة الحالية"
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-brand-line bg-brand-weak px-5 py-4",
        // Keyed by the price so the flash restarts on every accepted bid.
        "motion-safe:animate-price-flash",
        className,
      )}
      key={currentPrice}
    >
      <h2 className="text-xs font-bold text-brand-text">المزايدة الحالية</h2>

      {/*
        `polite`, never `assertive`: an update announces without interrupting,
        and never moves focus or scroll (RT-X2, FR-RT-06).
      */}
      <div aria-live="polite" className="flex flex-wrap items-baseline gap-2 text-brand-text">
        <Money amount={currentPrice} size="hero" className="text-brand-text" />
        {lastRaise ? (
          <span className="inline-flex items-baseline gap-0.5 text-sm font-bold text-brand-text">
            {/* Vertical, so it must NOT mirror in RTL — no icon-directional here. */}
            <span aria-hidden="true">▲</span>
            <bdi className="num">{formatSar(lastRaise)}</bdi>
            <span className="sr-only">ارتفع السعر بمقدار {formatSarWithSuffix(lastRaise)}</span>
          </span>
        ) : null}
      </div>

      <p className="text-sm text-ink-2">
        <bdi className="num">{bidCount}</bdi> مزايدات
        {leadingBidder ? <> · المتصدر: {leadingBidder}</> : null}
      </p>
    </section>
  );
}
