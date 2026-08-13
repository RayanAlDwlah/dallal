#!/usr/bin/env bash
# ============================================================================
# Runs the identity acceptance suite against a throwaway PostgreSQL 17
# container. Needs Docker. That is the whole list.
#
# It applies every file in supabase/migrations/ in filename order, so it proves
# the migrations as they would actually run — not a copy of them.
#
# Usage:
#   ./run.sh              apply migrations, run the suite
#   KEEP=1 ./run.sh       leave the container up for poking at
# ============================================================================
set -uo pipefail

CONTAINER=dalal-auth-tests
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
WORK="$(mktemp -d)"
trap '[ -n "${KEEP:-}" ] || docker rm -f "$CONTAINER" >/dev/null 2>&1; rm -rf "$WORK"' EXIT

command -v docker >/dev/null || { echo "docker is required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "the docker daemon is not running"; exit 1; }

# The identity migration ALTERs public.profiles, which the BID-02 migration
# declares. Until PR #5 lands, that file is only on feature/rayan-bidding, so
# say which file is missing rather than failing on a confusing SQL error.
if ! ls "$MIGRATIONS"/*bid02* >/dev/null 2>&1; then
  echo "missing: supabase/migrations/*bid02*.sql — it declares public.profiles."
  echo "It lives on feature/rayan-bidding until PR #5 merges:"
  echo "  git show origin/feature/rayan-bidding:supabase/migrations/20260812120000_bid02_bid_acceptance.sql \\"
  echo "    > supabase/migrations/20260812120000_bid02_bid_acceptance.sql"
  exit 1
fi

echo "==> starting PostgreSQL 17"
docker rm -f "$CONTAINER" >/dev/null 2>&1
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres postgres:17 >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -q || { echo "postgres never became ready"; exit 1; }

# Reuses the bidding suite's shim rather than keeping a second copy that could
# drift from it.
cp "$ROOT/tests/bidding/lib/supabase-shim.sql" "$HERE/acceptance.sql" "$WORK/"
cp "$MIGRATIONS"/*.sql "$WORK/"
docker cp "$WORK/." "$CONTAINER":/t/ >/dev/null

echo "==> applying the Supabase shim"
docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/supabase-shim.sql || exit 1

echo "==> applying supabase/migrations in order"
for f in "$MIGRATIONS"/*.sql; do
  name="$(basename "$f")"
  printf '    %-52s ' "$name"
  if docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f "/t/$name" 2>"$WORK/err"; then
    echo ok
  else
    echo FAILED; cat "$WORK/err"; exit 1
  fi
done

echo
echo "==> identity acceptance suite"
# A DO block that aborts partway emits neither PASS nor FAIL, so counting only
# PASS/FAIL reports a clean run while assertions silently never executed.
# Keep this in step with acceptance.sql.
EXPECTED=16
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
if [ "$fail" -eq 0 ]; then
  echo "SUITE PASSED"
  exit 0
fi
echo "SUITE FAILED — $fail failing assertions"
exit 1
