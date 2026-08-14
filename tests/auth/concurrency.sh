#!/usr/bin/env bash
# ============================================================================
# AUTH-11 — display-name uniqueness under genuine concurrency.
#
# AUTH-11's acceptance criteria say "display-name uniqueness tested INCLUDING
# THE CONCURRENT CASE". The sequential assertion in acceptance.sql does not
# cover it: registerAction checks availability and then signs up, and the window
# between those two statements is exactly what a second registration can land
# in. A check-then-act that is never raced looks correct in every test.
#
# Per round, N simultaneous connections attempt to register the SAME display
# name with different addresses:
#
#   1. exactly one acceptance                              BR-39, FR-PROF-03
#   2. exactly one profile row carries that name           BR-39
#   3. every loser is told 23505 specifically — not a
#      generic failure the app would have to guess at      FR-PROF-03
#   4. ZERO orphaned auth.users rows                       FR-PROF-02
#
# (4) is the one worth the whole file. The profile insert happens in a trigger
# inside the signup transaction, so a losing registration must take its
# auth.users row down with it. If it does not, the loser holds an account that
# can sign in, has no public identity, and reaches the bid path with a null
# display name — while the UI reports failure and the user tries again.
#
# Usage:  ./concurrency.sh [rounds] [workers]      defaults: 8 rounds, 8 workers
# Runs inside the throwaway container started by run.sh. LOCAL ONLY.
# ============================================================================
set -uo pipefail

ROUNDS="${1:-8}"
WORKERS="${2:-8}"
PSQL="psql -U postgres -tAq"
failures=0

printf 'AUTH-11 — %s rounds x %s simultaneous registrations of one name\n\n' "$ROUNDS" "$WORKERS"

for round in $(seq 1 "$ROUNDS"); do
  name="سباق_$round"
  out="/tmp/auth11-round-$round"

  for i in $(seq 1 "$WORKERS"); do
    uuid=$(printf '00000000-0000-0000-0000-%012d' $((round * 1000 + i)))
    (
      # Reported as 'accepted' or the SQLSTATE, one line per worker, so a
      # connection that dies silently shows up as a missing answer rather than
      # being counted as a rejection.
      $PSQL -v ON_ERROR_STOP=0 -c "
        do \$\$
        begin
          insert into auth.users (id, email, raw_user_meta_data)
          values ('$uuid', 'race-$round-$i@test.local',
                  jsonb_build_object('display_name', '$name'));
          raise notice 'accepted';
        exception when others then
          raise notice '%', sqlstate;
        end \$\$;" 2>&1 | grep -oE 'accepted|[0-9A-Z]{5}' | head -1
    ) &
  done > "$out" 2>&1
  wait

  accepted=$(grep -c '^accepted$' "$out")
  dup=$(grep -c '^23505$' "$out")
  answered=$(grep -cE '^(accepted|[0-9A-Z]{5})$' "$out")

  profiles=$($PSQL -c "select count(*) from public.profiles where display_name = '$name';")
  # Accounts created this round that have no profile. Must be zero: the trigger
  # runs inside the signup transaction, so a failure rolls the account back too.
  orphans=$($PSQL -c "
    select count(*) from auth.users u
     where u.email like 'race-$round-%@test.local'
       and not exists (select 1 from public.profiles p where p.id = u.id);")
  accounts=$($PSQL -c "
    select count(*) from auth.users where email like 'race-$round-%@test.local';")

  verdict=OK
  [ "$accepted" = 1 ]          || verdict='FAIL exactly-one-acceptance'
  [ "$profiles" = 1 ]          || verdict='FAIL profile rows != 1'
  [ "$answered" = "$WORKERS" ] || verdict='FAIL a registration got no answer'
  [ "$dup" = "$((WORKERS - 1))" ] || verdict='FAIL losers not told 23505'
  [ "$orphans" = 0 ]           || verdict='FAIL orphaned auth.users row'
  [ "$accounts" = 1 ]          || verdict='FAIL account count != 1'
  [ "$verdict" = OK ]          || failures=$((failures + 1))

  printf 'round %-3s accepted=%s dup=%s answered=%s | profiles=%s accounts=%s orphans=%s  %s\n' \
    "$round" "$accepted" "$dup" "$answered" "$profiles" "$accounts" "$orphans" "$verdict"
done

echo
if [ "$failures" -eq 0 ]; then
  echo "AUTH-11 concurrency: PASS — $ROUNDS/$ROUNDS rounds clean"
  exit 0
fi
echo "AUTH-11 concurrency: FAIL — $failures of $ROUNDS rounds violated an invariant"
exit 1
