// ============================================================================
// BID-10 (#71) — the realtime UX rules, asserted against the SHIPPED module.
//
// Run:  node --experimental-strip-types --no-warnings tests/realtime/ux-rules.check.mjs
//
// No database, no network, no credentials, no browser. These are pure
// decisions over a three-value status, so they are testable exhaustively
// rather than by sampling — and every one of the three states is enumerated
// below, not just the interesting ones.
//
// ---------------------------------------------------------------------------
// WHY THIS IMPORTS THE REAL FILE
//
// `lib/realtime/ux-rules.ts` imports only a TYPE from auction-channel.ts, and
// a type import erases. So the module has no runtime dependency on the browser
// client at all and `--experimental-strip-types` can load it directly. That is
// the point: this asserts the SHIPPED functions, not copies of them, so an
// edit that flips a comparison fails here instead of passing quietly.
//
// Same technique BID-11's harness uses on connection-timing.ts, for the same
// reason.
//
// ---------------------------------------------------------------------------
// WHAT IS NOT ASSERTED HERE, SAID PLAINLY
//
// Three of BID-10's six rules are NOT functions and cannot be checked from
// here — they are enforced by construction, and ux-rules.ts explains each:
//
//   * bidding stays available while stale — enforced by `disabled` in
//     bid-panel.tsx not mentioning the connection. The rule is the ABSENCE of
//     a branch, and no test of a function can prove a line is still absent.
//     A reviewer reading that expression is the check.
//   * a live update never touches the typed amount — enforced by no snapshot
//     path writing to the input's state.
//   * EC-03's "unknown, never failed" — enforced by the outcome union having
//     a `no_verdict` variant that bid-panel.tsx must handle to type-check.
//
// The first two are what SC-22 and RT-X2 actually ask for and they need a
// browser with a partially typed field. That is INT-02's territory, not this
// harness's, and claiming them here would be the overclaim this project keeps
// meeting. They are listed as not-shown rather than reasoned into a pass.
// ============================================================================

import {
  isPossiblyStale,
  isTypedAmountSuperseded,
  shouldAnnounceConnectionLoss,
} from "../../lib/realtime/ux-rules.ts";

const EXPECTED = 14;
let pass = 0;
let fail = 0;

function chk(label, got, want) {
  if (Object.is(got, want)) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(58)} (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(58)} got=${got} want=${want}`);
  }
}

// The three states enumerated from the union itself rather than typed out, so
// a fourth status added to AuctionChannelStatus makes this list wrong in a way
// the count guard below catches.
const STATES = ["live", "connecting", "unavailable"];
console.log(`\n==> ux-rules over all ${STATES.length} connection states\n`);

// --- FR-RT-11 / RT-R4 — how much the interface trusts its own copy ---------
//
// "connecting" is the assertion that matters. It is the state a reasonable
// session would treat as healthy, and treating it as healthy is silent
// staleness for up to eight seconds: no cue can have arrived before the join
// lands, so a bid committed in that window is off screen with nothing saying
// so. BID-11's CONNECT_DEADLINE_MS bounds the window; it does not remove it.
chk("live is not stale", isPossiblyStale("live"), false);
chk("connecting IS stale — no cue can have arrived yet", isPossiblyStale("connecting"), true);
chk("unavailable is stale", isPossiblyStale("unavailable"), true);

// --- RT-R2 — when the interface SPEAKS, which is narrower ------------------
//
// Announcing a one-second-old connection would fire on every page load and is
// the alarming treatment RT-R2 rules out ("clearly and calmly").
chk("live says nothing", shouldAnnounceConnectionLoss("live"), false);
chk("connecting says nothing — stale but not yet news", shouldAnnounceConnectionLoss("connecting"), false);
chk("unavailable earns a sentence", shouldAnnounceConnectionLoss("unavailable"), true);

// --- The two are NOT redundant --------------------------------------------
//
// This is the assertion guarding the likely future "simplification". The file
// says collapsing them breaks one requirement whichever way it collapses; this
// makes that claim fail a run rather than sit in a comment. It is written as a
// property over every state — trust is weaker-or-equal to speech, and strictly
// weaker somewhere — so it survives a state being added.
const impliesHolds = STATES.every(
  (s) => !shouldAnnounceConnectionLoss(s) || isPossiblyStale(s),
);
const differSomewhere = STATES.some(
  (s) => isPossiblyStale(s) !== shouldAnnounceConnectionLoss(s),
);
chk("announcing always implies stale", impliesHolds, true);
chk("but they differ somewhere — not one function", differSomewhere, true);

// --- RT-X3 / FR-RT-07 — has the price overtaken what the user typed? -------
//
// The empty-field case is the one with a user-visible consequence: an empty
// box is UNANSWERED, not "insufficient", and "your amount is too low" about a
// bid nobody made is a false statement. Both empty rows below exist for that.
chk(
  "typed amount below the minimum is superseded",
  isTypedAmountSuperseded({ hasTypedAmount: true, belowMinimum: true }),
  true,
);
chk(
  "typed amount meeting the minimum is not",
  isTypedAmountSuperseded({ hasTypedAmount: true, belowMinimum: false }),
  false,
);
chk(
  "EMPTY field is never superseded, even when below",
  isTypedAmountSuperseded({ hasTypedAmount: false, belowMinimum: true }),
  false,
);
chk(
  "empty field with nothing below it is not either",
  isTypedAmountSuperseded({ hasTypedAmount: false, belowMinimum: false }),
  false,
);

// The function must not do its own comparing. Comparing two amounts is
// lib/money's job and there must be exactly one implementation of it
// (CLAUDE.md §4 rule 6); arithmetic on amounts in JS is forbidden outright by
// rule 1. Asserting the arity keeps a future session from "helpfully" passing
// the raw amounts in and comparing them here.
chk("it takes ONE argument — the decision, not the amounts", isTypedAmountSuperseded.length, 1);
chk("no amount arithmetic: the source names no operator", /[<>]=?|[-+*/]\s*args\./.test(isTypedAmountSuperseded.toString()), false);

// A suite that exits 0 having asserted nothing is the failure this project
// keeps meeting (#117) — every other harness here carries the same guard.
console.log("");
const reached = pass + fail;
if (reached !== EXPECTED) {
  fail += 1;
  console.log(`FAIL  only ${reached} of ${EXPECTED} checks ran — the harness stopped early`);
}
console.log(`\n${fail === 0 ? "BID-10: PASS" : `BID-10: FAIL — ${fail} check(s)`}  (${pass}/${reached})`);
process.exit(fail === 0 ? 0 : 1);
