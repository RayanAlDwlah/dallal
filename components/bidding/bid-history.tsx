"use client";

import { useLiveAuction } from "@/lib/bidding/use-live-auction";
import { compareSar, formatSar, SAR_SUFFIX } from "@/lib/money";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Created empty by S0-13 (#22); behaviour
 * filled by BID-07, wired live by BID-09. Mohammed owns the presentation half
 * (TEAM.md §11, ARCHITECTURE §14.6): every class and layout choice below is
 * his to restyle without asking, provided the four behaviours hold.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The four behaviours — each fails silently, so they are named:
 *
 *   1. ORDER: rendered exactly as delivered. `bid_history` orders by
 *      `bids.id` — lock order, the definitive order (BR-11). Nothing here
 *      re-sorts and nothing may: the only sortable projected column is
 *      `created_at`, which is transaction start, disagrees with lock order
 *      under contention, and renders a DECREASING history (measured at 2 of
 *      12 contended auctions, S0-11 §6). Newest first (FR-BID-29).
 *
 *   2. IDENTITY: display name only (BR-26, FR-BID-22a). The email absence is
 *      structural — the view cannot reach one — and stays that way exactly as
 *      long as nobody adds a join.
 *
 *   3. MONEY: canonical text through lib/money, digits inside a `<bdi>`
 *      isolate, the `SAR` indicator OUTSIDE it (CLAUDE.md §3/§4, BR-42/43).
 *      One formatter; never a locale-formatted number.
 *
 *   4. LIVENESS: entries come from the shared BID-09 store, so a new bid
 *      appears in the same paint as the new price (SC-21), with no refresh
 *      (SC-20), and a reconnect re-reads the list rather than resuming it
 *      (FR-RT-12).
 *
 * Public to unauthenticated visitors (BR-40, SC-75), still visible after the
 * auction closes (FR-END-12), and never followed by a next step (BR-34).
 */
export interface BidHistoryProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
}

/*
 * Gregorian calendar and Latin digits, explicitly. A bare "ar" locale picks
 * Arabic-Indic digits — and on some engines a non-Gregorian default calendar —
 * and both violate the digits rule (CLAUDE.md §3, BR-42). Display only
 * (FR-BID-23): this string is never an ordering key.
 */
const TIME_FORMAT = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", {
  dateStyle: "short",
  timeStyle: "short",
});

export function BidHistory({ auctionId }: BidHistoryProps) {
  const { snapshot } = useLiveAuction(auctionId);

  const heading = (
    <h2 id="bid-history-title" className="text-base font-bold">
      سجل المزايدات
    </h2>
  );

  /*
   * Before the first read lands — including on the server — this is a quiet
   * placeholder, not a spinner takeover: the page's server-rendered content is
   * what the viewer reads across this moment (ARCH §14.5, EC-09).
   */
  if (!snapshot) {
    return (
      <section aria-labelledby="bid-history-title">
        {heading}
        <p className="mt-2 text-sm text-ink-3">يُحمَّل السجل…</p>
      </section>
    );
  }

  if (snapshot.history.length === 0) {
    return (
      <section aria-labelledby="bid-history-title">
        {heading}
        {/* No bids is a normal state, never an error tone (BR-09's spirit). */}
        <p className="mt-2 text-sm text-ink-3">لا توجد مزايدات بعد.</p>
      </section>
    );
  }

  /*
   * Computed, not assumed. BR-03 (every bid strictly above the current price)
   * makes the newest entry the highest, so this loop lands on index 0 for any
   * history the database can produce — but hard-coding "first" as "highest"
   * would silently lie on the day that invariant breaks, and the mark exists
   * to be trusted (FR-BID-22: "highest clearly marked").
   */
  let highest = 0;
  for (let i = 1; i < snapshot.history.length; i += 1) {
    const candidate = snapshot.history[i];
    const leader = snapshot.history[highest];
    if (candidate && leader && compareSar(candidate.amount, leader.amount) > 0) {
      highest = i;
    }
  }

  return (
    <section aria-labelledby="bid-history-title">
      {heading}
      <ol className="divide-rule mt-2 divide-y">
        {snapshot.history.map((entry, i) => (
          /*
           * Keyed by content, not index: bids are append-only (BR-05) and new
           * entries arrive at the head, so an index key would re-identify
           * every existing row on each new bid.
           */
          <li
            key={`${entry.createdAt}·${entry.amount}·${entry.displayName}`}
            className="flex items-center justify-between gap-3 py-2"
          >
            <span className="min-w-0 truncate text-sm text-ink">
              {/* Isolated so a Latin display name cannot flip the line (§3). */}
              <bdi>{entry.displayName}</bdi>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {i === highest && (
                <span className="bg-brand-weak text-brand-text rounded px-1.5 py-0.5 text-xs font-bold">
                  الأعلى
                </span>
              )}
              <span className="num text-sm font-bold text-ink">
                {/* Digits inside the isolate, the indicator outside (§4.6). */}
                <bdi>{formatSar(entry.amount)}</bdi> {SAR_SUFFIX}
              </span>
              <time dateTime={entry.createdAt} className="num text-xs text-ink-3">
                <bdi>{TIME_FORMAT.format(new Date(entry.createdAt))}</bdi>
              </time>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
