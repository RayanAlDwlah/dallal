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
REACHABLE=$(grep -rh 'from "\.\./\.\./lib/' tests/*/*.check.mjs 2>/dev/null \
  | sed 's/.*from "\.\.\/\.\.\///; s/".*//' | sort -u \
  | while read -r f; do [ -f "$f" ] && printf '%s ' "$f"; done)

if [ -n "$REACHABLE" ]; then
  # shellcheck disable=SC2086
  aliased=$(grep -hP '^\s*import\s+(?!type\s)[^;]*from\s+"@/' $REACHABLE 2>/dev/null | grep -c . || true)
  if [ "$aliased" -gt 0 ]; then
    # shellcheck disable=SC2086
    grep -nP '^\s*import\s+(?!type\s)[^;]*from\s+"@/' $REACHABLE 2>/dev/null | sed 's/^/      hint: /'
  fi
  chk "hint — no VALUE @/ import in a reachable module" "$aliased" 0
else
  chk "hint — no VALUE @/ import in a reachable module" 0 0
fi

ran=$((pass + fail))
echo
echo "$pass passed, $fail failed, $ran of 3 checks reached"
if [ "$ran" -ne 3 ]; then
  echo "!! expected 3 checks, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi
[ "$fail" -eq 0 ] && echo "check-imports: PASS" || echo "check-imports: FAIL — $fail check(s)"
exit $([ "$fail" -eq 0 ] && echo 0 || echo 1)
