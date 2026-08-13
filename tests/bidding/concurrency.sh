#!/usr/bin/env bash
# ============================================================================
# BID-20 — the concurrency test.
#
# GITHUB_PLAN.md:463 calls this "the single most important test in the project"
# and asks for it to be run REPEATEDLY, not once. Running it once proves almost
# nothing: a lock bug that loses one bid in twenty passes a single run.
#
# Per round, on ONE auction, N simultaneous connections bid the SAME amount:
#   1. exactly one acceptance                          BR-12, SC-16
#   2. history rows == acceptances — none lost/dup     FR-BID-14, NFR-REL-04
#   3. every submission gets a definitive answer       FR-BID-16
#   4. current_price == max accepted bid, zero drift   BR-13, NFR-DAT-01
#   5. losers are distinguishable: outbid_race vs
#      not_above_current                               SC-18, EC-01, §13.5
#
# Usage:  ./concurrency.sh [rounds] [workers]     defaults: 8 rounds, 8 workers
# Runs inside the throwaway container started by run.sh. LOCAL ONLY.
# ============================================================================
set -uo pipefail

ROUNDS="${1:-8}"
WORKERS="${2:-8}"
PSQL="psql -U postgres -tAq"
OWNER='00000000-0000-0000-0000-0000000000a1'
failures=0

printf 'BID-20 — %s rounds x %s simultaneous bidders\n\n' "$ROUNDS" "$WORKERS"

for round in $(seq 1 "$ROUNDS"); do
  auction=$($PSQL -c "insert into public.auctions
      (owner_id, status, end_time, starting_price, current_price)
    values ('$OWNER', 'active', now() + interval '1 hour', 100, 100)
    returning id;")

  out="/tmp/bid20-round-$round"
  for i in $(seq 1 "$WORKERS"); do
    ( $PSQL -c "select set_config('request.jwt.claims',
                  json_build_object('sub','00000000-0000-0000-0000-0000000000b$i')::text, false);
                select public.place_bid('$auction', '250')::text;" | tail -1 ) &
  done > "$out" 2>&1
  wait

  accepted=$(grep -c '"accepted": true' "$out")
  answered=$(grep -c 'accepted' "$out")
  race=$(grep -c 'outbid_race' "$out")
  toolow=$(grep -c 'not_above_current' "$out")
  rows=$($PSQL -c "select count(*) from public.bids where auction_id='$auction';")
  price=$($PSQL -c "select current_price from public.auctions where id='$auction';")
  maxbid=$($PSQL -c "select coalesce(max(amount),0) from public.bids where auction_id='$auction';")

  verdict=OK
  [ "$accepted" = 1 ]         || { verdict='FAIL exactly-one-acceptance'; }
  [ "$rows" = "$accepted" ]   || { verdict='FAIL history != acceptances'; }
  [ "$answered" = "$WORKERS" ]|| { verdict='FAIL a submission got no answer'; }
  [ "$price" = "$maxbid" ]    || { verdict='FAIL current_price != max bid'; }
  [ "$verdict" = OK ]         || failures=$((failures + 1))

  printf 'round %-3s accepted=%s history=%s answered=%s | race=%s too_low=%s | price=%s max=%s  %s\n' \
    "$round" "$accepted" "$rows" "$answered" "$race" "$toolow" "$price" "$maxbid" "$verdict"
done

echo
if [ "$failures" -eq 0 ]; then
  echo "BID-20: PASS — $ROUNDS/$ROUNDS rounds clean"
else
  echo "BID-20: FAIL — $failures of $ROUNDS rounds violated an invariant"
fi

# ============================================================================
# BID-15 under the same contention — the extension inside a lock queue.
#
# The extension trigger takes `FOR UPDATE` on a row its own transaction already
# holds and then updates it. Re-entrant, no new lock, no new lock ORDER, so it
# cannot deadlock — by reasoning. This project's rule is that reasoning about
# concurrency is what gets measured, not what gets trusted, so it is measured.
#
# Distinct rising amounts, unlike the rounds above: several bids are accepted,
# so several extension opportunities occur inside one lock queue.
#
# What is asserted is only what is deterministic. "extension_count == accepted"
# is NOT: the first accepted bid pushes end_time 30 s out, which puts the next
# one outside the 15-second window, so how many extend depends on real timing.
# These four hold regardless:
#   1. every submission gets a definitive answer — nothing deadlocked or hung
#   2. end_time == original + 30 s x extension_count — the quantum survives
#      contention; no interleaving produces a 29- or 60-second step
#   3. at least one extension happened — the window was genuinely exercised
#   4. extensions <= acceptances — no bid extended twice, no rejection extended
# ============================================================================
echo
printf 'BID-15 — %s simultaneous bidders inside the final 15 seconds\n\n' "$WORKERS"

ext_auction=$($PSQL -c "insert into public.auctions
    (owner_id, status, end_time, starting_price, current_price)
  values ('$OWNER', 'active', clock_timestamp() + interval '10 seconds', 100, 100)
  returning id;")
t0=$($PSQL -c "select end_time from public.auctions where id='$ext_auction';")

out=/tmp/bid15-extension
for i in $(seq 1 "$WORKERS"); do
  ( $PSQL -c "select set_config('request.jwt.claims',
                json_build_object('sub','00000000-0000-0000-0000-0000000000b$i')::text, false);
              select public.place_bid('$ext_auction', '$((100 + i * 10))')::text;" | tail -1 ) &
done > "$out" 2>&1
wait

accepted=$(grep -c '"accepted": true' "$out")
answered=$(grep -c 'accepted' "$out")
rows=$($PSQL -c "select count(*) from public.bids where auction_id='$ext_auction';")
ext=$($PSQL -c "select extension_count from public.auctions where id='$ext_auction';")
quantum=$($PSQL -c "select (end_time = timestamptz '$t0' + extension_count * interval '30 seconds')
                    from public.auctions where id='$ext_auction';")

verdict=OK
[ "$answered" = "$WORKERS" ] || verdict='FAIL a submission got no answer (deadlock?)'
[ "$rows" = "$accepted" ]    || verdict='FAIL history != acceptances'
[ "$quantum" = t ]           || verdict='FAIL end_time is not original + 30s x count'
[ "$ext" -ge 1 ]             || verdict='FAIL nothing extended — the window was not exercised'
[ "$ext" -le "$accepted" ]   || verdict='FAIL more extensions than accepted bids'
[ "$verdict" = OK ]          || failures=$((failures + 1))

printf 'extension  accepted=%s history=%s answered=%s | extensions=%s quantum_exact=%s  %s\n' \
  "$accepted" "$rows" "$answered" "$ext" "$quantum" "$verdict"

echo
[ "$verdict" = OK ] && echo "BID-15 contention: PASS" || echo "BID-15 contention: $verdict"
exit "$failures"
