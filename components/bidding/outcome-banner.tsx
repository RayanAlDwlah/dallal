"use client";

import { useLiveAuction } from "@/lib/bidding/use-live-auction";
import { formatSar, SAR_SUFFIX } from "@/lib/money";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Created empty by S0-13 (#22); behaviour
 * filled by BID-18 (#79), and BID-17 (#78) for the live transition — no longer
 * a stub. Mohammed owns the presentation half (TEAM.md §11, ARCHITECTURE
 * §14.6): every class and layout choice below is his to restyle without
 * asking, provided the behaviours in this header hold.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEHAVIOUR — Rayan: the outcome values and WHEN they become visible.
 * PRESENTATION — Mohammed: how the outcome reads (TEAM.md §11, §6 row "Winner
 * Display", ARCHITECTURE §14.6).
 *
 * `auctionId` is the only prop S0-13 fixes; see bid-panel.tsx for why.
 *
 * Neither owner recomputes the outcome. It is determined once by finalization
 * (BID-16) and recorded on the auction row; this banner and Mohammed's seller
 * view (AUC-17) both READ that same record (TEAM.md §6, BR-06, FR-SEC-07).
 *
 * ## WHEN it appears — and why that IS the BID-17 transition
 *
 * The banner renders nothing until the shared live store (BID-09) delivers a
 * snapshot whose STORED status is `ended`, and renders the outcome from that
 * same snapshot. `status = 'ended'` is written by `close_ended_auctions` in
 * the SAME UPDATE as winner_id, final_price and closed_at (BID-15 migration
 * §4), and that UPDATE fires the BID-08 broadcast (the trigger is AFTER
 * UPDATE on auctions — one trigger, all of §14.3). So for a viewer watching
 * an active auction, finalization commits → the cue arrives → the store
 * re-reads → ONE snapshot carries both the flip and the outcome → this banner
 * appears fully formed, with no refresh (SC-23, FR-RT-08). There is no
 * polling and no timer here, deliberately: the subscription is the mechanism,
 * and a clock-based reveal would show an outcome frame before the outcome
 * exists to be read.
 *
 * That same single-UPDATE fact is why there is no "pending" state here: an
 * `ended` snapshot is a finalized one. In the EC-04 window (end time passed,
 * sweep not yet run) the stored status is still `active`, this banner stays
 * quiet, and the page's server-rendered surfaces carry the "being finalized"
 * message where it is owed (SellerOutcome's `pending`, AUC-16's presented
 * status).
 *
 * Two data cases, not one — and the second is a normal outcome, never an
 * error:
 *   - at least one bid → winner display name and final price (FR-DETAIL-18)
 *   - no bids at all   → ended with no winner and no final price (BR-09, EC-05)
 *
 * Identity and money rules, same as bid-history.tsx: the winner's display
 * name is the ONLY identity shown (BR-26, FR-BID-22a — the projection carries
 * no internal id, structurally), isolated in `<bdi>` because it is
 * user-supplied and may be Latin; the amount renders through lib/money and
 * nothing else, digits inside a `<bdi>` isolate with `SAR` OUTSIDE it
 * (CLAUDE.md §3/§4, BR-42/43).
 *
 * And the hard boundary, which is a product decision rather than a design one:
 * this banner may NOT present, imply or link to a next step — no payment, no
 * contact control, no shipping, no "complete your purchase". The result display
 * IS the end of the flow (FR-DETAIL-21a, FR-END-17a, PRD §19.0, SC-67).
 *
 * NOT personalised: PRD G6's "the winner sees that they won" would need this
 * component to know the viewer IS the winner, and the snapshot deliberately
 * carries winnerName only — no id to compare (FR-BID-22a). Adding one is a
 * data-exposure decision, not a rendering one, and is not taken here.
 */
export interface OutcomeBannerProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
}

/*
 * A QUESTION RECORDED FOR BID-18, so it is not rediscovered then (@Dem4t,
 * #110 review): once this banner has content, the OWNER of an ended auction
 * will see the outcome twice — SellerOutcome renders FR-DETAIL-21's
 * seller-facing sentence, and this banner renders the general one. Whether
 * this banner should stay quiet for the owner, or the two should merge, is a
 * decision between Rayan (values, timing) and Mohammed (composition) to make
 * WHEN BID-18 fills this in — not silently by either.
 *
 * STATUS NOW THAT BID-18 HAS FILLED IT IN: still open, still recorded, still
 * not decided here. This banner renders for every viewer including the owner,
 * so the doubling is now the LIVE, expected state — visible, not forgotten —
 * until Rayan and Mohammed settle it together.
 */
export function OutcomeBanner({ auctionId }: OutcomeBannerProps) {
  const { snapshot } = useLiveAuction(auctionId);

  /*
   * Quiet while there is nothing to say: before the first read lands
   * (including the server render — the page's server-rendered content is the
   * bridge, ARCH §14.5) and for the whole active life of the auction. The
   * page's live regions carry the active experience; an empty outcome frame
   * on a running auction would be a placeholder box, which the stub this file
   * replaces deliberately refused to be.
   */
  if (!snapshot || snapshot.auction.status !== "ended") return null;

  const { winnerName, finalPrice, bidCount } = snapshot.auction;
  const won = winnerName !== null && finalPrice !== null;

  /*
   * ended + no winner + bids exist: unreachable per schema — finalization
   * writes the flip and the outcome in one UPDATE, and with bids present it
   * always picks a winner (BID-15 §4's LEFT JOIN LATERAL). If a snapshot ever
   * arrives shaped like this, it contradicts the record: saying "no bids"
   * would be false (bidCount says otherwise), and there is no winner to show.
   * The honest render is nothing, until the next read delivers a consistent
   * row. Guarded by bidCount, NOT assumed away.
   */
  if (!won && bidCount !== 0) return null;

  return (
    <section aria-labelledby="outcome-banner-title">
      <h2 id="outcome-banner-title" className="text-ink-3 text-xs font-bold">
        نتيجة المزاد
      </h2>
      {/* FR-END-13 — the status stated plainly, before the detail. */}
      <p className="text-lg font-bold">انتهى المزاد</p>

      {won ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-ink-3 text-xs font-bold">الفائز</span>
            <p className="min-w-0 text-base font-semibold">
              {/* Isolated so a Latin display name cannot flip the line (§3). */}
              <bdi>{winnerName}</bdi>
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-ink-3 text-xs font-bold">السعر النهائي</span>
            <p className="num text-base font-bold text-ink">
              {/* Digits inside the isolate, the indicator outside (§4.6). */}
              <bdi>{formatSar(finalPrice)}</bdi> {SAR_SUFFIX}
            </p>
          </div>
        </div>
      ) : (
        /*
         * BR-09 / EC-05 / FR-DETAIL-19 — zero bids is a real, permanent
         * outcome, stated in full and in the same calm register as a sale
         * (byte-identical to SellerOutcome's sentence, deliberately — one
         * fact, one wording). Never an empty or broken frame.
         */
        <p className="text-ink-2 mt-2 text-sm">
          انتهى المزاد دون أي مزايدة، فلا يوجد فائز ولا سعر نهائي.
        </p>
      )}
    </section>
  );
}
