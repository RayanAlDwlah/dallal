import { Card, CardBody } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { formatSarWithSuffix, type Sar } from "@/lib/money";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-17 (#59). The seller's view of their own
 * completed auction.
 *
 * TEAM.md §6 fixes the boundary this component sits on: **Rayan determines and
 * records the outcome; it is never claimed, granted or set by anyone else**
 * (BR-06, FR-SEC-07). This reads the record finalization wrote (BID-16) and
 * recomputes nothing — not the winner, not the final price, not whether there
 * were bids. Rayan's outcome banner and this view read the same row, and
 * neither derives it.
 *
 * Why a separate component from that banner at all: FR-DETAIL-21 asks for the
 * outcome "from the seller's perspective", which is a different sentence, not a
 * different fact. The seller is told what happened to *their* auction; every
 * other viewer is told who won.
 *
 * ── The zero-bid case is an OUTCOME, not an error ─────────────────────────
 *
 * BR-09, EC-05 and FR-DETAIL-19: an auction can end with no bids and no winner,
 * and that is a normal, final result. It is rendered in the same calm register
 * as a sale, never as a failure — and never as "pending" (see below), because a
 * seller told "no bids" when the winner is seconds from appearing has been told
 * something false about a record they cannot change (BR-30, BR-31).
 *
 * ── The hard boundary: NO NEXT STEP ───────────────────────────────────────
 *
 * FR-DETAIL-21a, FR-END-17a, SC-67 and PRD §19.0. This view may not present,
 * imply or link to anything that follows: no payment prompt, no "contact the
 * buyer", no shipping, no address, no "complete the sale". The product provides
 * none of them, and SAR amounts here are simulated — no money changes hands
 * (CLAUDE.md §1). **The result display is the end of the flow.** There is
 * deliberately no action of any kind in this component, and adding one is a
 * product change, not a UI improvement.
 *
 * Equally absent, and equally deliberate: no reopen, no extend, no re-run, no
 * edit, no cancel. Those are not omitted for lack of time — no such route
 * exists at any layer (BR-30, BR-31, and the immutability suite asserts it).
 */
export interface SellerOutcomeProps {
  /**
   * The winner's display name, or null when the auction ended with no bids.
   * Never an email — the read joins public.profiles, which has no email column
   * (CLAUDE.md §6, BR-26).
   */
  winnerName: string | null;
  /** Recorded at close alongside the winner, or null with no bids. */
  finalPrice: Sar | null;
  /**
   * True in the FR-END-03 window: the end time has passed but the closing sweep
   * has not recorded the outcome yet (EC-04). Distinct from "no winner", which
   * is permanent.
   */
  pending: boolean;
}

export function SellerOutcome({ winnerName, finalPrice, pending }: SellerOutcomeProps) {
  return (
    <Card as="section" aria-label="نتيجة مزادك">
      <CardBody className="gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink-3 text-xs font-bold">مزادك</h2>
          {/* FR-END-13 — the status stated plainly, before the detail. */}
          <p className="text-lg font-bold">انتهى المزاد</p>
        </div>

        {pending ? (
          /*
           * EC-04 — over, but the outcome is not recorded yet. Saying "no
           * winner" here would be wrong within seconds; saying nothing would
           * read as a broken page. So it says exactly what is true: it is over,
           * and the result is being settled. FR-DETAIL-09 and BID-17 make it
           * appear without a manual refresh once it lands.
           *
           * Byte-identical to OutcomePendingNote's sentence, and it must stay
           * that way — one fact, one wording. It no longer says «هنا»: this
           * branch is server-rendered and never retracts, so once BID-17's
           * banner lands both are on screen and a promise pointing at itself
           * would be pointing at the wrong block (@Dem4t, #128). The note's
           * header carries the full reasoning and the proposed composition fix
           * for the half that is still open — this branch has the same gap.
           */
          <p className="text-ink-2 text-sm">
            انتهى وقت المزاد، ويجري اعتماد النتيجة الآن. تظهر خلال لحظات دون الحاجة
            إلى تحديث الصفحة.
          </p>
        ) : winnerName && finalPrice ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-ink-3 text-xs font-bold">الفائز</span>
              {/* A display name may be Latin, Arabic or mixed — unisolated it
                  reorders the line around it (CLAUDE.md §3). */}
              <p className="text-base font-semibold">
                <bdi>{winnerName}</bdi>
              </p>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-ink-3 text-xs font-bold">المزايدة الأخيرة</span>
              {/* lib/money.ts is the only formatter in the product (NFR-DAT-08,
                  BR-43). Nothing here builds a price string. */}
              <Money amount={finalPrice} size="lg" />
              <span className="sr-only">{formatSarWithSuffix(finalPrice)}</span>
            </div>
          </div>
        ) : (
          /*
           * BR-09 / FR-DETAIL-19 / EC-05 — ended with no bids and no winner.
           * Stated in full rather than left as an empty region, because the
           * absence of a winner is itself the result the seller came to read.
           */
          <p className="text-ink-2 text-sm">
            انتهى المزاد دون أي مزايدة، فلا يوجد فائز ولا سعر نهائي.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
