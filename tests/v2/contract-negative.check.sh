#!/usr/bin/env bash
# ============================================================================
# Breaks the contract-provenance rule on purpose, four ways, and asserts
# `tests/v2/contract.check.sh` notices every one.
#
#   bash tests/v2/contract-negative.check.sh
#
# Needs nothing: no Docker, no network, no database. It edits tracked markdown
# in place and restores it after every probe, so it refuses to start if any
# file it touches already has uncommitted changes.
#
# ---------------------------------------------------------------------------
# WHY
#
# `contract.check.sh` exists because a provenance header that says "verify me"
# and is never verified reads as checked. This file exists for the identical
# reason one level up: a provenance CHECK that has never been red has never
# been shown to be connected to the document it claims to pin.
#
# One of its five assertions was already red once, before it was committed —
# the header-offset probe fired on a first draft that pulled every digit run
# out of `tail -n +39 docs/v2/ARCHITECTURE-V2.md` and compared 3922 to 39. The
# check was right and the check's own extraction was wrong, which is precisely
# the case a suite like this is for.
#
# ---------------------------------------------------------------------------
# WHAT IS NOT PROBED, AND WHY — read this before trusting the count
#
# "the canonical contract exists" (assertion 1 of 5) has NO probe. Falsifying
# it means deleting `docs/v2/ARCHITECTURE-V2.md`, and `contract.check.sh`
# answers that with an early `exit 1` before any labelled line is printed — so
# the harness would report BROKEN ("no check prints this label") for a check
# that behaved exactly as designed. A probe whose only possible verdict is a
# false accusation is worse than an acknowledged gap.
#
# That gap is stated here rather than left to be inferred, because an unprobed
# assertion nobody wrote down is a coverage claim that is quietly false — the
# same defect as a stale count, one level up.
# ============================================================================
set -uo pipefail

. "$(dirname "$0")/../lib/negative.sh"

CONTRACT="docs/v2/ARCHITECTURE-V2.md"

neg_files "$CONTRACT"
neg_run "bash tests/v2/contract.check.sh"

echo "==> negative probes against tests/v2/contract.check.sh"
echo

# ---------------------------------------------------------------------------
# A. The body is not the approved text any more.
#
# The whole point of the digest. A word changed inside the approved document
# is the change this repository most wants to be loud: it is invisible in a
# diff review that skims a 600-line file, and it silently rewrites a contract
# every later ticket is measured against.
# ---------------------------------------------------------------------------
neg_probe "the approved body is byte-identical to the document the owner signed off" \
  'perl -pi -e '"'"'s/^Build Dallal V2 \*\*inside/Build Dallal V2 **outside/'"'"' '"$CONTRACT"

# ---------------------------------------------------------------------------
# B. The heading the body is located BY is edited.
#
# `contract.check.sh` finds the body by searching for its opening heading
# rather than trusting the header's line number. That search is load-bearing:
# if the heading drifts, every offset below it is measured from the wrong
# place. This probe proves the search notices instead of silently matching
# nothing and passing.
# ---------------------------------------------------------------------------
neg_probe "the approved body heading is present exactly once, unmodified" \
  'perl -pi -e '"'"'s/^# Dallal V2 — Approved Architecture and Execution Contract/# Dallal V2 — Architecture/'"'"' '"$CONTRACT"

# ---------------------------------------------------------------------------
# C. The header advertises a digest that is not the one CI enforces.
#
# The reader-facing half. A header printing a hash nobody checks sends anyone
# who actually runs the command chasing a mismatch that is the header's fault,
# and the natural "fix" is to trust the document over the check.
# ---------------------------------------------------------------------------
neg_probe "the header quotes the digest this check enforces" \
  'perl -pi -e '"'"'s/^e9cd38c7[0-9a-f]+$/0000000000000000000000000000000000000000000000000000000000000000/'"'"' '"$CONTRACT"

# ---------------------------------------------------------------------------
# D. The copy-paste verify command drifts off the body.
#
# The rot this is likeliest to suffer: one line is added to the provenance
# header, the body slides down by one, and every other assertion in
# `contract.check.sh` still passes while the command a reader is invited to
# run now hashes the wrong bytes and reports a false mismatch.
# ---------------------------------------------------------------------------
neg_probe "the header's copy-paste verify command names the real body offset" \
  'perl -pi -e '"'"'s/tail -n \+39/tail -n +40/'"'"' '"$CONTRACT"

neg_report "CONTRACT-NEGATIVE" 4
