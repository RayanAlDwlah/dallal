#!/usr/bin/env bash
# ============================================================================
# Contention. Runs INSIDE the container: `bash /t/concurrency.sh ROUNDS WORKERS`
#
# Every assertion above this file runs one statement at a time, and one
# statement at a time is the only condition under which a broken lock looks
# correct. `place_bid` takes `for update` on the auction row and does five
# things after it — read the price, compare, insert, update, notify. Drop the
# lock, or read the price before taking it, and every serial assertion still
# passes while two simultaneous bidders both win.
#
# So: N real client connections, one auction, no coordination between them.
# Whatever they produce must satisfy four invariants that a lost update cannot.
#
#   A. bid_count equals the number of rows in bids
#   B. current_price equals the last bid by id
#   C. current_price equals the maximum amount
#   D. amounts ordered by id are STRICTLY increasing
#
# D is the one that catches a lost update. A and B survive it — the losing
# transaction's own update is consistent with its own read. Only the total
# order over `id` shows two bidders having seen the same price.
#
# THE FIFTH LINE IS AN OBSERVATION, NOT AN ASSERTION. `created_at` defaults to
# `now()` = TRANSACTION START, which is before the bid queued on the lock, so
# ordering by it can render a DECREASING history — measured at 2 of 12 contended
# auctions on V1 (#100). It depends on scheduling, so a round where it does not
# happen proves nothing and must not fail the run. It is printed because seeing
# it happen is the argument for `order by id`, and because a round where the two
# orderings disagree is a round that genuinely contended.
# ============================================================================
set -uo pipefail

ROUNDS="${1:-8}"
WORKERS="${2:-8}"
PSQL="psql -U postgres -q -tA"
BIDDERS=(
  '22222222-2222-2222-2222-222222222222'
  '33333333-3333-3333-3333-333333333333'
  '44444444-4444-4444-4444-444444444444'
)

fail=0
divergent=0

for r in $(seq 1 "$ROUNDS"); do
  auction=$($PSQL -c "select t_auction('100.00', '10');")
  [ -n "$auction" ] || { echo "round $r: could not create an auction"; fail=$((fail + 1)); continue; }

  # Each worker races the others for the same next price. Most attempts lose and
  # come back `too_low` — that IS the contention; a worker that always succeeds
  # is a worker that was never racing. Retrying re-reads the price, so the
  # workers keep colliding rather than backing off after one miss.
  for w in $(seq 1 "$WORKERS"); do
    who="${BIDDERS[$(( (w - 1) % ${#BIDDERS[@]} ))]}"
    $PSQL -c "
      do \$\$
      declare v_next numeric; v_r jsonb;
      begin
        for i in 1 .. 6 loop
          select coalesce(current_price + bid_increment, starting_price)
            into v_next from public.auctions where id = '$auction';
          select t_bid('$auction', '$who', v_next::text) into v_r;
          exit when (v_r ->> 'ok') = 'true';
        end loop;
      end \$\$;" >/dev/null 2>&1 &
  done
  wait

  read -r accepted rows price last maxamt strict <<<"$(
    $PSQL -F' ' -c "
      select
        (select bid_count from public.auctions where id = '$auction'),
        (select count(*) from public.bids where auction_id = '$auction'),
        (select current_price::text from public.auctions where id = '$auction'),
        (select amount::text from public.bids where auction_id = '$auction' order by id desc limit 1),
        (select max(amount)::text from public.bids where auction_id = '$auction'),
        (select coalesce(bool_and(gt), true) from (
           select amount > lag(amount) over (order by id) as gt
           from public.bids where auction_id = '$auction') s where gt is not null);"
  )"

  bad=""
  [ "$accepted" = "$rows" ]  || bad="$bad A(bid_count=$accepted rows=$rows)"
  [ "$price" = "$last" ]     || bad="$bad B(current=$price last=$last)"
  [ "$price" = "$maxamt" ]   || bad="$bad C(current=$price max=$maxamt)"
  [ "$strict" = "t" ]        || bad="$bad D(history not strictly increasing by id)"
  [ "$rows" -gt 0 ] 2>/dev/null || bad="$bad E(no bid was accepted — the round did not run)"

  # The observation. Same rows, two orderings; when they disagree, `created_at`
  # would have rendered the history out of order.
  if [ "$($PSQL -c "
        select (select string_agg(amount::text, ',' order by id) from public.bids where auction_id='$auction')
             = (select string_agg(amount::text, ',' order by created_at, id) from public.bids where auction_id='$auction');")" = "f" ]; then
    divergent=$((divergent + 1))
  fi

  if [ -n "$bad" ]; then
    echo "round $r: FAIL —$bad"
    $PSQL -c "select id, amount::text, created_at from public.bids where auction_id='$auction' order by id;" \
      | sed 's/^/    /'
    fail=$((fail + 1))
  else
    printf 'round %-3s ok — %s bids accepted of %s racing, up to %s\n' "$r" "$rows" "$WORKERS" "$price"
  fi
done

echo
echo "observation: created_at ordering disagreed with id ordering in $divergent of $ROUNDS rounds"
echo "             (0 is not a pass and not a failure — it means this run did not contend hard enough"
echo "              to reproduce it. The ordering rule stands on the mechanism, not on this count.)"

if [ "$fail" -eq 0 ]; then
  echo "concurrency: $ROUNDS rounds x $WORKERS workers, all invariants held"
  exit 0
fi
echo "concurrency: $fail of $ROUNDS rounds violated an invariant"
exit 1
