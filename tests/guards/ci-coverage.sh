#!/usr/bin/env bash
# ============================================================================
# Every suite in tests/ is either RUN by CI or WRITTEN DOWN as not run.
#
#   ./tests/guards/ci-coverage.sh
#
# Needs nothing: no Docker, no node, no network. Reads two things off disk.
#
# ---------------------------------------------------------------------------
# WHY THIS EXISTS
#
# CI is a list of commands, and a list of commands has one silent failure mode:
# something that should be on it is not. Nobody deletes a test suite — a suite
# just gets WRITTEN and never wired up, or a workflow step gets dropped in a
# conflict resolution and the file still parses, still runs, still goes green.
#
# This is not hypothetical here. tests/bidding/run.sh added EXPECTED_SUITES for
# exactly this, after two near-misses in one hour (#116): a merge conflict
# resolved by taking one side can delete a whole `suite X N` line, dozens of
# assertions vanish, and SUITE PASSED still prints. The same hole exists one
# level up, in .github/workflows/ci.yml, and until this file nothing looked at
# it. A dropped `- run: ./tests/…` line is a green build with less coverage and
# no diff anyone would question.
#
# So: enumerate the suites that exist, enumerate the ones CI names, and require
# every difference to be listed below WITH A REASON. Not to make it hard to
# leave something out — sometimes that is right — but to make it IMPOSSIBLE to
# leave something out by accident.
#
# ---------------------------------------------------------------------------
# WHAT COUNTS AS A SUITE
#
# An entry point a human would type: tests/<area>/run.sh, any *.check.sh, any
# *.check.mjs, and this directory's negative.sh. Helpers invoked BY a run.sh —
# concurrency.sh, lib/*.awk, the .sql files — are not entry points and are not
# enumerated; they are covered by whatever runs them.
#
# A suite counts as covered if ci.yml names it directly, OR if a run.sh that
# ci.yml names invokes it. That second clause is what lets tests/auth/run.sh
# stand in for the four *.check.mjs files it calls, without listing them twice.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

WORKFLOW=".github/workflows/ci.yml"

# ---------------------------------------------------------------------------
# The allowlist — suites deliberately NOT in CI.
#
# Every line is `path — reason`. The reason is not decoration: it is the thing
# a reviewer reads six months from now when they wonder whether this was a
# decision or an oversight. Adding a line here is allowed. Adding one WITHOUT
# a reason is not, and the parse below enforces that.
#
# It was empty between 2026-08-15 and 2026-08-16. It held three entries before
# that, all excused for one root cause: they needed credentials to a real
# Supabase project, and this repository is public (CLAUDE.md §6). All three —
# tests/auth/identity-e2e.check.mjs, tests/auth/session.check.mjs,
# tests/realtime/reconnect.check.mjs — were deleted with the V1 product on this
# branch, and this script reported all three as STALE, which is the stale-entry
# check doing exactly its job.
#
# ── The three entries below are a DIFFERENT excuse, and it is a weaker one ──
#
# They arrived in the 2026-08-16 merge with `main`, from PR #175. Each compiles
# a V1 component and asserts a property that had been MEASURED as broken and
# then fixed — they are not speculative checks. Each names a file V2 does not
# have, because V2 rebuilt that screen from the approved previews:
#
#   V1 file the check compiles          the V2 file that replaced it
#   ----------------------------------  ---------------------------------------
#   app/auctions/new/                   components/auction/create-wizard.tsx
#     create-auction-form.tsx
#   components/bidding/                 components/bidding/live-auction.tsx
#     outcome-banner.tsx                  (outcome is rendered inline there)
#   components/bidding/                 components/bidding/live-auction.tsx
#     live-status-countdown.tsx
#
# They are NOT excused because they are unimportant. They are excused because
# re-aiming each one is a real piece of work — the assertions are AST facts
# about a specific component's shape, not greps — and doing three of them badly
# inside a merge is how a suite turns into decoration. They fail loudly today
# ("cannot read <path> — the file moved, which is itself the failure"), so
# nothing about them can be mistaken for a pass.
#
# WHAT EACH ONE IS STILL PROTECTING, so whoever re-aims it knows what to keep:
#   * create-form-recovery — a server rejection must not discard the seller's
#     chosen File or reset the form. V2's wizard holds images in state across
#     steps; the property transfers, the anchors do not.
#   * winner-statement — FR-END-14: the winner is addressed in the second
#     person, with the amount, through <Money>, compared against the LIVE
#     snapshot rather than a frozen boolean.
#   * live-status-mount — the page must mount the SUBSCRIBING wrapper, never
#     the bare countdown. V2's equivalent trap is rendering a countdown without
#     useLiveAuction, which is the same defect one component name over.
#
# The fourth suite from that PR, tests/ui/money-canonical-text.check.mjs, WAS
# re-aimed at V2 in the same merge and runs in CI. It is the proof that these
# three are deferred work rather than dead weight.
#
# Do not read an allowlist entry as "nothing is missing." Suites that do not
# exist at all are a different question again, and the largest of them — a V2
# database suite for `place_bid` — is written up in the header of
# .github/workflows/ci.yml rather than here, because an allowlist can only name
# files it can stat.
# ---------------------------------------------------------------------------
ALLOWLIST="
tests/auction/create-form-recovery.check.mjs — compiles V1's app/auctions/new/create-auction-form.tsx, which V2 replaced with components/auction/create-wizard.tsx; the File-retention property still applies and the AST anchors do not
tests/auction/winner-statement.check.mjs — compiles V1's components/bidding/outcome-banner.tsx, which V2 folded into components/bidding/live-auction.tsx; FR-END-14 still applies and the AST anchors do not
tests/realtime/live-status-mount.check.mjs — compiles V1's components/bidding/live-status-countdown.tsx, removed on this branch as an orphan importing deleted V2 modules; the mount-the-subscriber property still applies to components/bidding/live-auction.tsx
"

pass=0
fail=0

echo "==> CI coverage — every suite either runs or is written down"
echo

# --- what exists -----------------------------------------------------------
suites="$(find tests -type f \( -name 'run.sh' -o -name '*.check.sh' -o -name '*.check.mjs' \) \
            -o -path 'tests/guards/negative.sh' | sort)"

# --- what ci.yml names, directly or through a run.sh it names --------------
#
# The workflow with whole-line comments removed. This is not tidiness — the
# first version of this file matched the raw YAML and reported all three
# ALLOWLIST entries as RUN, because ci.yml's own header names them in prose
# while explaining why they are NOT run. The document describing an absence
# read as the presence. Exactly the trap INT-08 was built around, one file
# type over.
wf_code() { grep -v '^[[:space:]]*#' "$WORKFLOW"; }

covered() { # path -> 0 if covered
  local p="$1" area stem
  wf_code | grep -qF -- "$p" && return 0

  # Transitively: a run.sh in the same directory that CI names, which invokes
  # this file. Matching on the STEM rather than the filename is required — the
  # auth suite calls its three pure-function checks from a loop:
  #
  #     for f in validation site-url login-path; do … "$HERE/$f.check.mjs"
  #
  # so the string "validation.check.mjs" appears nowhere in the file that runs
  # validation.check.mjs. A filename match reported three wired suites as
  # unwired, which would have taught the first reader to distrust this script.
  # The runner is read with comments AND echo/printf lines removed. Both
  # removals are load-bearing and both were found by this script getting it
  # wrong: tests/auth/run.sh PRINTS, at runtime, the exact sentence
  #
  #     note: AUTH-11's HTTP criteria are tests/auth/session.check.mjs
  #           — not run here.
  #
  # which is the file announcing that it does not run session.check.mjs. On the
  # raw text that reads as an invocation, so an allowlisted suite came back
  # RUN. Third time this trap has been hit in this one directory: prose about
  # an absence is indistinguishable from the presence unless you strip it.
  area="$(dirname "$p")"
  stem="$(basename "$p" | sed 's/\.check\.[a-z]*$//; s/\.sh$//')"
  if [ -f "$area/run.sh" ] && wf_code | grep -qF -- "$area/run.sh"; then
    grep -v '^[[:space:]]*#' "$area/run.sh" \
      | grep -vE '^[[:space:]]*(echo|printf)[[:space:]]' \
      | grep -qE "(^|[^a-zA-Z0-9_-])$stem([^a-zA-Z0-9_-]|$)" && return 0
  fi
  return 1
}

allowed() { # path -> 0 if on the allowlist WITH a reason
  printf '%s\n' "$ALLOWLIST" | grep -qE "^$(printf '%s' "$1" | sed 's/[.[\*^$]/\\&/g') — .+$"
}

# The loop reads from a here-string rather than from a pipe. A pipe would put
# it in a subshell and the counters below would be discarded silently at the
# end of it — the same class of bug as a suite line vanishing: everything runs,
# nothing is counted, and the summary still prints.
total=0
unwired=0
while read -r s; do
  [ -z "$s" ] && continue
  total=$((total + 1))
  if covered "$s"; then
    printf 'RUN         %s\n' "$s"
  elif allowed "$s"; then
    printf 'NOT RUN     %s\n' "$s"
    printf '            reason: %s\n' \
      "$(printf '%s\n' "$ALLOWLIST" | grep -F -- "$s — " | sed 's/^.* — //')"
  else
    unwired=$((unwired + 1))
    printf 'UNWIRED     %s\n' "$s"
    printf '            not named in %s and not on the allowlist.\n' "$WORKFLOW"
    printf '            Add a step to the workflow, or a line to ALLOWLIST saying why not.\n'
  fi
done <<EOF
$suites
EOF

# An allowlist entry naming a file that no longer exists is its own defect: it
# reads as a considered exception forever while the suite it excused is gone.
stale=0
while read -r a; do
  [ -z "$a" ] && continue
  if [ ! -f "$a" ]; then
    stale=$((stale + 1))
    printf 'STALE       %s is on the allowlist but does not exist\n' "$a"
  fi
done <<EOF
$(printf '%s\n' "$ALLOWLIST" | grep ' — ' | sed 's/ — .*//')
EOF

# A workflow that names no suite at all would pass every check above by having
# nothing to compare against. This is the floor: CI must run something.
# `[[:space:]]`, not `\s`. `\s` is a GNU extension: BSD grep on macOS does not
# honour it, so this returned 0 on half the team's machines and tripped the
# floor below for a reason that had nothing to do with the workflow.
named=$(grep -cE '^[[:space:]]+run:.*tests/' "$WORKFLOW")

echo
echo "$total suite(s) found · $unwired unwired · $stale stale allowlist entr(y|ies) · $named workflow step(s) naming tests/"

if [ "$named" -lt 5 ]; then
  echo "!! $WORKFLOW names only $named test step(s). Steps have gone missing."
  fail=$((fail + 1))
fi
fail=$((fail + unwired + stale))

if [ "$fail" -eq 0 ]; then
  echo "CI-COVERAGE: PASS"
  exit 0
fi
echo "CI-COVERAGE: FAIL — $fail problem(s)"
exit 1
