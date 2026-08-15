#!/usr/bin/env bash
# ============================================================================
# The guard suite — the rules that are TRUE TODAY and have nothing holding them.
#
#   ./tests/guards/run.sh
#
# Needs nothing: no Docker, no node, no network, no credentials. It reads the
# tree and asserts twenty-one facts about it. It finishes in under a second,
# which is deliberate: a guard nobody minds running is a guard that runs.
#
# ---------------------------------------------------------------------------
# WHY THIS FILE EXISTS
#
# CLAUDE.md §8 names the failure mode this project is most exposed to:
#
#   "a confident session filling a gap with something reasonable — a reserve
#    price, a bid increment, a numeric(12,2), an English string, a COALESCE
#    that hides a null. Every one of those type-checks, passes review at a
#    glance, and silently violates a decision someone made deliberately."
#
# Three developers build this in sessions that cannot see each other. The only
# thing that survives a session ending is what is written down — and a written
# rule stops nothing on its own. The project already proved this to itself: the
# 20-extension cap is a CHECK CONSTRAINT rather than an `if`, because an `if`
# is one line any session can delete while the diff still reads as a cleanup.
#
# This file applies the same reasoning one level up. Every check below is a
# rule that is currently OBEYED and currently UNHELD — obeyed because the
# people who wrote these files were careful, held by nothing but that care.
#
# ---------------------------------------------------------------------------
# WHAT IS DELIBERATELY *NOT* HERE — no check duplicates a suite that exists
#
# This is not the place to re-assert behaviour a real suite already proves. A
# second, weaker copy of an assertion is worse than none: it goes green for its
# own reasons and makes the tree look better covered than it is.
#
#   already held, NOT repeated here          by
#   ------------------------------------     ------------------------------
#   NaN / Infinity rejected as an amount     tests/bidding/acceptance.sql
#   the extension cap is a CHECK             tests/bidding/closing.sql
#   end_time moves forward only, in 30s      tests/bidding/closing.sql
#   a rejected bid never extends             tests/bidding/closing.sql
#   history ordered by bids.id, not time     tests/bidding/{acceptance,sweep}.sql
#   eligibility by clock, not by `status`    tests/bidding/acceptance.sql
#   no reserve / increment / max identifier  tests/integration/excluded-features
#   no numeric(P,S) typmod                   tests/integration/excluded-features
#   status admits exactly two values         tests/integration/excluded-features
#
# The gap those leave is a specific shape: every one of them lives in SQL or in
# behaviour, and the rules that live in TYPESCRIPT, in the RTL layer, and in
# what git tracks have nothing at all. That gap is what this file is.
#
# ---------------------------------------------------------------------------
# WHY IT STRIPS COMMENTS FIRST — the lesson INT-08 already paid for
#
# This repository documents its absences obsessively. A plain grep for the
# banned things returns the healthiest files as the worst offenders:
#
#   lib/money.ts:28          "Latin `SAR`, never `ر.س` — BR-43"
#   live-snapshot.ts:47      "The absence of an .order() call is load-bearing."
#   countdown.tsx:68         "`ar-SA` … renders ٢٠/٠٨/٢٠٢٦."
#
# Every one of those is the rule working, quoted back as if it were a breach.
# A check that cannot tell "we did not do this" from "we did this" gets an
# ignore list bolted on by the first person who runs it, and an ignore list is
# how a guard dies. So the views below strip comments before matching — the
# same technique, for the same reason, as tests/integration/excluded-features.
#
# KNOWN LIMIT, stated rather than discovered: stripping is textual, not a
# parse. A `//` inside a string literal, or a `--` inside a SQL string, ends
# that line early and could hide a violation behind it. No such literal exists
# in this tree today. The alternative is two parsers.
#
# ---------------------------------------------------------------------------
# WHEN A CHECK HERE GOES RED AND THE CODE IS RIGHT
#
# It will happen, and the answer is never an ignore list. Some of these rules
# are absolute (money never touches a float) and some are absolute only until
# the team decides otherwise. If a check blocks work that is genuinely correct,
# the fix is to change the check IN A PULL REQUEST, where the person changing
# it has to say what decision moved and someone else has to agree. That is the
# whole point: the guard does not stop the change, it stops the SILENT change.
#
# Keep EXPECTED in step with the chk() calls.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

EXPECTED=21
pass=0
fail=0

chk() { # label  got  want
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    printf 'PASS  %-62s (%s)\n' "$1" "$2"
  else
    fail=$((fail + 1))
    printf 'FAIL  %-62s got=%s want=%s\n' "$1" "$2" "$3"
  fi
}

# --- comment-stripped views of the code ------------------------------------
# Block comments always; whole-line // only, so a URL inside a string cannot
# swallow the rest of its line and take a violation with it. Identical to the
# INT-08 audit's views on purpose — one technique, not two.
code_ts() {
  find app components lib -name '*.ts' -o -name '*.tsx' 2>/dev/null | while read -r f; do
    perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' "$f"
  done
}
code_sql() {
  find supabase/migrations -name '*.sql' 2>/dev/null | while read -r f; do
    perl -0777 -pe 's{/\*.*?\*/}{}gs; s{--[^\n]*}{}g' "$f"
  done
}
# `grep -c .` rather than `wc -l`: BSD wc pads its output with spaces and GNU
# wc does not, so a wc-based count compares equal on one developer's machine
# and unequal on another's. Two of the three of us are on WSL and one is on
# macOS; this suite has to say the same thing on both.
count_ts() { code_ts | grep -oiE "$1" | grep -c . ; }
count_sql() { code_sql | grep -oiE "$1" | grep -c . ; }

# Every STRING LITERAL in the comment-stripped TypeScript, one per line. This
# is the view a PostgREST column reference lives in, and nothing else does: an
# insert payload names its columns as object KEYS, a row type names them as
# FIELDS, and neither is a read. Separating the three is what lets M2 below be
# an absolute rule instead of a count with exceptions.
strings_ts() {
  find app components lib -name '*.ts' -o -name '*.tsx' 2>/dev/null | while read -r f; do
    perl -0777 -ne 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm;
                    while (/(["'"'"'`])((?:[^\\\1]|\\.)*?)\1/gs) { print "$2\n" }' "$f"
  done
}

echo "==> guards — the rules with nothing else holding them (CLAUDE.md §3, §4, §5, §6)"
echo

# ===========================================================================
# MONEY — CLAUDE.md §4, docs/contracts/S0-12-money.md
# ===========================================================================
echo "--- money"

# M1. §4 rule 1. The ban is on the CALL, not on the intent, because intent is
# not greppable and a float that reaches an amount is unrecoverable: the value
# is already wrong by the time anything can notice.
#
# This is repo-wide over app/components/lib rather than scoped to the money
# files, and that is on purpose — the amount arrives from a form, a URL, a
# realtime payload and a server read, so "the money files" is not a place.
#
# If a genuinely non-money `Number()` is ever needed (a page index, a count),
# this check fires and it is RIGHT to fire: narrow it in a PR that says which
# call and why. Do not add an ignore file.
#
# NARROWED FOR V2, 2026-08-16 — this is that PR. The V1 tree had zero
# non-money conversions, so a blanket count was free. V2 has seven, and every
# one of them is a genuinely non-money integer: a brightness slider, a lot
# duration in minutes, an "ends within N hours" filter, two «بعد N ساعات»
# presets and an AI sampling knob. A check that reports seven violations on a
# tree that has none gets deleted by the next person in a hurry — which is the
# real failure mode, not the one it was guarding.
#
# So the ban is split by what the call can actually do:
#
#   parseFloat / toFixed  — absolute, still zero. Neither has a non-money use
#                           on this codebase and both exist to produce or
#                           print a float. `toFixed` is also the quiet way a
#                           second formatter arrives.
#   Number / parseInt     — banned on a LINE THAT NAMES AN AMOUNT. That is
#                           where the damage is: `Number(a.current_price)` is
#                           the defect, `Number(hours)` is a filter.
#
# The money vocabulary is the same list M2 and M3 use. Widen all three
# together or none.
chk "no float call on an amount — parseFloat/toFixed at all, Number()/parseInt() on a money line" \
    "$(( $(count_ts '\bparseFloat\s*\(|\.toFixed\s*\(') \
       + $(code_ts | grep -E '\b(Number|parseInt)\s*\(' \
            | grep -ciE '\b(amount|price|increment|deposit|sar)\b') ))" 0

# M2. §4 rule 7, and the only rule on this list that was MEASURED breaking
# (#103). Not writing Number() is not enough: PostgREST serialises a bare
# `numeric` as an unquoted JSON number, and JSON.parse inside the Supabase
# client turns it into a float before one line of this repository runs. The
# float is produced with NO CODE OF OURS ON THE STACK.
#
# So the cast is the whole defence, and it is per column, every time. This
# counts every price column named anywhere in the comment-stripped TypeScript
# and subtracts the ones carrying ::text — the difference must be zero.
#
# It reads every string literal rather than only `.select("…")` arguments
# deliberately: the real select strings on this codebase are named constants
# (AUCTION_SELECT, DETAIL_SELECT, HISTORY_SELECT) assembled far from the call,
# so a check that only matched the call site would see none of the seven casts
# that are actually there.
#
# It is scoped to string literals rather than to identifiers for the opposite
# reason — `starting_price` also appears as an INSERT payload key and as a row
# type field, neither of which is a read and neither of which can be cast. An
# identifier-wide check reports 24 violations on a tree that has none, and a
# check that cries wolf 24 times gets deleted.
#
# A filter argument — .eq("current_price", …) — would fire this and needs no
# cast. None exists today. If one arrives, narrow this in a PR that says so.
#
# NARROWED FOR V2, 2026-08-16 — one arrived, twice. `/api/price-suggestion`
# filters with .not("current_price", "is", null) and the home page filters with
# the PostgREST expression `current_price.lte.${maxPrice}`. Neither reads the
# VALUE — a filter is evaluated in PostgreSQL and returns rows, so there is no
# number crossing the wire to corrupt, and `::text` in a filter is a syntax
# error rather than a fix.
#
# So the check moved from "any string" to the two places a money value can
# actually cross the wire, and it is the sum of both:
#
#   part 1  every money column inside a .select() STRING LITERAL is cast
#   part 2  every money column inside the shared column CONSTANTS is cast
#
# Part 2 is the one that matters on this tree, and it is why the V1 comment
# above about named constants is still true: almost every select on V2 passes
# an identifier (AUCTION_WITH_RELATIONS, LOT_COLUMNS, SESSION_COLUMNS), so a
# check that only read .select() arguments would see three casts and miss
# fourteen. types/db.ts and types/sessions.ts are where all five money columns
# — starting_price, current_price, bid_increment, amount, deposit — are named
# for reading, in one place, once. That is V2's whole §4.7 defence.
#
# Both parts read STRING LITERALS, not identifiers, for the V1 reason above: a
# money column also appears as a TypeScript interface field and as an insert
# payload key, and neither is a read.
chk "every money column read — in a .select() or in the shared constants — carries ::text" \
    "$(( $(code_ts | perl -0777 -ne 'while(/\.select\(\s*([`"'"'"'])(.*?)\1/gs){print "$2\n"}' \
            | grep -oE '\b(starting_price|current_price|bid_increment|amount|deposit)\b(::text)?' \
            | grep -vc '::text') \
       + $(perl -0777 -ne 'while(/"([^"]*)"/g){print "$1\n"}' types/db.ts types/sessions.ts 2>/dev/null \
            | grep ',' \
            | grep -oE '\b(starting_price|current_price|bid_increment|amount|deposit)\b(::text)?' \
            | grep -vc '::text') ))" 0
# ^ part 2 reads only string literals CONTAINING A COMMA, i.e. column lists.
# `"deposit"` on its own is EntryMode's value, not a column — the entry mode is
# «وديعة» or «دعوة», and a session whose entry_mode is the string deposit has
# no more crossed the wire as a number than one whose city is a string. A
# single-column select of a money column has no comma either, and is caught by
# part 1, which reads .select() arguments and does not care about commas.

# M3. The one money column read WITHOUT a ::text cast is bid_history.amount,
# and it is safe for a structural reason rather than a careful one: the view
# defines it as sar_text(b.amount), so what crosses the wire is already text.
#
# That makes this check the licence for the bare `amount` in HISTORY_SELECT.
# Redefine the view to expose the raw numeric column and M2 keeps passing while
# every bid amount in the history silently becomes a float — this is the check
# that notices.
#
# It reads the LAST migration that defines the view, not all of them: the view
# is created once and `create or replace`d as it evolves, so counting across
# the directory would assert a number that grows by one every time someone
# touches it — which is the same as asserting nothing. Filename order is the
# order `supabase db push` applies them, so the last definition is the live one.
# RE-AIMED FOR V2, 2026-08-16. There is no `public.bid_history` view in V2 and
# no `sar_text()`; the reply path is different, so the check follows the defect
# rather than the file it used to live in.
#
# The defect is unchanged: a `numeric` reaching the wire is parsed into a float
# by the Supabase client before any of our code runs (#103). In V2 the second
# place that can happen — after the select lists M2 holds — is a SECURITY
# DEFINER function's `jsonb` reply. `jsonb_build_object('amount', v_amount)`
# puts an unquoted JSON *number* in the payload, and the bid button reads that
# payload. It looks exactly like the correct line; the only difference is the
# five characters that are missing.
#
# So: every money-named key in every jsonb reply, across every migration, must
# carry `::text`. The value expression must start with an identifier — a quoted
# literal ('invite' under the 'deposit' key of entry_mode) is not an amount.
chk "no money value enters a jsonb reply uncast — every RPC amount is ::text" \
    "$(code_sql \
        | grep -ohE "'(amount|current_price|min_amount|starting_price|increment|new_price|deposit)'[[:space:]]*,[[:space:]]*[a-z_][a-zA-Z_0-9.]*(::text)?" \
        | grep -vc '::text')" 0

# M4. §4 rule 3. INT-08 already bans the numeric(P,S) TYPMOD, which is the
# loud version of this mistake. The quiet version passes that check untouched:
# a new money column declared bare `numeric` has no typmod, no ceiling, and no
# domain either — so it accepts NaN, accepts three decimals, and accepts a
# negative. It looks like every other column in the file.
#
# NARROWED FOR V2, 2026-08-16: PL/pgSQL LOCALS are subtracted. `place_bid`
# declares `v_amount numeric` and must — the incoming text is cast into it so
# the domain's own predicate (> 0, two decimals, < Infinity) can be re-checked
# before anything is written. A local is not a column, holds no row, and its
# value is validated three lines later. The `v_` prefix is the convention every
# function in this schema follows; a money COLUMN named `v_something` would be
# a stranger thing than the one this check exists to catch.
chk "no money column is declared bare numeric — every one is sar_amount" \
    "$(( $(count_sql '\b[a-z_]*(price|amount)\s+numeric\b') \
       - $(count_sql '\bv_[a-z_]*(price|amount)\s+numeric\b') ))" 0

# M5. §4 rule 6 — one formatter, byte-identical wherever it exists. A second
# formatter does not announce itself as a second formatter; it arrives as a
# one-line toLocaleString() in a component that needed a number on a screen.
# lib/money.ts is excluded because it IS the formatter, and it says in its own
# header why it does not use Intl.NumberFormat (Intl takes a number).
chk "no second formatter — Intl/toLocaleString outside lib/money.ts" \
    "$(find app components lib -name '*.ts' -o -name '*.tsx' 2>/dev/null \
        | grep -v '^lib/money.ts$' | while read -r f; do
            perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' "$f"
          done | grep -oE 'toLocaleString|Intl\.NumberFormat' | grep -c .)" 0

# M6. §4 rule 6 again, the indicator half. BR-43 / FR-CREATE-13 fix it as the
# Latin `SAR`. `ر.س` is the reasonable-looking wrong answer — it is what an
# Arabic interface "obviously" wants, which is exactly why it needs a guard
# rather than a convention.
chk "the currency indicator is Latin SAR — never ر.س in rendered code" \
    "$(count_ts 'ر\.س')" 0

# ===========================================================================
# RTL — CLAUDE.md §3, BR-41, BR-42, PRD §1.2
# ===========================================================================
echo
echo "--- rtl"

# R1. §3: "Digits stay Western (0–9). Arabic-Indic digits are deliberately not
# used." The way they arrive is never a typed character — it is a date or
# number formatted with the `ar-SA` locale, whose default numbering system is
# `arab`. Three files carry a comment saying exactly that, which is why this
# check reads the stripped view: those comments are the rule, not a breach.
#
# perl rather than `grep -P`: BSD grep on macOS has no -P at all and exits with
# a usage error, which `chk` reads as an empty count and reports as a failure
# on a clean tree. One of the three of us is on macOS and two are on WSL —
# a guard that only runs on Linux is a guard two thirds of this team will
# delete. Same portability rule as `grep -c .` above.
chk "no Arabic-Indic digit (٠-٩) in code" \
    "$(code_ts | perl -CSD -ne 'print if /[\x{0660}-\x{0669}]/' | grep -c .)" 0

# R2/R3. §3: dir is set "once, at the root, and never overridden per
# component". Both halves matter and they fail differently — a second dir
# anywhere is a component that decided its own direction, and a root that
# stopped declaring one flips the whole document to LTR while every component
# still looks correct in isolation.
chk "dir=\"rtl\" is declared exactly once in the tree" \
    "$(count_ts 'dir="rtl"')" 1
chk "that one declaration is the root layout" \
    "$(perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' app/layout.tsx | grep -c 'lang="ar" dir="rtl"')" 1

# R4. §3: "Never physical left/right for layout that should mirror." The whole
# interface is RTL, so a physical utility is not a style choice — it is a
# component that mirrors the wrong way for every user of the product. Logical
# ps-/pe-/ms-/me-/start-/end- are the vocabulary; these four are the ones that
# arrive by muscle memory from every other project on earth.
chk "no physical ml-/mr-/pl-/pr- utility in JSX" \
    "$(find app components -name '*.tsx' 2>/dev/null | while read -r f; do
         perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' "$f"
       done | grep -oE '\b(ml|mr|pl|pr)-[a-z0-9.]+' | grep -c .)" 0

# R5. §3: numbers are wrapped in a bidirectional isolate, and the currency
# indicator stays OUTSIDE it. Without the isolate the decimal point and the
# indicator reorder in RTL — "1,250.00 SAR" renders as something else entirely,
# and it renders that way only in Arabic, so a reviewer reading the JSX sees
# nothing wrong. The isolate lives in one component; assert it is still there.
#
# RE-AIMED FOR V2, 2026-08-16. Counting `<bdi` in money.tsx and demanding
# exactly one was a count of that file's components, not of the rule: V2 ships
# two money renderings there (`Money`, and `IncrementAmount` for «زايد بـ 500»,
# which prints no decimals), so the count is 2 and says nothing either way.
#
# The rule has two halves and this now asserts both, as a sum that must be 0:
#
#   part 1  every <bdi> in money.tsx wraps a FORMATTER CALL, not a raw value.
#           `<bdi>{amount}</bdi>` renders 1250 where 1,250.00 belongs — the
#           isolate is intact and the string is wrong.
#   part 2  no <bdi> anywhere in the tree contains SAR. This is the half that
#           actually breaks: put the indicator inside the isolate and the
#           decimal point and the indicator reorder in Arabic only, so the JSX
#           reads correctly to a reviewer and renders wrongly to a user.
#
# Part 2 is tree-wide on purpose. money.tsx is where the pattern is defined;
# any component is where it gets copied wrong.
chk "money renders through a formatter inside <bdi>, with SAR outside the isolate" \
    "$(( $(perl -0777 -pe 's{/\*.*?\*/}{}gs; s{^\s*//[^\n]*$}{}gm' components/ui/money.tsx \
            | grep -oE '<bdi[^>]*>[{][a-zA-Z_]+' | grep -vc 'format') \
       + $(code_ts | perl -0777 -ne 'while(/<bdi\b.*?<\/bdi>/gs){ print "$&\n" }' \
            | grep -c 'SAR') ))" 0

# ===========================================================================
# SECRETS — CLAUDE.md §6
# ===========================================================================
echo
echo "--- secrets"

# S1. §6: "Never commit a secret. No .env, no keys, no tokens. The repository
# is PUBLIC. A leaked key is rotated, not deleted from history." That last
# clause is why this check is worth its second of runtime: by the time a human
# notices, the remedy is not `git rm`, it is rotation. .env.example is the
# documented exception — it carries names, never values.
chk "no .env file is tracked by git (.env.example excepted)" \
    "$(git ls-files 2>/dev/null | grep -E '(^|/)\.env' | grep -v '\.env\.example$' | grep -c .)" 0

# S2. §6: the service-role key "never reaches the browser and never appears in
# a client-side environment variable". NEXT_PUBLIC_ is not a naming convention
# — Next.js inlines anything with that prefix into the client bundle at build
# time. A NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is a published key, on a public
# repository's deployment, the moment it builds.
chk "no SERVICE_ROLE name carries the NEXT_PUBLIC_ prefix" \
    "$(grep -rhoE 'NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE[A-Z_]*' \
        app components lib supabase .env.example 2>/dev/null | grep -c .)" 0

# S3. The same key, the other route into the bundle. A module marked
# "use client" is compiled into the browser bundle whatever its variable is
# called, so a correctly-named SUPABASE_SERVICE_ROLE_KEY read from a client
# component is the identical leak with none of the identical warning signs.
chk "no \"use client\" module mentions SERVICE_ROLE" \
    "$(grep -rl 'use client' app components lib 2>/dev/null \
        | xargs grep -l 'SERVICE_ROLE' 2>/dev/null | grep -c .)" 0

# ===========================================================================
# BIDDING — CLAUDE.md §5
# ===========================================================================
echo
echo "--- bidding"

# B1. §5: "Bid history is ordered by bids.id, never by created_at. created_at
# defaults to now() = transaction start, not lock order. Sorting by it renders
# a DECREASING bid history under contention — measured at 2 of 12 contended
# auctions."
#
# The SQL side of this is held by the bidding suite. The TYPESCRIPT side is
# held by a comment, in lib/bidding/live-snapshot.ts, which says so plainly:
#
#     Adding `.order("created_at")` here would look like tidiness and be that
#     bug. The absence of an `.order()` call is load-bearing.
#
# A comment asking a future session not to tidy something is not a guard. This
# is. The read is ordered by `seq` — the view's public rank over bids.id — and
# any .order() naming created_at is the regression, whatever it is ordering.
#
# NARROWED FOR V2, 2026-08-16. The rule is about BIDS, and V1's tree happened
# to contain no other ordered read, so "any read" and "a bids read" were the
# same number there. V2 orders three things by created_at and every one is
# correct: a seller's own auctions, a host's own sessions, and a session's
# attendee list. None of them is a bid, none is subject to lock-order skew, and
# for all three created_at IS the intended key.
#
# So this now walks each PostgREST chain and fires only when the table is
# `bids`. `(?:(?!\.from\().)*?` stops the match at the next .from( so one
# query's .order() cannot be attributed to another query's table — the whole
# point of scoping it. V2's own bids read is `.order("id")`, which is the
# shape §5 asks for and what this check protects.
chk "no .order(\"created_at\") on a bids read" \
    "$(code_ts | perl -0777 -ne 'while(/\.from\(\s*["'"'"'`]bids["'"'"'`](?:(?!\.from\().)*?\.order\(\s*["'"'"'`]created_at/gs){print "hit\n"}' \
        | grep -c .)" 0

# ===========================================================================
# GOVERNANCE — CLAUDE.md §1
# ===========================================================================
echo
echo "--- governance"

# The rule these two watch is the newest one in CLAUDE.md and the least
# code-shaped, which is exactly why it needs watching: it lives entirely in
# prose, across nine documents, and the failure mode is a sentence coming back
# rather than a line of code being written.
#
# G1 was measured, not predicted. The first governance sweep (ea6eb5f) worked
# from CLAUDE.md §1's list of stale documents — TEAM.md, GITHUB_PLAN.md,
# ARCHITECTURE.md, README.md, docs/v2/* — banner-ed all five, and stopped. A
# mechanical sweep the next day found design/STACK.md §11 still saying
# "Mohammed must not add a second update mechanism alongside Rayan's": a live
# prohibition, on a named person, in a file nobody had thought to list. The
# list was a promise that somebody enumerated correctly. This is not.
#
# Quotations are stripped first, and for the same reason comments are stripped
# above: this repository RETIRES rules by quoting them, so «...», "..." and
# *"..."* are where the dead sentences live. Without stripping, the documents
# that did the work of retiring a rule are reported as its worst offenders,
# somebody adds an ignore list, and the guard dies. The stripping is textual —
# an unbalanced quote mark swallows to the next one. There is none today.
# `git ls-files`, not `find` — and that is not a style preference. The first
# version of this used find and reported got=4 / got=20 on a tree whose tracked
# files were clean: every match came from .claude/worktrees/, four stale
# checkouts of this same repository sitting inside it, ignored by git and
# absent from a CI checkout. It would have been GREEN IN CI AND RED LOCALLY —
# the exact inversion of a useful guard, and the shape the team has been bitten
# by before (BSD wc padding, grep -P on macOS). The tracked tree is the subject.
prose_md() {
  git ls-files -z '*.md' 2>/dev/null | while IFS= read -r -d '' f; do
    perl -0777 -pe 's{«.*?»}{}gs; s{\*"[^"]*"\*}{}gs; s{"[^"\n]*"}{}g' "$f"
  done
}
count_md() { prose_md | grep -oiE "$1" | grep -c . ; }

# G1. §1: '"Do not write code you do not own" is deleted. It is no longer a
# rule on this project, and a session that refuses work by citing it is citing
# something that does not exist.' A document may quote it to say it is dead —
# CLAUDE.md §1 does, and that quotation is stripped above. Asserting it is not.
chk "the deleted refusal rule has not come back" \
    "$(count_md 'do not write code you do not own')" 0

# G2. §1: 'A steward's absence must not block a ready, well-specified ticket.
# Request the review, say in the PR that you requested it, and proceed.' The
# shape that violates this is not the word "owns" — that survives legitimately
# all over the tree as "who knows this best". It is an instruction addressed to
# a NAMED PERSON forbidding them from touching something. That is a permission
# boundary whatever it is called, and it is the thing that stopped work.
chk "no document forbids a named person from touching something" \
    "$(count_md '(mohammed|rayan|abdulrahman|dem4t|m7ya505|RayanAlDwlah)[^.]{0,40}(must not|may not|is not allowed to|shall not|cannot) (touch|change|edit|modify|add|write|alter|rename)')" 0

# ===========================================================================
# RATIFICATION — docs/decisions/README.md, "The ratification gate"
# ===========================================================================
echo
echo "--- ratification"

# CLAUDE.md §2: product decisions live in PRD.md and NOWHERE ELSE. This
# directory is the holding area between a decision being made and the PRD
# saying so, and the gap it spans is the one place a product decision can sit
# unratified for a week while code gets written against it. R3 is that, today:
# CLAUDE.md §5 says end_time has two doors, PRD.md:784 says "the single
# exception". Both on main. Neither noticed by anything.
#
# These two do not ratify and cannot. They hold the QUEUE — the list the owner
# reads. A queue nobody is required to update is a queue that is wrong.

# The status cell only — `| Status | **VALUE** — ...` on one line of the header
# table. Deliberately not the whole file: D-03 and D-05 both discuss the retired
# `DECIDED in shape` in their own prose, and a file-wide match would call the
# two records that documented the fix its only violators. Same lesson as the
# comment stripping above, arrived at the same way.
dec_files() { git ls-files -z 'docs/decisions/D-*.md' 2>/dev/null; }
dec_status() { # -> one line per record: "D-0N-slug.md<TAB>STATUS"
  dec_files | while IFS= read -r -d '' f; do
    s="$(perl -ne 'if (/^\|\s*Status\s*\|\s*\*\*([A-Z][A-Z ]*[A-Z])\*\*/) { print "$1\n"; exit }' "$f")"
    printf '%s\t%s\n' "${f##*/}" "${s:-NONE}"
  done
}

# R-A. README rule 4: 'Status is one of — and it is one of exactly these three.'
# This is the check that would have caught `DECIDED in shape`, which is not a
# hypothetical: THREE records wore it, it read as "half-decided, proceed
# carefully" when the truth was "decided, and here are four things nobody has
# decided", and it was removed by hand on 2026-08-15. By hand is not a mechanism.
#
# The comparison is awk on whole FIELDS, not a regex on a suffix, and that is a
# correction rather than a preference. This check spent three commits reading
#
#     grep -cvE '<backslash>t(DECIDED|OPEN|IN PRD)$'
#
# which was green here and RED IN CI on every one of them. GNU grep's ERE has
# no such escape and reads it as a literal `t`, so nothing matched, `-cv`
# counted all six records, and the check reported six violations against a tree
# with none. macOS grep — BSD *and* the ugrep shim on this machine — accepts it
# and returns zero. Measured on both, see the portability check below.
#
# A field comparison also rejects `FOO IN PRD`, which a `$`-anchored alternation
# would have accepted.
chk "every decision record declares one of the three defined statuses" \
    "$(dec_status | awk -F'\t' '$2 != "DECIDED" && $2 != "OPEN" && $2 != "IN PRD" { n++ } END { print n+0 }')" 0

# R-B. Every record that has not landed in the PRD must appear in the gate's R
# register, so the owner's queue cannot silently lose an entry. A seventh
# decision record is the realistic way that happens: written, indexed, and never
# checked against what PRD.md already says — which is exactly how R1 (categories
# are "out of scope", PRD.md:411) and R2 (FR-CREATE-15, "exactly one image")
# went unnoticed until they were swept for.
#
# `IN PRD` records are exempt BY DEFINITION: ratified is what leaving this queue
# means. That exemption is also the way this check could be defeated — mark
# everything `IN PRD` and it goes quiet — which is why R-A above pins the
# vocabulary and why only the owner may write that value (README rule 1).
unqueued=0
while IFS="$(printf '\t')" read -r base status; do
  [ "$status" = "IN PRD" ] && continue
  id="${base:0:4}"   # D-01-bid-increment-button.md -> D-01
  grep -qE "^\| \*\*R[0-9]+\*\* \| \[$id\]" docs/decisions/README.md || unqueued=$((unqueued + 1))
done <<EOF
$(dec_status)
EOF
chk "every unratified decision record is in the R register" "$unqueued" 0

# ===========================================================================
# PORTABILITY — the guard layer runs on two greps and must mean the same thing
# ===========================================================================
echo
echo "--- portability"

# P1. No grep pattern may contain a backslash-t escape.
#
# This is not style. The R-A check above carried one for three commits and was
# GREEN ON THIS MACHINE AND RED IN CI THE WHOLE TIME — the precise inversion §9
# warns about, and the second time this repository has produced it. Measured,
# all three on 2026-08-15:
#
#   ugrep 7.5.0 (the shim `grep` resolves to here)   escape honoured   -> 0
#   /usr/bin/grep, BSD, macOS 15                     escape honoured   -> 0
#   GNU grep, ubuntu-latest, in CI                   literal `t`       -> 6
#
# So the whole team's laptops agree with each other and disagree with the only
# environment that gates a merge. Nobody would find that by reading; the local
# run says PASS. Use a bracket expression, awk on fields, or `printf` the tab
# into the pattern — the R-A check above now does the second.
#
# `\s` is deliberately NOT flagged: it is an extension in GNU, BSD and ugrep
# alike, all three were measured, and all three agree. A portability rule that
# bans things which actually work teaches people to ignore it.
#
# Comments are NOT stripped here, unlike every check above. A dead grep in a
# comment is where the next one gets copied from, and this file is the most
# copied-from file in the repository.
#
# The needle is assembled rather than written, because a check that greps for a
# two-character sequence cannot contain that sequence and still pass — the
# first draft matched its own source and was unconditionally red, which is the
# same defect one turn later.
#
# The needle reaches awk through ENVIRON, and that is the SECOND correction
# this one check has needed. It was first written as
#
#     awk -v n="$BS"t ... index($0,n)
#
# which is the same bug one tool over: POSIX awk runs escape processing on a
# -v assignment, so `n` was set to a literal TAB and this check spent its whole
# life looking for a real tab after the word grep. It could not fire. Measured
# on 2026-08-15 by appending a line carrying the escape to a tracked .sh and
# watching this report PASS (0) — found by the probe in negative.sh, which is
# the entire argument for writing the probe instead of trusting the pass.
#
# ENVIRON is exempt from that processing. Doubling the backslash in the -v
# assignment also works, and is one tidy-up away from being "simplified" back
# to the broken form, so ENVIRON is preferred. That alternative is described
# here rather than written out: this check greps for two characters, and a
# comment demonstrating them next to the word grep would flag its own file.
BS='\'
chk "no grep pattern carries a backslash-escaped tab — GNU grep reads it as a literal t" \
    "$(git grep -h -F -- "${BS}t" -- '*.sh' '*.yml' '*.yaml' 2>/dev/null \
        | NEEDLE="${BS}t" awk -v g="gre""p" \
            'index($0,g) && index($0,ENVIRON["NEEDLE"]) > index($0,g)' \
        | grep -c .)" 0

# ===========================================================================
# SELF — CLAUDE.md §9 describes this file; it has to describe it correctly
# ===========================================================================
echo
echo "--- self"

# S1. §9 tells a reader how many checks this suite runs. That sentence went
# stale TWICE IN TWO COMMITS — 15 -> 17 with §9 still saying fifteen, then
# 17 -> 19 with §9 still saying seventeen — and both times the document that
# exists to describe the guard layer was quietly wrong about it. Nobody would
# have noticed by reading; the number is the last thing anyone re-reads.
#
# So the number is no longer maintained by hand. It is written as a DIGIT in
# §9 so this can parse it, and this compares it to EXPECTED. Add a check, and
# the suite tells you which sentence to update instead of leaving it wrong.
#
# Note the shape: it compares §9's number to EXPECTED, not to the number of
# chk() calls. EXPECTED is already compared to the calls that actually ran, at
# the bottom of this file, and that comparison is what catches a check dying
# mid-run. Chaining to it rather than re-deriving keeps one source, not two.
claimed="$(perl -ne 'if (/^- \*\*`run\.sh`\*\* — \*\*(\d+) checks\*\*/) { print "$1\n"; exit }' CLAUDE.md)"
chk "CLAUDE.md §9's stated check count matches EXPECTED" "${claimed:-absent}" "$EXPECTED"

# ---------------------------------------------------------------------------
ran=$((pass + fail))
echo
echo "$pass passed, $fail failed, $ran of $EXPECTED checks reached"

# The count is not decoration. A `chk` whose command substitution dies takes
# its own line out of the run, and a suite that silently shrinks still prints
# a clean summary — the exact failure the bidding suite added EXPECTED_SUITES
# for after two near-misses in one hour (#116). Same reasoning, one file down.
if [ "$ran" -ne "$EXPECTED" ]; then
  echo "!! expected $EXPECTED checks, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi

if [ "$fail" -eq 0 ]; then
  echo "GUARDS: PASS"
  exit 0
fi
echo "GUARDS: FAIL — $fail check(s)"
exit 1
