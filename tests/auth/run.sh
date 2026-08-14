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

# ----------------------------------------------------------------------------
# The pure-function checks run FIRST, before Docker is even looked for. They
# need nothing but node, they finish instantly, and there is no reason to spin
# a container to discover that a boundary constant is wrong. It also means a
# machine with no working Docker still gets 65 assertions of value instead of
# one error line.
# ----------------------------------------------------------------------------
node_fail=0
echo "==> pure-function checks (no Docker)"
for f in validation site-url login-path; do
  printf '    %-24s ' "$f.check.mjs"
  if out=$(node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON "$HERE/$f.check.mjs" 2>&1); then
    echo "$out" | tail -1 | sed 's/^---- //'
  else
    echo FAILED
    echo "$out" | grep -E 'FAIL|!!' | sed 's/^/       /'
    node_fail=$((node_fail + 1))
  fi
done
echo

command -v docker >/dev/null || { echo "docker is required for the rest"; exit 1; }
docker info >/dev/null 2>&1 || { echo "the docker daemon is not running — the checks above still ran"; exit 1; }

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
cp "$ROOT/tests/bidding/lib/supabase-shim.sql" "$HERE/acceptance.sql" "$HERE/concurrency.sh" "$WORK/"
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
EXPECTED=22
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
echo "==> AUTH-11 display-name concurrency"
# The sequential BR-39 assertion above cannot cover this: registerAction reads
# availability and then signs up, and a second registration lands between them.
ROUNDS="${ROUNDS:-8}"
WORKERS="${WORKERS:-8}"
if docker exec "$CONTAINER" bash /t/concurrency.sh "$ROUNDS" "$WORKERS" | sed 's/^/    /'; then
  conc=0
else
  conc=1
fi

echo
if [ "$fail" -eq 0 ] && [ "$conc" -eq 0 ] && [ "$node_fail" -eq 0 ]; then
  echo "SUITE PASSED"
  exit 0
fi
echo "SUITE FAILED — assertions: $fail, concurrency: $conc, pure-function checks: $node_fail"
exit 1
