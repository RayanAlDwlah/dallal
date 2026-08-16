#!/usr/bin/env bash
# ============================================================================
# The V2 database suite — runs against a throwaway PostgreSQL 17 container.
#
#   ./tests/bidding-v2/run.sh            acceptance + closing + money + 8 rounds
#   ./tests/bidding-v2/run.sh 30         ... + 30 concurrency rounds
#   KEEP=1 ./tests/bidding-v2/run.sh     leave the container up for poking at
#
# No Supabase account, no network, no shared database, no credentials. The
# locking and constraint semantics this proves are properties of the PostgreSQL
# engine, not of our hosting, so anyone on the team — including a Claude session
# with no credentials — can prove them locally and repeatedly.
#
# ---------------------------------------------------------------------------
# WHY THIS EXISTS, AND WHAT ITS ABSENCE COST
#
# V2 shipped on 2026-08-15 with NO database suite at all. V1's `tests/bidding/`
# proved the extension cap, the lock ordering, the `sar_amount` domain and the
# concurrency behaviour — the four properties CLAUDE.md §5 calls
# non-negotiable — and it was deleted along with the V1 tree it tested. V2
# rewrote `place_bid` in the same window. For one day the shipped bid operation
# was held up by nothing but the text of a migration.
#
# It was not free. `D-01` §4 required an assertion — "the server accepts an
# amount that is NOT a multiple of the increment" — to ship in the same PR as
# the `bid_increment` column. There was no suite to put it in, so it never
# shipped, and the contradiction between `place_bid` and `BR-32` reached
# production unnoticed. See `CLAUDE.md` §0 and check 12 of acceptance.sql.
#
# ---------------------------------------------------------------------------
# APPLYING THE MIGRATIONS IS ITSELF THE FIRST TEST
#
# Everything below runs the COMMITTED migration files, in the order
# `supabase db push` applies them, against an empty database. A syntax error, a
# constraint no data can satisfy, or a migration that depends on an earlier one
# having run currently reaches production unchecked — `supabase db push` against
# an already-migrated project does not re-apply what is already there. This step
# catches all three before the assertions start.
#
# THE SHIM IS WHY THIS WAS HARD, AND IT IS ONE FILE. V2's schema INSERTs storage
# buckets and creates four `storage.objects` policies at TOP LEVEL, not inside a
# conditional block, so a bare postgres:17 aborts at `core_schema.sql:496` and
# nothing after it exists. `lib/supabase-shim.sql` mirrors `auth` and `storage`
# at the fidelity the assertions read, and says on each line where it diverges.
# ============================================================================
set -uo pipefail

ROUNDS="${1:-8}"
WORKERS="${2:-8}"
CONTAINER=dalal-v2-bidding-tests
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap '[ -n "${KEEP:-}" ] || docker rm -f "$CONTAINER" >/dev/null 2>&1; rm -rf "$WORK"' EXIT

command -v docker >/dev/null || { echo "docker is required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "the docker daemon is not running"; exit 1; }

echo "==> starting PostgreSQL 17"
docker rm -f "$CONTAINER" >/dev/null 2>&1
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres postgres:17 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -q || { echo "postgres never became ready"; exit 1; }
echo "    $(docker exec "$CONTAINER" psql -U postgres -tAc 'select version();' | cut -c1-40)"

# The migrations are discovered, never listed. A hand-written list is a list
# that goes stale silently: add a migration, forget this file, and the suite
# keeps passing against a schema production no longer has. `supabase db push`
# orders by filename, so this does too.
mapfile -t MIGRATIONS < <(ls -1 "$ROOT"/supabase/migrations/*.sql | sort)
[ "${#MIGRATIONS[@]}" -gt 0 ] || { echo "no migrations found"; exit 1; }

cp "$HERE"/lib/supabase-shim.sql "$HERE"/lib/seed.sql "$HERE"/*.sql "$HERE"/concurrency.sh "$WORK/"
i=0
for m in "${MIGRATIONS[@]}"; do
  i=$((i + 1))
  cp "$m" "$(printf '%s/m%02d-%s' "$WORK" "$i" "$(basename "$m")")"
done
docker cp "$WORK/." "$CONTAINER":/t/ >/dev/null

echo "==> applying the Supabase shim (auth + storage)"
docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/supabase-shim.sql || exit 1

# pg_cron is absent on a stock container and `core_schema.sql` handles that
# itself — it wraps the whole schedule in a `do` block whose handler raises a
# NOTICE and carries on. That is a SUPPORTED outcome, not a degraded one: the
# sweep is a latency device, `finalize_auction()` also runs on page load, and
# bidding eligibility never trusts the status flag anyway. A stack without
# pg_cron loses timeliness, never correctness — and closing.sql calls
# `finalize_expired_auctions()` directly rather than waiting for a scheduler.
echo "==> applying ${#MIGRATIONS[@]} committed migrations, in push order"
i=0
for m in "${MIGRATIONS[@]}"; do
  i=$((i + 1))
  f="$(printf 'm%02d-%s' "$i" "$(basename "$m")")"
  printf '    %-52s ' "$(basename "$m")"
  if docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f "/t/$f" 2>"$WORK/err"; then
    echo ok
  else
    echo FAILED; sed 's/^/      /' "$WORK/err"; exit 1
  fi
done

echo "==> applying the test-only fixtures"
docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/seed.sql || exit 1

# The EXPECTED count guards the worst failure mode a harness can have: a DO
# block that aborts partway emits neither PASS nor FAIL, so counting only
# PASS/FAIL reports a clean run while assertions silently never executed. Keep
# these in step with the .sql files.
fail=0
suites=0
suite() {
  local file="$1" expected="$2" raw acc pass bad ran
  suites=$((suites + 1))
  echo
  echo "==> $file"
  raw=$(docker exec "$CONTAINER" psql -U postgres -q -f "/t/$file.sql" 2>&1)
  acc=$(echo "$raw" | grep -E 'PASS|FAIL' | sed 's/^psql[^ ]* //; s/WARNING:  //; s/NOTICE:  //')
  echo "$acc" | sed 's/^/    /'
  pass=$(echo "$acc" | grep -c '^PASS'); bad=$(echo "$acc" | grep -c '^FAIL')
  ran=$((pass + bad))
  echo "    ---- $pass passed, $bad failed, $ran of $expected assertions reached"
  fail=$((fail + bad))

  # psql writes "psql:/t/closing.sql:68: ERROR:  …" — never a bare "ERROR:" at
  # the start of a line. V1 anchored this on ^ERROR: , so it matched nothing and
  # an aborted run printed no cause at all (#116). Un-anchored here from the
  # start: the count still catches THAT the run died, never WHY.
  if echo "$raw" | grep -q 'ERROR:'; then
    echo "    !! psql reported an error — assertions after it never ran:"
    echo "$raw" | grep 'ERROR:' | sed 's/^psql[^ ]* //; s/^/       /'
    fail=$((fail + 1))
  fi
  if [ "$ran" -ne "$expected" ]; then
    echo "    !! expected $expected assertions, only $ran reached. Treating as failure."
    fail=$((fail + 1))
  fi
}

suite acceptance 32
suite closing    26
suite money      19

# EXPECTED catches a suite that aborts partway; nothing above catches a suite
# LINE that vanishes. A merge conflict resolved by taking one side can drop a
# whole `suite X N` call — dozens of assertions disappear and SUITE PASSED still
# prints. That happened twice in one hour on V1 (#112, #114) and was caught by
# reading, not by structure. This is the structure.
EXPECTED_SUITES=3
if [ "$suites" -ne "$EXPECTED_SUITES" ]; then
  echo
  echo "!! expected $EXPECTED_SUITES suites, only $suites ran — a suite line is missing. Treating as failure."
  fail=$((fail + 1))
fi

echo
echo "==> concurrency — $ROUNDS rounds of $WORKERS simultaneous bidders"
docker exec "$CONTAINER" bash /t/concurrency.sh "$ROUNDS" "$WORKERS" | sed 's/^/    /'
conc=${PIPESTATUS[0]}

echo
if [ "$fail" -eq 0 ] && [ "$conc" -eq 0 ]; then
  echo "SUITE PASSED"
  exit 0
fi
echo "SUITE FAILED — assertion failures: $fail, concurrency failures: $conc"
exit 1
