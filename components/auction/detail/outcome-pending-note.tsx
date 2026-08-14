import { Card, CardBody } from "@/components/ui/card";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-16 (#58), completing EC-04 for viewers who
 * are not the seller.
 *
 * ── The gap this closes ───────────────────────────────────────────────────
 *
 * EC-04 does not scope its requirement to the seller:
 *
 *   > If not yet (within the 30 s window) → status shown as ended WITH THE
 *   > OUTCOME MARKED AS BEING FINALIZED, and it appears without a manual
 *   > refresh once available.
 *
 * #110 delivered that sentence only inside SellerOutcome, which is gated
 * `ended && role === "owner"`. So in the FR-END-03 window — end time passed,
 * closing sweep not yet run — a non-owner saw the status flip to «منتهي»
 * (AUC-16's presented status), the bid control disappear (AUC-15), and then
 * nothing at all where the outcome belongs. Half the requirement, for most of
 * the audience.
 *
 * @RayanAlDwlah's BID-17 banner is correctly quiet in this window and must stay
 * quiet: it renders from the STORED status, and `status = 'ended'` is written
 * in the same UPDATE as the winner and the final price, so an `ended` snapshot
 * is a finalized one. There is nothing for it to say yet. The window belongs to
 * the server render, which is this.
 *
 * ── Why the wording is byte-identical to SellerOutcome's ──────────────────
 *
 * One fact, one sentence. The seller and a bidder are being told exactly the
 * same thing here — the auction is over and the result is being settled — and
 * only the OUTCOME itself differs by viewer (FR-DETAIL-21 vs FR-DETAIL-18).
 * Two wordings for one state would be two things to keep in step.
 *
 * ── What it must never say ────────────────────────────────────────────────
 *
 * Not "no winner", and not "no bids". Those are permanent outcomes (BR-09,
 * EC-05) and this state is temporary; saying either would be false within
 * seconds, about a record nobody can change (BR-30, BR-31). And no next step,
 * for the same reason the outcome views have none (FR-DETAIL-21a, SC-67).
 */
export function OutcomePendingNote() {
  return (
    <Card as="section" aria-label="نتيجة المزاد">
      <CardBody className="gap-1">
        <h2 className="text-ink-3 text-xs font-bold">نتيجة المزاد</h2>
        <p className="text-lg font-bold">انتهى المزاد</p>
        <p className="text-ink-2 text-sm">
          انتهى وقت المزاد، ويجري اعتماد النتيجة الآن. ستظهر هنا خلال لحظات دون
          الحاجة إلى تحديث الصفحة.
        </p>
      </CardBody>
    </Card>
  );
}
