#!/usr/bin/env bash
# ============================================================================
# Proves every check in tests/v2/graph.check.mjs can FAIL.
#
#   ./tests/v2/graph-negative.check.sh
#
# Needs git, perl and node. About twenty seconds.
#
# ---------------------------------------------------------------------------
# WHY THIS EXISTS
#
# `graph.check.mjs` prints ninety-three PASS lines. That proves ninety-three
# comparisons ran and agreed. It does NOT prove that any of them would have
# disagreed had the board been wrong — and this particular file is unusually
# exposed to that, because most of its assertions are anchored by a REGEX
# AGAINST PROSE. Reword the sentence and the anchor stops matching. Some of
# those cases are caught by `grab()` announcing "the sentence this reads is
# gone"; the ones inside a loop are not, they simply stop iterating.
#
# The suite's own header records three times this already happened:
#
#   * `reachRows > 0` went green while silently skipping the newest row, because
#     that row's cell said "**19 of 39 each**" and the regex wanted `**`
#     immediately after the denominator. Seven of eight rows checked, PASS.
#   * `[a-z]` in a number class stopped matching the moment a count crossed
#     twenty and the word grew a hyphen.
#   * deleting a reach-table row changed nothing, because the row count and its
#     denominator dropped together.
#
# All three were found by running a probe, not by reading. This file is those
# probes, kept.
#
# ---------------------------------------------------------------------------
# WHAT IS PROBED, AND WHAT IS NOT — SAID PLAINLY
#
# Fifty-two probes against ninety-three assertions. The gap is not laziness and
# it is not coverage theatre; it is three loops that generate one assertion per
# row of a table:
#
#   * `decisions index: D-0n's open items …`   — six, one per record
#   * `D-0n: its §5 open items …`              — six, one per record
#   * `reach of On` / `reach denominator …`    — one pair per reach row
#
# A probe kills one member of each family, which proves the loop body can fail.
# It does not prove the loop VISITS every row — that is a different question,
# and it is the one that got this suite twice. So it is asserted inside
# `graph.check.mjs` itself, by counting: `every row of the reach table was
# parsed` and `decisions index: every D-record row was parsed`. Probes 41 and 7
# break those two counters, which is what makes the family probes meaningful.
#
# ---------------------------------------------------------------------------
# THE MUTATIONS ARE REALISTIC ON PURPOSE
#
# Almost every one is an edit somebody would actually make: a number left
# behind after the board changed, a row dropped from a table, an id removed
# from one copy of the graph and not the other. Two are deliberate vandalism
# (probes 50 and 52) because the thing being probed is the suite's own
# blind-spot guard, and nothing subtle triggers it.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
. tests/lib/negative.sh

neg_files "docs/v2/TICKETS.md
docs/v2/SPEC.md
docs/decisions/README.md
docs/decisions/D-04-ai-product-surface.md
docs/decisions/D-05-deposit.md
docs/ai/local-model.md"

neg_run "node --no-warnings tests/v2/graph.check.mjs"

echo "==> breaking the V2 board on purpose — every probe must be CAUGHT"
echo

# ---------------------------------------------------------------------------
# A. The graph is written twice. Break one copy and only one copy.
# ---------------------------------------------------------------------------
neg_probe "edges in TICKETS.md 'blocked on' that SPEC.md §4.3 'blocks' omits" \
  'perl -pi -e '"'"'s/(\| D-04 \| )V2-A20( \|)/${1}none${2}/ if /^\| \*\*O11\*\* \|/'"'"' docs/v2/SPEC.md'

neg_probe "edges in SPEC.md §4.3 'blocks' that TICKETS.md 'blocked on' omits" \
  'perl -pi -e '"'"'s/\*\*O11\*\*/none/ if /^\| \*\*V2-A20\*\* \|/'"'"' docs/v2/TICKETS.md'

# ---------------------------------------------------------------------------
# B. The register is whole — ids, citations, and the two copies of the
#    record→item mapping (the index cell and the record's own §5).
# ---------------------------------------------------------------------------
neg_probe "O-ids run 1..N with no gap and no duplicate" \
  'perl -pi -e '"'"'s/^\| \*\*O34\*\* \|/| **O99** |/'"'"' docs/v2/SPEC.md'

neg_probe "every O-id cited in the V2 docs or the decisions index exists in the register" \
  'perl -pi -e '"'"'s{^}{"O77 is still open.\n"}e if $. == 1'"'"' docs/v2/TICKETS.md'

neg_probe "every ticket named in a 'depends on' cell is a real ticket" \
  'perl -pi -e '"'"'s/\| V2-A1 \|/| V2-C99 |/ if /^\| \*\*V2-A4\*\* \|/'"'"' docs/v2/TICKETS.md'

neg_probe "every ticket named in the register's 'blocks' column is a real ticket" \
  'perl -pi -e '"'"'s/\| V2-A4 \|$/| V2-C99 |/ if /^\| \*\*O34\*\* \|/'"'"' docs/v2/SPEC.md'

# The row-count assertion. It is what makes the six per-record probes below
# mean anything: without it, a loop that visits nothing passes exactly as
# loudly as one that visits six records.
neg_probe "decisions index: every D-record row was parsed" \
  'perl -ni -e '"'"'print unless /^\| \[D-05\]\(/'"'"' docs/decisions/README.md'

# The documented one: the ids stay real, keep blocking V2-A19, and pass every
# other assertion — only the page a reader opens FIRST goes quiet about them.
neg_probe "decisions index: D-03's open items match the register's source column" \
  'perl -pi -e '"'"'s/, \*\*O31[^*]*O33\*\*// if /^\| \[D-03\]\(/'"'"' docs/decisions/README.md'

neg_probe "every D-record the index names has a file on disk" \
  'perl -pi -e '"'"'s{$}{"\n| [D-07](D-07-ghost.md) | ghost | DECIDED | O1 | none |"}e if /^\| \[D-06\]\(/'"'"' docs/decisions/README.md'

neg_probe "D-04: its §5 open items are exactly the ones the register sources to it" \
  'perl -ni -e '"'"'print unless /^\| \*\*O34\*\* \|/'"'"' docs/decisions/D-04-ai-product-surface.md'

neg_probe "every open item raised in a record reached the register, and vice versa" \
  'perl -pi -e '"'"'s{^}{"9. **`O78` — is this a thing?**\n"}e if $. == 1'"'"' docs/decisions/D-05-deposit.md'

# The measurement report raises nothing and only cites, which is exactly where
# a stale id survives a renumber. It is also the only file this assertion
# covers that no other assertion reads.
neg_probe "every O-id cited in a decision record or the measurement report exists in the register" \
  'perl -pi -e '"'"'s{^}{"See O88 for the bounds.\n"}e if $. == 1'"'"' docs/ai/local-model.md'

# ---------------------------------------------------------------------------
# C. Every total stated in prose, in all three documents.
#
#    Two shapes of mutation appear here and the difference matters. Most change
#    the PROSE and leave the graph alone — the "somebody updated the board and
#    not the sentence" failure, run backwards. Probes 14, 15 and 16 do the
#    opposite: they change the GRAPH and leave the prose, which is the failure
#    as it actually occurs.
# ---------------------------------------------------------------------------
neg_probe "TICKETS.md header: ticket count" \
  'perl -pi -e '"'"'s/\*\*40 tickets, plus/**39 tickets, plus/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md header: dependency edges" \
  'perl -pi -e '"'"'s/\| V2-B1 \|/| V2-B1, V2-A14 |/ if /^\| \*\*V2-B2\*\* \|/'"'"' docs/v2/TICKETS.md'

# One mutation, two probes: it drops a blocking edge from BOTH copies of the
# graph, so §4.3 and the board still agree with each other and disagree only
# with the header. That is the consistent-but-stale edit, and it is the one a
# reviewer waves through.
DROP_O34='perl -pi -e '"'"'s/\*\*O14, O34\*\*/**O14**/ if /^\| \*\*V2-A4\*\* \|/'"'"' docs/v2/TICKETS.md && perl -pi -e '"'"'s/\| V2-A4 \|$/| none |/ if /^\| \*\*O34\*\* \|/'"'"' docs/v2/SPEC.md'
neg_probe "TICKETS.md header: blocking edges" "$DROP_O34"
neg_probe "TICKETS.md header: items that block a ticket" "$DROP_O34"

neg_probe "TICKETS.md header: register size" \
  'perl -pi -e '"'"'s/of the 34 open owner questions/of the 33 open owner questions/'"'"' docs/v2/TICKETS.md'

neg_probe "decisions index: record count" \
  'perl -pi -e '"'"'s/All six records are/All five records are/'"'"' docs/decisions/README.md'

# The documented one: reverting the register size to its pre-O31 value left
# every other assertion in the suite green.
neg_probe "decisions index: register size" \
  'perl -pi -e '"'"'s/Thirty-four open items remain/Thirty open items remain/'"'"' docs/decisions/README.md'

neg_probe "TICKETS.md reach section: register size" \
  'perl -pi -e '"'"'s/Thirty-four open items, listed in full/Thirty open items, listed in full/'"'"' docs/v2/TICKETS.md'

# A header card and a glossary line. Both of these were stale for at least one
# commit before anything read them, and both are the FIRST number a reader
# sees. They are two documents, so they are two probes.
neg_probe "SPEC.md: ticket count" \
  'perl -pi -e '"'"'s/\*\*40 tickets plus the unblock step\*\*/**39 tickets plus the unblock step**/'"'"' docs/v2/SPEC.md'

neg_probe "decisions/README.md: ticket count" \
  'perl -pi -e '"'"'s/\*\*40 tickets plus the unblock step\*\*/**39 tickets plus the unblock step**/'"'"' docs/decisions/README.md'

neg_probe "SPEC.md: highest O-id" \
  'perl -pi -e '"'"'s/`O34`/`O30`/ if /\*\*Open item\*\*/'"'"' docs/v2/SPEC.md'

neg_probe "decisions/README.md: highest O-id" \
  'perl -pi -e '"'"'s/`O34`\)/`O30`)/'"'"' docs/decisions/README.md'

neg_probe "TICKETS.md: issues the board would open" \
  'perl -pi -e '"'"'s/forty issues are hard/thirty issues are hard/'"'"' docs/v2/TICKETS.md'

neg_probe "SPEC.md §4.3 heading: register size" \
  'perl -pi -e '"'"'s/thirty-four real blockers/thirty real blockers/'"'"' docs/v2/SPEC.md'

neg_probe "SPEC.md §4.3: items that block a ticket" \
  'perl -pi -e '"'"'s/\*\*34 of the 34 items/**33 of the 34 items/'"'"' docs/v2/SPEC.md'

neg_probe "SPEC.md §4.3: register size" \
  'perl -pi -e '"'"'s/34 of the 34 items/34 of the 33 items/'"'"' docs/v2/SPEC.md'

# ---------------------------------------------------------------------------
# D. Unblocked, the waves, and what answering an item opens up.
#
#    Each of these is stated twice — as a count and as a list — and the probes
#    are paired to match: one breaks the number and leaves the list, the next
#    breaks the list and leaves the number. A correct count beside a stale list
#    is still a lie, and only the second probe of each pair can prove the suite
#    reads the list at all.
# ---------------------------------------------------------------------------
neg_probe "TICKETS.md: unblocked count" \
  'perl -pi -e '"'"'s/\*\*Four tickets are unblocked:/**Five tickets are unblocked:/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: the unblocked list matches the closure" \
  'perl -pi -e '"'"'s/V2-A14, V2-B1, V2-B2, V2-B3\.\*\*/V2-A14, V2-B1, V2-B2.**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: the wave table has a row per wave" \
  'perl -ni -e '"'"'print unless /^\| \*\*2\*\* \| V2-B2/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: wave 1 membership" \
  'perl -pi -e '"'"'s/\| V2-A14, V2-B1 \|/| V2-A14 |/ if /^\| \*\*1\*\* \|/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: wave-1 count — how many people can work at once" \
  'perl -pi -e '"'"'s/\*\*Two of them can be started:/**Three of them can be started:/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: wave-1 list" \
  'perl -pi -e '"'"'s/can be started: V2-A14, V2-B1\.\*\*/can be started: V2-A14.**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: unblocked before O1/O2" \
  'perl -pi -e '"'"'s/unblocked set from \*\*4 to 9\*\*/unblocked set from **3 to 9**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: which tickets O1/O2 release" \
  'perl -pi -e '"'"'s/, `V2-A17`// if /measured by re-running/'"'"' docs/v2/TICKETS.md'

# The arrow is a multibyte character and perl is not run with -CSD here, so the
# pattern steps around it with a negated class rather than matching it.
neg_probe "TICKETS.md: unblocked after O1/O2/O20" \
  'perl -pi -e '"'"'s/(and the set goes 9)([^0-9]+)10/${1}${2}11/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: reach of O1+O2" \
  'perl -pi -e '"'"'s/upstream of \*\*28 of the 40/upstream of **27 of the 40/'"'"' docs/v2/TICKETS.md'

# ---------------------------------------------------------------------------
# E. The reach table and the prose around it — the part of this board that has
#    gone wrong the most often.
# ---------------------------------------------------------------------------
neg_probe "reach denominator on the O1 row" \
  'perl -pi -e '"'"'s/\*\*28 of 40\*\*/**28 of 39**/ if /^\| \*\*O1\*\* \|/'"'"' docs/v2/TICKETS.md'

neg_probe "reach of O20" \
  'perl -pi -e '"'"'s/\*\*21 of 40\*\*/**20 of 40**/ if /^\| \*\*O20\*\* \|/'"'"' docs/v2/TICKETS.md'

# A row that stops PARSING rather than one that goes wrong — the "19 of 39
# each" failure, reproduced. The row still looks like a row; the figure just
# loses its emphasis, so the inner regex skips it and says nothing.
neg_probe "every row of the reach table was parsed" \
  'perl -pi -e '"'"'s/\| \*\*10 of 40\*\* \|/| 10 of 40 |/ if /^\| \*\*O21\*\* \|/'"'"' docs/v2/TICKETS.md'

# A row DELETED rather than skipped. Row count and denominator drop together,
# every remaining figure stays correct, and the only thing that notices is the
# table's written-down selection rule.
neg_probe "TICKETS.md: items the reach table names" \
  'perl -ni -e '"'"'print unless /^\| \*\*O34\*\* \| Which two percentiles/'"'"' docs/v2/TICKETS.md'

# The other half of that rule: what the table omits is a CLAIM about the
# omitted items, and this tightens the claim until it is false.
neg_probe "TICKETS.md: omitted items all reach" \
  'perl -pi -e '"'"'s/reaches six tickets or fewer\.\*\*/reaches two tickets or fewer.**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: reached by O1/O2 but not released by them" \
  'perl -pi -e '"'"'s/The other \*\*23\*\* carry/The other **22** carry/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: items reaching six tickets or fewer" \
  'perl -pi -e '"'"'s/\*\*twenty-two items reach six/**twenty items reach six/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: items reaching exactly one ticket" \
  'perl -pi -e '"'"'s/\*\*twelve reach exactly one ticket\*\*/**ten reach exactly one ticket**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: the items reaching exactly six are the ones named" \
  'perl -pi -e '"'"'s/`O3`, `O8` and/`O3` and/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: reach of O10" \
  'perl -pi -e '"'"'s/`O10` reaches five\./`O10` reaches four./'"'"' docs/v2/TICKETS.md'

# The assertion that costs an id a row. `O15` is real, is in the register, and
# is pinned by nothing — so naming it in this section is exactly the "`O11`
# reaches none" shape: prose that reads as verified because it sits next to
# numbers that are.
neg_probe "every O-id discussed in the reach section is pinned by a row or a checked sentence" \
  'perl -pi -e '"'"'s{$}{"\n\nSee also `O15`, which reaches plenty."}e if /^## The register this board is waiting on/'"'"' docs/v2/TICKETS.md'

# ---------------------------------------------------------------------------
# F. The suite's own blind-spot guards. These fire before any assertion runs,
#    and they are the difference between a red build and ninety-three vacuous
#    passes. Nothing subtle triggers them, so these three mutations are blunt.
# ---------------------------------------------------------------------------
neg_probe "the reach section could not be located" \
  'perl -pi -e '"'"'s/^## The register this board is waiting on/## The register/'"'"' docs/v2/TICKETS.md'

# grab(): a sentence reworded rather than a number changed. The check has to
# say "the sentence I read is gone" rather than skipping quietly, because the
# two assertions behind this one both stop running.
neg_probe "TICKETS.md states what is unblocked" \
  'perl -pi -e '"'"'s/\*\*Four tickets are unblocked:/**Four tickets are open for claiming:/'"'"' docs/v2/TICKETS.md'

# The board table stops parsing entirely. Without the vacuity guard this is a
# clean green run over an empty graph.
neg_probe "a table shape changed and every assertion below would pass vacuously" \
  'perl -pi -e '"'"'s/^\| \*\*(V2-[^*]+)\*\* \|/| $1 |/'"'"' docs/v2/TICKETS.md'

neg_report "V2-GRAPH-NEGATIVE" 52
