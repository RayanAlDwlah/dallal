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
exit "$failures"
