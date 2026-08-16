// ============================================================================
// BID-18 / #161 — the WINNER must be told they won, and told the amount.
//
// Run:  node --no-warnings tests/auction/winner-statement.check.mjs
//
// Needs nothing: no database, no network, no browser. It reads one file.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// FR-END-14 (PRD.md:724) and SC-36 (PRD.md:1701) are both graded **Must**, and
// both had zero implementation. Measured in CP-3: cp3_winner won auction
// 2976b00b at 1,250.75 SAR with the page open, and the block that appeared was
// byte-identical to the one the seller and an uninvolved third viewer saw:
//
//     نتيجة المزاد · انتهى المزاد · الفائز cp3_winner · السعر النهائي 1,250.75 SAR
//
// Naming the winner is not telling the viewer they ARE the winner. They had to
// recognise their own display name and infer it.
//
// PRD.md:1476 asserts this is already surfaced in-page. That sentence is false
// as measured, and it is the reason FR-END-14 could pass as covered while
// nothing covered it — which is exactly why the rule now has a check instead of
// a paragraph.
//
// ---------------------------------------------------------------------------
// SCOPE — this asserts the RENDERING half only
//
// `viewerIsWinner` is decided server-side from the verified session and passed
// in (CLAUDE.md §6). Whether the page COMPUTES and passes it is Rayan's half
// and belongs to his suite, not this one: asserting it here would put a check
// on someone else's unlanded work and go red for a reason this file cannot fix.
//
// What this file holds is that the presentation exists, is gated, renders money
// through the one display path, and stays inside SC-67.
//
// ---------------------------------------------------------------------------
// COMMENTS ARE STRIPPED FIRST, and here that is not a nicety
//
// Check 6 asserts the rendered text never offers payment, contact, collection
// or shipping (SC-67, BR-34, FR-END-17a). The component's own header explains
// that prohibition BY NAMING EVERY ONE OF THOSE WORDS. A raw grep would flag
// the file for documenting the rule it obeys — the precise failure INT-08 and
// tests/guards/run.sh both already paid for.
// ============================================================================
import { readFileSync } from "node:fs";

const BANNER = "components/bidding/outcome-banner.tsx";

const EXPECTED = 22;
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

function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // the [^:] keeps https:// intact
}

/**
 * The winner block ALONE, not the whole file.
 *
 * The first version of check 6 asked "does the file contain `<Money
 * amount={finalPrice}>`?" and it passed even with the statement's amount
 * hand-rolled back into a `<bdi>` — because the SHARED RECORD below renders
 * that same value through `Money`, and satisfied the pattern on its own.
 * Control B caught it on the first run, which is the entire reason the control
 * exists. Scoped to the gated block, both the rule and its control mean what
 * they say.
 */
function winnerBlock(src) {
  const m = src.match(/\{\s*viewerIsWinner\s*\?\s*\(([\s\S]*?)\)\s*:\s*null\s*\}/);
  return m ? m[1] : "";
}

/**
 * One audit function, so the controls below run the IDENTICAL logic over
 * mutated text. Two copies of the rules would let a control pass while the
 * real check rots.
 */
function audit(text) {
  const src = code(text);
  const block = winnerBlock(src);
  return {
    // The identity half (@Dem4t, #161): the NAME crosses, never a boolean
    // frozen at server render — a frozen flag is false forever on the one
    // path that matters: the auction ending under its winner (BID-17).
    acceptsProp: /\bviewerDisplayName\b[^;]*?:\s*string\s*\|\s*null/.test(src),
    defaultsToFalse: /viewerDisplayName\s*=\s*null/.test(src),
    // Derived inside, against the LIVE snapshot winnerName.
    comparesLive: /winnerName\s*===\s*viewerDisplayName/.test(src),
    // The statement renders ONLY behind the flag. An ungated sentence would
    // tell the seller and every passer-by that they won.
    gated: /\{\s*viewerIsWinner\s*\?/.test(src),
    // Second person, addressed to the viewer — not a label naming someone.
    addressesViewer: /فزت/.test(block),
    // FR-END-14 asks for the statement AND the amount, together.
    namesTheAmount: /مزايدتك/.test(block),
    // Through the one display path (NFR-DAT-08, BR-21 — no ceiling).
    amountThroughMoney: /<Money\b[^>]*\bamount=\{finalPrice\}/.test(block) && !/<bdi\b/.test(block),
    // FR-END-16 — the shared record survives for every viewer, winner included.
    keepsSharedRecord: /الفائز/.test(src) && /السعر النهائي/.test(src),
    // SC-67 / BR-34 / FR-END-17a — no next step, in any of its shapes.
    offersNextStep:
      /(الدفع|ادفع|الشحن|شحن|التوصيل|توصيل|الاستلام|استلم|تواصل مع|payment|checkout|shipping|delivery)/.test(
        src,
      ),
    // FR-END-15 is a `should` and the PRD never words a loss message. Inventing
    // one would be a product decision taken in a component (TEAM.md rule 16).
    inventsLossState: /(لم تفز|خسرت|لم تربح)/.test(src),
  };
}

const text = read(BANNER);
const a = audit(text);

console.log(`\n-- ${BANNER} --`);
chk("accepts viewerDisplayName: string | null — a name, not a frozen flag", a.acceptsProp, true);
chk("defaults to null — every other viewer is unchanged", a.defaultsToFalse, true);
chk("compares against the LIVE snapshot winnerName (no frozen boolean)", a.comparesLive, true);
chk("the statement is gated on it", a.gated, true);
chk("addresses the viewer in the second person (FR-END-14)", a.addressesViewer, true);
chk("names the amount alongside it (FR-END-14)", a.namesTheAmount, true);
chk("the amount goes through <Money>, not hand-rolled markup", a.amountThroughMoney, true);
chk("the shared winner/price record survives (FR-END-16)", a.keepsSharedRecord, true);
chk("offers no payment, contact, shipping or collection (SC-67)", a.offersNextStep, false);
chk("invents no loss message (FR-END-15 is a should, unworded)", a.inventsLossState, false);

// --------------------------------------------------------------------------
// THE CONTROLS. Each pair's first check guards the mutation itself: a probe
// that edited nothing would make its partner pass for no reason at all.
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// THE WIRING. The first shipped draft of this feature accepted the prop and
// nothing passed it: default false, statement unreachable, suite green —
// built-but-unconsumed, the defect this repository has now produced FIVE
// times (#138, #140, #160 twice, and this file's own first draft). So the
// suite reads the page too: the prop must be passed, and must come from the
// server-verified session (getViewer), never from anything client-supplied.
// --------------------------------------------------------------------------
const PAGE = "app/auctions/[id]/page.tsx";
const pageSrc = code(read(PAGE));
function auditPage(src) {
  return {
    passesProp: /<OutcomeBanner\b[^>]*viewerDisplayName=\{/.test(src),
    fromVerifiedSession: /getViewer\(\)/.test(src),
  };
}
const pg = auditPage(pageSrc);
console.log(`\n-- ${PAGE} — the wiring --`);
chk("the page passes viewerDisplayName to OutcomeBanner", pg.passesProp, true);
chk("the name comes from getViewer() — the verified session", pg.fromVerifiedSession, true);

console.log("\n-- control A: the gate removed — everyone is told they won --");
const ungated = text.replace(/\{viewerIsWinner \? \(/, "{true ? (");
chk("the mutation actually changed the source", ungated !== text, true);
chk("an ungated statement FAILS the audit", !audit(ungated).gated, true);

console.log("\n-- control B: the amount hand-rolled back out of <Money> --");
const handRolled = text.replace(
  /<Money amount=\{finalPrice\} size="md" \/>/,
  '<bdi className="num">{finalPrice}</bdi>',
);
chk("the mutation actually changed the source", handRolled !== text, true);
chk("bypassing <Money> FAILS the audit", !audit(handRolled).amountThroughMoney, true);

console.log("\n-- control C: a next step offered (SC-67) --");
const nextStep = text.replace(/فزت بهذا المزاد/, "فزت بهذا المزاد — تواصل مع البائع للاستلام");
chk("the mutation actually changed the source", nextStep !== text, true);
chk("offering a next step FAILS the audit", audit(nextStep).offersNextStep, true);

console.log("\n-- control D: the page stops passing the prop (built-but-unwired) --");
const unwired = pageSrc.replace(/ viewerDisplayName=\{[^}]*\}/, "");
chk("the mutation actually changed the source", unwired !== pageSrc, true);
chk("an unwired banner FAILS the audit", !auditPage(unwired).passesProp, true);

console.log("\n-- control E: the comparison re-frozen into a boolean prop --");
const frozen = text.replace(/winnerName === viewerDisplayName/, "viewerIsWinnerFrozen");
chk("the mutation actually changed the source", frozen !== text, true);
chk("a frozen flag FAILS the audit", !audit(frozen).comparesLive, true);

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
  `\n${fail === 0 ? "BID-18 winner statement: PASS" : `BID-18 winner statement: FAIL — ${fail} check(s)`}  (${pass}/${reached})`,
);
process.exit(fail === 0 ? 0 : 1);
