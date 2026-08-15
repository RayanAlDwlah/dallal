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
// and `formatSarWithSuffix` (lib/money.ts:130) produces exactly that for every
// NON-rendered use. The rendered path disagreed with it.
//
// `Money` laid the amount and the `SAR` indicator out as two flex children with
// the spacing from `gap-1`. A layout gap separates boxes and contributes
// nothing to text, so the element looked right and `textContent` read:
//
//     1,250.00SAR
//
// which costs a user who copies a price, and costs any measurement that reads
// `innerText` — #88 and #92 both do, and an assertion on the canonical string
// would have failed against visually correct output. Rule 6 says "one
// formatter, byte-identical wherever it exists"; this was the one place the
// product disagreed with its own formatter, and nothing could see it, because
// every check in the tree reads SOURCE and the defect only exists once the
// source has been COMPILED.
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
// order.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CLAIM
//
// It does not prove the space is invisible on screen. Per CSS Flexible Box
// Layout §4 a whitespace-only run between flex items is not rendered, so it
// adds no box and no break point and the spacing stays `gap-1`'s — but that is
// the spec's word, not a measurement, and no browser runs in this environment.
// The rendered-layout half belongs to #88.
// ============================================================================
import { readFileSync } from "node:fs";
import ts from "typescript";

const MONEY = "components/ui/money.tsx";

const EXPECTED = 7;
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

function emit(source) {
  return ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: "esnext", module: "esnext" },
  }).outputText;
}

/**
 * One audit function, so the controls below run the IDENTICAL logic over
 * mutated source. Two copies of the rule would let a control pass while the
 * real check rots.
 */
function audit(source) {
  const out = emit(source);
  const branch = out.slice(out.lastIndexOf("suffix ?"));
  return {
    // The indicator is still rendered at all.
    rendersSuffix: /SAR_SUFFIX/.test(branch),
    // A literal space child sits FIRST in the suffix branch — i.e. between the
    // isolate and the indicator, which is the only position that yields the
    // canonical order.
    spaceBeforeSuffix: /children:\s*\[\s*" "\s*,/.test(branch),
    // The containment on the isolate is what lets an amount with no ceiling
    // (BR-21) scroll inside itself instead of widening the document — measured
    // at 1871px on #120. A "tidy" that drops it re-opens that hole.
    keepsContainment:
      /max-w-full/.test(out) && /min-w-0/.test(out) && /overflow-x-auto/.test(out),
    // The indicator stays OUTSIDE the isolate (CLAUDE.md §3): inside it, the
    // decimal point and `SAR` reorder in RTL.
    suffixOutsideIsolate: !/bdi[\s\S]{0,200}SAR_SUFFIX/.test(branch),
  };
}

const source = readFileSync(MONEY, "utf8");
const a = audit(source);

console.log(`\n-- ${MONEY} (compiled) --`);
chk("renders the SAR indicator", a.rendersSuffix, true);
chk("a literal space precedes it — canonical `1,250.00 SAR` (§4.6)", a.spaceBeforeSuffix, true);
chk("the isolate keeps its overflow containment (BR-21, #120)", a.keepsContainment, true);
chk("the indicator stays outside the isolate (§3)", a.suffixOutsideIsolate, true);

// --------------------------------------------------------------------------
// THE CONTROLS. The first of each pair guards the mutation itself: a probe
// that edited nothing would make its partner pass for no reason at all.
// --------------------------------------------------------------------------
console.log("\n-- control A: the space removed — the #156 defect restored --");
const noSpace = source.replace(/\{" "\}\n/, "");
chk("the mutation actually changed the source", noSpace !== source, true);
chk("dropping the space FAILS the audit", !audit(noSpace).spaceBeforeSuffix, true);

console.log("\n-- control B: the containment 'tidied' off the isolate --");
const noContain = source.replace(/max-w-full min-w-0 overflow-x-auto/, "");
chk("stripping containment FAILS the audit", !audit(noContain).keepsContainment, true);

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
