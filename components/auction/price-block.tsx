import type { AuctionStatus } from "@/lib/auctions/detail";
import { cn } from "@/lib/cn";
import { Money } from "@/components/ui/money";
import { formatSarWithSuffix, type AuctionPrice, type Sar } from "@/lib/money";

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
  /**
   * The PRESENTED status (lib/auctions/presentation.ts), not the raw row —
   * same value BidSlot and StatusCountdown receive. Optional and defaulting to
   * open so the listing card and the styleguide, which render a price with no
   * lifecycle around them, are unaffected.
   */
  status?: AuctionStatus;
  className?: string;
}

export function PriceBlock({
  startingPrice,
  currentPrice,
  bidCount,
  leadingBidder,
  lastRaise,
  status,
  className,
}: PriceBlockProps) {
  return bidCount === 0 ? (
    <StartingPrice startingPrice={startingPrice} status={status} className={className} />
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

/**
 * Quieter: a dashed rule, muted caption. The amount is an invitation —
 * **while the auction is open.**
 *
 * F-3 (#162), measured in a browser by @RayanAlDwlah on #159: a CLOSED
 * zero-bid auction went on rendering "أول مزايدة بمبلغ X بالضبط مقبولة".
 * `BR-29` makes that sentence true only while bidding is open; once the end
 * time has passed `place_bid` rejects on the server clock (`LC-03`), so the
 * page was stating a rule the server does not follow.
 *
 * It was wrong on a fresh reload too, not only live — this component received
 * no status at all, so it could not have known. That is the fix: the presented
 * status now reaches it.
 *
 * When ended, the invitation is DROPPED rather than reworded. The amount stays
 * (`FR-END-12` keeps an ended auction fully readable), and what happened to the
 * auction is stated by the components that own that — `OutcomeBanner` and
 * `SellerOutcome`. Inventing a second sentence here would be a copy decision
 * nobody made, and a second place saying what the outcome was.
 */
export function StartingPrice({
  startingPrice,
  status = "active",
  className,
}: {
  startingPrice: Sar;
  /** Presented status (lib/auctions/presentation.ts). Defaults open. */
  status?: AuctionStatus;
  className?: string;
}) {
  const ended = status === "ended";
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
        {ended ? (
          "لا توجد مزايدات"
        ) : (
          <>
            لا توجد مزايدات · أول مزايدة بمبلغ {formatSarWithSuffix(startingPrice)} بالضبط{" "}
            <strong className="text-ink">مقبولة</strong>
          </>
        )}
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
            {/*
              INT-06 (#88) — was `<bdi className="num">{formatSar(lastRaise)}</bdi>`,
              a fourth hand-rolled amount island with none of Money's
              `max-w-full min-w-0 overflow-x-auto`. A raise is a difference of
              two prices and BR-21 puts no ceiling on either, so it is
              width-unbounded like any other amount.
              MILDER than the two in bid-panel/bid-history and stated as such:
              the parent here is `flex-wrap`, so a wide delta wraps to its own
              line instead of dragging the hero price with it. And `lastRaise`
              is not passed by any caller yet (#138 leaves it for a SQL-side
              delta), so this was latent rather than live. Fixed at the same
              time because the fix is the same and the next caller would
              activate it.
              `suffix={false}`: the sr-only line below already states the amount
              with its indicator, and repeating it visually would say SAR twice.
            */}
            <Money amount={lastRaise} size="sm" suffix={false} />
            <span className="sr-only">ارتفع السعر بمقدار {formatSarWithSuffix(lastRaise)}</span>
          </span>
        ) : null}
      </div>

      <p className="text-sm text-ink-2">
        <bdi className="num">{bidCount}</bdi> مزايدات
        {/* A display name is user-supplied and may be Latin or mixed-script.
            Unisolated, it reorders the separator and the label around it. */}
        {leadingBidder ? (
          <>
            {" · "}المتصدر: <bdi>{leadingBidder}</bdi>
          </>
        ) : null}
      </p>
    </section>
  );
}
