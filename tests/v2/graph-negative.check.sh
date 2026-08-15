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
# `graph.check.mjs` prints 137 PASS lines. That proves 137
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
# 82 probes against 137 assertions. The gap is not laziness and
# it is not coverage theatre; it is four loops that generate one assertion per
# row of a table:
#
#   * `decisions index: D-0n's open items …`   — six, one per record
#   * `D-0n: its §5 open items …`              — six, one per record
#   * `reach of On` / `reach denominator …`    — one pair per reach row
#   * `reach of Rn` / `R reach denominator …`  — one pair per R reach row
#
# A probe kills one member of each family, which proves the loop body can fail.
# It does not prove the loop VISITS every row — that is a different question,
# and it is the one that got this suite twice. So it is asserted inside
# `graph.check.mjs` itself, by counting: `every row of the reach table was
# parsed`, `every row of the R reach table was parsed` and `decisions index:
# every D-record row was parsed`. Probes 41, 7 and the section-G row-deletion
# probe break those counters, which is what makes the family probes meaningful.
#
# The R reach table gets a second, stronger counter — `the R reach table names
# exactly the records that conflict with the PRD` — because counting rows alone
# is what let a deleted row and its denominator drop together, twice.
#
# ---------------------------------------------------------------------------
# THE MUTATIONS ARE REALISTIC ON PURPOSE
#
# Almost every one is an edit somebody would actually make: a number left
# behind after the board changed, a row dropped from a table, an id removed
# from one copy of the graph and not the other. Two are deliberate vandalism
# (probes 50 and 52) because the thing being probed is the suite's own
# blind-spot guard, and nothing subtle triggers it.
#
# One probe (G6) mutates `tests/v2/graph.check.mjs` rather than a document. It
# has to: the assertion it targets guards a hypothetical the checker measures on
# a throwaway copy of the board, and the only way to prove that guard is real is
# to remove the line that puts the real board back.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
. tests/lib/negative.sh

# `graph.check.mjs` is declared as a mutation surface for one probe only (G6),
# which breaks the checker's own restore-the-board line to prove the assertion
# guarding it is not decorative. Everything else here mutates documents.
neg_files "docs/v2/TICKETS.md
docs/v2/SPEC.md
docs/decisions/README.md
docs/decisions/D-04-ai-product-surface.md
docs/decisions/D-05-deposit.md
docs/ai/local-model.md
tests/v2/graph.check.mjs"

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
#    and they are the difference between a red build and 137 vacuous
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

# ---------------------------------------------------------------------------
# G. THE RATIFICATION GATE — the `ratification` column and the `R` register.
#
# These are new on 2026-08-15 and they are the highest-risk block in the file,
# for a reason worth stating: the column was added to fix a defect whose entire
# signature was "a check that is green because it is looking at nothing." Nine
# structural assertions and a second closure went in at once, and the run they
# first produced was 43 fresh PASS lines. That is precisely the evidence that
# proves nothing — the whole board parsed identically before the column existed,
# because the row regex is not anchored at the end of the line.
#
# One of these probes already earned its place before this file was committed:
# the pin rule as first written auto-exempted R5 and R6 (they conflict with
# nothing, so the code excused them), which made it unfallible for every id that
# two other checks did not already catch. Writing the probe is what showed it.
# ---------------------------------------------------------------------------
echo
echo "==> the ratification gate"
echo

# G1. The two registers must not mix. README.md says so in bold and the failure
#     is silent in both directions: an R in `blocked on` looks like a question
#     nobody can answer, an O in `ratification` looks like a signature nobody
#     can give.
neg_probe "no 'blocked on' cell names an R-id" \
  'perl -pi -e '"'"'s/\| — \| — \|$/| **R1** | — |/ if /^\| \*\*V2-C4\*\*/'"'"' docs/v2/TICKETS.md'

neg_probe "no 'depends on' cell names an R-id" \
  'perl -pi -e '"'"'s/\| V2-B1 \|/| V2-B1, R2 |/ if /^\| \*\*V2-B2\*\*/'"'"' docs/v2/TICKETS.md'

neg_probe "no 'ratification' cell names an O-id or a ticket" \
  'perl -pi -e '"'"'s/\*\*R3\*\* \|$/**R3, O31** |/ if /^\| \*\*V2-A19\*\*/'"'"' docs/v2/TICKETS.md'

# G2. The R register is whole — the same three questions the O register answers,
#     asked one register over, because that is where the hole was this time.
neg_probe "R-ids run 1..N with no gap and no duplicate" \
  'perl -pi -e '"'"'s/^\| \*\*R6\*\*/| **R7**/'"'"' docs/decisions/README.md'

neg_probe "every R names a decision record that exists on disk" \
  'perl -pi -e '"'"'s/\[D-02\]\(D-02-categories\.md\)/[D-09](D-09-nope.md)/ if /^\| \*\*R1\*\*/'"'"' docs/decisions/README.md'

neg_probe "every decision record has exactly one R row" \
  'perl -pi -e '"'"'s/\[D-05\]\(D-05-deposit\.md\)/[D-04](D-04-ai-product-surface.md)/ if /^\| \*\*R6\*\*/'"'"' docs/decisions/README.md'

neg_probe "every R-id cited in the V2 docs or the decisions index exists in the R register" \
  'perl -pi -e '"'"'s{$}{"\n\nSee also `R8`, which is not a thing."}e if /^### The second gate/'"'"' docs/v2/TICKETS.md'

# G3. THE PROBE THIS WHOLE SECTION EXISTS FOR.
#
# Clearing V2-A19's cell reproduces the original defect exactly: D-03's pause is
# live on `main`, PRD.md:784 still says anti-sniping is the single exception,
# and the ticket that implements it renders with nothing in the column. Before
# the column existed this was not a mutation — it was the committed state.
neg_probe "every R that conflicts with PRD.md is carried by at least one ticket" \
  'perl -pi -e '"'"'s/\*\*R3\*\* \|$/— |/ if /^\| \*\*V2-A19\*\*/'"'"' docs/v2/TICKETS.md'

# The opposite error, which is the one a careful session makes: gating a ticket
# on a record the PRD is merely SILENT about. R5 is D-04, the AI surface; rule 4
# makes it safe to build. A gate there is a gate the owner never asked for.
neg_probe "no ticket is gated on an R that does not conflict with PRD.md" \
  'perl -pi -e '"'"'s/\| \*\*O12\*\* \| — \|/| **O12** | **R5** |/ if /^\| \*\*V2-A6\*\*/'"'"' docs/v2/TICKETS.md'

# G4. The figures the section states about itself.
neg_probe "TICKETS.md: records conflicting with the PRD" \
  'perl -pi -e '"'"'s/\*\*Four of the six conflict/**Three of the six conflict/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: R register size" \
  'perl -pi -e '"'"'s/Four of the six conflict/Four of the five conflict/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: tickets carrying an R directly" \
  'perl -pi -e '"'"'s/\*\*Ten tickets carry one directly/**Nine tickets carry one directly/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: the directly-carrying list matches the board" \
  'perl -pi -e '"'"'s/`V2-A1`, `V2-B4` \(`R1`\)/`V2-A1` (`R1`)/'"'"' docs/v2/TICKETS.md'

# Grouping, probed WITHOUT changing the total. V2-B4 moves from R1 to R2: ten
# tickets are still listed, all ten are still the right ten, and two groups are
# now wrong. A count assertion cannot see this and the list assertion cannot
# either — only the per-group one can.
neg_probe "TICKETS.md: the tickets listed under R1" \
  'perl -pi -e '"'"'s/`V2-A1`, `V2-B4` \(`R1`\); `V2-C2`, `V2-A2`, `V2-B7` \(`R2`\)/`V2-A1` (`R1`); `V2-C2`, `V2-A2`, `V2-B7`, `V2-B4` (`R2`)/'"'"' docs/v2/TICKETS.md'

# The unstated-precondition assertions. Naming the WRONG R keeps the sentence
# well-formed and the figure correct, and makes the claim false — which is the
# shape the whole section is about.
neg_probe "needs R4 ratified to be a ready-count" \
  'perl -pi -e '"'"'s/that `R1` is ratified/that `R4` is ratified/'"'"' docs/v2/TICKETS.md'

neg_probe "needs R1+R4 ratified to be a ready-count" \
  'perl -pi -e '"'"'s/that `R1` \*\*and\*\* `R2` are ratified/that `R1` **and** `R4` are ratified/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: unblocked but not cleared, today" \
  'perl -pi -e '"'"'s/\*\*Today zero unblocked tickets/**Today two unblocked tickets/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: unblocked but not cleared after O1/O2" \
  'perl -pi -e '"'"'s/becomes \*\*five\*\*/becomes **four**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: which tickets ratification holds after O1/O2" \
  'perl -pi -e '"'"'s/, `V2-A17` — every one/ — every one/'"'"' docs/v2/TICKETS.md'

neg_probe "reach of R1" \
  'perl -pi -e '"'"'s/\*\*28 of 40\*\*/**27 of 40**/ if /^\| \*\*R1\*\*/'"'"' docs/v2/TICKETS.md'

# The exact historical defect, reproduced one table over: a cell that says
# "**21 of 40 each**" stops matching a regex that wants `**` after the
# denominator, and the loop silently visits one row fewer.
neg_probe "every row of the R reach table was parsed" \
  'perl -pi -e '"'"'s/\*\*21 of 40\*\*/**21 of 40 each**/ if /^\| \*\*R2\*\*/'"'"' docs/v2/TICKETS.md'

# And the OTHER historical defect: deleting a row drops the count and the
# denominator together, so counting rows cannot see it. This is the assertion
# that can — the table's membership is pinned to the register, not to itself.
neg_probe "the R reach table names exactly the records that conflict with the PRD" \
  'perl -ni -e '"'"'print unless /^\| \*\*R3\*\* \| D-03/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: tickets downstream of an unratified decision" \
  'perl -pi -e '"'"'s/\*\*36 of the 40 tickets sit downstream/**35 of the 40 tickets sit downstream/'"'"' docs/v2/TICKETS.md'

# The list, probed without touching the count — swapping one id for another
# keeps "four" correct and makes the four wrong.
neg_probe "TICKETS.md: which tickets are untouched by ratification" \
  'perl -pi -e '"'"'s/`V2-B2`, `V2-B3` — \*\*the same four/`V2-B2`, `V2-A18` — **the same four/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: R3's reach on the wide reading" \
  'perl -pi -e '"'"'s/reach goes 1 → 3\*\*/reach goes 1 → 4**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: the records that gate no ticket are the ones that conflict with nothing" \
  'perl -pi -e '"'"'s/\*\*`R5` and `R6` carry no ticket/**`R5` and `R4` carry no ticket/'"'"' docs/v2/TICKETS.md'

# The pin rule. Rewording the sentence that pins R5 and R6 un-pins them both —
# which is the realistic version of the failure, and the one that showed the
# first draft of this check was auto-exempting them and could never fire.
neg_probe "every R-id discussed in the ratification section is pinned" \
  'perl -pi -e '"'"'s/carry no ticket at all\*\*/gate nothing whatsoever**/'"'"' docs/v2/TICKETS.md'

# G5. The two guards that fire before any assertion runs.
neg_probe "ratification rows — a table shape changed" \
  'perl -pi -e '"'"'s/^\| \*\*(R\d+)\*\* \|/| $1 |/'"'"' docs/decisions/README.md'

# The 6th column is REQUIRED by the row regex, so a row written with five cells
# does not parse at all. Same label as the probe in section B, deliberately: it
# is a different way to break the same counter, and it is the one that proves
# the required-column design does what it was chosen for. An optional group here
# would read a forgotten cell as "no ratification needed" and stay green.
neg_probe "TICKETS.md header: ticket count" \
  'perl -pi -e '"'"'s/ \| — \|$/ |/ if /^\| \*\*V2-B3\*\*/'"'"' docs/v2/TICKETS.md'

# G6. The check that guards THIS FILE's own honesty, not the board's.
#
# `R3's reach on the wide reading` mutates the parsed board in memory to answer
# a hypothetical the owner has to decide. If that mutation leaked, every figure
# printed after it would be wrong and all of them would agree with each other —
# the failure mode with no symptom. So the restore is asserted, and the only way
# to probe an assertion about the checker is to break the checker.
neg_probe "the hypothetical was discarded" \
  'perl -pi -e '"'"'s/^  for \(const \[t, arr\] of saved\) board\.get\(t\)\.ratif = arr;.*$/  \/\/ restore removed by probe/'"'"' tests/v2/graph.check.mjs'

neg_report "V2-GRAPH-NEGATIVE" 82
