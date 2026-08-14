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
      (owner_id, status, end_time, starting_price, current_price,
       name, description, image_path)
    values ('$OWNER', 'active', now() + interval '1 hour', 100, 100,
            'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
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
    (owner_id, status, end_time, starting_price, current_price,
     name, description, image_path)
  values ('$OWNER', 'active', clock_timestamp() + interval '10 seconds', 100, 100,
          'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
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

# ============================================================================
# BID-03 — bids on different auctions do not block each other (ARCH §13.3).
#
# place_bid locks exactly one auction row per transaction (BID-02 contract
# §2b), so a bid on B must complete while A's row lock is HELD. The contract's
# V-1 script phase (c) sketched this with pg_sleep and a wall-clock bound;
# this phase proves it deterministically instead:
#
#   1. a REAL place_bid on A is left uncommitted — its transaction is held
#      open on a FIFO, so A's row lock stays held until *we* release it,
#      not until a sleep expires
#   2. a bid on B runs on a separate connection with lock_timeout set: if B
#      ever waited on A's lock it would ERROR loudly, never hang the harness
#   3. B's acceptance arrives while A's transaction is verifiably still open
#      (pg_stat_activity shows it idle-in-transaction AFTER B answered) —
#      holding A open while B completes IS the proof; no timing bound
#   4. only then is A released, and both auctions' invariants are asserted
#      in SQL: price == max accepted bid, exactly one history row, each side
#      untouched by the other
# ============================================================================
echo
printf 'BID-03 — a bid on auction B while auction A'"'"'s row lock is held open\n\n'

new_auction() {
  $PSQL -c "insert into public.auctions
      (owner_id, status, end_time, starting_price, current_price,
       name, description, image_path)
    values ('$OWNER', 'active', now() + interval '1 hour', 100, 100,
            'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
    returning id;"
}
auc_a=$(new_auction)
auc_b=$(new_auction)

gate=/tmp/bid03-gate; hold_out=/tmp/bid03-holder
rm -f "$gate" "$hold_out"; mkfifo "$gate"

# The holder: one psql session, one open transaction. place_bid on A executes
# (taking A's exclusive row lock) and then the session blocks reading the
# FIFO — the lock is held until the harness writes "commit;" into the gate.
( { printf 'begin;\n'
    printf "select set_config('request.jwt.claims',
              json_build_object('sub','00000000-0000-0000-0000-0000000000b1')::text, false);\n"
    printf "select public.place_bid('%s', '150')::text;\n" "$auc_a"
    cat "$gate"
  } | $PSQL ) > "$hold_out" 2>&1 &
holder=$!

# Wait for the holder's bid to be ACCEPTED (not for time to pass): once the
# acceptance is in the output, A's row lock is held by an open transaction.
a_locked=f
for _ in $(seq 1 100); do
  grep -q '"accepted": true' "$hold_out" && { a_locked=t; break; }
  kill -0 "$holder" 2>/dev/null || break
  sleep 0.1
done

# The measurement: bid on B on a separate connection. lock_timeout means a
# cross-auction block becomes a loud ERROR (no acceptance), never a hang.
b_out=$($PSQL -c "set lock_timeout = '2s';
                  set statement_timeout = '10s';
                  select set_config('request.jwt.claims',
                    json_build_object('sub','00000000-0000-0000-0000-0000000000b2')::text, false);
                  select public.place_bid('$auc_b', '175')::text;" 2>&1 | tail -1)
b_accepted=f
printf '%s' "$b_out" | grep -q '"accepted": true' && b_accepted=t

# The proof moment: B has its answer, and A's transaction is STILL open.
a_open_during_b=$($PSQL -c "select (count(*) >= 1)
    from pg_stat_activity
    where state = 'idle in transaction' and query like '%place_bid%';")

# Only now release A, and let its bid commit.
kill -0 "$holder" 2>/dev/null && printf 'commit;\n' > "$gate"
wait "$holder" 2>/dev/null
rm -f "$gate"

# Both auctions' invariants, compared in SQL (S0-12: no amount leaves SQL):
# current_price == the accepted amount == max(history), exactly one row each.
a_ok=$($PSQL -c "select (a.current_price = '150'
    and a.current_price = (select max(amount) from public.bids where auction_id = a.id)
    and (select count(*) from public.bids where auction_id = a.id) = 1)
  from public.auctions a where a.id = '$auc_a';")
b_ok=$($PSQL -c "select (a.current_price = '175'
    and a.current_price = (select max(amount) from public.bids where auction_id = a.id)
    and (select count(*) from public.bids where auction_id = a.id) = 1)
  from public.auctions a where a.id = '$auc_b';")

verdict=OK
[ "$a_locked" = t ]        || verdict='FAIL the bid on A never took the lock — nothing was proven'
[ "$b_accepted" = t ]      || verdict='FAIL bid on B not accepted while A was locked (blocked? lock_timeout?)'
[ "$a_open_during_b" = t ] || verdict='FAIL A'"'"'s transaction was not open when B answered — proof invalid'
[ "$a_ok" = t ]            || verdict='FAIL auction A invariants broken after release'
[ "$b_ok" = t ]            || verdict='FAIL auction B invariants broken'
[ "$verdict" = OK ]        || failures=$((failures + 1))

printf 'cross-auction  a_lock_held=%s b_accepted=%s a_open_during_b=%s | a_ok=%s b_ok=%s  %s\n' \
  "$a_locked" "$b_accepted" "$a_open_during_b" "$a_ok" "$b_ok" "$verdict"

echo
[ "$verdict" = OK ] && echo "BID-03 cross-auction: PASS" || echo "BID-03 cross-auction: $verdict"

# ============================================================================
# BID-03 — the last two criteria on #64, which nothing asserted until now:
#
#   SC-17  the history's amounts are STRICTLY INCREASING
#   SC-19  after concurrent bidding, closing yields exactly ONE winner, and it
#          is the highest bid
#
# The rounds at the top of this file bid the SAME amount, so exactly one is
# accepted and a one-row history is trivially increasing — it proves SC-16, and
# it cannot prove SC-17. This phase bids DISTINCT RISING amounts instead, so
# several are accepted into one history under contention, which is the only
# arrangement in which SC-17 can fail. Then it closes the auction, which the
# phases above never do, and SC-19 is asserted on the result.
#
# SC-17 is read through public.bid_history, not through the bids table: the
# view is what the product renders, and it carries the ordering decision (seq =
# row_number over bids.id, BID-09). Ordering by created_at instead renders a
# DECREASING history under exactly this contention — measured at 2 of 12
# auctions, which is why the rule exists. Asserting on the view is therefore
# asserting on the rule; asserting on `order by id` by hand would only restate
# the query the view already contains.
#
# THE VACUOUS-PASS GUARD (#117). "Strictly increasing" is true of a one-row
# history, and how many bids win a race is not deterministic — if the highest
# amount happens to commit first, every other bid is correctly rejected as
# not_above_current and that round's history has one row. So each round asserts
# the property, AND the phase fails if NO round ever reached two accepted bids:
# without that, a suite in which nothing was ever contended reports a pass for
# a property it never exercised.
# ============================================================================
echo
printf 'BID-03 — SC-17 strictly increasing history, SC-19 one winner after contention\n\n'

contended=0
before=$failures
for round in $(seq 1 "$ROUNDS"); do
  auction=$(new_auction)

  out="/tmp/bid03-rising-$round"
  for i in $(seq 1 "$WORKERS"); do
    ( $PSQL -c "select set_config('request.jwt.claims',
                  json_build_object('sub','00000000-0000-0000-0000-0000000000b$i')::text, false);
                select public.place_bid('$auction', '$((100 + i * 10))')::text;" | tail -1 ) &
  done > "$out" 2>&1
  wait

  accepted=$(grep -c '"accepted": true' "$out")
  answered=$(grep -c 'accepted' "$out")
  rows=$($PSQL -c "select count(*) from public.bid_history where auction_id = '$auction';")
  [ "$accepted" -ge 2 ] && contended=$((contended + 1))

  # SC-17, over the product's own ordering. bool_and over a lag window: every
  # row after the first must be strictly greater than the row before it in seq
  # order. Amounts are compared as numeric IN SQL and never leave it (S0-12).
  rising=$($PSQL -c "select coalesce(bool_and(prev is null or amount > prev), false)
      from (select amount, lag(amount) over (order by seq) as prev
              from public.bid_history where auction_id = '$auction') t;")

  # Close it. end_time must go backwards, which no product path can do
  # (auctions_guard_update) — same declared back door as pg_temp.expire in
  # closing.sql, one statement wide, re-enabled immediately.
  $PSQL -c "alter table public.auctions disable trigger auctions_immutable_terms;
            update public.auctions set end_time = clock_timestamp() - interval '1 second'
             where id = '$auction';
            alter table public.auctions enable trigger auctions_immutable_terms;" > /dev/null
  $PSQL -c "select public.close_ended_auctions();" > /dev/null

  # SC-19, as one boolean so no amount crosses into the shell: ended, the final
  # price is the highest bid, the winner is the bidder who placed it, and only
  # one bid sits at that price — one winner, not a tie resolved by luck.
  won=$($PSQL -c "select (a.status = 'ended'
      and a.final_price = (select max(amount) from public.bids where auction_id = a.id)
      and a.winner_id = (select bidder_id from public.bids
                          where auction_id = a.id order by amount desc limit 1)
      and (select count(*) from public.bids
            where auction_id = a.id and amount = a.final_price) = 1)
    from public.auctions a where a.id = '$auction';")

  verdict=OK
  [ "$answered" = "$WORKERS" ] || verdict='FAIL a submission got no answer'
  [ "$rows" = "$accepted" ]    || verdict='FAIL history != acceptances'
  [ "$rising" = t ]            || verdict='FAIL SC-17 history is not strictly increasing'
  [ "$won" = t ]               || verdict='FAIL SC-19 winner is not the single highest bid'
  [ "$verdict" = OK ]          || failures=$((failures + 1))

  printf 'round %-3s accepted=%s history=%s | rising=%s one_winner=%s  %s\n' \
    "$round" "$accepted" "$rows" "$rising" "$won" "$verdict"
done

echo
if [ "$contended" -eq 0 ]; then
  failures=$((failures + 1))
  echo "BID-03 SC-17/SC-19: FAIL — no round ever accepted two bids; SC-17 was never exercised"
elif [ "$failures" -eq "$before" ]; then
  echo "BID-03 SC-17/SC-19: PASS — $ROUNDS/$ROUNDS rounds clean, $contended genuinely contended"
else
  echo "BID-03 SC-17/SC-19: FAIL — $((failures - before)) of $ROUNDS rounds violated an invariant"
fi

exit "$failures"
