// ============================================================================
// #156 — the RENDERED text of a price must be the canonical string.
//
// Run:  node --no-warnings tests/ui/money-canonical-text.check.mjs
//
// Needs nothing but the `typescript` devDependency. No browser, no database,
// no network, no server.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// CLAUDE.md §4 rule 6 fixes one canonical form — `1,250.00 SAR`, "one space" —
// and `lib/money.ts` produces exactly that for every NON-rendered use. The
// rendered path disagreed with it.
//
// `Money` laid the amount and the `SAR` indicator out as two flex children with
// the spacing coming from CSS. A layout gap separates boxes and contributes
// nothing to text, so the element looked right and `textContent` read:
//
//     1,250.00SAR
//
// which costs a user who copies a price, and costs any measurement that reads
// `innerText`. Rule 6 says "one formatter, byte-identical wherever it exists";
// this was the one place the product disagreed with its own formatter, and
// nothing could see it, because every check in the tree reads SOURCE and the
// defect only exists once the source has been COMPILED.
//
// ---------------------------------------------------------------------------
// RE-AIMED AT V2 ON 2026-08-16 — AND THE FIRST RUN IS THE LESSON
//
// This file arrived on `delivery/v2-app` in the merge with `main`, written
// against V1's `Money`, which took a `suffix` prop and rendered `SAR_SUFFIX`
// through a ternary. It located the region to audit with
// `out.slice(out.lastIndexOf("suffix ?"))`.
//
// V2's `Money` has no `suffix` prop. `lastIndexOf` returned **-1**, `slice(-1)`
// returned **the last character of the file**, and the audit ran against a
// one-character string. The result was not a clean failure. It was:
//
//     FAIL  renders the SAR indicator
//     FAIL  a literal space precedes it
//     PASS  the indicator stays outside the isolate        <- vacuous
//     PASS  dropping the space FAILS the audit             <- vacuous
//
// Three of the seven checks passed **because the probe found nothing**. A
// negative assertion over an empty string is always true, and a control that
// asserts "the mutated source fails" is satisfied for free when the unmutated
// source fails too. So the suite reported 5/7 on a component it had never
// looked at, and two of those five would have kept reporting PASS if `Money`
// had been deleted outright.
//
// THAT IS WHY THE REGION LOOKUP NOW REFUSES RATHER THAN DEGRADES. If the
// anchors are not found, this exits non-zero with BROKEN and audits nothing. A
// probe that cannot find what it measures must say so — silence read as
// success is the one outcome a guard suite may never produce.
//
// ---------------------------------------------------------------------------
// SO THIS CHECK COMPILES THE COMPONENT RATHER THAN GREPPING IT
//
// `ts.transpileModule` does not resolve imports, so the real file goes in
// untouched — no stubs, nothing mocked, no second copy of the component to
// drift. What comes back is the JSX the runtime will actually execute, and the
// question "is there a text node between the amount and the indicator" is
// answerable from it exactly.
//
// A source grep for `{" "}` would pass on a space sitting in the wrong branch,
// or outside the isolate, or after the indicator. The emit cannot lie about
// order — which is why the two positional facts below are decided by comparing
// INDICES in the emitted children array, not by a proximity regex.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CLAIM
//
// It does not prove the space is invisible on screen. Per CSS Flexible Box
// Layout §4 a whitespace-only run between flex items is not rendered, so it
// adds no box and no break point and the spacing stays `.sar`'s 5px
// `margin-inline-start` — but that is the spec's word, not a measurement, and
// no browser runs in this environment.
// ============================================================================
import { readFileSync } from "node:fs";
import ts from "typescript";

const MONEY = "components/ui/money.tsx";

const EXPECTED = 10;
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

function broken(why) {
  console.log(`\nBROKEN  ${why}`);
  console.log("\nThis suite audits a region of the COMPILED component. It could not\nfind that region, so it measured nothing. Re-aim the anchors at the\ncomponent as it is now — do not delete a check to go green.");
  process.exit(1);
}

function emit(source) {
  return ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: "esnext", module: "esnext" },
  }).outputText;
}

/**
 * One audit function, so the controls below run the IDENTICAL logic over
 * mutated source. Two copies of the rule would let a control pass while the
 * real check rots.
 *
 * `strict` is what separates the real run from a control. The real run demands
 * the anchors exist and REFUSES if they do not. A control has deliberately
 * broken one of them, so it passes `strict: false` and reads the missing
 * anchor as the audit failing — which is the whole point of the control.
 */
function audit(source, { strict = false } = {}) {
  const out = emit(source);

  // The region is `Money`'s body — from its declaration to the next top-level
  // export. Anchoring on the function NAME rather than on an expression inside
  // it is what makes this survive a rewrite of the markup: the name is the
  // contract, the JSX is the implementation.
  const start = out.indexOf("export function Money(");
  if (start === -1) {
    if (strict) broken("`export function Money(` is not in the emit of " + MONEY);
    return { rendersSuffix: false, spaceBetween: false, keepsContainment: false, suffixOutsideIsolate: false };
  }
  const rest = out.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  const region = end === -1 ? rest : rest.slice(0, end);

  const iBdi = region.indexOf('_jsx("bdi"');
  const iSar = region.indexOf('"sar"');
  if (strict && iBdi === -1) broken('`Money` no longer emits a `<bdi>` — the amount has left its bidi isolate');

  // The indicator is rendered at all, and it carries the class that positions
  // it. `.sar` is not decoration: its margin-inline-start IS the visible gap,
  // and the space checked below is a TEXT fact layered on top of it.
  const rendersSuffix = /className:\s*"sar"[\s\S]{0,60}children:\s*"SAR"/.test(region);

  // POSITION, decided by index rather than proximity. A literal `" "` child
  // must sit AFTER the isolate closes and BEFORE the indicator — the only
  // order that yields `1,250.00 SAR` in textContent. A regex asking merely
  // "is there a space near the indicator" would accept `SAR 1,250.00`.
  const between = iBdi !== -1 && iSar !== -1 ? region.slice(iBdi, iSar) : "";
  const spaceBetween = /\}\s*\)\s*,\s*" "\s*,/.test(between);

  // The containment on the isolate is what lets an amount with no ceiling
  // (BR-21) scroll inside itself instead of widening the document — measured
  // at 1871px on #120. A "tidy" that drops it re-opens that hole.
  const keepsContainment =
    /max-w-full/.test(region) && /min-w-0/.test(region) && /overflow-x-auto/.test(region);

  // The indicator stays OUTSIDE the isolate (CLAUDE.md §3): inside it, the
  // decimal point and `SAR` reorder in RTL. Structural, not proximity-based —
  // the `_jsx("bdi", {...})` call must be CLOSED before `"sar"` appears, which
  // is exactly what "sibling, not child" means in this emit.
  const suffixOutsideIsolate = iBdi !== -1 && iSar !== -1 && /\}\s*\)\s*,/.test(between);

  return { rendersSuffix, spaceBetween, keepsContainment, suffixOutsideIsolate };
}

const source = readFileSync(MONEY, "utf8");
const a = audit(source, { strict: true });

console.log(`\n-- ${MONEY} (compiled) --`);
chk("renders the SAR indicator", a.rendersSuffix, true);
chk("a literal space sits between the isolate and it — `1,250.00 SAR` (§4.6)", a.spaceBetween, true);
chk("the isolate keeps its overflow containment (BR-21, #120)", a.keepsContainment, true);
chk("the indicator stays outside the isolate (§3)", a.suffixOutsideIsolate, true);

// --------------------------------------------------------------------------
// THE CONTROLS. The first of each pair guards the mutation itself: a probe
// that edited nothing would make its partner pass for no reason at all.
//
// Control B previously had no such guard — its regex could stop matching and
// the pair would still read PASS. It has one now, for the same reason the
// region lookup above refuses instead of degrading.
// --------------------------------------------------------------------------
console.log("\n-- control A: the space removed — the #156 defect restored --");
// \r?\n, not \n: a CRLF checkout (Windows, core.autocrlf=true) otherwise
// leaves this mutation a no-op and both its checks red on a healthy tree —
// green in CI, red on a developer's machine, the inverted-guard shape #172's
// review documented on this exact suite family.
const noSpace = source.replace(/\{" "\}\r?\n/, "");
chk("A: the mutation actually changed the source", noSpace !== source, true);
chk("A: dropping the space FAILS the audit", !audit(noSpace).spaceBetween, true);

console.log("\n-- control B: the containment 'tidied' off the isolate --");
const noContain = source.replace(/max-w-full min-w-0 overflow-x-auto/, "");
chk("B: the mutation actually changed the source", noContain !== source, true);
chk("B: stripping containment FAILS the audit", !audit(noContain).keepsContainment, true);

// This control is new, and it is here because its assertion is the one the V1
// version of this file reported as a vacuous PASS. `suffixOutsideIsolate` was
// a negated regex, so an empty region satisfied it — it had never once been
// shown capable of failing. Now it is: move the indicator inside the isolate
// and the audit must object.
console.log("\n-- control C: the indicator moved INSIDE the bidi isolate --");
const inside = source
  .replace(/<\/bdi>\{" "\}\r?\n\s*<span className="sar">SAR<\/span>/, '<span className="sar">SAR</span>\n      </bdi>');
chk("C: the mutation actually changed the source", inside !== source, true);
chk("C: an indicator inside the isolate FAILS the audit", !audit(inside).suffixOutsideIsolate, true);

console.log("");
const reached = pass + fail;
if (reached !== EXPECTED) {
  fail += 1;
  console.log(`FAIL  only ${reached} of ${EXPECTED} checks ran — the harness stopped early`);
}
console.log(
  `\n${fail === 0 ? "money canonical text: PASS" : `money canonical text: FAIL — ${fail} check(s)`}  (${pass}/${reached})`,
);
process.exit(fail === 0 ? 0 : 1);
