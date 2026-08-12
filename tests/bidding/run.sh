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
#   ./run.sh                 acceptance + 8 rounds of BID-20
#   ./run.sh 30              acceptance + 30 rounds  (use before merging BID-02)
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

echo "==> extracting SQL from docs/contracts/BID-02-bid-operation.md"
python3 "$HERE/lib/extract-sql.py" "$WORK" || exit 1

echo "==> starting PostgreSQL 17"
docker rm -f "$CONTAINER" >/dev/null 2>&1
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres postgres:17 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -q || { echo "postgres never became ready"; exit 1; }
echo "    $(docker exec "$CONTAINER" psql -U postgres -tAc 'select version();' | cut -c1-40)"

cp "$HERE/lib/supabase-shim.sql" "$HERE/acceptance.sql" "$HERE/concurrency.sh" "$WORK/"
docker cp "$WORK/." "$CONTAINER":/t/ >/dev/null

echo "==> applying the Supabase shim (auth schema, auth.uid, PostgREST roles)"
docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/supabase-shim.sql || exit 1

echo "==> applying the BID-02 migration"
for f in 01-schema 02-function 03-rls 04-seed; do
  printf '    %-14s ' "$f"
  if docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f "/t/$f.sql" 2>/tmp/err; then
    echo ok
  else
    echo FAILED; cat /tmp/err; exit 1
  fi
done

echo
echo "==> acceptance suite"
# EXPECTED guards against the worst failure mode a harness can have: a DO block
# that aborts partway emits neither PASS nor FAIL, so counting only PASS/FAIL
# reports a clean run while assertions silently never executed. Keep this in
# step with acceptance.sql.
EXPECTED=18
raw=$(docker exec "$CONTAINER" psql -U postgres -q -f /t/acceptance.sql 2>&1)
acc=$(echo "$raw" | grep -E 'PASS|FAIL' | sed 's/^psql[^ ]* //; s/WARNING:  //; s/NOTICE:  //')
echo "$acc" | sed 's/^/    /'
pass=$(echo "$acc" | grep -c '^PASS'); fail=$(echo "$acc" | grep -c '^FAIL')
ran=$((pass + fail))
echo "    ---- $pass passed, $fail failed, $ran of $EXPECTED assertions reached"

if echo "$raw" | grep -q '^ERROR:'; then
  echo "    !! psql reported an error — assertions after it never ran:"
  echo "$raw" | grep '^ERROR:' | sed 's/^/       /'
  fail=$((fail + 1))
fi
if [ "$ran" -ne "$EXPECTED" ]; then
  echo "    !! expected $EXPECTED assertions, only $ran reached. Treating as failure."
  fail=$((fail + 1))
fi

echo
echo "==> BID-20 concurrency"
docker exec "$CONTAINER" bash /t/concurrency.sh "$ROUNDS" "$WORKERS" | sed 's/^/    /'
conc=${PIPESTATUS[0]}

echo
if [ "$fail" -eq 0 ] && [ "$conc" -eq 0 ]; then
  echo "SUITE PASSED"
  exit 0
fi
echo "SUITE FAILED — acceptance failures: $fail, concurrency failures: $conc"
exit 1
