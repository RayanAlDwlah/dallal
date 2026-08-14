import { Alert } from "@/components/ui/alert";

/**
 * MOHAMMED'S FILE — `@m7ya505`. Created empty by S0-13 (#22); filled by
 * AUC-13 (#55). The status label and the live countdown.
 *
 * Presentation is Mohammed's; the status VALUE and the moment it changes are
 * Rayan's, arriving from finalization and his subscription (ARCHITECTURE §14.6,
 * BID-15/BID-17). This region displays them and derives neither.
 *
 * ── The end time MOVES. Build for that from the first line. ────────────────
 *
 * BR-36 was REVERSED on 2026-08-13 (CLAUDE.md §5, ARCHITECTURE §15.2). A bid
 * ACCEPTED in the final 15 seconds extends end_time by exactly 30 seconds,
 * repeating, to a hard cap of 20 extensions. Any document still saying the end
 * time is fixed is stale — including the doc comment on components/auction/
 * countdown.tsx, which this issue's sibling AUC-13 corrects.
 *
 * The consequence for AUC-13 is concrete: the countdown must FOLLOW the
 * server-supplied end time when it moves, and must never freeze on a value read
 * once at mount (RT-P3). components/auction/countdown.tsx already re-derives on
 * every change to `endsAt`, so the requirement is met by passing it a fresh
 * value — not by adding a subscription here. One per-auction subscription is
 * owned upstream; a second is a competing update mechanism (TEAM.md §10.4).
 *
 * ── Two more things AUC-13 owes ────────────────────────────────────────────
 *
 *   - the absolute end time in the VIEWER'S local timezone with the zone made
 *     explicit (NFR-USA-07, FR-DETAIL-08).
 *   - Western digits, always. `ar-SA` alone resolves to Arabic-Indic numerals;
 *     the fix is the `-u-nu-latn` extension, as countdown.tsx already does
 *     (BR-42, CLAUDE.md §3).
 *
 * And what this region must NOT do: decide bid eligibility. That is settled on
 * the server against clock_timestamp(), never by a rendered status or a client
 * clock (LC-03, BR-19, EC-17). A countdown that is a second out cannot corrupt
 * an outcome, and that is by design.
 */
export function StatusCountdown() {
  return (
    <Alert tone="info" title="الحالة والوقت المتبقي">
      <p>
        منطقة عرض فارغة من <span className="num">S0-13</span>. الحالة والعدّاد
        ضمن <span className="num">AUC-13</span>.
      </p>
    </Alert>
  );
}
