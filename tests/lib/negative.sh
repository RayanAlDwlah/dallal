#!/usr/bin/env bash
# ============================================================================
# The negative-probe harness. SOURCED, never executed.
#
#   . "$(dirname "$0")/../lib/negative.sh"
#
# ---------------------------------------------------------------------------
# WHY THIS IS A SHARED FILE AND NOT COPIED INTO EACH SUITE
#
# `tests/guards/negative.sh` proved the pattern and wrote the safety reasoning
# down. Two more suites now need the same machinery, and copying it would put
# three copies of a `git checkout --` loop in the tree — the operation that
# already destroyed uncommitted work on this repository once, on 2026-08-15,
# because the restore trap was armed one block too early and fired on the way
# out of the refusal that had just declined to touch anything.
#
# That ordering is a safety property, not a style. It is enforced HERE, once,
# in `neg_files`: the dirty-tree refusal runs first and exits, and the trap is
# armed only after it. A caller cannot get it wrong, because a caller never
# writes it.
#
# `tests/guards/negative.sh` is deliberately NOT converted to use this file.
# It is the one that runs in CI ahead of everything else, it has been through
# its own incident, and rewriting a working safety mechanism to share code with
# two new ones trades a real risk for a cosmetic gain. If a third caller
# appears, revisit that.
#
# ---------------------------------------------------------------------------
# WHAT A PROBE PROVES, AND THE THIRD OUTCOME
#
# A probe breaks one rule on purpose and asserts the check notices:
#
#   CAUGHT   the named check went FAIL. The check works.
#   MISSED   the rule was broken and the check stayed green. The CHECK is
#            broken — that is the whole reason this file exists.
#   BROKEN   no check by that name printed at all. The label drifted, and the
#            probe has been asserting nothing, quietly.
#   NO-OP    the mutation changed no file. THE PROBE is broken, not the check.
#
# The fourth outcome is the one `tests/guards/negative.sh` cannot report, and
# it is not hypothetical: during PZ-8 a probe passed two `s///` expressions to
# a single-file helper, the second edit never happened, and the run reported
# MISSED against a check that was fine. A reader chasing that MISSED would have
# "fixed" a working check. So every mutation here is required to actually dirty
# something, and a mutation that does not is a failure of the suite.
# ============================================================================
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  echo "tests/lib/negative.sh is a library. Source it; do not run it." >&2
  exit 1
fi

NEG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$NEG_ROOT" || exit 1

NEG_PASS=0
NEG_FAIL=0
NEG_NOOP=0
NEG_RUN=""
NEG_TOUCHED=()

# Print every declared file that has uncommitted changes, staged or not.
# One function, used by BOTH the pre-flight refusal and the post-run assertion,
# so the two cannot ask different questions — the divergence that made
# `negative.sh` report a developer's unrelated work as "a mutation was not
# reverted", on a run where every probe had passed and every file was restored.
neg_dirty() {
  local f
  for f in "${NEG_TOUCHED[@]}"; do
    if ! git diff --quiet -- "$f" 2>/dev/null ||
      ! git diff --cached --quiet -- "$f" 2>/dev/null; then
      printf '  %s\n' "$f"
    fi
  done
}

neg_restore() {
  local f
  for f in "${NEG_TOUCHED[@]}"; do
    git checkout -- "$f" 2>/dev/null
  done
}

# neg_files "<newline-separated paths>"
#
# Declares the mutation surface, refuses to start if any of it is dirty, and
# only then arms the restore trap. Nothing that can exit may be added between
# the refusal and the `trap` line.
neg_files() {
  local f dirty
  while read -r f; do
    [ -z "$f" ] && continue
    if [ ! -f "$f" ]; then
      echo "REFUSING TO RUN — declared file does not exist: $f"
      exit 1
    fi
    NEG_TOUCHED+=("$f")
  done <<EOF
$1
EOF
  if [ "${#NEG_TOUCHED[@]}" -eq 0 ]; then
    echo "REFUSING TO RUN — no files declared; every probe would be a NO-OP"
    exit 1
  fi

  dirty="$(neg_dirty)"
  if [ -n "$dirty" ]; then
    echo "REFUSING TO RUN — these files have uncommitted changes, and this script"
    echo "restores by discarding changes to them. Commit or stash first:"
    # '%s\n', not '%s': command substitution ate the trailing newline, and the
    # last filename ran into whatever the caller's shell printed next.
    printf '%s\n' "$dirty"
    exit 1
  fi

  trap neg_restore EXIT
}

# neg_run "<command>" — the check under test. Run once per probe.
neg_run() { NEG_RUN="$1"; }

# neg_probe "<label substring>" "<mutation>"
neg_probe() {
  local want="$1"
  shift
  local out line
  eval "$@" >/dev/null 2>&1

  if [ -z "$(neg_dirty)" ]; then
    NEG_NOOP=$((NEG_NOOP + 1))
    NEG_FAIL=$((NEG_FAIL + 1))
    printf 'NO-OP   %-64s the mutation changed nothing — the PROBE is broken\n' "$want"
    return
  fi

  out="$(eval "$NEG_RUN" 2>&1)"
  neg_restore

  line="$(printf '%s\n' "$out" | grep -F -- "$want" | head -1)"
  if [ -z "$line" ]; then
    NEG_FAIL=$((NEG_FAIL + 1))
    printf 'BROKEN  %-64s no check prints this label\n' "$want"
  elif printf '%s' "$line" | grep -q '^FAIL'; then
    NEG_PASS=$((NEG_PASS + 1))
    printf 'CAUGHT  %-64s\n' "$want"
  else
    NEG_FAIL=$((NEG_FAIL + 1))
    printf 'MISSED  %-64s the rule was broken and the check stayed green\n' "$want"
  fi
}

# neg_report "<SUITE-NAME>" <expected probe count>
neg_report() {
  local name="$1" expected="$2" ran left
  ran=$((NEG_PASS + NEG_FAIL))
  echo
  echo "$NEG_PASS caught, $NEG_FAIL not caught ($NEG_NOOP no-op), $ran of $expected probes reached"

  # A probe that exits early takes its assertion with it and the summary still
  # prints. Same vacuous-pass shape as #121, one file out.
  if [ "$ran" -ne "$expected" ]; then
    echo "!! expected $expected probes, only $ran reached. Treating as failure."
    NEG_FAIL=$((NEG_FAIL + 1))
  fi

  # A probe that leaks a mutation makes every probe after it meaningless, and
  # this is the only place that can notice.
  left="$(neg_dirty)"
  if [ -n "$left" ]; then
    echo "!! a mutation was not reverted:"
    printf '%s\n' "$left"
    NEG_FAIL=$((NEG_FAIL + 1))
  fi

  if [ "$NEG_FAIL" -eq 0 ]; then
    echo "$name: PASS — every probed check can fail"
    exit 0
  fi
  echo "$name: FAIL — $NEG_FAIL probe(s)"
  exit 1
}
