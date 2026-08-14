import type { AuctionDetail, AuctionStatus } from "./detail";

/**
 * AUC-16 (#58) — the status an auction is PRESENTED as, which is not always the
 * status stored on its row.
 *
 * FR-DETAIL-24 and EC-04: an auction whose end time has passed must be shown as
 * ended **even before close processing has run**. The closing sweep runs on a
 * schedule (BID-15, FR-END-03 allows up to 30 seconds), so there is a real
 * window in which `status` still reads `active` while the auction is over. A
 * page that rendered the stored flag would offer a bid control, a live
 * countdown and an "active" badge on an auction that can no longer take a bid.
 *
 * ── This is presentation, and ONLY presentation ────────────────────────────
 *
 * It decides nothing. Bid eligibility is settled inside the database against
 * clock_timestamp() within the row lock, and a bid arriving after the end time
 * is rejected whatever this function returned (LC-03, PRD §13 step 4, EC-04).
 * That separation is what makes it safe to compute a lifecycle state here at
 * all: the worst a wrong answer can do is draw the wrong thing for one render.
 *
 * The clock is the SERVER's, carried from the same read as the row (BR-19,
 * EC-17). Never `Date.now()` — a viewer whose device clock is a day fast would
 * otherwise see every auction on the site as ended.
 *
 * ── Why it is a separate module ────────────────────────────────────────────
 *
 * lib/auctions/detail.ts states in its own header that it derives no
 * presentation status, because AUC-11 deliberately left this decision to
 * AUC-16. Keeping the derivation out of the read module keeps that true: the
 * record stays a faithful copy of the row, and exactly one function in the
 * codebase turns "the row says active" into "draw it as ended".
 */

/**
 * `ended` when the row says so, OR when the server clock has passed the end
 * time. Never the reverse: a row marked `ended` is terminal (BR-15) and no
 * clock reading brings it back.
 */
export function presentedStatus(
  auction: Pick<AuctionDetail, "status" | "endsAt">,
  serverNow: string,
): AuctionStatus {
  if (auction.status === "ended") return "ended";
  return Date.parse(auction.endsAt) <= Date.parse(serverNow) ? "ended" : "active";
}

/**
 * True for an auction that is over but whose outcome has not been recorded yet
 * — the FR-END-03 window between the end time and the closing sweep.
 *
 * EC-04 asks for this state to be shown as "ended, outcome being finalized"
 * rather than as "ended with no winner", which is a DIFFERENT and permanent
 * outcome (BR-09). Presenting the first as the second would tell a seller their
 * auction drew no bids seconds before the winner appears.
 *
 * Derived from `closedAt` rather than from `status`, because `closedAt` is
 * written in the same transaction as the winner and the final price
 * (FR-END-08): if it is set, the outcome is complete; if it is not, there is
 * nothing to report yet.
 */
export function outcomePending(
  auction: Pick<AuctionDetail, "status" | "endsAt" | "closedAt">,
  serverNow: string,
): boolean {
  return presentedStatus(auction, serverNow) === "ended" && auction.closedAt === null;
}
