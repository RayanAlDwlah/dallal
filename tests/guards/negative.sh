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
# `./tests/guards/run.sh` printing twenty PASS lines proves one thing: that
# twenty commands ran and returned the numbers expected. It does NOT prove
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
# RE-AIMED FOR V2, 2026-08-16. Four of the paths this list carried are V1 files
# that the ship deleted: lib/auctions/listing.ts, the bid09 and bid02 migrations,
# components/bidding/bid-panel.tsx. A probe whose mutation targets a missing file
# does not mutate anything — `perl -pi` errors, run.sh stays green, and the probe
# reports MISSED, which reads as "this check is broken" about a check that is
# fine. Four false accusations pointed at the wrong half of the suite. The V2
# equivalents are lib/auctions/queries.ts, the core schema, and live-auction.tsx;
# types/db.ts is new to the list because V2 keeps its money casts in one shared
# constant rather than inline at each call site.
TOUCHED="lib/auctions/queries.ts
types/db.ts
supabase/migrations/20260815100000_core_schema.sql
components/ui/money.tsx
app/layout.tsx
.env.example
components/bidding/live-auction.tsx
TEAM.md
docs/decisions/D-01-bid-increment-button.md
docs/decisions/README.md
tests/guards/ci-coverage.sh
CLAUDE.md"

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
# --- refuse to run on a dirty tree -----------------------------------------
# A restore is `git checkout --`, which is destructive to uncommitted work. It
# is only safe because these files are known clean when we start.
#
# THE TRAP IS ARMED BELOW THIS BLOCK, NOT ABOVE IT, and that ordering is the
# whole safety property. It used to be armed first — which meant the refusal
# path printed "REFUSING TO RUN … commit or stash first", exited 1, and then
# `git checkout --` ran on the way out and DISCARDED THE EXACT UNCOMMITTED WORK
# the refusal had just declined to touch. Measured on 2026-08-15: a rewritten
# docs/decisions/README.md, gone, with the reassuring message still on screen.
#
# A safety check that performs the damage it is refusing to risk is worse than
# no safety check, because it is trusted. Nothing may be added between here and
# the `trap` line that can exit.
dirty="$(dirty_scope)"
if [ -n "$dirty" ]; then
  echo "REFUSING TO RUN — these files have uncommitted changes and this script"
  echo "restores by discarding changes to them. Commit or stash first:"
  printf '%s' "$dirty"
  exit 1
fi

trap restore EXIT

pass=0
fail=0
EXPECTED=24   # 21 → 24: M1, M2 and R5 each gained a second probe, one per half

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
# M1 and M2 each get TWO probes, because each is now a sum of two counts and a
# single probe can only ever prove one of them fires. That is exactly how a
# narrowed check goes half-vacuous without anyone noticing: the half with the
# probe keeps working, the half without it stops matching, and the suite still
# prints one confident PASS. Both halves of the narrowing are what V2 added, so
# both halves are what has to be shown breakable.

# M1, first half — parseFloat/toFixed, banned outright wherever they appear.
probe "no float call on an amount" \
  "perl -pi -e 's{^}{const x = parseFloat(\"1\"); // GUARDNEGATIVE\n} if \$. == 1' lib/auctions/queries.ts"

# M1, second half — the narrowing. Number() survives in this tree on array
# indices and timestamps, so the check only counts it on a line that also names
# money. This probe writes that line. `bid.amount` and not `current_price`: the
# check matches \bamount\b, and an underscore is a word character, so «price» in
# «current_price» has no word boundary in front of it and would not have fired.
probe "no float call on an amount" \
  "perl -pi -e 's{^}{const x = Number(bid.amount); // GUARDNEGATIVE\n} if \$. == 1' lib/auctions/queries.ts"

# M2, first half — an inline .select() naming a money column bare.
probe "carries ::text" \
  "perl -pi -e 's{^}{const q = supabase.from(\"auctions\").select(\"id, current_price\");\n} if \$. == 1' lib/auctions/queries.ts"

# M2, second half — the shared constants, which is where V2 actually keeps the
# casts and therefore where the regression would land.
probe "carries ::text" \
  "perl -pi -e 's/starting_price::text/starting_price/' types/db.ts"

# Replaces the probe for the V1 `bid_history.amount is sar_text()` check. V2 has
# no bid_history view; place_bid answers in jsonb, and an uncast money value in
# that reply reaches JSON.parse as a bare number — the #103 defect, one layer
# further out. Same rule, new mechanism, so the probe moves with it.
probe "no money value enters a jsonb reply uncast" \
  "perl -pi -e \"s/'current_price', v_amount::text/'current_price', v_amount/\" supabase/migrations/20260815100000_core_schema.sql"

probe "no money column is declared bare numeric" \
  "perl -pi -e 's{^}{alter table public.auctions add column if not exists reserve_price numeric;\n} if \$. == 1' supabase/migrations/20260815100000_core_schema.sql"

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

# The old mutation here turned every <bdi> into a <span> — and that is NOT
# caught, by this check or the re-aimed one, because both count bad <bdi>
# elements and a tree with no <bdi> at all has none. It reported CAUGHT on V1
# only because the check it probed was worded the other way round. Two probes
# now, one per half of the rule the check actually states.
#
# First half: the number renders without going through the formatter — the
# «one formatter, byte-identical wherever it exists» rule (§4.6) breaking at
# the point of render rather than by someone writing a second formatter.
probe "inside <bdi>" \
  "perl -pi -e 's/\{formatMoney\(amount\)\}/{amount}/' components/ui/money.tsx"

# Second half: SAR pulled INSIDE the isolate. This is the one that looks like
# tidying — one element instead of two — and it is the bug §3 names: the
# indicator and the decimal point reorder in RTL text.
probe "inside <bdi>" \
  "perl -pi -e 's{<span className=\"sar\">SAR</span>}{<bdi className=\"sar\">SAR</bdi>}' components/ui/money.tsx"

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
  "perl -pi -e 's{^}{const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n} if \$. == 2' components/bidding/live-auction.tsx"

# --- bidding ---------------------------------------------------------------
# fetchBids() orders by `id` and §5 says why: created_at defaults to now() =
# transaction start, not lock order, so sorting by it renders a DECREASING bid
# history under contention. This flips exactly that one .order().
probe "no .order(\"created_at\")" \
  "perl -pi -e 's/\.order\(\"id\"/.order(\"created_at\"/' lib/auctions/queries.ts"

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

# --- ratification ----------------------------------------------------------
# The first mutation is not invented. `DECIDED in shape` is the exact string
# three records carried until 2026-08-15, when it was removed BY HAND. This
# probe is the difference between "we fixed it" and "it cannot come back".
probe "declares one of the three defined statuses" \
  "perl -pi -e 's{\\*\\*DECIDED\\*\\*}{**DECIDED in shape**} if \$. == 5' docs/decisions/D-01-bid-increment-button.md"

# Drops D-02's row out of the R register while the record stays DECIDED — the
# realistic shape, which is not vandalism but a table edit that loses a line.
#
# This probe is also the only thing that can tell the R-B check apart from a
# check that never loops at all: its `unqueued` counter starts at 0 and the
# assertion wants 0, so a loop body that never executes passes exactly as
# loudly as one that examined every record. That is the vacuous pass #121 was
# filed for, one file over.
probe "every unratified decision record is in the R register" \
  "perl -ni -e 'print unless /^\\| \\*\\*R1\\*\\* \\|/' docs/decisions/README.md"

# --- portability -----------------------------------------------------------
# The mutation is not invented: it is the escape the R-A check above carried
# for three commits, which was green on every machine on this team and red in
# CI on every push. Appending it to another guard script is the realistic
# shape — that is where the next one gets copied from.
#
# THIS PROBE EARNED ITS KEEP THE FIRST TIME IT RAN. The check it probes was
# written as `awk -v n="$BS"t`, and POSIX awk runs escape processing on a -v
# assignment, so the needle was a literal TAB. The check was hunting real tab
# characters after the word grep and could never fire on the defect it names.
# It had already been committed, and the positive run said PASS. Nothing but a
# probe was ever going to find that.
#
# Note what this probe can and cannot do. It proves the check FIRES. It cannot
# prove the check was NEEDED, because a negative probe only ever asks "does red
# appear when the rule is broken" — and one defect in this same area was a check
# that was red UNCONDITIONALLY, which a probe reads as CAUGHT and calls healthy.
# That class is caught by the positive run, in CI, on the other grep. Written
# down because the gap is not obvious and the next reader will assume otherwise.
#
# The needle is assembled from $BS rather than typed, for the reason run.sh
# gives one level down: a probe that breaks a rule by writing the forbidden
# sequence into its own source makes the tree permanently red. The literal
# two characters must never appear in this file. $BS expands HERE, at argument
# construction, so the string reaching the mutation is correct while the bytes
# on disk are clean. Measured: before this, the probe's own line was the single
# violation the fixed check reported against an otherwise clean tree.
BS='\'
probe "backslash-escaped tab" \
  "printf '%s\n' \"# GUARDNEGATIVE grep -cE 'a${BS}${BS}tb' /dev/null\" >> tests/guards/ci-coverage.sh"

# --- self ------------------------------------------------------------------
# The failure this reproduces is the one that actually happened, twice, in two
# consecutive commits: a check was added and §9's sentence describing the suite
# was left saying the old number. Here that is one digit.
probe "CLAUDE.md §9's stated check count matches EXPECTED" \
  "perl -pi -e 's{^- \\*\\*.run\\.sh.\\*\\* — \\*\\*\\d+ checks\\*\\*}{- **\`run.sh\`** — **99 checks**}' CLAUDE.md"

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
