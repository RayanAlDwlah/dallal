#!/usr/bin/env bash
# ============================================================================
# The auction suites.
#
#   immutability.sql — AUC-18. A user cannot modify or delete any auction,
#                      their own included, and creation is attributed to the
#                      caller rather than the payload.
#   creation.sql     — AUC-19. Creation validation at its boundaries, the money
#                      domain clause by clause, and the active-only listing.
#   duplicate.sql    — AUC-03. One intent, one auction (EC-21) — and the other
#                      direction, that the guard never eats a real auction.
#
# All three go through the `authenticated` role, so they exercise the server path
# a crafted request meets rather than anything the UI does (AUC-19's AC).
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
cp "$ROOT/tests/bidding/lib/supabase-shim.sql" \
   "$HERE/immutability.sql" "$HERE/creation.sql" "$HERE/duplicate.sql" "$WORK/"
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

total_fail=0

# A DO block that aborts partway emits neither PASS nor FAIL, so counting only
# PASS/FAIL reports a clean run while assertions silently never executed. Every
# suite therefore declares how many it must reach, and the count is checked.
run_suite() {
  local file="$1" expected="$2" title="$3"
  echo
  echo "==> $title"
  local raw acc pass fail ran
  raw=$(docker exec "$CONTAINER" psql -U postgres -q -f "/t/$file" 2>&1)
  acc=$(echo "$raw" | grep -E 'PASS|FAIL' | sed 's/^psql[^ ]* //; s/WARNING:  //; s/NOTICE:  //')
  echo "$acc" | sed 's/^/    /'
  pass=$(echo "$acc" | grep -c '^PASS'); fail=$(echo "$acc" | grep -c '^FAIL')
  ran=$((pass + fail))
  echo "    ---- $pass passed, $fail failed, $ran of $expected assertions reached"

  # immutability.sql's completeness guard prints the columns it cannot account
  # for. Harmless for a suite that has none.
  echo "$raw" | grep -q 'uncovered column' && \
    echo "$raw" | grep 'uncovered column' | sed 's/^psql[^ ]* //; s/WARNING:  /    !! /'

  # psql writes "psql:/t/immutability.sql:68: ERROR:  …" — never a bare "ERROR:"
  # at the start of a line. Anchored on ^ERROR: this matched nothing and the
  # branch could never fire, so an aborted run printed no cause at all.
  #
  # The assertion COUNT still catches the failure, but the count says THAT the
  # run died, never WHY — and the two failures look identical from outside.
  # Un-anchoring turns a mystery back into one line of output.
  if echo "$raw" | grep -q 'ERROR:'; then
    echo "    !! psql reported an error — assertions after it never ran:"
    echo "$raw" | grep 'ERROR:' | sed 's/^psql[^ ]* //; s/^/       /'
    fail=$((fail + 1))
  fi
  if [ "$ran" -ne "$expected" ]; then
    echo "    !! expected $expected assertions, only $ran reached. Treating as failure."
    fail=$((fail + 1))
  fi
  total_fail=$((total_fail + fail))
}

# Keep each EXPECTED in step with the chk() calls in its file.
run_suite immutability.sql 24 "AUC-18 — immutability and authorization"
run_suite creation.sql     26 "AUC-19 — creation validation and the active-only listing"
run_suite duplicate.sql    13 "AUC-03 — duplicate-submission prevention (EC-21)"

echo
if [ "$total_fail" -eq 0 ]; then
  echo "SUITE PASSED"
  exit 0
fi
echo "SUITE FAILED — $total_fail failing assertions"
exit 1
