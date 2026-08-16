// ============================================================================
// AUC create form — a REJECTED submission must be visible, and must not
// destroy the seller's image.
//
// Run:  node --no-warnings tests/auction/create-form-recovery.check.mjs
//
// Needs nothing: no database, no network, no .env.local. It reads one file off
// disk, asserts nine facts about it, and then breaks two of them on purpose to
// prove the assertions can still fail.
//
// ---------------------------------------------------------------------------
// THE TWO DEFECTS, BOTH MEASURED, BOTH INVISIBLE TO EVERY OTHER GATE
//
// 1. A rejection showed the seller NOTHING. Measured 2026-08-15 at
//    localhost:3100 against the dev project: an end time valid when typed and
//    stale by the time it was confirmed came back as `fieldErrors.endTime`.
//    The message WAS rendered — `document.querySelector('[role=alert]')` found
//    it, correctly worded, with a 0x0 bounding rect and `parentHidden: true`.
//    Every `fieldErrors` entry is drawn by a `Field` inside the block the
//    review screen hides, and only the top-level `state.error` sits outside it
//    — which `createAuctionAction` does not set when it returns field errors.
//    The seller saw the confirm button do nothing at all.
//
// 2. The seller's image was destroyed by the form reset, and the page said
//    otherwise. Found only because fixing (1) made a rejection visible. After
//    ANY rejected submission `input[name=image].files.length` is 0 while the
//    page still reads «الملف المختار: …». React resets the <form> once the
//    action completes; controlled fields are re-applied from state on the next
//    render and survive, a file input cannot be controlled so the File is
//    gone, and `imageName` is state so the LABEL survives. `incomplete`
//    consults `imageName`, so review stays reachable and confirming returns
//    «اختر صورة للمنتج.» — round and round, the page insisting a file is
//    attached. Reproduced twice. The only exit was a full reload.
//
// Neither is visible to `tsc`, to `eslint`, or to a single SQL suite. Both are
// one-line reverts away from returning, and both reverts read as tidying:
// `action={submit}` back to `action={formAction}` is objectively shorter, and
// nothing else in the file would break.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CLAIM
//
//   * It does not render the form or dispatch an action. It reads text — the
//     same trade `live-price-mount.check.mjs` documents and for the same
//     reason: booting React here would test far more than the two facts that
//     went wrong.
//   * It does not prove the seller SEES the message. That took a browser: the
//     alert node measured 566x18 with no hidden ancestor, the end-time field
//     outlined, the form back on the fields, and the auction then published
//     with the image intact and the DOM input measured EMPTY at submit time.
//   * It says nothing about what the SERVER accepts. `submit()` only stops the
//     client silently sending nothing; the action re-validates either way
//     (SEC-V6), and `tests/auction/*.sql` covers that.
//
// NOT WIRED TO ANYTHING YET: `main` has no `.github/workflows` at 1433a75. CI
// and `ci-coverage.sh` are on PR #167; when that lands this file must be named
// there or the coverage check will go red on it — correctly.
// ============================================================================
import { readFileSync } from "node:fs";

const FORM = "app/auctions/new/create-auction-form.tsx";

const EXPECTED = 13;
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

/**
 * The file explains both defects at length in comments, naming `formAction`,
 * `setReviewing` and the reset. Describing a mistake is not making it.
 */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function audit(text) {
  const src = code(text);
  return {
    // (1) The review view is derived from a request AND the server's answer,
    // never corrected afterwards — an effect calling setState here is a
    // cascading render, and eslint's react-hooks/set-state-in-effect is right
    // to refuse it. So there must be no setter at all.
    reviewingIsDerived: /\bconst\s+reviewing\s*=/.test(src),
    noReviewingSetter: /\bsetReviewing\s*\(/.test(src),
    rejectionRevokesReview: /\bconst\s+reviewing\s*=[^;]*serverRejected/.test(src),

    // (2) The retained File is re-attached to the payload on the way out.
    formCallsSubmit: /<form\b[^>]*\baction=\{submit\}/s.test(src),
    formCallsRawAction: /<form\b[^>]*\baction=\{formAction\}/s.test(src),
    retainsFile: /\bsetImageFile\s*\(/.test(src),
    reattachesFile: /formData\.set\(\s*["']image["']\s*,\s*imageFile\s*\)/.test(src),
    // ...and only when the input really is empty. `formData.get("image")` on
    // an emptied input is still a File, an empty one, so the test is size.
    onlyWhenEmpty: /\.size\s*===\s*0/.test(src),

    // EC-08 — the fields are HIDDEN, never unmounted. Unmounting would drop
    // every value on the way to review, which is the bug this file's fixes
    // must not trade for.
    fieldsHiddenNotUnmounted: /<div\s+hidden=\{reviewing\}/.test(src),
  };
}

let formText;
try {
  formText = readFileSync(FORM, "utf8");
} catch {
  console.log(`!! cannot read ${FORM} — the file moved, which is itself the failure`);
  process.exit(1);
}

const a = audit(formText);
console.log(`\n-- ${FORM} --`);
chk("`reviewing` is derived, not stored", a.reviewingIsDerived, true);
chk("nothing calls setReviewing — no cascading render", a.noReviewingSetter, false);
chk("a server rejection revokes the review view", a.rejectionRevokesReview, true);
chk("the form submits through submit(), not formAction", a.formCallsSubmit, true);
chk("the form does NOT bind formAction directly (the reset path)", a.formCallsRawAction, false);
chk("the chosen File is retained in state", a.retainsFile, true);
chk("and re-attached to the FormData on submit", a.reattachesFile, true);
chk("only when the input is genuinely empty (size === 0)", a.onlyWhenEmpty, true);
chk("EC-08 — the fields are hidden, never unmounted", a.fieldsHiddenNotUnmounted, true);

// --------------------------------------------------------------------------
// 10-13. THE CONTROLS. Each mutation is checked for having actually changed
// the text first: a probe that edited nothing would make its partner pass for
// no reason, which is a failure of the probe and not a pass of the rule.
// --------------------------------------------------------------------------
console.log("\n-- control A: binding formAction directly again --");
const reverted = formText.replace(/action=\{submit\}/, "action={formAction}");
chk("the mutation actually changed the source", reverted !== formText, true);
const afterA = audit(reverted);
chk("binding formAction back FAILS the audit", !afterA.formCallsSubmit || afterA.formCallsRawAction, true);

console.log("\n-- control B: dropping the emptiness guard --");
const unguarded = formText.replace(/inForm\.size\s*===\s*0/, "true");
chk("the mutation actually changed the source", unguarded !== formText, true);
const afterB = audit(unguarded);
chk("overriding a real file choice FAILS the audit", !afterB.onlyWhenEmpty, true);

console.log("");
const reached = pass + fail;
if (reached !== EXPECTED) {
  fail += 1;
  console.log(`FAIL  only ${reached} of ${EXPECTED} checks ran — the harness stopped early`);
}
console.log(
  `\n${fail === 0 ? "create-form recovery: PASS" : `create-form recovery: FAIL — ${fail} check(s)`}  (${pass}/${reached})`,
);
process.exit(fail === 0 ? 0 : 1);
