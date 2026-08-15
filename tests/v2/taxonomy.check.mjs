#!/usr/bin/env node
// ============================================================================
// F0 — the taxonomy catalog check.
//
//   node tests/v2/taxonomy.check.mjs
//
// Needs nothing: no Docker, no network, no credentials. Reads two JSON files.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS FOR
//
// docs/v2/taxonomy/catalog.json is the sourced 13/110 dataset every taxonomy
// ticket downstream of F0 consumes. The architecture contract §16 says the
// dataset must be present "before taxonomy code merges or the product claims
// that count". This file is what makes "present" mean more than "a file exists".
//
// It enforces two different kinds of thing and the difference matters:
//
//   STRUCTURE   unique slugs, one valid parent each, an Arabic label, a source.
//               These are properties of the data and they hold today.
//   THE COUNT   exactly 13 parents and exactly 110 children.
//               This does NOT hold today and the failure is the deliverable.
//
// ---------------------------------------------------------------------------
// THIS CHECK FAILS ON PURPOSE, RIGHT NOW
//
// The catalog carries 61 canonical subcategories. The contract says 110. So the
// count gate is red, and it should be: CLAUDE.md §9 says the answer to a red
// guard you believe is wrong is to change the guard IN A PULL REQUEST where
// someone has to agree — never to soften it quietly so the tree goes green.
//
// The 49-row gap is not a research shortfall that more reading closes. The
// prototype's own grid accounts for 72 subcategories; the headline says 110;
// 38 rows are named by no artifact anywhere. That is a product decision
// (O-F0-1), and CLAUDE.md §8 and TEAM.md rule 16 both say a session does not
// get to invent one. So the check states the shortfall precisely and stays red
// until the owner rules.
//
// Because it is knowingly red, it is NOT wired into .github/workflows/ci.yml.
// It sits on the tests/guards/ci-coverage.sh allowlist with that reason, which
// is the mechanism this repository already uses for a suite that cannot run
// green in CI. THE ALLOWLIST ENTRY COMES OUT THE DAY O-F0-1 IS ANSWERED — at
// that point this check is either satisfied or it is the thing blocking a wrong
// answer, and either way it belongs in the workflow.
//
// ---------------------------------------------------------------------------
// OUTPUT SHAPE — a contract with tests/lib/negative.sh, and it was got wrong
//
// Every assertion prints ONE stable label, in both outcomes:
//
//   ok    <label>
//   FAIL  <label> — <detail>
//
// The harness finds a probed assertion by its label and then asks whether that
// line begins with FAIL. Two rules follow, and the first version of this file
// broke both:
//
//   1. The FAIL branch must repeat the SAME label as the ok branch. It used to
//      print `FAIL duplicate category slug: vehicles` against an ok line that
//      said `category slugs are unique` — no shared text, so 13 probes came
//      back BROKEN ("no check prints this label") and were asserting nothing.
//   2. No label may be a substring of another. `category slugs are unique` sits
//      inside `subcategory slugs are unique`, so a probe for the first matched
//      the second's ok line and reported MISSED against a check that had
//      correctly failed. Hence "main category" throughout for the parent-level
//      assertions; the prefix is load-bearing, not decoration.
//
// FAIL prints at column 0 and ok is indented, because the harness anchors on
// ^FAIL.
//
// ---------------------------------------------------------------------------
// EXIT CODES — three states, not two
//
//   0  everything holds, count included
//   1  a STRUCTURAL invariant is broken. Always a defect in the data.
//   2  structure holds, the COUNT does not. The expected state until O-F0-1.
//
// Two exit codes would have collapsed "the data is malformed" into "the data is
// incomplete", and those need different people: one is a bug, the other is a
// question for the owner.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CATALOG = join(ROOT, "docs", "v2", "taxonomy", "catalog.json");
const SOURCES = join(ROOT, "docs", "v2", "taxonomy", "sources.json");

let structuralFailures = 0;
let countFailures = 0;
let passes = 0;

// assert(condition, label, detail) — the single output path.
const assert = (cond, label, detail = "") => {
  if (cond) {
    passes++;
    console.log(`  ok    ${label}`);
  } else {
    structuralFailures++;
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// A count miss is a real failure of the contract, so it prints FAIL and is
// probeable like any other. It is tallied separately only to drive the exit
// code.
const assertCount = (cond, label, detail = "") => {
  if (cond) {
    passes++;
    console.log(`  ok    ${label}`);
  } else {
    countFailures++;
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const read = (p, what) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.log(`FAIL  ${what} is readable and valid JSON — ${e.message}`);
    process.exit(1);
  }
};

const list = (xs) => xs.join(", ");

console.log("==> F0 taxonomy catalog\n");

const catalog = read(CATALOG, "catalog.json");
const sources = read(SOURCES, "sources.json");

const cats = catalog.categories ?? [];
const subs = catalog.subcategories ?? [];
const knownSources = new Set(Object.keys(sources.sources ?? {}));
const parentSlugs = new Set(cats.map((c) => c.slug));

// --- 1. structure: main categories ----------------------------------------
console.log("-- main categories --");
{
  const slugs = cats.map((c) => c.slug);
  const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
  assert(dupes.length === 0, "main category slugs are unique", `duplicated: ${list(dupes)}`);

  // ASCII slugs. The Arabic label is the human surface; the slug is the stable
  // machine key and goes in URLs, so it stays ASCII per issue #180's own terms.
  const nonAscii = cats.filter((c) => !/^[a-z0-9-]+$/.test(c.slug ?? ""));
  assert(
    nonAscii.length === 0,
    "main category slugs are stable lowercase ASCII",
    list(nonAscii.map((c) => c.slug)),
  );

  // An Arabic label must actually contain Arabic. Checking for a non-empty
  // string would pass a slug pasted into the label field, which is the way this
  // particular mistake actually happens.
  const noLabel = cats.filter((c) => !/[؀-ۿ]/.test(c.label ?? ""));
  assert(
    noLabel.length === 0,
    "every main category has an Arabic label",
    list(noLabel.map((c) => c.slug)),
  );

  const noProv = cats.filter((c) => !Array.isArray(c.sources) || c.sources.length === 0);
  assert(
    noProv.length === 0,
    "every main category cites at least one source",
    list(noProv.map((c) => c.slug)),
  );

  const unknown = [...new Set(cats.flatMap((c) => (c.sources ?? []).filter((s) => !knownSources.has(s))))];
  assert(
    unknown.length === 0,
    "every main category source id resolves in sources.json",
    list(unknown),
  );

  const orders = cats.map((c) => c.sort_order);
  assert(
    new Set(orders).size === orders.length && orders.every(Number.isInteger),
    "main category sort order is deterministic",
  );
}

// --- 2. structure: subcategories ------------------------------------------
console.log("\n-- subcategories --");
{
  const slugs = subs.map((s) => s.slug);

  const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
  assert(dupes.length === 0, "subcategory slugs are unique", `duplicated: ${list(dupes)}`);

  // Globally unique, not merely unique within a parent. A subcategory slug ends
  // up in a URL and in a seed's primary key; two parents each owning a "parts"
  // row would collide the moment either is addressed on its own.
  const collide = slugs.filter((s) => parentSlugs.has(s));
  assert(
    collide.length === 0,
    "no subcategory slug collides with a main category slug",
    list(collide),
  );

  const nonAscii = subs.filter((s) => !/^[a-z0-9-]+$/.test(s.slug ?? ""));
  assert(
    nonAscii.length === 0,
    "subcategory slugs are stable lowercase ASCII",
    list(nonAscii.map((s) => s.slug)),
  );

  const orphans = subs.filter((s) => !parentSlugs.has(s.parent));
  assert(
    orphans.length === 0,
    "every subcategory has exactly one existing parent",
    list(orphans.map((s) => `${s.slug}→${s.parent}`)),
  );

  const noLabel = subs.filter((s) => !/[؀-ۿ]/.test(s.label ?? ""));
  assert(
    noLabel.length === 0,
    "every subcategory has an Arabic label",
    list(noLabel.map((s) => s.slug)),
  );

  const noProv = subs.filter((s) => !Array.isArray(s.sources) || s.sources.length === 0);
  assert(
    noProv.length === 0,
    "every subcategory cites at least one source",
    list(noProv.map((s) => s.slug)),
  );

  const unknown = [...new Set(subs.flatMap((s) => (s.sources ?? []).filter((x) => !knownSources.has(x))))];
  assert(unknown.length === 0, "every subcategory source id resolves in sources.json", list(unknown));

  const badClass = subs.filter((s) => !["A", "B", "C"].includes(s.evidence));
  assert(
    badClass.length === 0,
    "every subcategory carries an evidence class",
    list(badClass.map((s) => s.slug)),
  );

  // Class C is "proposed, never canonical". A C row sitting in the canonical
  // array is precisely the gap-filling F0 forbids, so it is a hard failure.
  const proposed = subs.filter((s) => s.evidence === "C");
  assert(
    proposed.length === 0,
    "no proposed row is being passed off as canonical",
    list(proposed.map((s) => s.slug)),
  );

  // Sort order is deterministic per parent, not globally — the picker renders
  // one parent's children at a time.
  const byParent = {};
  for (const s of subs) (byParent[s.parent] ??= []).push(s.sort_order);
  const clash = Object.entries(byParent).filter(([, o]) => new Set(o).size !== o.length);
  assert(
    clash.length === 0,
    "subcategory sort order is deterministic within each parent",
    list(clash.map(([p]) => p)),
  );

  // ARCHITECTURE §5.1: misc keeps a single general subcategory. If the 49-row
  // shortfall is ever "solved" by shovelling rows into misc, this catches it.
  const miscCount = subs.filter((s) => s.parent === "misc").length;
  assert(
    miscCount === 1,
    "misc has exactly one general subcategory",
    `ARCHITECTURE §5.1 requires 1, found ${miscCount}`,
  );

  const childless = cats.filter((c) => !subs.some((s) => s.parent === c.slug));
  assert(
    childless.length === 0,
    "every main category has at least one subcategory",
    list(childless.map((c) => c.slug)),
  );
}

// --- 3. structure: category fields ----------------------------------------
console.log("\n-- category fields --");
{
  const fields = catalog.category_fields ?? {};
  const entries = Object.entries(fields).filter(([k]) => k !== "$note");

  const missing = cats.filter((c) => !(c.slug in fields));
  assert(
    missing.length === 0,
    "every main category has a field metadata entry",
    list(missing.map((c) => c.slug)),
  );

  // Evidence and proposal must stay separable. A `labels` that is not an array
  // means the observed half was overwritten by the proposed half.
  const malformed = entries.filter(
    ([, v]) => !Array.isArray(v?.labels) || typeof v?.proposed !== "object",
  );
  assert(
    malformed.length === 0,
    "observed field labels stay separate from proposed validation metadata",
    list(malformed.map(([k]) => k)),
  );

  // CLAUDE.md §4: none of these is money. A field whose proposed type mentions
  // SAR or the money domain would be a second money-shaped surface arriving by
  // the back door, which D-02 §2.1 names explicitly as the thing not to do.
  //
  // The NOT-clause is stripped before matching, and that is not a convenience.
  // The first version of this check went red on `المساحة (م²)` and
  // `الوزن التقريبي`, whose annotations read "NOT money" — the two fields most
  // carefully marked as non-money were reported as the only money violations.
  // tests/guards/run.sh strips comments for exactly this reason: this
  // repository documents its absences, and a matcher that cannot tell "we
  // forbid this" from "we require this" earns an ignore list within a week.
  //
  // The strip removes ONLY the words "NOT money", never a type. A probe in
  // taxonomy-negative.check.sh sets a field to "sar_amount, NOT money" and
  // requires it still to be caught, so this cannot decay into a blanket skip.
  const denegated = (t) => String(t).replace(/\bNOT\s+money\b/gi, "");
  const moneyish = entries.flatMap(([k, v]) =>
    Object.entries(v.proposed ?? {})
      .filter(([, t]) => /sar_amount|\bSAR\b|money/i.test(denegated(t)))
      .map(([f]) => `${k}.${f}`),
  );
  assert(moneyish.length === 0, "no category field is typed as money", list(moneyish));
}

// --- 4. the count ----------------------------------------------------------
console.log("\n-- the contract count --");
{
  const wantCats = catalog.contract?.categories_required;
  const wantSubs = catalog.contract?.subcategories_required;

  assertCount(
    cats.length === wantCats,
    `exactly ${wantCats} main categories are present`,
    `found ${cats.length}`,
  );

  const short = wantSubs - subs.length;
  assertCount(
    subs.length === wantSubs,
    `exactly ${wantSubs} subcategories are present`,
    `found ${subs.length} (${short > 0 ? `${short} short` : `${-short} over`})`,
  );

  if (subs.length !== wantSubs) {
    const u = catalog.unresolved ?? {};
    console.log(`        prototype grid names ......... ${catalog.counts?.prototype_grid_named}`);
    console.log(`        picker adds .................. ${catalog.counts?.prototype_picker_only_named}`);
    console.log(`        anonymous +N remaining ....... ${u.total_anonymous_remaining}`);
    console.log(`        prototype accounts for ....... ${catalog.counts?.prototype_implied_total}`);
    console.log(`        headline claims .............. ${catalog.counts?.prototype_headline_claim}`);
    console.log(`        named by no artifact ......... ${u.beyond_the_placeholders?.count}`);
    console.log(`        blocked on ................... O-F0-1 (product decision, not research)`);
  }

  // A hand-maintained number that drifts from the array beside it is the exact
  // failure CLAUDE.md §9 retells three times, so every declared count is
  // recomputed rather than trusted.
  assert(
    catalog.counts?.subcategories_canonical === subs.length,
    "counts.subcategories_canonical matches the array",
    `declared ${catalog.counts?.subcategories_canonical}, array has ${subs.length}`,
  );

  assert(
    catalog.counts?.categories === cats.length,
    "counts.categories matches the array",
    `declared ${catalog.counts?.categories}, array has ${cats.length}`,
  );

  assert(
    catalog.counts?.subcategories_shortfall_vs_contract === short,
    "declared shortfall matches the arithmetic",
    `declared ${catalog.counts?.subcategories_shortfall_vs_contract}, computed ${short}`,
  );

  const named =
    (catalog.counts?.prototype_grid_named ?? 0) + (catalog.counts?.prototype_picker_only_named ?? 0);
  assert(
    named === subs.length,
    "named-row arithmetic reconciles with the catalog",
    `grid+picker = ${named}, catalog has ${subs.length}`,
  );

  const implied = named + (catalog.unresolved?.total_anonymous_remaining ?? 0);
  assert(
    implied === catalog.counts?.prototype_implied_total,
    "prototype-implied total reconciles",
    `declared ${catalog.counts?.prototype_implied_total}, computed ${implied}`,
  );

  const placeholderSum = (catalog.unresolved?.anonymous_placeholders_remaining ?? []).reduce(
    (n, p) => n + p.count,
    0,
  );
  assert(
    placeholderSum === catalog.unresolved?.total_anonymous_remaining,
    "per-parent placeholder counts sum to the declared total",
    `summed ${placeholderSum}, declared ${catalog.unresolved?.total_anonymous_remaining}`,
  );
}

// --- 5. provenance discipline ---------------------------------------------
console.log("\n-- provenance --");
{
  // A source that failed to load can never back a row. This is the "a search
  // snippet is not a read source" rule, made mechanical.
  const failed = Object.entries(sources.sources ?? {})
    .filter(([, v]) => /^FAILED/.test(v.access ?? ""))
    .map(([k]) => k);
  const citedFailed = [...cats, ...subs].flatMap((r) =>
    (r.sources ?? []).filter((s) => failed.includes(s)).map((s) => `${r.slug}→${s}`),
  );
  assert(
    citedFailed.length === 0,
    "no row cites a source that could not be read",
    list(citedFailed),
  );

  // Class A claims an external read. A row whose only citations are in-repo is
  // class B by definition, and mislabelling it would inflate how sourced this
  // dataset looks.
  const inRepo = new Set(["prototype", "d02"]);
  const fakeA = subs
    .filter((s) => s.evidence === "A")
    .filter((s) => (s.sources ?? []).every((x) => inRepo.has(x)));
  assert(
    fakeA.length === 0,
    "no class A row cites only in-repo sources",
    list(fakeA.map((s) => s.slug)),
  );

  // A class A row asserts a source WROTE something. source_labels is where that
  // wording is preserved, and without it the claim is unauditable.
  const noSourceLabels = subs
    .filter((s) => s.evidence === "A")
    .filter((s) => !s.source_labels || Object.keys(s.source_labels).length === 0);
  assert(
    noSourceLabels.length === 0,
    "every class A row preserves the label as the source wrote it",
    list(noSourceLabels.map((s) => s.slug)),
  );

  const aliases = catalog.aliases ?? [];
  const aliasBad = aliases.filter((a) => !a.canonical || !a.variant || !a.decision);
  assert(
    aliasBad.length === 0,
    "every alias records canonical, variant and the decision taken",
    `${aliasBad.length} incomplete`,
  );

  const aliasTargets = new Set([...cats, ...subs].map((r) => r.slug));
  const dangling = aliases.filter((a) => !aliasTargets.has(a.canonical));
  assert(
    dangling.length === 0,
    "every alias resolves to a real row",
    list(dangling.map((a) => a.canonical)),
  );

  const q = catalog.open_questions ?? [];
  assert(
    q.length > 0 && q.every((x) => x.id && x.question),
    "every open question carries an id",
    "README rule 5: every gap carries an id",
  );
}

// --- verdict ---------------------------------------------------------------
console.log(
  `\n${passes} ok · ${structuralFailures} structural failures · ${countFailures} count gaps`,
);

if (structuralFailures > 0) {
  console.log("\nSTRUCTURAL FAILURE — the data is malformed. This is a defect; fix the data.");
  process.exit(1);
}
if (countFailures > 0) {
  console.log(
    "\nCOUNT NOT MET — the structure is sound and the dataset is incomplete.\n" +
      "This is the expected state until O-F0-1 is answered by the product owner.\n" +
      "Do NOT close it by adding plausible rows: see docs/v2/taxonomy/PROVENANCE.md §4.",
  );
  process.exit(2);
}
console.log("\nALL GOOD.");
process.exit(0);
