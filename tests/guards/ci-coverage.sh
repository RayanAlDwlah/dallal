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
# All three below fail for one root cause: they need credentials to a real
# Supabase project, and this repository is public (CLAUDE.md §6).
# ---------------------------------------------------------------------------
ALLOWLIST="
tests/auth/identity-e2e.check.mjs — writes real rows to a real project, and nothing in this product can delete an auction (BR-30, BR-31); CI would accumulate junk forever
tests/auth/session.check.mjs — needs a running server (npm run dev) plus credentials
tests/realtime/reconnect.check.mjs — needs project credentials and 35 s against a live realtime socket
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
named=$(grep -cE '^\s+run:.*tests/' "$WORKFLOW")

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
