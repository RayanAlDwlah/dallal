"use client";

import { Alert } from "@/components/ui/alert";
import { Money } from "@/components/ui/money";
import { useLiveAuction } from "@/lib/bidding/use-live-auction";

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
 * Identity and money rules: the winner's display name is the ONLY identity
 * shown (BR-26, FR-BID-22a — the projection carries no internal id,
 * structurally), isolated in `<bdi>` because it is user-supplied and may be
 * Latin; the amount renders through the `Money` component, which is the
 * product's single display path for a price (NFR-DAT-08) and therefore the
 * only place the isolate, the `SAR` placement and the overflow containment
 * are decided once (CLAUDE.md §3/§4, BR-42/43).
 *
 * And the hard boundary, which is a product decision rather than a design one:
 * this banner may NOT present, imply or link to a next step — no payment, no
 * contact control, no shipping, no "complete your purchase". The result display
 * IS the end of the flow (FR-DETAIL-21a, FR-END-17a, PRD §19.0, SC-67).
 *
 * PERSONALISED NOW — BID-18 / #161, FR-END-14 and SC-36, both **Must**.
 *
 * This paragraph used to say the component could not know the viewer is the
 * winner, and that was true: the snapshot carries `winnerName` and no id to
 * compare (FR-BID-22a), and inventing one here would have been a data-exposure
 * decision taken in a rendering file.
 *
 * It still is not taken here. What arrives is `viewerDisplayName` — read from
 * the verified server session by `getViewer()` (identity, @Dem4t) — and the
 * comparison happens below against the LIVE snapshot's `winnerName`, not
 * against a value frozen at render. The distinction is the whole point: an
 * auction that ends UNDER the viewer delivers its winner through the
 * subscription (BID-17), and a boolean decided at server-render time would be
 * false forever on exactly that path — the frozen-prop defect this repository
 * has now shipped three times (#138, #140, #160). Display name is the one
 * public identity (CLAUDE.md §6) and is unique (BR-39), so the comparison is
 * sound; no internal identifier enters any payload — FR-BID-22a and #166 are
 * untouched by this file. The rendering half asks the question; the identity
 * half answers it with a name the server already vouched for.
 */
export interface OutcomeBannerProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
  /**
   * The verified session's public display name, or null for a visitor
   * (`CLAUDE.md` §6 — identity is never taken from the client). Read
   * server-side by the page and passed in; this file never fetches it.
   *
   * Optional and defaulting to null on purpose: every other viewer — seller,
   * losing bidder, signed-out visitor — renders exactly what they rendered
   * before, so the shared record below is unchanged for them (FR-END-16).
   */
  viewerDisplayName?: string | null;
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
export function OutcomeBanner({ auctionId, viewerDisplayName = null }: OutcomeBannerProps) {
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
   * IDENTITY HALF (@Dem4t). Compared against the LIVE winnerName — the
   * snapshot's, never a value frozen at server render — so an auction ending
   * under the viewer personalises on the same update that flips the status
   * (BID-17), with no reload. Both operands are display names: unique (BR-39),
   * the only public identity (CLAUDE.md §6), no internal id involved
   * (FR-BID-22a). Null viewer → false → the shared record, unchanged.
   */
  const viewerIsWinner = viewerDisplayName !== null && winnerName === viewerDisplayName;

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
          {/*
           * FR-END-14 / SC-36 — BOTH graded Must, and both unmet until now:
           * naming the winner is not telling the viewer they ARE the winner.
           * cp3_winner had to recognise their own display name and infer it,
           * from a block byte-identical to the seller's and a passer-by's.
           *
           * ADDED ABOVE THE RECORD, REPLACING NOTHING. Swapping the `الفائز`
           * row out for the winner would fix FR-END-14 by breaking FR-END-16,
           * which requires ANY viewer — the winner included — to see the winner
           * and the final price. So the shared record stays whole for everyone
           * and the winner gains a sentence addressed to them.
           *
           * `Alert tone="success"` rather than bespoke markup: it already
           * carries `role="status"` and `aria-live="polite"`, which is exactly
           * right here — this block can appear WHILE the viewer is watching
           * (BID-17), and a win that only exists visually is not a statement to
           * a screen-reader user. Reusing the primitive also keeps the tone
           * inside the design system instead of inventing a green.
           *
           * ⚠️ SC-67 / BR-34 / FR-END-17a — the wording is deliberately a
           * STATEMENT OF FACT and nothing else. No payment, no contact, no
           * collection, no shipping, no "what happens next", because none of
           * those exist: SAR amounts are simulated and no money moves. The
           * price is named as `مزايدتك الفائزة` — what they bid — rather than
           * anything owed, for the same reason.
           */}
          {viewerIsWinner ? (
            <Alert tone="success">
              <p className="text-base font-bold">
                {/* Decorative: a screen reader announcing "party popper" before
                    the sentence would bury the sentence. */}
                <span aria-hidden="true">🎉 </span>
                فزت بهذا المزاد
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1">
                <span>مزايدتك الفائزة</span>
                {/* Through `Money` — never a hand-rolled island. BR-21 puts no
                    ceiling on this value, and `Money` is the only path carrying
                    the scrollable digit island (NFR-DAT-08, CLAUDE.md §4.6). */}
                <Money amount={finalPrice} size="md" />
              </p>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-0.5">
            <span className="text-ink-3 text-xs font-bold">الفائز</span>
            <p className="min-w-0 text-base font-semibold">
              {/* Isolated so a Latin display name cannot flip the line (§3). */}
              <bdi>{winnerName}</bdi>
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-ink-3 text-xs font-bold">السعر النهائي</span>
            {/*
             * Through `Money`, not hand-rolled markup — @Dem4t's blocking
             * finding on #122. The FORMAT was already canonical either way;
             * what the hand-rolled `<bdi>` could not inherit is CONTAINMENT.
             * `overflow` does not apply to an inline box, so a legal 30-digit
             * amount (no maximum price — BR-21, SEC-R3) escaped its column and
             * pushed the document to 1871px, measured by @m7ya505 on #120.
             * `Money` is the one display path that carries the scrollable
             * digit island (NFR-DAT-08); every bypass of it re-opens that hole.
             *
             * SIZE IS NOT MINE TO SETTLE, and the two reviewers wrote different
             * words: @Dem4t asked for `lg` — matching SellerOutcome, which
             * renders THIS SAME VALUE in the adjacent block on this page —
             * while @m7ya505's option (a) said `sm` for a two-file follow-up
             * that also covered bid-history. Presentation is @m7ya505's, wholly
             * (CLAUDE.md §1), so `lg` is here only because it is the only
             * variant argued for THIS file, and one word changes it without
             * asking me.
             */}
            <Money amount={finalPrice} size="lg" />
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
