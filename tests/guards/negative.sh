#!/usr/bin/env bash
# ============================================================================
# The guard suite's own guard — proves every check in run.sh can FAIL.
#
#   ./tests/guards/negative.sh
#
# Needs nothing but git and perl. Takes about fifteen seconds.
#
# ---------------------------------------------------------------------------
# WHY THIS EXISTS
#
# `./tests/guards/run.sh` printing seventeen PASS lines proves one thing: that
# seventeen commands ran and returned the numbers expected. It does NOT prove
# that any of them would have returned a different number had the rule been
# broken. A check with a typo'd pattern, a swallowed exit code, or a path that
# matches nothing passes exactly as loudly as a check that works — and it
# passes forever, on every branch, while the rule it names quietly rots.
#
# This repository has caught that defect twice already, both times by reading
# rather than by structure:
#
#   #117  a `grep` anchored on ^ERROR: matched nothing psql ever prints, so
#         the branch reporting WHY a suite aborted could not fire at all
#   #121  a vacuous pass — a suite reported green on a run where the
#         assertions had never executed
#
# So this file breaks each rule on purpose, one at a time, and asserts the
# guard notices. A check that stays green while its rule is violated is
# reported here as a FAILURE OF THE CHECK, which is the only way that class of
# bug becomes visible from outside.
#
# ---------------------------------------------------------------------------
# HOW IT MUTATES, AND WHY THAT IS SAFE
#
# It edits tracked files in place, runs run.sh, then restores them with
# `git checkout --`. Three things keep that honest:
#
#   1. it REFUSES TO START if any file it touches already has uncommitted
#      changes — otherwise a restore would silently discard your work
#   2. an EXIT TRAP restores every file, on success, on failure, and on ^C
#   3. every mutation carries the marker GUARDNEGATIVE, so a tree left dirty
#      by a hard kill is one grep away from being identified
#
# It never writes a real secret. The .env case stages an EMPTY file named
# .env.guardnegative and unstages it again; nothing is ever committed.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

# Every file a mutation below touches. Kept as one list so the safety check and
# the restore trap cannot drift apart.
TOUCHED="lib/auctions/listing.ts
supabase/migrations/20260814200000_bid09_history_order_key.sql
supabase/migrations/20260812120000_bid02_bid_acceptance.sql
components/ui/money.tsx
app/layout.tsx
.env.example
lib/supabase/config.ts
components/bidding/bid-panel.tsx
TEAM.md"

STAGED_ENV=".env.guardnegative"

# Everything this script is allowed to have changed, printed one per line, or
# nothing at all. Both the pre-flight refusal and the post-run assertion go
# through here, and that is the point: they used to be two different questions.
#
# The pre-flight asked "are the files I touch dirty?" and the assertion asked
# "is the WHOLE TREE dirty?" — so the script would start happily on a branch
# with unrelated work in progress and then fail at the end, reporting the
# developer's own uncommitted files as "a mutation was not reverted". Measured,
# not imagined: it fired on this very branch, against a run where all fifteen
# probes were CAUGHT and every mutation had been restored correctly.
#
# That is the cry-wolf failure. The message named the wrong cause, the exit
# code said the guard suite was broken when it was not, and the fix a hurried
# reader reaches for is deleting the assertion — which would remove the only
# thing that can notice a probe leaking a mutation into every probe after it.
# Same list, same question, both ends.
dirty_scope() {
  local f
  while read -r f; do
    [ -z "$f" ] && continue
    if ! git diff --quiet -- "$f" 2>/dev/null || ! git diff --cached --quiet -- "$f" 2>/dev/null; then
      printf '  %s\n' "$f"
    fi
  done <<EOF
$TOUCHED
EOF
  [ -e "$STAGED_ENV" ] && printf '  %s (left on disk)\n' "$STAGED_ENV"
  git ls-files --error-unmatch "$STAGED_ENV" >/dev/null 2>&1 \
    && printf '  %s (left in the index)\n' "$STAGED_ENV"
  return 0
}

restore() {
  echo "$TOUCHED" | while read -r f; do
    [ -n "$f" ] && git checkout -- "$f" 2>/dev/null
  done
  git rm --cached --quiet "$STAGED_ENV" 2>/dev/null
  rm -f "$STAGED_ENV"
}
trap restore EXIT

# --- refuse to run on a dirty tree -----------------------------------------
# A restore is `git checkout --`, which is destructive to uncommitted work. It
# is only safe because these files are known clean when we start.
dirty="$(dirty_scope)"
if [ -n "$dirty" ]; then
  echo "REFUSING TO RUN — these files have uncommitted changes and this script"
  echo "restores by discarding changes to them. Commit or stash first:"
  printf '%s' "$dirty"
  exit 1
fi

pass=0
fail=0
EXPECTED=17

# probe LABEL_SUBSTRING  MUTATION_COMMAND
#
# Applies the mutation, runs the guard suite, and asserts the line whose label
# contains LABEL_SUBSTRING now reads FAIL. Then restores.
probe() {
  local want="$1"; shift
  local out line
  eval "$@" >/dev/null 2>&1
  out="$(./tests/guards/run.sh 2>&1)"
  restore
  line="$(printf '%s\n' "$out" | grep -F -- "$want" | head -1)"
  if [ -z "$line" ]; then
    fail=$((fail + 1))
    printf 'BROKEN  %-58s no such check in run.sh\n' "$want"
  elif printf '%s' "$line" | grep -q '^FAIL'; then
    pass=$((pass + 1))
    printf 'CAUGHT  %-58s\n' "$want"
  else
    fail=$((fail + 1))
    printf 'MISSED  %-58s the rule was broken and the guard stayed green\n' "$want"
  fi
}

echo "==> breaking each rule on purpose — every one must be CAUGHT"
echo

# --- money -----------------------------------------------------------------
probe "no Number()/parseFloat/parseInt/toFixed" \
  "perl -pi -e 's{^}{const x = Number(1); // GUARDNEGATIVE\n} if \$. == 1' lib/auctions/listing.ts"

probe "carries ::text" \
  "perl -pi -e 's/starting_price::text/starting_price/ if /GUARDNEGATIVE|starting_price::text/' lib/auctions/listing.ts"

probe "bid_history.amount is sar_text()" \
  "perl -pi -e 's/public\.sar_text\(b\.amount\) as amount/b.amount as amount/' supabase/migrations/20260814200000_bid09_history_order_key.sql"

probe "no money column is declared bare numeric" \
  "perl -pi -e 's{^}{alter table public.auctions add column if not exists reserve_price numeric;\n} if \$. == 1' supabase/migrations/20260812120000_bid02_bid_acceptance.sql"

probe "no second formatter" \
  "perl -pi -e 's{^}{const y = (1).toLocaleString();\n} if \$. == 1' components/ui/money.tsx"

# The Arabic is written as codepoint escapes, not as literal characters. Under
# `perl -CSD` the OUTPUT stream is encoded as UTF-8, so raw UTF-8 bytes sitting
# in the program text get encoded a second time and what lands in the file is
# mojibake — which the guard correctly does not match, so the probe reported
# MISSED against a working check. Escapes are unambiguous at any encoding.
# ر = U+0631, س = U+0633.
probe "the currency indicator is Latin SAR" \
  "perl -CSD -pi -e 's{^}{const z = \"\x{0631}.\x{0633}\";\n} if \$. == 1' components/ui/money.tsx"

# --- rtl -------------------------------------------------------------------
probe "no Arabic-Indic digit" \
  "perl -CSD -pi -e 's{^}{const d = \"\x{0661}\x{0662}\x{0663}\";\n} if \$. == 1' components/ui/money.tsx"

probe "declared exactly once in the tree" \
  "perl -pi -e 's{^}{const dup = <span dir=\"rtl\" />;\n} if \$. == 1' components/ui/money.tsx"

probe "that one declaration is the root layout" \
  "perl -pi -e 's/lang=\"ar\" dir=\"rtl\"/lang=\"ar\"/' app/layout.tsx"

probe "no physical ml-/mr-/pl-/pr-" \
  "perl -pi -e 's{^}{const c = \"ml-4\";\n} if \$. == 1' components/ui/money.tsx"

probe "isolates its digits in <bdi>" \
  "perl -pi -e 's/<bdi/<span/' components/ui/money.tsx"

# --- secrets ---------------------------------------------------------------
# An empty file, staged and immediately unstaged. Nothing is committed and no
# value of any kind is written.
#
# `-f` is required and is the whole point. .gitignore already carries `.env.*`,
# so a plain `git add` is REFUSED and the probe reported MISSED against a
# check that was fine. That refusal is also the answer to "then why keep the
# check at all": .gitignore stops the accident, and the only way a .env reaches
# a public repository is somebody overriding it — with -f, or with a rule
# edited earlier in the same PR. This check is the one that sees that.
probe "no .env file is tracked by git" \
  "touch $STAGED_ENV && git add -f --intent-to-add $STAGED_ENV"

probe "no SERVICE_ROLE name carries the NEXT_PUBLIC_ prefix" \
  "printf 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=\n' >> .env.example"

probe "no \"use client\" module mentions SERVICE_ROLE" \
  "perl -pi -e 's{^}{const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n} if \$. == 2' components/bidding/bid-panel.tsx"

# --- bidding ---------------------------------------------------------------
probe "no .order(\"created_at\")" \
  "perl -pi -e 's/\.order\(\"end_time\"/.order(\"created_at\"/' lib/auctions/listing.ts"

# --- governance ------------------------------------------------------------
# Both governance checks strip quotations before matching, because this
# repository retires a rule by quoting it and a guard that cannot tell "we
# deleted this" from "we require this" gets an ignore list within a week. That
# stripping is also the way these two checks could go vacuous — strip too much
# and they match nothing, forever, on every branch.
#
# These probes insert the banned sentences UNQUOTED, which is the only form
# that is actually a violation. They are the reason the stripping can be
# trusted: if it ever grew to swallow plain prose, both would report MISSED.
probe "the deleted refusal rule has not come back" \
  "perl -pi -e 's{^}{Do not write code you do not own.\n} if \$. == 1' TEAM.md"

probe "forbids a named person from touching something" \
  "perl -pi -e 's{^}{Mohammed must not touch the money formatter.\n} if \$. == 1' TEAM.md"

# ---------------------------------------------------------------------------
ran=$((pass + fail))
echo
echo "$pass caught, $fail not caught, $ran of $EXPECTED probes reached"
if [ "$ran" -ne "$EXPECTED" ]; then
  echo "!! expected $EXPECTED probes, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi

# Every file this script touches must be exactly as we found it. A probe that
# leaves a mutation behind would make every later probe meaningless, and this
# is the only place that can notice.
#
# Scoped to dirty_scope() — the same list the pre-flight refusal uses — so this
# reports what it says it reports and nothing else. Unrelated work elsewhere in
# the tree is none of this assertion's business; see the note on that function.
left="$(dirty_scope)"
if [ -n "$left" ]; then
  echo "!! a mutation was not reverted:"
  printf '%s\n' "$left"
  fail=$((fail + 1))
fi

if [ "$fail" -eq 0 ]; then
  echo "GUARDS-NEGATIVE: PASS — every check can fail"
  exit 0
fi
echo "GUARDS-NEGATIVE: FAIL — $fail probe(s)"
exit 1
