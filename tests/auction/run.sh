#!/usr/bin/env bash
# ============================================================================
# AUC-18 — proves a user cannot modify or delete any auction, their own
# included, and that creation is attributed to the caller rather than the
# payload.
#
# Needs Docker. That is the whole list.
#
# It applies every file in supabase/migrations/ in filename order, so it proves
# the artefacts that ship rather than a copy of them — same discipline as
# tests/auth/run.sh and tests/bidding/run.sh.
#
# Usage:
#   ./run.sh              apply migrations, run the suite
#   KEEP=1 ./run.sh       leave the container up for poking at
# ============================================================================
set -uo pipefail

CONTAINER=dalal-auction-tests
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
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

# Reuses the bidding suite's shim rather than keeping a second copy that could
# drift from it.
cp "$ROOT/tests/bidding/lib/supabase-shim.sql" "$HERE/immutability.sql" "$WORK/"
cp "$MIGRATIONS"/*.sql "$WORK/"
docker cp "$WORK/." "$CONTAINER":/t/ >/dev/null

echo "==> applying the Supabase shim"
docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f /t/supabase-shim.sql || exit 1

echo "==> applying supabase/migrations in order"
for f in "$MIGRATIONS"/*.sql; do
  name="$(basename "$f")"
  printf '    %-56s ' "$name"
  if docker exec "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f "/t/$name" 2>"$WORK/err"; then
    echo ok
  else
    echo FAILED; cat "$WORK/err"; exit 1
  fi
done

echo
echo "==> auction immutability suite"
# A DO block that aborts partway emits neither PASS nor FAIL, so counting only
# PASS/FAIL reports a clean run while assertions silently never executed.
# Keep this in step with immutability.sql.
EXPECTED=23
raw=$(docker exec "$CONTAINER" psql -U postgres -q -f /t/immutability.sql 2>&1)
acc=$(echo "$raw" | grep -E 'PASS|FAIL' | sed 's/^psql[^ ]* //; s/WARNING:  //; s/NOTICE:  //')
echo "$acc" | sed 's/^/    /'
pass=$(echo "$acc" | grep -c '^PASS'); fail=$(echo "$acc" | grep -c '^FAIL')
ran=$((pass + fail))
echo "    ---- $pass passed, $fail failed, $ran of $EXPECTED assertions reached"

# The completeness guard prints the column names it could not account for.
echo "$raw" | grep -q 'uncovered column' && \
  echo "$raw" | grep 'uncovered column' | sed 's/^psql[^ ]* //; s/WARNING:  /    !! /'

# psql writes "psql:/t/immutability.sql:68: ERROR:  …" — never a bare "ERROR:"
# at the start of a line. Anchored on ^ERROR: this matched nothing and the
# branch could never fire, so an aborted run printed no cause at all.
#
# The assertion COUNT below still caught the failure ("0 of 23 reached"), which
# is the only reason this was a short diagnosis rather than a long one. But the
# count says THAT the run died, never WHY — and the two failures look identical
# from outside. Un-anchoring turns a mystery back into one line of output.
if echo "$raw" | grep -q 'ERROR:'; then
  echo "    !! psql reported an error — assertions after it never ran:"
  echo "$raw" | grep 'ERROR:' | sed 's/^psql[^ ]* //; s/^/       /'
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
