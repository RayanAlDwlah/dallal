#!/usr/bin/env bash
# ============================================================================
# Every *.check.mjs must actually LOAD (#147).
#
#   ./tests/integration/check-imports.check.sh
#
# WHAT THIS MEASURES, AND WHY IT CHANGED
#
# The first version of this file counted `@/` value imports in the lib modules
# the harness reaches, and required zero. @Dem4t rejected it on #155 and was
# right: it measured the SPELLING of one known cause, not the EFFECT the issue
# was opened about.
#
# The proof was immediate. My fix replaced `@/lib/money` with `../money`, the
# count went to zero, this guard reported 3/3 PASS — and the check still did not
# load, because node's ESM resolver does not infer extensions either. A guard
# that passes on a branch where the thing it guards is broken is worse than no
# guard: it converts an open question into a settled one.
#
# So the authority here is now: RUN each check and see whether it LOADED. A load
# failure is distinguishable from an assertion failure by the error node emits,
# and it does not matter how the path was broken — alias, missing extension,
# renamed file, deleted export — all three fail the same way.
#
# The static rule is kept below the load check, demoted to what it always was:
# a fast hint that needs no toolchain. It can never again stand in for the load
# check, and it is reported as a hint rather than as a pass.
#
# NODE >= 22 is required, because these files import .ts and type-stripping is
# what makes that work. On an older node NOTHING can load, and this reports that
# as a FAILURE rather than skipping — same contract as tests/auction/run.sh.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

pass=0
fail=0

chk() { # label  got  want   — got is trimmed; BSD wc pads and GNU does not (#153)
  set -- "$1" "$(printf '%s' "$2" | tr -d '[:space:]')" "$3"
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1)); printf 'PASS  %-56s (%s)\n' "$1" "$2"
  else
    fail=$((fail + 1)); printf 'FAIL  %-56s got=%s want=%s\n' "$1" "$2" "$3"
  fi
}

CHECKS=$(find tests -name '*.check.mjs' 2>/dev/null | sort)
COUNT=$(printf '%s\n' "$CHECKS" | grep -c . || true)

echo "==> check harness — every *.check.mjs loads (#147)"
chk "the harness discovers at least one check" "$([ "$COUNT" -gt 0 ] && echo yes || echo no)" yes

node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)

if [ "$node_major" -ge 22 ]; then
  # THE AUTHORITY. Run each one and look only at whether it LOADED. An assertion
  # failure is somebody else's problem and is explicitly not counted here — the
  # question is whether the module graph resolves, not whether the rules hold.
  loaded=0
  for f in $CHECKS; do
    err=$(node --no-warnings --experimental-strip-types "$f" 2>&1 >/dev/null || true)
    if printf '%s' "$err" | grep -qE 'ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION|Cannot find (module|package)'; then
      printf '      !! %s did not load\n' "$f"
      printf '%s' "$err" | grep -E 'Error|Cannot find' | head -2 | sed 's/^/         /'
    else
      loaded=$((loaded + 1))
    fi
  done
  chk "every discovered check loads" "$loaded" "$COUNT"
else
  # Not a skip. On this node the answer is genuinely unknown, and reporting
  # "unknown" as "fine" is the defect this whole file exists about.
  printf '      !! node %s cannot type-strip; no check can load here.\n' "$node_major"
  chk "every discovered check loads" "NOT-RUN-node<22" "$COUNT"
fi

# ---------------------------------------------------------------------------
# The static hint. Node does not read `paths` from tsconfig.json, so a VALUE
# import through `@/` in a check-reachable module cannot resolve. `import type`
# is erased by type-stripping and is exempt — a coarser rule would flag
# lib/realtime/ux-rules.ts, which is fine.
#
# This is a HINT. It caught the original cause and would catch it again, but
# #155 proved it cannot certify the thing above it.
# ---------------------------------------------------------------------------
# No 2>/dev/null here either, and for the same reason one line down: if this
# discovery grep fails, the module set is empty, the branch below reports 0
# against 0, and the whole hint PASSES having measured nothing. Same vacuous
# shape as the -P bug, one step earlier in the pipeline.
#
# THE SUBJECT MOVED ON 2026-08-16, AND THE OLD ONE HAD ALREADY GONE VACUOUS.
#
# The set used to be "lib modules a check.mjs imports", discovered by grepping
# for `from "../../lib/`. On the V2 tree that set is EMPTY — measured, not
# assumed: the two surviving checks (tests/v2/graph.check.mjs and
# tests/governance/workflow.check.mjs) import `node:fs`, `node:url`,
# `node:path` and `node:child_process` and nothing else. They read source as
# TEXT rather than importing it, which is why they survived the V1 deletion at
# all. So the file's own else-branch was firing — "NO-FILES-DISCOVERED" — and
# its stated reason ("the harness demonstrably imports lib modules") was no
# longer true of this tree.
#
# Two wrong ways out, both of which this file was written to forbid. Deleting
# the branch and letting an empty set report PASS is the vacuous shape it
# names. Deleting the hint altogether throws away the one measure that needs no
# toolchain, on a tree where node <22 makes the load check unrunnable.
#
# So the subject is widened to what it should always have been: EVERY LOCAL
# MODULE IN THE CHECK GRAPH — the check files themselves, plus any local module
# they import. The check files are in it by construction, so the set is never
# empty (check 1 already proved COUNT > 0) and there is no branch left that can
# measure nothing. And it is aimed at the real #147 defect one hop earlier: an
# `@/` value import written INTO a check is exactly as unresolvable as one in a
# module the check pulls in, and it is the likelier of the two to be written,
# because `@/` is what every other file in this repository uses.
#
# A local module is resolved against the directory of the check that imports
# it, and only counted if it is a file on disk — a path that does not resolve
# is the LOAD check's finding, not this one's, and double-reporting it here
# would make one defect look like two.
LOCAL_MODULES=$(
  for f in $CHECKS; do
    d=$(dirname "$f")
    grep -hE '^[[:space:]]*import[[:space:]].*from[[:space:]]*"\.\.?/' "$f" \
      | sed 's/.*from[[:space:]]*"//; s/".*//' \
      | while read -r rel; do
          m="$d/$rel"
          [ -f "$m" ] && printf '%s\n' "$m"
        done
  done
)
REACHABLE=$(printf '%s\n%s\n' "$CHECKS" "$LOCAL_MODULES" | grep -v '^$' | sort -u | tr '\n' ' ')

# POSIX only. This used `grep -P` for a `(?!type\s)` lookahead, and -P is
# GNU-only: BSD grep answers `invalid option -- P`, the pipeline yields nothing,
# `grep -c .` returns 0, and the check reported PASS on every tree — including
# the one @RayanAlDwlah probed with #136's broken import restored. A check that
# cannot fail, inside the PR about checks that cannot fail.
#
# Three cheap passes do the same job with `-E`, which every grep has: take
# import lines, drop the `import type` ones (the exemption — type-only alias
# imports are erased by type-stripping and are harmless), keep what still
# targets `@/`.
#
# And NO `2>/dev/null` here. The stderr of the tool doing the measuring is the
# evidence that it ran; silencing it is what turned a broken flag into a green
# line for a whole review cycle.
value_aliases() { # files…
  # shellcheck disable=SC2086
  grep -nE '^[[:space:]]*import[[:space:]]' "$@" \
    | grep -vE '^[^:]*:[0-9]*:[[:space:]]*import[[:space:]]+type[[:space:]]' \
    | grep -E 'from[[:space:]]+"@/'
}

if [ -n "$REACHABLE" ]; then
  # shellcheck disable=SC2086
  aliased=$(value_aliases $REACHABLE | grep -c . || true)
  if [ "$aliased" -gt 0 ]; then
    # shellcheck disable=SC2086
    value_aliases $REACHABLE | sed 's/^/      hint: /'
  fi
  chk "hint — no VALUE @/ import anywhere in the check graph" "$aliased" 0
else
  # Still not a pass, and now it cannot be reached by a tree that merely has no
  # lib imports: REACHABLE contains $CHECKS itself, and check 1 above has
  # already asserted that $CHECKS is non-empty. Getting here means the file list
  # was lost between the two, which is a broken harness, not a clean tree.
  chk "hint — no VALUE @/ import anywhere in the check graph" "NO-FILES-DISCOVERED" 0
fi

# How many modules the hint actually read. A number nobody looks at until the
# day it drops — which is the day someone deletes the last check that imports
# anything and the hint quietly narrows to the check files alone.
printf '      scanned %s module(s) in the check graph\n' "$(printf '%s' "$REACHABLE" | tr ' ' '\n' | grep -c . || true)"

ran=$((pass + fail))
echo
echo "$pass passed, $fail failed, $ran of 3 checks reached"
if [ "$ran" -ne 3 ]; then
  echo "!! expected 3 checks, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi
[ "$fail" -eq 0 ] && echo "check-imports: PASS" || echo "check-imports: FAIL — $fail check(s)"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
