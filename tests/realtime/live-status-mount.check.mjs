// ============================================================================
// BID-17 / #160 — the auction page must MOUNT the live status, and the flip
// must stay a ONE-WAY LATCH.
//
// Run:  node --no-warnings tests/realtime/live-status-mount.check.mjs
//
// Needs nothing: no database, no network, no .env.local. It reads two files
// off disk and asserts two wiring facts about them.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// It is `live-price-mount.check.mjs` again, one prop over, and deliberately
// the same shape — the defect was the same defect. `useLiveAuction`, the
// channel, the broadcast and the payload were all built and all green, and
// `app/auctions/[id]/page.tsx` rendered `StatusCountdown` with a server read
// frozen at render time. Measured on the delivery branch, 2026-08-15 12:58:22,
// auction 98ddfc1c, two open pages with `navCount === 1`: the outcome block
// arrived with the winner and the final price, the bid control disappeared,
// and the card above still read «حالة المزاد نشط». SC-23 clause 1 and
// FR-RT-08 — graded **Must** at PRD.md:1295 — were unmet on a product where
// every suite passed. CP-3 had already written it down (F-1).
//
// So five of the checks below are @Dem4t's risk from #125, restated: a later
// refactor swaps `LiveStatusCountdown` back to `StatusCountdown` "as a
// simplification", the badge freezes again, and nothing falls over. Not `tsc`
// — the props are identical by construction, which is the property that made
// the edit safe in the first place. Not `eslint`. Not one SQL suite.
//
// ---------------------------------------------------------------------------
// AND THE ONE THAT IS NOT A COPY: the latch
//
// The other simplification is worse than a freeze, and it is the one a reader
// is most likely to make, because it is shorter and it looks equivalent:
//
//     const status = snapshot?.auction.status ?? serverStatus;   // WRONG
//
// `serverStatus` is `presentedStatus()` — AUC-16's clock-derived value, which
// reads `ended` for an auction past its end time whose row still says `active`
// (FR-DETAIL-24, EC-04). The snapshot carries the STORED flag, which inside
// that window still says `active`. So the two disagree there, and `??`
// resolves it backwards: a page loaded inside the window renders «منتهي», the
// first snapshot lands, and the badge goes BACKWARDS to «نشط» on an auction
// whose time is up. A status that un-ends on screen is worse than one that
// never changed, and no type or lint rule can see the difference.
//
// Either source saying `ended` is enough and nothing takes it back. `status`
// has exactly two values (CLAUDE.md §5) and an auction never reopens, so the
// latch cannot lose information. Checks 10-12 pin the shape; check 18 runs the
// audit over the `??` version and requires it to fail.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CLAIM, SAID PLAINLY
//
//   * It does not prove a viewer SEES the badge flip. That took a browser: a
//     page open since 13:03 with `navCount === 1` and the tab BACKGROUNDED,
//     observed at 13:10:13 to carry `منتهي` with `StatusPill tone=ended`
//     alongside the zero-bid outcome line. Source text cannot show that.
//   * It does not prove the subscription delivers — `tests/realtime/*.sql`
//     and `reconnect.check.mjs` cover the channel.
//   * It reads text, so a mount behind a condition that is never true would
//     pass. Same hole, same price, as the file it mirrors.
//   * The `endsAt` checks FLIPPED — AUC-13 / #140, @m7ya505. They used to
//     assert the countdown still ran on the frozen server value, pinning a
//     carve-out so nobody settled #140 by accident from here. #140 is done, so
//     they now assert the opposite: the live value, with the server value as
//     the RT-R7 floor. Control C runs the audit over the re-frozen version and
//     requires it to fail — the carve-out was replaced, not deleted.
//   * It does not say what the viewer sees when the countdown JUMPS from
//     00:00:02 to 00:00:32. That is #146, still open, and nothing in this file
//     or the wrapper decides it.
//
// WIRED: `.github/workflows/ci.yml` names this file in the `static` job (added
// with #171). An earlier revision of this header said it was unwired; that was
// true at 1433a75, before #167 landed CI at all.
// ============================================================================
import { readFileSync } from "node:fs";

const PAGE = "app/auctions/[id]/page.tsx";
const WRAPPER = "components/bidding/live-status-countdown.tsx";

const EXPECTED = 21;
let pass = 0;
let fail = 0;

function chk(label, got, want) {
  if (got === want) {
    pass += 1;
    console.log(`PASS  ${label.padEnd(62)}  (${got})`);
  } else {
    fail += 1;
    console.log(`FAIL  ${label.padEnd(62)}  got=${got}  want=${want}`);
  }
}

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    console.log(`!! cannot read ${path} — the file moved, which is itself the failure`);
    process.exit(1);
  }
}

/**
 * Both files discuss `StatusCountdown` and `??` by name at length — they
 * should; that is where the reasoning lives. Reasoning about a shape is not
 * writing it, so strip comments before asking what the file does.
 */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // the [^:] keeps https:// intact
}

/**
 * One audit function, so the controls below run the IDENTICAL logic over
 * mutated text. Two copies of the rules would let a control pass while the
 * real check rots.
 */
function auditPage(text) {
  const src = code(text);
  return {
    importsLive:
      /import\s*\{[^}]*\bLiveStatusCountdown\b[^}]*\}\s*from\s*["'][^"']*bidding\/live-status-countdown["']/.test(src),
    rendersLive: /<LiveStatusCountdown[\s/>]/.test(src),
    passesAuctionId: /<LiveStatusCountdown\b[^>]*\bauctionId=/s.test(src),
    rendersBareCountdown: /<StatusCountdown[\s/>]/.test(src),
    importsBareCountdown:
      /import\s*\{[^}]*\bStatusCountdown\b[^}]*\}\s*from\s*["'][^"']*detail\/status-countdown["']/.test(src),
  };
}

function auditWrapper(text) {
  const src = code(text);
  return {
    isClient: /^\s*["']use client["']/.test(src),
    subscribes: /\buseLiveAuction\s*\(/.test(src),
    rendersMohammedsCountdown: /<StatusCountdown[\s/>]/.test(src),
    // Both sources are consulted, and `ended` wins from either one.
    latchReadsServer: /serverStatus\s*===\s*["']ended["']/.test(src),
    latchReadsSnapshot: /snapshot\?\.auction\.status\s*===\s*["']ended["']/.test(src),
    latchIsOr: /===\s*["']ended["']\s*\|\|/.test(src),
    // The plausible, shorter, WRONG version.
    coalescesStatus: /snapshot\?\.auction\.status\s*\?\?/.test(src),
    // AUC-13 / #140. These two flipped when the carve-out was lifted: `endsAt`
    // now comes from the snapshot, with the server value as the RT-R7 floor.
    frozenServerEndsAt: /endsAt=\{endsAt\}/.test(src),
    takesEndsAtFromSnapshot: /endsAt=\{[^}]*snapshot\?\.auction\.endsAt/.test(src),
    // The fallback is half the rule. Taking the snapshot value ALONE renders a
    // blank countdown until the first cue arrives, which RT-R7 forbids.
    fallsBackToServerEndsAt: /endsAt=\{[^}]*snapshot\?\.auction\.endsAt\s*\?\?\s*endsAt\s*\}/.test(src),
  };
}

const pageText = read(PAGE);
const wrapperText = read(WRAPPER);

// --------------------------------------------------------------------------
// 1-5. The page. This is the half that regressed, and the half a refactor
// touches.
// --------------------------------------------------------------------------
const page = auditPage(pageText);
console.log(`\n-- ${PAGE} --`);
chk("imports LiveStatusCountdown", page.importsLive, true);
chk("renders <LiveStatusCountdown>", page.rendersLive, true);
chk("passes it an auctionId — without it nothing subscribes", page.passesAuctionId, true);
chk("does NOT render <StatusCountdown> directly (the frozen path)", page.rendersBareCountdown, false);
chk("does NOT import status-countdown directly either", page.importsBareCountdown, false);

// --------------------------------------------------------------------------
// 6-14. The wrapper. Mounting a component that stopped subscribing is the
// same freeze wearing the right name — and a wrapper that subscribes but
// resolves the two sources with `??` is worse than the freeze.
// --------------------------------------------------------------------------
const wrapper = auditWrapper(wrapperText);
console.log(`\n-- ${WRAPPER} --`);
chk("is a client component", wrapper.isClient, true);
chk("subscribes via useLiveAuction", wrapper.subscribes, true);
chk("renders Mohammed's StatusCountdown — presentation unchanged", wrapper.rendersMohammedsCountdown, true);
chk("the latch reads the server status", wrapper.latchReadsServer, true);
chk("the latch reads the live snapshot too", wrapper.latchReadsSnapshot, true);
chk("the two are joined by || — ended is one-way", wrapper.latchIsOr, true);
chk("does NOT ?? the snapshot over the server (the un-ending badge)", wrapper.coalescesStatus, false);
chk("takes endsAt from the snapshot — AUC-13 / #140", wrapper.takesEndsAtFromSnapshot, true);
chk("falls back to the server endsAt (RT-R7 — never a blank)", wrapper.fallsBackToServerEndsAt, true);
chk("does NOT forward the frozen server endsAt alone (the #140 defect)", wrapper.frozenServerEndsAt, false);

// --------------------------------------------------------------------------
// 15-18. THE CONTROLS. Two regressions, each applied to real text and each
// required to be caught. The odd-numbered check of each pair guards the
// mutation itself: a probe that edited nothing would make its partner pass
// for no reason at all.
// --------------------------------------------------------------------------
console.log("\n-- control A: the 'simplification' back to the frozen prop --");
const frozen = pageText
  .replace(/<LiveStatusCountdown/g, "<StatusCountdown")
  .replace(/<\/LiveStatusCountdown/g, "</StatusCountdown")
  .replace(/\bLiveStatusCountdown\b/g, "StatusCountdown")
  .replace(/bidding\/live-status-countdown/g, "auction/detail/status-countdown");
chk("the mutation actually changed the source", frozen !== pageText, true);

const afterFrozen = auditPage(frozen);
chk(
  "swapping LiveStatusCountdown back FAILS the audit",
  !afterFrozen.importsLive ||
    !afterFrozen.rendersLive ||
    afterFrozen.rendersBareCountdown ||
    afterFrozen.importsBareCountdown,
  true,
);

console.log("\n-- control B: the shorter latch that un-ends the badge --");
const coalesced = wrapperText.replace(
  /const\s+ended\s*=[\s\S]*?;/,
  'const status = snapshot?.auction.status ?? serverStatus;\n  const ended = status === "ended";',
);
chk("the mutation actually changed the source", coalesced !== wrapperText, true);

const afterCoalesced = auditWrapper(coalesced);
chk(
  "resolving with ?? instead of || FAILS the audit",
  afterCoalesced.coalescesStatus || !afterCoalesced.latchIsOr || !afterCoalesced.latchReadsSnapshot,
  true,
);

// AUC-13 / #140. The regression this one models is the likeliest of all: the
// live value is one expression, and "simplifying" it back to the bare prop
// reads as tidying. It is the defect the issue was opened for.
console.log("\n-- control C: the countdown re-frozen on the server endsAt (#140) --");
const refrozen = wrapperText.replace(
  /endsAt=\{snapshot\?\.auction\.endsAt\s*\?\?\s*endsAt\}/,
  "endsAt={endsAt}",
);
chk("the mutation actually changed the source", refrozen !== wrapperText, true);

const afterRefrozen = auditWrapper(refrozen);
chk(
  "re-freezing endsAt on the server value FAILS the audit",
  !afterRefrozen.takesEndsAtFromSnapshot ||
    !afterRefrozen.fallsBackToServerEndsAt ||
    afterRefrozen.frozenServerEndsAt,
  true,
);

// --------------------------------------------------------------------------
// A run that exits 0 having asserted nothing is the failure this project keeps
// meeting — every harness here carries this guard.
// --------------------------------------------------------------------------
console.log("");
const reached = pass + fail;
if (reached !== EXPECTED) {
  fail += 1;
  console.log(`FAIL  only ${reached} of ${EXPECTED} checks ran — the harness stopped early`);
}
console.log(
  `\n${fail === 0 ? "BID-17 status mount: PASS" : `BID-17 status mount: FAIL — ${fail} check(s)`}  (${pass}/${reached})`,
);
process.exit(fail === 0 ? 0 : 1);
