#!/usr/bin/env bash
# ============================================================================
# Breaks the seven-step governance rule on purpose, eighteen ways, and asserts
# `tests/governance/workflow.check.mjs` notices every one.
#
#   bash tests/governance/workflow-negative.check.sh
#
# Needs nothing: no Docker, no network, no database. It edits tracked markdown
# in place and restores it after every probe, so it refuses to start if any
# file it touches already has uncommitted changes.
#
# ---------------------------------------------------------------------------
# WHY
#
# `CLAUDE.md` §9: "A check is not finished when it passes; it is finished when
# it has been made to fail on purpose." `workflow.check.mjs` makes fifteen
# assertions and every one of them passed the first time it ran — which is
# exactly the shape that deserves suspicion, because a check that has never
# been red has never been shown to be connected to anything.
#
# Two of the fourteen already have a receipt from the day they were written:
# the vacuity guard in section 3 fired for real during PZ-8 (deleting the two
# restatements dropped the phrase count below the threshold everywhere and the
# section went silent), and the two-fingerprints-per-step rule was added
# because a probe killed the bolds-only design. This file is the rest of them.
#
# ---------------------------------------------------------------------------
# THE SEVEN-STEP LOOP IS PROBED IN FULL
#
# `graph-negative.check.sh` has to declare three loop families unprobed — it
# cannot afford one probe per row. Here the loop is seven long, so all seven
# get one: sections B1..B7 paste each canonical step into a different document
# as a numbered item. They are deliberately not identical in shape, because
# the interesting question is not "does the detector work" but "which
# fingerprint is doing the work":
#
#   B1  copies only the step's opening words, no emphasis   (lead fingerprint)
#   B3  copies only the bolded phrase, with the bold dropped (norm strips `*`)
#   B5  copies the step wrapped across two lines             (continuation join)
#
# Each of those three would survive a plausible simplification of the check,
# and each would then be an undetected fourth copy of the workflow.
#
# ---------------------------------------------------------------------------
# WHAT IS NOT PROBED, AND WHY — read this before trusting the count
#
# 1. `the tracked markdown set was found` (files.length > 5). Falsifying it
#    means untracking a hundred markdown files. The restore mechanism here is
#    `git checkout --` over a declared surface; it cannot put an untracked
#    file set back, and a probe whose failure mode is "loses the repository"
#    is not worth the assertion it buys. Unprobed, deliberately.
#
# 2. A restatement written from scratch in different words. `workflow.check.mjs`
#    says in its own header that it does not catch this and that nothing
#    mechanical does. That is a stated non-goal, not a gap — probing it would
#    assert a MISSED as the correct answer, which this harness cannot express.
#
# 3. `PRD.md` is excluded from the mutation surface below even though it is a
#    tracked markdown file the check reads. The owner's standing instruction is
#    that `PRD.md` is not modified by a session; a probe reverts, but a probe
#    interrupted between mutation and restore does not, and that file is the
#    one place where that is not an acceptable risk.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
. tests/lib/negative.sh

neg_files "CLAUDE.md
README.md
TEAM.md
docs/v2/SPEC.md
docs/v2/TICKETS.md
docs/v2/ARCHITECTURE-V2.md
docs/auth-configuration.md"

neg_run "node --no-warnings tests/governance/workflow.check.mjs"

echo "==> breaking the seven-step rule on purpose — every probe must be CAUGHT"
echo

# ---------------------------------------------------------------------------
# A. The canonical section itself — is it there, is it whole, is it countable
# ---------------------------------------------------------------------------

# The early-exit path. Rename the heading and every assertion below it would
# pass vacuously, so the check has to refuse to run rather than report green.
neg_probe "the canonical workflow section could not be located" \
  'perl -pi -e '"'"'s/### The workflow, in seven steps/### The workflow, in seven stages/'"'"' CLAUDE.md'

# The heading counts the list. CLAUDE.md §9 records the same defect one
# document up: its stated check count went wrong twice in two commits.
neg_probe "CLAUDE.md §1: the heading's step count matches the list" \
  'perl -pi -e '"'"'s/### The workflow, in seven steps/### The workflow, in six steps/'"'"' CLAUDE.md'

# The section is present, the heading still says seven, and the list is gone.
# Every per-step assertion in section 2 silently stops existing — the loop runs
# zero times and prints nothing. This is the vacuity shape, and the heading
# count is the only assertion standing between it and a green run.
neg_probe "CLAUDE.md §1: the heading's step count matches the list" \
  'perl -ni -e '"'"'if (/^### The workflow, in/) { $in = 1 } elsif (/^> /) { $in = 0 } print unless $in && /^\d+\. /;'"'"' CLAUDE.md'

neg_probe "CLAUDE.md §1: the steps are numbered 1..N in order" \
  'perl -pi -e '"'"'s/^7\. \*\*After merge/8. **After merge/'"'"' CLAUDE.md'

# Unbolding a step is the most ordinary markdown edit there is, and it takes
# that step's bold fingerprint with it. Step 6 then rests on its lead words
# alone, and stops being detectable the moment someone reflows the sentence.
neg_probe "CLAUDE.md §1: no step rests on a single fingerprint" \
  'perl -pi -e '"'"'s/^6\. \*\*Every PR states:\*\*/6. Every PR states:/'"'"' CLAUDE.md'

# A phrase in two steps cannot say which step a copy came from, and reports the
# same restatement twice.
neg_probe "CLAUDE.md §1: no fingerprint belongs to two steps" \
  'perl -pi -e '"'"'s/^6\. \*\*Every PR states:\*\*/6. **Every PR states:** **expected change surface**/'"'"' CLAUDE.md'

# ---------------------------------------------------------------------------
# B. The restatement detector — one probe per step, seven of seven
# ---------------------------------------------------------------------------

# Lead words only, no emphasis anywhere. The bolds-only design of this detector
# passed this copy; that is why the lead fingerprint exists.
neg_probe "step 1 is a numbered step in exactly one document" \
  'printf "%s\n" "1. Check dependencies and confirm the issue is ready before you start." >> README.md'

neg_probe "step 2 is a numbered step in exactly one document" \
  'printf "%s\n" "2. Claim it — assign yourself in GitHub — before writing code." >> TEAM.md'

# The bolded phrase copied WITHOUT the bold. `norm` strips emphasis before
# comparing for exactly this: a copy-paste through a rich-text field loses it.
neg_probe "step 3 is a numbered step in exactly one document" \
  'printf "%s\n" "3. Use one branch per ticket, named for the ticket id." >> TEAM.md'

neg_probe "step 4 is a numbered step in exactly one document" \
  'printf "%s\n" "4. The ticket declares an expected change surface — the files it is likely to touch." >> docs/v2/SPEC.md'

# Wrapped across two lines, with the fingerprint straddling the break. Without
# the continuation join the phrase is two strings and matches neither.
neg_probe "step 5 is a numbered step in exactly one document" \
  'printf "%s\n" "5. If two tickets need the same file, merge the shared" "   contract or foundation first." >> TEAM.md'

neg_probe "step 6 is a numbered step in exactly one document" \
  'printf "%s\n" "6. Every PR states: the files changed, the verification evidence." >> README.md'

neg_probe "step 7 is a numbered step in exactly one document" \
  'printf "%s\n" "7. After merge, any available contributor claims the next ready ticket." >> docs/v2/TICKETS.md'

# ---------------------------------------------------------------------------
# C. The citation rule, and the guard that says the citation rule is looking
# ---------------------------------------------------------------------------

# README.md still says "seven-step workflow" — it is talking about the
# workflow — but no longer points at the document that governs it.
neg_probe "every document discussing the workflow cites CLAUDE.md §1 as the governing one" \
  'perl -pi -e '"'"'s/§1//g'"'"' README.md'

# The other trigger, and a different code path: a document that never says
# "seven steps" but reuses two canonical phrases is talking about the workflow
# too. Prose, not a numbered item, so section 2 stays quiet and this is the
# only thing that can catch it.
neg_probe "every document discussing the workflow cites CLAUDE.md §1 as the governing one" \
  'printf "%s\n" "Claim the ticket before writing code, and respect the expected change surface." >> docs/auth-configuration.md'

# The vacuity guard, and it has a real receipt: during PZ-8 satisfying section
# 2 by deleting the two restatements dropped every document below the phrase
# threshold, and this assertion is what announced that section 3 had stopped
# looking. Here: strip the naming trigger from all four talkers at once and
# only TEAM.md — which clears the phrase threshold on its own — is left.
neg_probe "more than one document discusses the workflow (else this check is vacuous)" \
  'perl -pi -e '"'"'s/seven[ -]steps?/N-step/gi'"'"' README.md TEAM.md docs/v2/SPEC.md docs/v2/TICKETS.md'

# ---------------------------------------------------------------------------
# D. The byte-pinned exemption — the dangerous kind of change, probed twice
#
# G0A gave section 2 an exemption: the approved V2 contract quotes text whose
# bytes are pinned to a SHA-256, so it cannot drift and cannot be reworded to
# comply. An exemption is the most dangerous thing to add to a guard — it is
# the "add an ignore" move `CLAUDE.md` §9 names as worse than a red build, and
# it is only NOT that move if both of the properties below hold. Neither is
# self-evident from reading the check, which is why neither is left to
# inspection.
# ---------------------------------------------------------------------------

# D1. THE EXEMPTION CANNOT GROW QUIETLY.
#
# The exempt set is keyed on a `tail -n +N` verify command, and exactly one
# file in the tree is really pinned — `contract.check.sh` pins that one path,
# not a class of them. So nothing stops another document from advertising a
# verify command nothing enforces, which would be self-exemption from section 2
# achieved by adding one line to a file. The check names the exempt path, and a
# second one has to be argued for in a reviewed change instead.
neg_probe "exactly one document is a byte-pinned quotation, and it is the V2 contract" \
  'printf "%s\n" "Verify with: tail -n +5 README.md | shasum -a 256" >> README.md'

# D2. THE EXEMPTION IS NARROW — THIS IS THE ONE THAT MATTERS.
#
# It covers the pinned BODY, not the file. Keyed on the path instead of the
# offset, section 2 would go silent across the whole contract — and the
# provenance header, which this repository wrote, which is editable, and which
# is exactly where a helpful summary of the workflow would be tempting to add,
# would become an undetected fourth copy. Every other assertion in this suite
# would still pass while that hole existed.
#
# So: paste step 4 ABOVE the pinned offset and require it to still be caught.
neg_probe "step 4 is a numbered step in exactly one document" \
  'perl -pi -e '"'"'s/^# The canonical V2 contract$/4. The ticket declares an **expected change surface** — the files it is likely to touch.\n\n# The canonical V2 contract/'"'"' docs/v2/ARCHITECTURE-V2.md'

neg_report "GOVERNANCE-WORKFLOW-NEGATIVE" 18
