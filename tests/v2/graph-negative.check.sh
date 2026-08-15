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
# `graph.check.mjs` prints 181 PASS lines. That proves 181 comparisons ran and
# agreed. It does NOT prove that any of them would have disagreed had the board
# been wrong — and this particular file is unusually
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
# 139 probes against 181 assertions. The gap is not laziness and it is not
# coverage theatre; it is five loops that generate one assertion per row of a
# table, or per stated reading:
#
#   * `decisions index: D-0n's open items …`   — six, one per record
#   * `D-0n: its §5 open items …`              — six, one per record
#   * `reach of On` / `reach denominator …`    — one pair per reach row
#   * `reach of Rn` / `R reach denominator …`  — one pair per R reach row
#   * `wider reading #n — …`                   — four per stated R3 reading
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
# The wider-reading family has the same counter in prose form: TICKETS.md states
# how many readings it measured, `how many wider R3 readings are stated` compares
# that word to the number of sentences actually matched, and section G probes
# both halves. It is not decoration — the single-`grab` version of that check
# measured the first reading and never saw the second, which is the reading the
# owner is being asked to decide against.
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
# Eight probes mutate `tests/v2/graph.check.mjs` rather than a document. Two of
# them have to: what they target is an assertion ABOUT the checker — that a
# hypothetical measured on a throwaway board was discarded, and that no label
# can be found only by matching a different one — and the only way to probe an
# assertion about the checker is to break the checker.
#
# The other six are a different reason and a firmer one. `PRD.md` is not in
# `neg_files` and must not be: the owner ratifies it by hand, no session edits
# it, and that holds even for a mutation this suite would restore a second
# later — an interrupted run must not be able to leave it broken. So the probes
# for `every PRD row the ratification items rest on still sits on the line cited`
# and for `PRD.md:1813 still says no screen may imply …` break the checker's
# expectation instead of the file. Same catch, and the file the owner owns stays
# untouched.
#
# Five of those six aim at the same assertion from different rows. Its list went
# 3 → 12 → 18 → 32 as §19/§22, then §20, then §21 were read inward, and one probe
# against one tuple stops being evidence for thirty-one others: the loop body
# is shared, but a typo in a newly added tuple is not caught by a probe on an old
# one.
#
# That reasoning does NOT extend to one probe per tuple, and the third probe is
# where the line is drawn: it is probe-per-KIND, not probe-per-row. Four kinds
# sit in that list and each gets at least one probe — a §19/§22 **exclusion**
# row (two probes, because that kind spans two sections), a §20 **assumption**
# row, a §21 **register entry**, and the one **rationale clause** (`:798`,
# pinned separately from the rule that shares its line — that separation exists
# because this probe found it missing), whose deletion leaves every rule it is
# cited beside still reading perfectly while the argument built on it is gone.
# Each is a different table, a different shape of sentence, and — if any two are
# ever read by different code — a different failure. Thirty-two probes against
# one shared loop body would be coverage theatre; five against four kinds is the
# claim the suite can actually defend.
#
# The §21 sweep's second pass added two more register entries (`:2032`, `:2035`)
# and NO probe, deliberately. That kind already has one, and the rule above is
# per kind. A probe added there would be the theatre this paragraph refuses.
#
# The `ARCHITECTURE.md` sweep (section J) has its OWN list on the same shape and
# the same budget, and it counts FIVE kinds rather than four. The fifth is why
# it is spelled out here instead of being folded into the paragraph above:
#
#   * a **reversal condition** — an `ADR` conditional whose trigger has fired
#   * a **prose absolute** — a sentence that simply stopped being true
#   * a **table row** — a boundary, the same shape as a §19 exclusion
#   * a **stale count** — a figure that moved underneath a claim
#   * a **shipped constraint** — a `WITH CHECK` that is live on `main`
#
# The last one is not a document and does not fail like one. Prose rots when
# somebody rewords it; a policy changes when somebody changes BEHAVIOUR, so its
# two probes are the only ones in this file whose real-world trigger is a
# migration rather than an edit. That is a louder failure for a better reason,
# and it is the reason the migration is a declared mutation surface at all.
#
# ---------------------------------------------------------------------------
# A LABEL IS AN ARGUMENT TO grep -F, SO QUOTE IT LIKE ONE
#
# `neg_probe`'s first argument is matched literally against the checker's
# output. Two labels here contain backticks, and they are in SINGLE quotes for
# that reason. In double quotes the shell runs command substitution first, the
# label arrives as "reach of " and matches nine other checks instead.
#
# Not theoretical: it happened on the way to writing this line, and the symptom
# was a MISSED verdict against a check that was working perfectly — the same
# symptom, and the same root cause, as the label collision G7 exists for. One
# arrived through the shell and one through the checker.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
. tests/lib/negative.sh

# `graph.check.mjs` is declared as a mutation surface for three probes (G6, G7,
# G8): two break the checker's own self-honesty assertions, and one stands in
# for a `PRD.md` edit this suite is not allowed to make. Everything else here
# mutates documents. `PRD.md` is absent from this list on purpose — see the
# header — and adding it is not a shortcut, it is the thing being refused.
#
# THE LAST ENTRY IS THE FIRST EXECUTABLE FILE THIS HARNESS MUTATES, and that is
# worth one paragraph rather than a silent line. Everything above it is prose or
# a checker; a migration that is live on `main` is neither. The safety argument
# is unchanged and it is the harness's, not this suite's: `neg_files` refuses to
# start if any declared file is dirty, arms the restore trap only AFTER that
# refusal, and `neg_probe` restores with `git checkout --` before it reads a
# verdict. Nothing here runs SQL — the migration is read as text by
# `graph.check.mjs` and mutated as text by section J. The reason to accept the
# added surface at all is that crossing 6 rests on a shipped `WITH CHECK`, and a
# pin nothing can break is not a pin.
neg_files "docs/v2/TICKETS.md
docs/v2/SPEC.md
docs/decisions/README.md
docs/decisions/D-04-ai-product-surface.md
docs/decisions/D-05-deposit.md
docs/ai/local-model.md
ARCHITECTURE.md
TEAM.md
GITHUB_PLAN.md
tests/v2/graph.check.mjs
supabase/migrations/20260812120000_bid02_bid_acceptance.sql"

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

neg_probe 'reach of `O20`' \
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
#    and they are the difference between a red build and 164 vacuous
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

neg_probe 'reach of `R1`' \
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

# The two wider readings of `R3`. Each is a hypothetical the owner has to decide
# against, each is measured on a throwaway copy of the board, and each figure in
# the prose is therefore a number that can rot. The assertions are labelled by
# ORDINAL and not by their arrow, deliberately: a label built out of the figure
# it is checking renames itself under the realistic mutation, and `neg_probe`
# then finds no line to match and reports a no-op instead of the catch it made.
neg_probe "TICKETS.md states what R3's reach becomes on a wider reading" \
  'perl -pi -e '"'"'s/reach goes (\d+) → (\d+)\*\*/reach becomes $1 → $2**/g'"'"' docs/v2/TICKETS.md'

# The sentence that says how many readings are above. Without it, deleting a
# superseded reading is invisible: the loop runs one fewer time and everything
# left standing still agrees.
neg_probe "TICKETS.md says how many wider readings it measured" \
  'perl -pi -e '"'"'s/\*\*Two wider readings are measured above\*\*/**Two wider readings appear above**/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: how many wider R3 readings are stated" \
  'perl -pi -e '"'"'s/\*\*Two wider readings are measured/**Three wider readings are measured/'"'"' docs/v2/TICKETS.md'

# The figure a reading starts FROM is R3's committed reach, not a number typed
# next to it. Moving it leaves the arrival figure correct, which is exactly what
# makes it the one left behind.
neg_probe "TICKETS.md: wider reading #1 — the figure it starts from is R3's real reach" \
  'perl -pi -e '"'"'s/reach goes 1 → 3\*\*/reach goes 2 → 3**/'"'"' docs/v2/TICKETS.md'

# A carrier that is not on the board — the realistic version of a renumber
# nobody finished, and the reason the named carriers are compared against the
# board instead of being quietly filtered down to whatever happens to exist.
neg_probe "TICKETS.md: wider reading #1 — every carrier it names is on the board" \
  'perl -pi -e '"'"'s/\(`V2-A11`, `V2-A12`\)/(`V2-A11`, `V2-A99`)/'"'"' docs/v2/TICKETS.md'

neg_probe "TICKETS.md: wider reading #1 — the figure it arrives at is what those carriers reach" \
  'perl -pi -e '"'"'s/reach goes 1 → 3\*\*/reach goes 1 → 4**/'"'"' docs/v2/TICKETS.md'

# Reading #2 gets its own probe for one reason: it is the SECOND match. The
# single-`grab` version of this check read the first sentence and stopped, so
# the 1 → 9 figure — the one the owner is actually being asked to decide
# against — was never measured at all. This probe is what proves the loop
# reaches it.
neg_probe "TICKETS.md: wider reading #2 — the figure it arrives at is what those carriers reach" \
  'perl -pi -e '"'"'s/reach goes 1 → 9\*\*/reach goes 1 → 8**/'"'"' docs/v2/TICKETS.md'

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
# The wider-reading loop mutates the parsed board in memory to answer a
# hypothetical the owner has to decide. If that mutation leaked, every figure
# printed after it would be wrong and all of them would agree with each other —
# the failure mode with no symptom. So the restore is asserted, and the only way
# to probe an assertion about the checker is to break the checker.
#
# The leading indentation is matched with `\s*` and put back through $1. It was
# hard-coded to two spaces, and moving the restore one level deeper — into the
# loop over the stated readings — turned this probe into a NO-OP: the mutation
# matched nothing, the checker stayed green, and the verdict was "the PROBE is
# broken" rather than a missed catch. That is the whole point of running these.
neg_probe "wider reading #1 — the hypothetical was discarded" \
  'perl -pi -e '"'"'s/^(\s*)for \(const \[t, arr\] of saved\) board\.get\(t\)\.ratif = arr;.*$/$1\/\/ restore removed by probe/'"'"' tests/v2/graph.check.mjs'

# ---------------------------------------------------------------------------
# G8. PRD LINE-NUMBER CITATIONS.
#
# PRD.md is NOT a mutation surface here and is deliberately absent from
# `neg_files`: the owner ratifies it by hand and nothing in this suite may edit
# it, not even for a second and not even with a restore. So the two probes that
# need a wrong PRD line get it the other way round — by moving the citation, or
# by breaking the checker's own expectation. Same assertion, same catch, and
# the file the owner owns is never touched.
# ---------------------------------------------------------------------------
neg_probe "every PRD.md line cited by the V2 docs exists and is not blank" \
  'perl -pi -e '"'"'s/`PRD\.md:411`/`PRD.md:99411`/'"'"' docs/v2/SPEC.md'

# Blunt on purpose, like probes 50 and 52: what it targets is the vacuity guard
# itself, and nothing subtle makes a "did we find any at all" check go quiet.
neg_probe "PRD citations were found at all" \
  'perl -pi -e '"'"'s/`PRD\.md:\d+`/PRD/g; s/`:\d+`/LINE/g'"'"' docs/v2/TICKETS.md docs/v2/SPEC.md docs/decisions/README.md'

# The PRD rows the eight ratification items rest on. Probed through the CHECKER
# rather than through PRD.md, for the reason in the section header — this is a
# G6-shaped probe: break the expectation and prove the comparison fires.
neg_probe "every PRD row the ratification items rest on still sits on the line cited" \
  'perl -pi -e '"'"'s/\[1847, "Multiple quantity \/ lots"\]/[1847, "Multiple quantity or lots"]/'"'"' tests/v2/graph.check.mjs'

# The same assertion, aimed at one of the rows added by the inward sweep rather
# than at the §19.2 three. A list that grew from 3 to 32 entries is a list where
# one probe against one entry stops being evidence for the rest: the loop body
# is shared, but a typo in a new tuple is not caught by a probe on an old one.
neg_probe "every PRD row the ratification items rest on still sits on the line cited" \
  'perl -pi -e '"'"'s/\[1917, "Image editing \/ cropping"\]/[1917, "Image editing and cropping"]/'"'"' tests/v2/graph.check.mjs'

# And a third, aimed at a §20 ASSUMPTION row rather than a §19/§22 exclusion.
# Not probe-per-tuple — 32 tuples would mean 32 probes and the loop body is one
# line. It is probe-per-KIND: the two probes above both aim at table rows in an
# "excluded" table, and the §20 sweep added a row that reads as ordinary prose
# in a differently-shaped table. If the two shapes were ever read by different
# code, a probe on an exclusion would say nothing about an assumption.
neg_probe "every PRD row the ratification items rest on still sits on the line cited" \
  'perl -pi -e '"'"'s/\[1949, "nobody needs to schedule a future start"\]/[1949, "nobody needs to schedule a future start time"]/'"'"' tests/v2/graph.check.mjs'

# Fourth kind: a §21 REGISTER ENTRY. Not a scope boundary and not a belief — a
# decision `:2025` says may not be reopened or reinterpreted. Aimed at Q1
# because item 8 is the only ratification item whose tickets carry no `R`.
neg_probe "every PRD row the ratification items rest on still sits on the line cited" \
  'perl -pi -e '"'"'s/\[2031, "A published auction runs to its end time and closes"\]/[2031, "A published auction runs until its end time and closes"]/'"'"' tests/v2/graph.check.mjs'

# Fifth, and the one most worth having: `:798` is a RATIONALE clause as well as
# a rule. Item 8 does not merely say BR-30 exists — it says BR-30's stated
# reason (an informal reserve) survives onto the host-advance power unchanged.
# Delete that clause from the PRD and every rule item 8 cites still reads
# perfectly while the argument it actually makes is gone. No other pinned row
# has that property, which is precisely why one probe on one tuple is not
# evidence here.
#
# THIS PROBE ALREADY EARNED ITS KEEP, AND NOT THE WAY IT WAS MEANT TO. Its
# first draft truncated the tuple to "…runs to its end time and closes",
# expecting the shortened string to stop matching. It came back MISSED, and the
# check was right twice over:
#
#   1. the comparison is `.includes()`, so a truncated expectation is still
#      contained in the line. A pin can only be broken by CHANGING a word, never
#      by dropping one — a shorter expectation is a weaker pin, not a false one.
#      Anyone adding a probe to this label will hit that; it is written here so
#      they hit it once.
#   2. the real defect, which the probe found and the reading had not: the
#      single `:798` tuple pinned BR-30's RULE half, and item 8 argues from its
#      REASON half. The edit item 8 warns about — deleting the informal-reserve
#      clause — would have left this assertion green. `graph.check.mjs` now
#      carries two tuples on line 798, and this probe aims at the second.
neg_probe "every PRD row the ratification items rest on still sits on the line cited" \
  'perl -pi -e '"'"'s/would hold an informal reserve, undermining BR-06 and fairness/would hold an informal minimum, undermining BR-06 and fairness/'"'"' tests/v2/graph.check.mjs'

# Dropping a citation is how a finding gets un-found: the rows stay in the PRD,
# the argument quietly stops pointing at them, and nothing else goes red.
#
# BOTH forms of the citation have to go. The first draft of this probe removed
# only `PRD.md:1848` and came back MISSED — "the rule was broken and the check
# stayed green" — because the same row is cited a second time six lines later
# as a bare `:1848`. The check was right; the probe was aimed at one of two
# doors. It now closes both, because "not one citation survives" is exactly
# what the assertion means.
neg_probe "TICKETS.md still cites every PRD row its ratification items rest on" \
  'perl -pi -e '"'"'s/`PRD\.md:1848`/the increment row/; s/`:1848`/that row/'"'"' docs/v2/TICKETS.md'

# And once for a row the inward sweep added — item 6's, which is cited exactly
# once, so unlike :1848 there is only one door to close.
neg_probe "TICKETS.md still cites every PRD row its ratification items rest on" \
  'perl -pi -e '"'"'s/`PRD\.md:1806`/the stored-balance row/'"'"' docs/v2/TICKETS.md'

# …and once through the OTHER citation form. `PRD.md:1806` above is the long
# form; the §20 rows in item 2's table are written as bare `:1949`, matched by a
# different alternative of the citation regex. Probing only the long form would
# leave that alternative unproven — the same one-of-two-doors mistake the
# :1848 probe made, in the regex rather than in the document.
neg_probe "TICKETS.md still cites every PRD row its ratification items rest on" \
  'perl -pi -e '"'"'s/`:1949`/that row/'"'"' docs/v2/TICKETS.md'

# SC-67 is a sentence, not a table row, and item 6 turns on one verb in it.
neg_probe "PRD.md:1813 still says no screen may imply the excluded payment surface" \
  'perl -pi -e '"'"'s/\(PRD\[1812\] \?\? ""\)\.includes\("offers or implies"\)/(PRD[1812] ?? "").includes("offers or suggests")/'"'"' tests/v2/graph.check.mjs'

# ---------------------------------------------------------------------------
# G9. The blockquote of open questions counts itself, and the reader who
#     miscounts it is the owner, deciding.
# ---------------------------------------------------------------------------
# The replacement carries no apostrophe on purpose. The pattern needs one and
# writes it as `.`, but putting a literal ' in the substitution would need four
# levels of quoting to survive the shell, and a probe nobody can read is a probe
# nobody will maintain.
neg_probe "TICKETS.md states how many questions the ratification blockquote raises" \
  'perl -pi -e '"'"'s/things here are the owner.s to answer/matters here belong to the owner/'"'"' docs/v2/TICKETS.md'

# Both of these probes name the CURRENT count, so both go stale every time the
# blockquote grows — they were `Five`→`Six` and item 5→6 one commit ago. That is
# the tax for probing a hand-maintained count, and it is paid on purpose: the
# alternative is a probe that mutates whatever number it finds, which passes for
# the wrong reason the day the count is already wrong.
neg_probe "TICKETS.md: how many questions the blockquote raises" \
  'perl -pi -e '"'"'s/\*\*Eight things here are the owner/**Nine things here are the owner/'"'"' docs/v2/TICKETS.md'

# A gap rather than a miscount — the count stays right and the numbering goes
# wrong, which is what a hand-numbered list does when an item is removed from
# the middle. Aimed at the last item so the mutation cannot accidentally
# duplicate an existing number and be caught for the wrong reason.
#
# No backtick in this one — item 8's heading starts with plain prose, unlike
# item 7's, which opened with `R5` and needed a `.` to stand in for the
# backtick (writing one would have been command-substituted by the shell).
neg_probe "TICKETS.md: the blockquote's questions are numbered 1..N with no gap" \
  'perl -pi -e '"'"'s/^> \*\*8\. A host can end/> **9. A host can end/'"'"' docs/v2/TICKETS.md'

# ---------------------------------------------------------------------------
# H. The decisions index restates the direct/conditional split in prose, one
#    document over from the table it summarises. That sentence said "three"
#    while its own table listed four non-`no` rows — nothing false, just a
#    narrower question than the sentence was read as asking.
#
#    Both mutations below are the realistic ones: a count updated on one side
#    of a reclassification and not the other.
# ---------------------------------------------------------------------------
neg_probe "decisions index: how many records contradict the PRD directly" \
  'perl -pi -e '"'"'s/\*\*None of the six is `IN PRD`\. Three contradict/**None of the six is `IN PRD`. Four contradict/'"'"' docs/decisions/README.md'

# The count stays right and the membership goes wrong — the error a reader is
# least likely to spot, because the number they check first still agrees.
neg_probe "decisions index: which records contradict the PRD directly" \
  'perl -pi -e '"'"'s/— `R1`, `R2`, `R3` —/— `R1`, `R2`, `R4` —/'"'"' docs/decisions/README.md'

# The sentence wraps mid-clause, and `perl -pi` sees one line at a time, so this
# anchors on the end of the first line rather than on the phrase that spans both.
neg_probe "decisions index: how many contradict it conditionally" \
  'perl -pi -e '"'"'s/\*\*and one$/**and two/'"'"' docs/decisions/README.md'

neg_probe "decisions index: which record contradicts it conditionally" \
  'perl -pi -e '"'"'s/contradicts it conditionally\*\*: `R4`/contradicts it conditionally**: `R5`/'"'"' docs/decisions/README.md'

# The cross-document half: the split can be internally consistent and still fail
# to account for a record the V2 board gates ten tickets on. Reclassifying R1 to
# `no` keeps the index's own two counts self-consistent — it drops out of both
# lists at once — while TICKETS.md still carries it on three tickets.
neg_probe "decisions index: the split accounts for every record gating a V2 ticket" \
  'perl -pi -e '"'"'s/\| \*\*YES — direct\*\* \|/| no |/ if /^\| \*\*R1\*\* \|/'"'"' docs/decisions/README.md'

# G7. The check that guards the PROBE MECHANISM, not the board and not the
# checker's arithmetic.
#
# `neg_probe` finds a check by `grep -F -- "$label" | head -1`. So a label that
# CONTAINS an earlier label, and prints after it, answers for it: the earlier
# check's probe reads the later check's PASS and reports MISSED against a check
# that did its job perfectly.
#
# This is the defect that turned two green probes red in the commit that added
# the ratification column, and it was invisible until the suite was run — three
# new labels ending `, restated` shadowed three old ones. The collision
# assertion is the fix; this probe is what stops the fix from rotting.
#
# The mutation renames one label to a strict extension of another, which is
# exactly the shape a well-meaning "make this clearer" edit produces.
neg_probe "no assertion label is findable only by matching a different one" \
  'perl -pi -e '"'"'s/"TICKETS.md: unblocked once O1 and O2 are answered"/"TICKETS.md: unblocked before O1\/O2 — after, that is"/'"'"' tests/v2/graph.check.mjs'

# ---------------------------------------------------------------------------
# I. THE TWO CROSS-DOCUMENT POINTERS into the board's `ratification` column.
#
#    A pointer is the cheapest thing in this repository to write and the most
#    expensive to notice has rotted, because a stale cross-reference still
#    reads like an answer. These seven mutations break each pointer the way it
#    would actually break: a reclassified record, a moved file, a renamed
#    heading, and a figure helpfully copied to where a reader would find it.
# ---------------------------------------------------------------------------
neg_probe "decisions index: how many records gate a ticket" \
  'perl -pi -e '"'"'s/\*\*Four of the six gate/**Five of the six gate/'"'"' docs/decisions/README.md'

# Count right, membership wrong — again the half a reader checks last.
neg_probe "decisions index: which records gate a ticket" \
  'perl -pi -e '"'"'s/gate at least one ticket: `R1`, `R2`, `R3`, `R4`\./gate at least one ticket: `R1`, `R2`, `R3`, `R5`./'"'"' docs/decisions/README.md'

# The other half of the same sentence. `R5`/`R6` gating nothing is a CLAIM — it
# is what makes the register's silence about the AI surface and the deposit
# safe to build on — so it is checked, not inferred from the first list.
neg_probe "decisions index: which records gate nothing" \
  'perl -pi -e '"'"'s/`R5` and `R6` gate/`R5` and `R4` gate/'"'"' docs/decisions/README.md'

# A moved or renamed board leaves prose that still reads correctly and links
# nowhere. Nothing between here and `main` resolves a relative path.
neg_probe "decisions index: the pointer links to the board" \
  'perl -pi -e '"'"'s{\(\.\./v2/TICKETS\.md\)}{(../v2/BOARD.md)}'"'"' docs/decisions/README.md'

# The slice bounds, not the pointer. `indexOf` returns -1 for a renamed heading
# and `slice` reads -1 as "one from the end" rather than raising, so an
# unguarded slice of a renamed section quietly widens to most of the file and
# the check downstream passes for a reason unrelated to §4.0.
neg_probe "SPEC.md: §4.0 and §4.1 headings both found, in order" \
  'perl -pi -e '"'"'s/^### 4\.1 The vocabulary/### 4.1bis The vocabulary/'"'"' docs/v2/SPEC.md'

neg_probe "SPEC.md: §4.0 names the board's ratification column and links to it" \
  'perl -pi -e '"'"'s{\[`TICKETS\.md`\]\(TICKETS\.md\)}{`TICKETS.md`}'"'"' docs/v2/SPEC.md'

# The anti-duplication rule. Both pointers omit every per-record reach figure so
# the reach table keeps exactly one home — and "deliberately omitted" is only a
# rule if something notices when a later editor helpfully copies one in. This
# mutation is that helpful edit, not a hostile one.
#
# It inserts the figure into the sentence that FORBIDS it, and deliberately
# leaves every regex anchor in the paragraph intact — so the only thing that
# can go red is the rule itself, not a grab() collapsing next to it.
neg_probe "the decisions index and SPEC §4.0 restate no reach figure" \
  'perl -pi -e '"'"'s/a number copied into a second document/R1 reaches 28 of 40, and a number copied into a second document/'"'"' docs/decisions/README.md'

# ---------------------------------------------------------------------------
# J. THE `ARCHITECTURE.md` CROSSINGS — source of truth #2, which this board
#    cited zero times until the crossings section was written.
#
#    Everything above this point probes the board against the PRODUCT document.
#    These eleven probe it against the ARCHITECTURE one, and the two are not
#    interchangeable: a PRD crossing is the owner's to ratify (`PRD.md:2025`
#    forbids reinterpretation), an architecture crossing is a steward's to
#    amend (every ADR carries its own reversal condition). The last probe in
#    this section exists solely to keep those two lists from merging.
#
#    Unlike `PRD.md`, `ARCHITECTURE.md` IS a declared mutation surface, so the
#    pin probes here break the real document rather than the checker's copy of
#    it. That is the stronger probe and it was available; the PRD ones are
#    indirect only because the owner's file is off limits.
# ---------------------------------------------------------------------------

# Blunt, like probe 587 and for the same reason: a vacuity guard is not moved by
# a subtle edit. If every citation stops matching the regex, the two assertions
# built on it go quietly vacuous and this is the only thing that says so.
neg_probe "ARCHITECTURE.md citations were found in TICKETS.md at all" \
  'perl -pi -e '"'"'s/`ARCHITECTURE\.md:\d+`/that document/g'"'"' docs/v2/TICKETS.md'

# An off-by-one in ONE of two copies — the realistic shape, not a typo. Crossing
# 4 cites `:958` twice, in the table and in the item, and this moves only the
# table's copy to `:955`, which is blank. So the dangling check must go red while
# `TICKETS.md still cites …` stays green: 958 is still cited by the other copy.
# A probe that broke both would prove one assertion and confound the other.
neg_probe "every ARCHITECTURE.md line cited by TICKETS.md exists and is not blank" \
  'perl -pi -e '"'"'s/\*\*4\*\* \| `ARCHITECTURE\.md:958`/**4** | `ARCHITECTURE.md:955`/'"'"' docs/v2/TICKETS.md'

# Four probes on the pin list, one per KIND — the rule from the header, applied
# to a second document. Kind one: a REVERSAL CONDITION. ADR-3 says what would
# make it wrong, crossing 1's entire argument is that the named trigger fired,
# and rewording the trigger means the crossing has to be re-argued from whatever
# replaced it rather than silently inherited.
neg_probe "every ARCHITECTURE.md line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/an outbound integration appears/an outbound integration is introduced/'"'"' ARCHITECTURE.md'

# Kind two: a PROSE ABSOLUTE. §6.5 defines a word — "server-side" — and crossing
# 2 turns on the definition excluding exactly one place. "Vercel function" going
# to "serverless function" is the edit somebody makes to sound vendor-neutral,
# it changes no intent, and it takes the pin with it.
neg_probe "every ARCHITECTURE.md line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/not inside a Vercel function/not inside a serverless function/'"'"' ARCHITECTURE.md'

# Kind three: a TABLE ROW — §14.2's, the one crossing 4 rests on. Same shape as
# a §19 exclusion row and probed separately for the same reason: if the two
# lists are ever read by different code, a probe on prose says nothing here.
#
# The pattern writes the apostrophe in "auction's" as `.`. A literal one would
# need four levels of quoting to reach perl, and the header's rule is that a
# probe nobody can read is a probe nobody will maintain.
neg_probe "every ARCHITECTURE.md line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/New bids on that auction; that auction.s price/New bids on that auction; its price/'"'"' ARCHITECTURE.md'

# Kind four, and the only pin in this repository that is waiting to be broken on
# purpose: a STALE COUNT. `:1552` says §21.1 "closes all fifteen"; it holds
# sixteen. The crossings section leaves that unfixed deliberately, so the
# document is amended once by its steward rather than twice. This mutation IS
# that eventual fix. When it stops being a probe and becomes a commit, the note
# explaining why the figure was left goes red — which is the point. It is not a
# guard against the correction; it is a guard against the correction landing
# while a paragraph still describes the figure as uncorrected.
neg_probe "every ARCHITECTURE.md line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/closes all fifteen/closes all sixteen/'"'"' ARCHITECTURE.md'

# The other direction: the citation disappears and the line stays put. `:1552`
# is cited exactly once, so unlike the `:1848` probe in section G there is only
# one door to close — checked before writing this, not assumed, because "cited
# once" is the assumption that made that probe report MISSED.
neg_probe "TICKETS.md still cites every ARCHITECTURE.md line its crossings section rests on" \
  'perl -pi -e '"'"'s/`ARCHITECTURE\.md:1552` says/the last sentence of that section says/'"'"' docs/v2/TICKETS.md'

# Kind five, twice: the SHIPPED CONSTRAINT. These two are the only probes in the
# file whose real-world trigger is somebody changing the database rather than
# somebody rewording a paragraph, and both mutations are edits a reviewer would
# wave through. Tightening `>=` to `>` reads as hardening a bound. It also means
# crossing 6 — "a lot cannot be inserted under the policy on `main` today" — is
# arguing about a `WITH CHECK` that no longer says what it is quoted as saying.
neg_probe "the shipped auctions insert policy still demands a future end_time at insert time" \
  'perl -pi -e '"'"'s/end_time >= now\(\)/end_time > now()/'"'"' supabase/migrations/20260812120000_bid02_bid_acceptance.sql'

# And the comment half. De-shouting a SQL comment is the most innocent edit in
# this suite; the sentence it flattens is the one recording that auction
# immutability is the ABSENCE of a policy, which is half of crossings 5 and 6.
neg_probe "the shipped auctions policy block still records that no update or delete path exists" \
  'perl -pi -e '"'"'s/There is NO update and NO delete policy/There is no update and no delete policy/'"'"' supabase/migrations/20260812120000_bid02_bid_acceptance.sql'

# The self-count. Deleting the row rather than editing the heading, because a
# dropped row is the mutation that got the reach table twice — there the row and
# its denominator fell together and nothing noticed. Here the heading holds the
# figure and the table holds the rows, so they cannot fall together, and this
# probe is what proves that separation is real rather than asserted.
neg_probe "the crossings section's stated count matches the rows in its table" \
  'perl -ni -e '"'"'print unless /^\| \*\*6\*\* \| `20260812120000_/'"'"' docs/v2/TICKETS.md'

# THE SEPARATION. Six `> **n.` items now sit below the owner's eight, numbered
# 1..6 like his are, and the only thing keeping them apart is that the capture
# in `graph.check.mjs` stops at the first non-blockquote line. That is a
# boundary a later editor can erase in one of two ways — by widening the regex,
# or by promoting a crossing into the owner's list — and the second is the one
# worth probing, because it is the one somebody does while trying to be helpful.
#
# The mutation writes its apostrophe as perl's `\x27`, in the REPLACEMENT rather
# than the pattern, where the `.` trick of the probes above is not available:
# the assertion matches a literal "ADR-3's", so the inserted text has to contain
# a real one. This is the idiom for that, and it is written down here because
# the alternative is four levels of shell quoting.
neg_probe "the steward crossings have not been swept into the owner's blockquote" \
  'perl -pi -e '"'"'s/^> partly because Q3 was left saying/> **9. ADR-3\x27s reversal condition has already fired.**\n> partly because Q3 was left saying/'"'"' docs/v2/TICKETS.md'

# ============================================================================
# K. TEAM.md and GITHUB_PLAN.md — ranks three and four
# ----------------------------------------------------------------------------
# The two PROCESS documents. Section J's five kinds do not carry over, because
# nothing here has a reversal condition and nothing here is prose describing an
# architecture — these are documents that CONFIGURE something, and the thing
# they configure is the issue tracker forty V2 issues would be created on.
#
# FOUR kinds, one probe each, plus the two DERIVED assertions which get their
# own treatment below because they cannot be probed the way a pin can:
#
#   * a CLOSED TAXONOMY — a total asserted as final ("22 labels", "no extra
#     milestones are created"). The mutation that breaks it is somebody
#     RAISING the number, which is the edit V2 actually requires.
#   * a PROHIBITION — an instruction resting on a premise ("must not be
#     created", because "zero open product questions").
#   * an ACCEPTANCE CRITERION — a merged ticket's AC that a later change
#     falsifies. Probed separately from the taxonomy because the AC is what
#     makes adding a label cost something.
#   * a PRODUCT PROHIBITION — the one row here that is the owner's, and the
#     dated precedent for amending it sitting two lines above.
#
# `already governed` is a fifth tuple group in the checker and deliberately has
# no probe of its own: it holds recorded NEGATIVE results, and the pin group it
# shares is already proven breakable by the four probes above. One probe per
# kind means per kind of FAILURE, not per label in a comment.
neg_probe "TEAM.md citations were found in TICKETS.md at all" \
  'perl -pi -e '"'"'s/`TEAM\.md:\d+`/that document/g'"'"' docs/v2/TICKETS.md'
neg_probe "GITHUB_PLAN.md citations were found in TICKETS.md at all" \
  'perl -pi -e '"'"'s/`GITHUB_PLAN\.md:\d+`/the plan/g'"'"' docs/v2/TICKETS.md'

# The dangling pair. Both point a real citation at a line that exists and is
# blank — line 2 of each file — which is the shape a citation takes after
# somebody inserts a paragraph above it and renumbers nothing.
neg_probe "every TEAM.md line cited by TICKETS.md exists and is not blank" \
  'perl -pi -e '"'"'s/`TEAM\.md:1076`/`TEAM.md:2`/'"'"' docs/v2/TICKETS.md'
neg_probe "every GITHUB_PLAN.md line cited by TICKETS.md exists and is not blank" \
  'perl -pi -e '"'"'s/`GITHUB_PLAN\.md:214`/`GITHUB_PLAN.md:2`/'"'"' docs/v2/TICKETS.md'

# Kind one — CLOSED TAXONOMY. Raising 22 to 23 is not a hypothetical mutation:
# it is precisely the edit creating an `area:` value for V2 sessions requires,
# and the whole point of crossing 2 is that it silently falsifies a sentence in
# a second document. The probe mutates the document, not the checker, because
# a real relabelling is the stronger evidence.
neg_probe "every board line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/\*\*22 labels exist\*\*/**23 labels exist**/'"'"' TEAM.md'

# Kind two — PROHIBITION. Softening "must not be created" to "should not be"
# is the reword somebody makes while thinking they are being less shouty. It
# also turns an absolute this board argues against into a preference, which
# changes what crossing 3 is claiming.
neg_probe "every board line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/\*\*never existed\*\*, and must not be created/**never existed**, and should not be created/'"'"' TEAM.md'

# Kind three — ACCEPTANCE CRITERION. S0-14's AC is the line that makes the
# prohibition defended rather than merely present. Dropping the clause leaves
# the ticket reading perfectly and removes the thing crossing 3 cites it for.
neg_probe "every board line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/ · `needs-decision` does not exist//'"'"' GITHUB_PLAN.md'

# Kind four — PRODUCT PROHIBITION. Removing `bid increment` from "Things
# nobody may build" is the edit ratifying D-01 requires, and it is the one
# mutation in this section scheduled to become a real commit. When the owner
# makes it, crossing 5 goes red and the paragraph arguing it must be revisited
# — which is the same double duty ARCHITECTURE.md:1552 does in section J.
neg_probe "every board line the crossings section rests on still sits on the line cited" \
  'perl -pi -e '"'"'s/ · bid increment · / · /'"'"' TEAM.md'

# The still-cited check. Same shape as section J's: remove ONE citation from
# the prose and leave the pin in the checker, which is what happens when a
# paragraph is rewritten to read more smoothly.
neg_probe "TICKETS.md still cites every board line its crossings section rests on" \
  'perl -pi -e '"'"'s/`GITHUB_PLAN\.md:11` reads/the plan.s status row reads/'"'"' docs/v2/TICKETS.md'

# ----------------------------------------------------------------------------
# THE TWO DERIVED ASSERTIONS. Everything above pins a sentence; these two count
# something on every run, and they fail in a direction the pins cannot: when
# the defect is FIXED. That is not a weaker probe, it is a different one, and
# it is the only mechanism in this repository that stops a paragraph explaining
# a gap from outliving the gap.
#
# Adding the sixteenth row to TEAM.md §26 is the correct fix for crossing 4.
# The probe performs the fix and asserts the prose notices.
neg_probe "TEAM.md §26's convenience copy is still one row short of PRD.md §21.1's register" \
  'perl -pi -e '"'"'s/^\| 15 \| \*\*Password reset is in the MVP\*\* \| M24 \|$/| 15 | **Password reset is in the MVP** | M24 |\n| 16 | **Arabic RTL; canonical 1,250.00 SAR** | BR-41, BR-42, BR-43 |/'"'"' TEAM.md'

# And the census. Correcting ONE of the thirteen is what a careful reader does
# after noticing the register holds sixteen — and doing it in one document out
# of four is exactly how the figure got copied thirteen times to begin with.
# The count is per file, so a single correction moves TEAM.md from 3 to 2 and
# the whole census fails, which is the intended behaviour: this figure may not
# be fixed one document at a time without the board saying so.
neg_probe "the \`fifteen\` decision-count claim still stands at thirteen across four documents" \
  'perl -pi -e '"'"'s/All fifteen are closed in/All sixteen are closed in/'"'"' TEAM.md'

# The self-count, same reasoning as section J: delete a row, not the heading.
neg_probe "the board section's stated count matches the rows in its table" \
  'perl -ni -e '"'"'print unless /^\| \*\*5\*\* \| `TEAM\.md:1334`/'"'"' docs/v2/TICKETS.md'

neg_report "V2-GRAPH-NEGATIVE" 139
