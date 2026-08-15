#!/usr/bin/env node
// F0 — deterministic validator for docs/v2/taxonomy/catalog.json.
//
// Fails (exit 1) on any of:
//   - parent count != 13 (so 12 and 14 both fail)
//   - named subcategory count != 110 (so 109 and 111 both fail)
//   - duplicate main slug or duplicate subcategory slug
//   - a subcategory whose parent_slug matches no main (orphan)
//   - a main or subcategory with a missing/empty Arabic label
//   - a main or subcategory with missing provenance (empty `sources`)
//
// Run: node tests/taxonomy/catalog.check.mjs

import { readFileSync } from "node:fs";

const EXPECTED_MAINS = 13;
const EXPECTED_SUBS = 110;

const c = JSON.parse(readFileSync("docs/v2/taxonomy/catalog.json", "utf8"));
const failures = [];
const fail = (m) => failures.push(m);

const mains = c.categories ?? [];
const subs = c.subcategories ?? [];

// ---- counts -------------------------------------------------------------
if (mains.length !== EXPECTED_MAINS) {
  fail(`parent count is ${mains.length}, expected exactly ${EXPECTED_MAINS}`);
}
if (subs.length !== EXPECTED_SUBS) {
  const gap = EXPECTED_SUBS - subs.length;
  fail(
    `named subcategory count is ${subs.length}, expected exactly ${EXPECTED_SUBS} ` +
      `(${gap > 0 ? `${gap} short` : `${-gap} over`})`,
  );
}

// ---- duplicate slugs ----------------------------------------------------
const dupes = (arr) => {
  const seen = new Set(), dup = new Set();
  for (const v of arr) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
};
for (const d of dupes(mains.map((m) => m.slug))) fail(`duplicate main slug: ${d}`);
for (const d of dupes(subs.map((s) => s.slug))) fail(`duplicate subcategory slug: ${d}`);

// ---- orphans, labels, provenance ---------------------------------------
const mainSlugs = new Set(mains.map((m) => m.slug));
const arabic = /[؀-ۿ]/;

for (const m of mains) {
  if (!m.slug) fail(`main with missing slug (sort_order ${m.sort_order})`);
  if (!m.label_ar || !arabic.test(m.label_ar)) fail(`main ${m.slug}: missing Arabic label`);
  if (!m.sources?.length) fail(`main ${m.slug}: missing provenance`);
}

for (const s of subs) {
  const id = s.slug || `<no slug, parent ${s.parent_slug}>`;
  if (!s.slug) fail(`subcategory with missing slug under ${s.parent_slug}`);
  if (!mainSlugs.has(s.parent_slug)) fail(`orphan subcategory ${id}: parent "${s.parent_slug}" does not exist`);
  if (!s.label_ar || !arabic.test(s.label_ar)) fail(`subcategory ${id}: missing Arabic label`);
  if (!s.sources?.length) fail(`subcategory ${id}: missing provenance`);
}

// ---- reconciliation ------------------------------------------------------
// The gap must always be fully accounted for; an unexplained shortfall is a
// separate failure from the count failure above.
const anon = (c.unresolved ?? []).reduce((a, u) => a + (u.count || 0), 0);
const unrep = c.counts?.subcategories_unrepresented_in_any_view ?? 0;
const accounted = subs.length + anon + unrep;
if (accounted !== EXPECTED_SUBS) {
  fail(`reconciliation: ${subs.length} named + ${anon} anonymous + ${unrep} unrepresented = ${accounted}, expected ${EXPECTED_SUBS}`);
}

// ---- report --------------------------------------------------------------
console.log(
  `taxonomy: ${mains.length} mains, ${subs.length} named subs, ` +
    `${anon} anonymous, ${unrep} unrepresented (sum ${accounted}/${EXPECTED_SUBS})`,
);

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    `\nThe subcategory shortfall is an EXTERNAL EVIDENCE GATE, not a data defect.\n` +
      `See docs/v2/taxonomy/PROVENANCE.md §5. Do not close it by inventing labels.`,
  );
  process.exit(1);
}
console.log("PASS");
