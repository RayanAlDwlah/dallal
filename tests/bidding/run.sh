#!/usr/bin/env bash
# ============================================================================
# Runs the bidding test suite against a throwaway PostgreSQL 17 container.
#
# No Supabase account, no network, no shared database. That is deliberate: the
# locking semantics this suite proves are a property of the PostgreSQL engine,
# not of our hosting, so they can be proven locally and repeatedly by anyone on
# the team — including a Claude session with no credentials.
#
# Usage:
#   ./run.sh                 acceptance + closing + 8 rounds of BID-20
#   ./run.sh 30              ... + 30 rounds  (use before merging BID-02)
#   KEEP=1 ./run.sh          leave the container up for poking at
# ============================================================================
set -uo pipefail

ROUNDS="${1:-8}"
WORKERS="${2:-8}"
CONTAINER=dalal-bidding-tests
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap '[ -n "${KEEP:-}" ] || docker rm -f "$CONTAINER" >/dev/null 2>&1; rm -rf "$WORK"' EXIT

command -v docker >/dev/null || { echo "docker is required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "the docker daemon is not running"; exit 1; }
ROOT="$(cd "$HERE/../.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20260812120000_bid02_bid_acceptance.sql"
MIGRATION15="$ROOT/supabase/migrations/20260814000000_bid15_closing_and_extension.sql"
MIGRATIONAUC="$ROOT/supabase/migrations/20260814120000_auc01_auction_product_fields.sql"
MIGRATIONAUC18="$ROOT/supabase/migrations/20260814130000_auc18_auction_authorization.sql"
CONTRACT="$ROOT/docs/contracts/BID-02-bid-operation.md"

# The migration is committed AND printed in the contract. Two copies of one
# artefact drift, and a suite that applies its own copy keeps passing while they
# do. So: assert they are identical, then apply the committed one.
echo "==> checking the migration against docs/contracts/BID-02-bid-operation.md"
awk -v out="$WORK" -f "$HERE/lib/contract-sync.awk" "$CONTRACT" || exit 1
if ! diff -u "$WORK/expected.sql" "$MIGRATION" > "$WORK/drift.diff"; then
  echo
  echo "    DRIFT — the committed migration is no longer the contract."
  echo "      contract:  docs/contracts/BID-02-bid-operation.md (first 3 sql blocks)"
  echo "      migration: supabase/migrations/$(basename "$MIGRATION")"
  sed -n '3,40p' "$WORK/drift.diff" | sed 's/^/      /'
  echo
  echo "    These are one artefact in two places. Change both, or change the"
  echo "    contract and regenerate. The suite will not run against a copy."
  exit 1
fi
echo "    migration == contract, no drift"
rm -f "$WORK/expected.sql" "$WORK/drift.diff"   # proven; not shipped into the container

echo "==> starting PostgreSQL 17"
docker rm -f "$CONTAINER" >/dev/null 2>&1
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres postgres:17 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -q || { echo "postgres never became ready"; exit 1; }
echo "    $(docker exec "$CONTAINER" psql -U postgres -tAc 'select version();' | cut -c1-40)"

cp "$HERE/lib/supabase-shim.sql" "$HERE/acceptance.sql" "$HERE/closing.sql" \
   "$HERE/terminal.sql" "$HERE/concurrency.sh" "$WORK/"
cp "$MIGRATION"       "$WORK/01-migration.sql"
cp "$MIGRATION15"     "$WORK/02-bid15.sql"
cp "$MIGRATIONAUC"    "$WORK/03-auc01.sql"
cp "$MIGRATIONAUC18"  "$WORK/04-auc18.sql"
# contract-sync.awk names the seed 04-seed.sql because it was the fourth thing
# applied when it was written. It is now the fifth, and it is still the last:
# every migration goes on before any fixture does, exactly as production sees
# them. Renaming it here rather than in the awk keeps the awk about the
# contract and this file about the order.
mv "$WORK/04-seed.sql" "$WORK/05-seed.sql"
docker cp "$WORK/." "$CONTAINER":/t/ >/dev/null

echo "==> applying the Supabase shim (auth schema, auth.uid, PostgREST roles)"
docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/supabase-shim.sql || exit 1

# 01 through 04 are the committed migration files verbatim, in the order
# `supabase db push` applies them. 05-seed is V-1's fixtures, which are NOT part
# of any of them: the seed writes auth.users directly with reserved UUIDs,
# something the product never does. Applying them separately is the point.
#
# Two of the four degrade deliberately on a stock postgres:17 container, and
# each says so rather than failing:
#
#   02-bid15  installs pg_cron when available. Here it is not — a supported
#             outcome, not a degraded one: the sweep is a latency device, every
#             assertion below calls close_ended_auctions() directly
#             (NFR-MNT-03), and a stack without pg_cron loses timeliness, never
#             correctness.
#   03-auc01  creates the auction-images bucket when a `storage` schema exists.
#             Here it does not. Same reasoning: no storage means no image
#             upload, and image upload is not what this suite proves. The three
#             NOT NULL product columns it adds are applied either way, which is
#             what the fixtures below now have to satisfy.
echo "==> applying the migrations, then the test-only seed"
for f in 01-migration 02-bid15 03-auc01 04-auc18 05-seed; do
  printf '    %-14s ' "$f"
  if docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f "/t/$f.sql" 2>/tmp/err; then
    echo ok
  else
    echo FAILED; cat /tmp/err; exit 1
  fi
done

# The EXPECTED count guards against the worst failure mode a harness can have:
# a DO block that aborts partway emits neither PASS nor FAIL, so counting only
# PASS/FAIL reports a clean run while assertions silently never executed. Keep
# these in step with the .sql files.
#
#   suite FILE EXPECTED   -> prints the assertions, sets `fail` for the caller
fail=0
suite() {
  local file="$1" expected="$2" raw acc pass bad ran
  echo
  echo "==> $file"
  raw=$(docker exec "$CONTAINER" psql -U postgres -q -f "/t/$file.sql" 2>&1)
  acc=$(echo "$raw" | grep -E 'PASS|FAIL' | sed 's/^psql[^ ]* //; s/WARNING:  //; s/NOTICE:  //')
  echo "$acc" | sed 's/^/    /'
  pass=$(echo "$acc" | grep -c '^PASS'); bad=$(echo "$acc" | grep -c '^FAIL')
  ran=$((pass + bad))
  echo "    ---- $pass passed, $bad failed, $ran of $expected assertions reached"
  fail=$((fail + bad))

  if echo "$raw" | grep -q '^ERROR:'; then
    echo "    !! psql reported an error — assertions after it never ran:"
    echo "$raw" | grep '^ERROR:' | sed 's/^/       /'
    fail=$((fail + 1))
  fi
  if [ "$ran" -ne "$expected" ]; then
    echo "    !! expected $expected assertions, only $ran reached. Treating as failure."
    fail=$((fail + 1))
  fi
}

suite acceptance 25          # BID-02 — bid acceptance
suite closing    50          # BID-15/BID-16 — finalization and the extension
suite terminal   20          # BID-19 — terminal-state enforcement

echo
echo "==> BID-20 concurrency"
docker exec "$CONTAINER" bash /t/concurrency.sh "$ROUNDS" "$WORKERS" | sed 's/^/    /'
conc=${PIPESTATUS[0]}

echo
if [ "$fail" -eq 0 ] && [ "$conc" -eq 0 ]; then
  echo "SUITE PASSED"
  exit 0
fi
echo "SUITE FAILED — assertion failures: $fail, concurrency failures: $conc"
exit 1
