#!/usr/bin/env bash
# ============================================================================
# Negative probes against tests/v2/taxonomy.check.mjs.
#
#   ./tests/v2/taxonomy-negative.check.sh
#
# Breaks one taxonomy rule at a time, in the real files, and asserts the check
# notices. A check that stays green while its rule is violated is reported as a
# failure OF THE CHECK.
#
# CLAUDE.md §9: "A check is not finished when it passes; it is finished when it
# has been made to fail on purpose." taxonomy.check.mjs carries 35 assertions
# and would otherwise carry zero committed evidence that any of them can fire.
#
# ---------------------------------------------------------------------------
# THE SIX FAILURE MODES F0 NAMES, AND WHERE THEY ARE PROBED
#
# The F0 deliverable requires the validator to fail for six specific things.
# Each is probed below and each is listed here so a reader can check the
# mapping without reading the whole file:
#
#   12 parents .............. probe 1     14 parents ......... probe 2
#   109 children ............ probe 3     111 children ....... probe 4
#   duplicate slug .......... probes 5, 6 orphan parent ...... probe 7
#   missing Arabic label .... probes 9,10 missing provenance . probes 11,12
#
# ---------------------------------------------------------------------------
# WHY THE MUTATOR IS NODE AND NOT sed
#
# These are JSON files whose string values are Arabic. A sed expression matching
# an Arabic label depends on the locale and on the byte encoding of the pattern,
# and a mutation that silently fails to apply reports MISSED against a check
# that is fine — the exact PZ-8 defect the NO-OP verdict was added for. Editing
# the parsed object cannot half-apply: it either changes the structure or
# raises. Node rather than python because this repository already runs Node
# (tests/v2/graph.check.mjs) and python is not present on every contributor's
# machine — it is absent from the one this file was written on.
#
# ---------------------------------------------------------------------------
# WHAT IS NOT PROBED, AND WHY — an unprobed assertion that is written down is a
# known gap; an unprobed one that is not is a coverage claim that is false.
#
#   - The two "unreadable JSON" exits. Reachable only by corrupting a file
#     wholesale, which proves the JSON parser works, not that this check does.
#   - `no row cites an unread source` is probed (23) by demoting a cited source
#     to FAILED. The mirror case — a source marked FAILED that nothing cites —
#     is the healthy state and has nothing to assert.
#   - `every category has at least one subcategory` and the two sort-order
#     assertions. Each is falsifiable, none is a rule anyone is tempted to bend
#     to close the 49-row gap, and probes are not free to read.
#   - The exit-code split (1 vs 2). The harness reads printed labels, not exit
#     codes, so it is asserted directly at the end of this file instead.
# ============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/../lib/negative.sh"

CATALOG="docs/v2/taxonomy/catalog.json"
SOURCES="docs/v2/taxonomy/sources.json"

neg_files "$CATALOG
$SOURCES"

neg_run "node tests/v2/taxonomy.check.mjs"

# mut '<js body over `d`>' <file>
mut() {
  node -e '
    const fs = require("fs");
    const body = process.argv[1], p = process.argv[2];
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    new Function("d", body)(d);
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
  ' "$1" "$2"
}

echo "==> negative probes — taxonomy.check.mjs"
echo

# --- the count gate --------------------------------------------------------

# 12 parents — one category removed.
neg_probe "exactly 13 main categories are present" \
  "mut 'd.categories.pop(); d.counts.categories = d.categories.length;' $CATALOG"

# 14 parents — one category added. The clone gets a fresh slug and its own
# child, so this probe trips the count and nothing else; a clone sharing a slug
# would trip the duplicate assertion too and the probe would pass for the wrong
# reason.
neg_probe "exactly 13 main categories are present" \
  "mut 'const c = JSON.parse(JSON.stringify(d.categories[0]));
        c.slug = \"extra-cat\"; c.sort_order = 99; d.categories.push(c);
        const s = JSON.parse(JSON.stringify(d.subcategories[0]));
        s.slug = \"extra-sub\"; s.parent = \"extra-cat\"; d.subcategories.push(s);
        d.counts.categories = d.categories.length;
        d.counts.subcategories_canonical = d.subcategories.length;' $CATALOG"

# 109 children — the contract target is lowered so the current 61 rows are still
# not enough and the count line still fires. Probing "109" by adding 48 rows
# would mean authoring 48 fake subcategories, which is the thing F0 exists to
# forbid; moving the target proves the same comparison.
neg_probe "exactly 109 subcategories are present" \
  "mut 'd.contract.subcategories_required = 109;
        d.counts.subcategories_shortfall_vs_contract = 109 - d.subcategories.length;' $CATALOG"

# 111 children — same, from the other side.
neg_probe "exactly 111 subcategories are present" \
  "mut 'd.contract.subcategories_required = 111;
        d.counts.subcategories_shortfall_vs_contract = 111 - d.subcategories.length;' $CATALOG"

# The gate must fire on the NUMBER, not be stuck on. Setting the contract to the
# current row count must silence it — if this reports STUCK-ON, the check would
# keep failing even after O-F0-1 is answered, and would then be worthless.
echo "-- inverted probe: the count gate must go quiet when the count is met --"
mut 'd.contract.subcategories_required = d.subcategories.length;
     d.counts.subcategories_shortfall_vs_contract = 0;' $CATALOG
if node tests/v2/taxonomy.check.mjs 2>&1 | grep -q '^FAIL  exactly .* subcategories are present'; then
  printf 'STUCK-ON %-63s\n' "the count gate fails even when the contract is met"
  NEG_FAIL=$((NEG_FAIL + 1))
else
  printf 'CAUGHT  %-64s\n' "the count gate goes quiet when the contract is met"
  NEG_PASS=$((NEG_PASS + 1))
fi
neg_restore
echo

# --- duplicate slugs -------------------------------------------------------
neg_probe "main category slugs are unique" \
  "mut 'd.categories[1].slug = d.categories[0].slug;' $CATALOG"

neg_probe "subcategory slugs are unique" \
  "mut 'd.subcategories[1].slug = d.subcategories[0].slug;' $CATALOG"

# --- orphan parent ---------------------------------------------------------
neg_probe "every subcategory has exactly one existing parent" \
  "mut 'd.subcategories[0].parent = \"no-such-category\";' $CATALOG"

# A subcategory slug equal to a category slug. Unique-within-parent would allow
# it; globally unique does not, and a seed primary key needs the stronger rule.
neg_probe "no subcategory slug collides with a main category slug" \
  "mut 'd.subcategories[0].slug = d.categories[0].slug;' $CATALOG"

# --- missing Arabic label --------------------------------------------------
#
# The label is replaced with the row's own SLUG, not with an empty string. An
# empty string is caught by any truthiness test; a Latin slug pasted into a
# label field is how this mistake actually reaches a diff, and it is the case a
# weaker check would wave through.
neg_probe "every main category has an Arabic label" \
  "mut 'd.categories[0].label = d.categories[0].slug;' $CATALOG"

neg_probe "every subcategory has an Arabic label" \
  "mut 'd.subcategories[0].label = d.subcategories[0].slug;' $CATALOG"

# --- missing provenance ----------------------------------------------------
neg_probe "every main category cites at least one source" \
  "mut 'd.categories[0].sources = [];' $CATALOG"

neg_probe "every subcategory cites at least one source" \
  "mut 'd.subcategories[0].sources = [];' $CATALOG"

# --- the rules that keep the dataset honest --------------------------------
#
# Not in the F0 list of six. These are the assertions that stop the 49-row gap
# being closed the easy way, which is the failure this whole ticket is shaped
# around.

# A proposed row promoted into the canonical array.
neg_probe "no proposed row is being passed off as canonical" \
  "mut 'd.subcategories[0].evidence = \"C\";' $CATALOG"

# The shortfall absorbed into misc.
neg_probe "misc has exactly one general subcategory" \
  "mut 'const s = JSON.parse(JSON.stringify(d.subcategories[0]));
        s.slug = \"misc-extra\"; s.parent = \"misc\"; s.sort_order = 2;
        d.subcategories.push(s);
        d.counts.subcategories_canonical = d.subcategories.length;' $CATALOG"

# A row citing a source id that is in no registry.
neg_probe "every subcategory source id resolves in sources.json" \
  "mut 'd.subcategories[0].sources = [\"a-platform-nobody-read\"];' $CATALOG"

# A class B row relabelled A without gaining an external citation — the cheapest
# possible way to make this dataset look better sourced than it is.
neg_probe "no class A row cites only in-repo sources" \
  "mut 'const s = d.subcategories.find(x => x.evidence === \"B\"); s.evidence = \"A\";' $CATALOG"

# A class A row that keeps its external citation but drops the wording the
# source actually used, making the claim unauditable.
neg_probe "every class A row preserves the label as the source wrote it" \
  "mut 'const s = d.subcategories.find(x => x.evidence === \"A\" && x.source_labels);
        s.source_labels = {};' $CATALOG"

# A hand-maintained count drifting from the array beside it. The failure
# CLAUDE.md §9 retells three times.
neg_probe "counts.subcategories_canonical matches the array" \
  "mut 'd.counts.subcategories_canonical = 999;' $CATALOG"

neg_probe "declared shortfall matches the arithmetic" \
  "mut 'd.counts.subcategories_shortfall_vs_contract = 0;' $CATALOG"

neg_probe "per-parent placeholder counts sum to the declared total" \
  "mut 'd.unresolved.anonymous_placeholders_remaining[0].count = 77;' $CATALOG"

# A category field typed as money. D-02 §2.1 names this as the silent way a
# second money surface arrives.
neg_probe "no category field is typed as money" \
  "mut 'd.category_fields.furniture.proposed[\"المقاس\"] = \"sar_amount\";' $CATALOG"

# The de-negation must not blind the check: a field annotated "NOT money" that
# IS typed as money still has to be caught. Without this probe, the fix that
# stopped "NOT money" being a false positive could have been written as a blanket
# skip of any annotation containing those words, and nothing would have noticed.
neg_probe "no category field is typed as money" \
  "mut 'd.category_fields.furniture.proposed[\"المقاس\"] = \"sar_amount, NOT money\";' $CATALOG"

# An open question stripped of its id — README rule 5, every gap carries an id.
neg_probe "every open question carries an id" \
  "mut 'delete d.open_questions[0].id;' $CATALOG"

# A source demoted to FAILED while rows still cite it.
neg_probe "no row cites a source that could not be read" \
  "mut 'd.sources.haraj.access = \"FAILED — pretend it never loaded\";' $SOURCES"

# --- the exit-code split ---------------------------------------------------
#
# The harness reads labels, so it cannot see exit codes, and the two-vs-one
# distinction is the part a future reader is most likely to flatten back into a
# single failure mode. Asserted directly.
echo
echo "-- exit codes --"

node tests/v2/taxonomy.check.mjs >/dev/null 2>&1
if [ "$?" -eq 2 ]; then
  printf 'CAUGHT  %-64s\n' "unmodified tree exits 2 (structure sound, count unmet)"
  NEG_PASS=$((NEG_PASS + 1))
else
  printf 'WRONG   %-64s\n' "unmodified tree should exit 2"
  NEG_FAIL=$((NEG_FAIL + 1))
fi

mut 'd.subcategories[0].parent = "no-such-category";' $CATALOG
node tests/v2/taxonomy.check.mjs >/dev/null 2>&1
if [ "$?" -eq 1 ]; then
  printf 'CAUGHT  %-64s\n' "a structural break exits 1 — it cannot hide in the count gap"
  NEG_PASS=$((NEG_PASS + 1))
else
  printf 'WRONG   %-64s\n' "a structural break must exit 1"
  NEG_FAIL=$((NEG_FAIL + 1))
fi
neg_restore

# 23 neg_probe calls + the inverted probe + the two exit-code assertions = 26.
neg_report "taxonomy-negative" 27
