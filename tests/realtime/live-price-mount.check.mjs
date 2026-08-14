// ============================================================================
// BID-09 / #125 — the auction page must MOUNT the live price region.
//
// Run:  node --no-warnings tests/realtime/live-price-mount.check.mjs
//
// Needs nothing: no database, no network, no .env.local. It reads two files
// off disk and asserts a wiring fact about them.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS — the defect class it guards, not the bug it followed
//
// The bug in #125 was not a wrong line. `useLiveAuction`, the channel, the
// broadcast trigger and the payload were all built, all tested, all green —
// and `app/auctions/[id]/page.tsx` rendered `PriceRegion` with a server read
// frozen at render time. A whole mechanism, correct and consumed by nobody.
// FR-RT-03, FR-RT-05, RT-P1, RT-X1 were unmet on the deployed product while
// every suite passed.
//
// @Dem4t named the risk when he approved the fix: a later refactor swaps
// `LivePriceRegion` back to `PriceRegion` "as a simplification", the price
// freezes again, and NOTHING falls over. Not `tsc` — the props are identical
// by construction, which is the very property that made the edit safe. Not
// `eslint`. Not a single SQL suite. The regression is invisible to every
// gate this repository has.
//
// So the gate is here, and it is deliberately the cheapest possible shape:
// does the page mount the live component, and does the live component still
// subscribe. That is the entire question. It is a source-level assertion, not
// a render — rendering the page would need a React tree, a Supabase browser
// client and a `document`, and would test far more than the one fact that
// keeps silently going wrong.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CLAIM, SAID PLAINLY
//
//   * It does not prove a viewer SEES a new price. That needs two browsers
//     and it is INT-02 (#91), not this.
//   * It does not prove the subscription delivers. `tests/realtime/*.sql` and
//     `reconnect.check.mjs` cover the channel; this covers the wire between
//     that channel and the screen.
//   * It reads text. A page that mounts the component behind a condition that
//     is never true would pass here. That is a real hole and it is the price
//     of not booting React; the check below asserts the mount is
//     unconditional in the only sense text can — the element is present and
//     the auction id reaches it.
//
// Check 11 is the point of the file: it runs the same audit over a copy of
// the page with the exact regression applied, and requires it to FAIL. An
// assertion that has never been seen to fail is not yet an assertion (#130).
// ============================================================================
import { readFileSync } from "node:fs";

const PAGE = "app/auctions/[id]/page.tsx";
const WRAPPER = "components/bidding/live-price-region.tsx";

const EXPECTED = 12;
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
 * Comments discuss `PriceRegion` by name — `page.tsx` says so at length, and
 * it should. Reasoning about a component is not rendering it, so strip
 * comments before asking what the file renders. `{/* … *​/}` is a JSX comment
 * wrapping a block comment, so the block rule covers both.
 */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // the [^:] keeps https:// intact
}

/**
 * The whole audit, as one function, so the control below can run the
 * IDENTICAL logic over mutated text. Two copies of the rules would let the
 * control pass while the real check rots.
 */
function auditPage(text) {
  const src = code(text);
  return {
    importsLive: /import\s*\{[^}]*\bLivePriceRegion\b[^}]*\}\s*from\s*["'][^"']*bidding\/live-price-region["']/.test(src),
    rendersLive: /<LivePriceRegion[\s/>]/.test(src),
    passesAuctionId: /<LivePriceRegion\b[^>]*\bauctionId=/s.test(src),
    rendersBareRegion: /<PriceRegion[\s/>]/.test(src),
    importsBareRegion: /import\s*\{[^}]*\bPriceRegion\b[^}]*\}\s*from\s*["'][^"']*detail\/price-region["']/.test(src),
  };
}

function auditWrapper(text) {
  const src = code(text);
  return {
    isClient: /^\s*["']use client["']/.test(src),
    subscribes: /\buseLiveAuction\s*\(/.test(src),
    rendersMohammedsRegion: /<PriceRegion[\s/>]/.test(src),
    livePrice: /currentPrice=\{[^}]*snapshot[^}]*\}/.test(src),
    liveBidCount: /bidCount=\{[^}]*snapshot[^}]*\}/.test(src),
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
chk("imports LivePriceRegion", page.importsLive, true);
chk("renders <LivePriceRegion>", page.rendersLive, true);
chk("passes it an auctionId — without it nothing subscribes", page.passesAuctionId, true);
chk("does NOT render <PriceRegion> directly (the frozen path)", page.rendersBareRegion, false);
chk("does NOT import price-region directly either", page.importsBareRegion, false);

// --------------------------------------------------------------------------
// 6-10. The wrapper. Mounting a component that stopped subscribing is the
// same freeze wearing the right name.
// --------------------------------------------------------------------------
const wrapper = auditWrapper(wrapperText);
console.log(`\n-- ${WRAPPER} --`);
chk("is a client component", wrapper.isClient, true);
chk("subscribes via useLiveAuction", wrapper.subscribes, true);
chk("renders Mohammed's PriceRegion — presentation unchanged", wrapper.rendersMohammedsRegion, true);
chk("currentPrice prefers the live snapshot", wrapper.livePrice, true);
chk("bidCount prefers the live snapshot", wrapper.liveBidCount, true);

// --------------------------------------------------------------------------
// 11-12. THE CONTROL. Apply the exact regression @Dem4t described — swap the
// live component back for the plain one — and require the audit above to
// notice. Check 12 guards the control itself: a mutation that changed nothing
// would make 11 pass for no reason.
// --------------------------------------------------------------------------
console.log("\n-- control: the 'simplification' that must be caught --");
const regressed = pageText
  .replace(/<LivePriceRegion/g, "<PriceRegion")
  .replace(/<\/LivePriceRegion/g, "</PriceRegion")
  .replace(/\bLivePriceRegion\b/g, "PriceRegion")
  .replace(/bidding\/live-price-region/g, "auction/detail/price-region");
chk("the mutation actually changed the source", regressed !== pageText, true);

const after = auditPage(regressed);
const caught = !after.importsLive || !after.rendersLive || after.rendersBareRegion || after.importsBareRegion;
chk("swapping LivePriceRegion back for PriceRegion FAILS the audit", caught, true);

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
console.log(`\n${fail === 0 ? "BID-09 mount: PASS" : `BID-09 mount: FAIL — ${fail} check(s)`}  (${pass}/${reached})`);
process.exit(fail === 0 ? 0 : 1);
