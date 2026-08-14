-- ============================================================================
-- Acceptance suite for finalization and the anti-sniping extension (BID-15,
-- BID-16, BR-36 as amended 2026-08-13).
--
-- Run via ./run.sh — it needs the BID-02 migration, the BID-15 migration and
-- the test-only seed applied first, in that order.
--
-- NOTHING HERE WAITS FOR REAL TIME. NFR-MNT-03 requires the closing operation
-- to be invocable directly in a test environment, and close_ended_auctions()
-- is exactly that: the pg_cron sweep is a latency device and calls the same
-- function. A suite that slept for 15 seconds per assertion would be a suite
-- nobody runs.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

create or replace function pg_temp.as_user(u uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', u)::text, false)::void $$;

create or replace function pg_temp.as_anon() returns void language sql as
$$ select set_config('request.jwt.claims', '', false)::void $$;

create or replace function pg_temp.chk(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %  (%)', rpad(label, 52), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 52), got, want;
  end if;
end $$;

-- Same reporting shape, for assertions whose expected value is an error
-- message. Matching a fragment rather than the whole string on purpose: the
-- assertion is about WHICH rule fired, not about its wording.
create or replace function pg_temp.chk_like(label text, got text, pat text)
returns void language plpgsql as $$
begin
  if got like pat then
    raise notice 'PASS  %  (%)', rpad(label, 52), left(got, 60);
  else
    raise warning 'FAIL  %  got=%  want~=%', rpad(label, 52), got, pat;
  end if;
end $$;

-- Runs a statement that is supposed to be refused and returns the refusal.
-- 'NO ERROR' is a value the assertions can fail on, rather than a silence.
create or replace function pg_temp.refused(stmt text)
returns text language plpgsql as $$
begin
  execute stmt;
  return 'NO ERROR';
exception when others then
  return sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- The one fixture that steps outside the product's rules, said plainly.
--
-- To close an auction that HAS bids, that auction must first have had a future
-- end time (place_bid rejects everything at or after it, LC-03) and must then
-- have a past one. Nothing in the product can perform that second step:
-- auctions_guard_update makes end_time monotonic and 30-second-quantised, and
-- that is the property §2 of the BID-15 migration exists to create — asserted
-- directly further down.
--
-- So the fixture disables the guard for one statement, in the open. Same
-- precedent as the V-1 seed, which writes auth.users directly because the
-- product never does. A test fixture may use the back door; the assertions are
-- what prove the front door is locked.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.expire(p_auction uuid, p_seconds integer default 1)
returns void language plpgsql as $$
begin
  alter table public.auctions disable trigger auctions_immutable_terms;
  update public.auctions
     set end_time = clock_timestamp() - make_interval(secs => p_seconds)
   where id = p_auction;
  alter table public.auctions enable trigger auctions_immutable_terms;
end $$;

create or replace function pg_temp.new_auction(p_ends_in interval,
                                               p_extensions integer default 0)
returns uuid language plpgsql as $$
declare v uuid;
begin
  -- extension_count is set at INSERT time, never by an UPDATE: the guard only
  -- governs updates, so this needs no back door. It is how the cap tests reach
  -- 19 and 20 without 20 real extensions ten minutes apart.
  insert into public.auctions (owner_id, status, end_time, starting_price,
                               current_price, extension_count,
                               name, description, image_path)
  values ('00000000-0000-0000-0000-0000000000a1', 'active',
          clock_timestamp() + p_ends_in, 100, 100, p_extensions,
          'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
  returning id into v;
  return v;
end $$;


-- ===========================================================================
-- A. Closing an auction that has bids — the ordinary path
-- ===========================================================================
do $$
declare
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
  b2 uuid := '00000000-0000-0000-0000-0000000000b2';
  a uuid; r jsonb; n_before integer; n_after integer;
begin
  a := pg_temp.new_auction(interval '1 hour');
  perform pg_temp.as_user(b1); r := public.place_bid(a, '150');
  perform pg_temp.as_user(b2); r := public.place_bid(a, '200');
  perform pg_temp.as_user(b1); r := public.place_bid(a, '250');
  select count(*) into n_before from public.bids where auction_id = a;

  perform pg_temp.expire(a);
  perform pg_temp.as_anon();

  perform pg_temp.chk('BID-15 close returns 1 for one due auction',
                      public.close_ended_auctions(a)::text, '1');

  perform pg_temp.chk('BID-16 status becomes ended',
                      (select status from public.auctions where id = a), 'ended');
  perform pg_temp.chk('BR-06 winner is the highest bidder',
                      (select winner_id::text from public.auctions where id = a), b1::text);
  perform pg_temp.chk('BR-06 final_price is the highest amount',
                      (select public.sar_text(final_price) from public.auctions where id = a),
                      '250.00');
  perform pg_temp.chk('FR-END-05 closed_at is recorded',
                      (select (closed_at is not null)::text from public.auctions where id = a),
                      'true');
  perform pg_temp.chk('current_price is not rewritten by closing',
                      (select public.sar_text(current_price) from public.auctions where id = a),
                      '250.00');

  -- SC-32. The 'active' predicate inside the function is the already-closed
  -- check; a second call must be a no-op rather than an error or a rewrite.
  perform pg_temp.chk('SC-32 a second close returns 0',
                      public.close_ended_auctions(a)::text, '0');
  perform pg_temp.chk('SC-32 the outcome is unchanged by the second call',
                      (select winner_id::text || ' ' || public.sar_text(final_price)
                         from public.auctions where id = a),
                      b1::text || ' 250.00');

  select count(*) into n_after from public.bids where auction_id = a;
  perform pg_temp.chk('SC-33 closing does not touch bid history',
                      n_after::text, n_before::text);

  perform pg_temp.as_user(b2);
  r := public.place_bid(a, '999');
  perform pg_temp.chk('BR-04 a bid on a closed auction is rejected',
                      coalesce(r->>'reason', 'ACCEPTED — BUG'), 'auction_ended');
end $$;

-- ===========================================================================
-- B. An auction with no bids at all
--
-- The single easiest way to get close_ended_auctions wrong is an inner join to
-- bids, which leaves every bidless auction 'active' forever and looks correct
-- in every test that has bids.
-- ===========================================================================
do $$
declare a uuid;
begin
  a := pg_temp.new_auction(interval '1 hour');
  perform pg_temp.expire(a);
  perform pg_temp.chk('BR-09 a bidless auction still closes',
                      public.close_ended_auctions(a)::text, '1');
  perform pg_temp.chk('BR-09 it ends with no winner',
                      (select (winner_id is null)::text from public.auctions where id = a),
                      'true');
  perform pg_temp.chk('SC-31 it ends with no final price',
                      (select (final_price is null)::text from public.auctions where id = a),
                      'true');
  perform pg_temp.chk('SC-31 its status is ended, not stuck active',
                      (select status from public.auctions where id = a), 'ended');
end $$;

-- ===========================================================================
-- C. An auction that has not reached its end time
-- ===========================================================================
do $$
declare a uuid;
begin
  a := pg_temp.new_auction(interval '1 hour');
  perform pg_temp.chk('an auction before its end time does not close',
                      public.close_ended_auctions(a)::text, '0');
  perform pg_temp.chk('...and is left active',
                      (select status from public.auctions where id = a), 'active');
end $$;

-- ===========================================================================
-- D. The sweep — no argument, every due auction at once (T1, SC-26)
-- ===========================================================================
do $$
declare a1 uuid; a2 uuid; a3 uuid; drained integer;
begin
  -- Drain first. acceptance.sql leaves a due auction behind (its LC-03 case),
  -- and asserting an absolute count without draining would couple this file to
  -- the other one's fixtures.
  drained := public.close_ended_auctions();
  a1 := pg_temp.new_auction(interval '1 hour');
  a2 := pg_temp.new_auction(interval '1 hour');
  a3 := pg_temp.new_auction(interval '1 hour');
  perform pg_temp.expire(a1); perform pg_temp.expire(a2); perform pg_temp.expire(a3);
  perform pg_temp.chk('T1 the sweep closes every due auction in one call',
                      public.close_ended_auctions()::text, '3');
  perform pg_temp.chk('T1 a sweep with nothing due returns 0',
                      public.close_ended_auctions()::text, '0');
end $$;

-- ===========================================================================
-- E. The extension — a bid inside the final 15 seconds (BR-36 as amended)
-- ===========================================================================
do $$
declare
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb; t0 timestamptz; t1 timestamptz;
begin
  a := pg_temp.new_auction(interval '10 seconds');
  select end_time into t0 from public.auctions where id = a;
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');
  select end_time into t1 from public.auctions where id = a;

  perform pg_temp.chk('BR-36 the bid itself is still accepted',
                      (r->>'accepted'), 'true');
  perform pg_temp.chk('BR-36 a bid in the final 15s adds exactly 30s',
                      (t1 = t0 + interval '30 seconds')::text, 'true');
  perform pg_temp.chk('BR-36 the extension counter reaches 1',
                      (select extension_count::text from public.auctions where id = a), '1');
end $$;

-- ===========================================================================
-- F. A bid outside the window changes nothing
--
-- 20 seconds, not 16: the boundary itself cannot be asserted without a clock
-- injection point, and a test that flakes when the container is busy is worse
-- than a test that sits a few seconds clear of the line.
-- ===========================================================================
do $$
declare
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb; t0 timestamptz;
begin
  a := pg_temp.new_auction(interval '20 seconds');
  select end_time into t0 from public.auctions where id = a;
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');
  perform pg_temp.chk('a bid outside the final 15s leaves end_time alone',
                      (select (end_time = t0)::text from public.auctions where id = a), 'true');
  perform pg_temp.chk('...and leaves the counter at 0',
                      (select extension_count::text from public.auctions where id = a), '0');
end $$;

-- ===========================================================================
-- G. It repeats — the whole point of the feature
-- ===========================================================================
do $$
declare
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb; t0 timestamptz;
begin
  a := pg_temp.new_auction(interval '10 seconds', 5);
  select end_time into t0 from public.auctions where id = a;
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');
  perform pg_temp.chk('BR-36 extending is not once-only: 5 becomes 6',
                      (select extension_count::text from public.auctions where id = a), '6');
  perform pg_temp.chk('...and end_time moved by one 30s quantum',
                      (select (end_time = t0 + interval '30 seconds')::text
                         from public.auctions where id = a), 'true');
end $$;

-- ===========================================================================
-- H. The cap — the part that guarantees the auction ends at all
--
-- At 20 the auction must run out exactly as a fixed-end auction does. Note the
-- bid is still ACCEPTED: the cap ends the extending, not the bidding. Getting
-- that backwards would reject a bid that arrived before the end time, which is
-- a different and worse bug than failing to extend.
-- ===========================================================================
do $$
declare
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb; t0 timestamptz;
begin
  a := pg_temp.new_auction(interval '10 seconds', 20);
  select end_time into t0 from public.auctions where id = a;
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');
  perform pg_temp.chk('at the cap the bid is still accepted',
                      (r->>'accepted'), 'true');
  perform pg_temp.chk('at the cap end_time does not move',
                      (select (end_time = t0)::text from public.auctions where id = a), 'true');
  perform pg_temp.chk('at the cap the counter stays at 20',
                      (select extension_count::text from public.auctions where id = a), '20');
end $$;

-- ===========================================================================
-- I. 19 -> 20 — the last extension that IS permitted
-- ===========================================================================
do $$
declare
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb;
begin
  a := pg_temp.new_auction(interval '10 seconds', 19);
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');
  perform pg_temp.chk('the 20th extension is permitted, not off by one',
                      (select extension_count::text from public.auctions where id = a), '20');
end $$;

-- ===========================================================================
-- J. The cap is a constraint, not an if
--
-- The trigger decides whether to extend; the CHECK decides what is possible.
-- If the cap lived only in the trigger, any future second call site would walk
-- straight past it.
-- ===========================================================================
do $$
begin
  perform pg_temp.chk_like('extension_count 21 violates auctions_extension_cap',
    pg_temp.refused($q$
      insert into public.auctions (owner_id, status, end_time, starting_price,
                                   current_price, extension_count,
                                   name, description, image_path)
      values ('00000000-0000-0000-0000-0000000000a1', 'active',
              now() + interval '1 hour', 100, 100, 21,
              'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg') $q$),
    '%auctions_extension_cap%');
end $$;

-- ===========================================================================
-- K. The guard — every shape of end_time change that must be refused
-- ===========================================================================
do $$
declare a uuid;
begin
  a := pg_temp.new_auction(interval '1 hour');
  -- Deliberately WITHOUT the place_bid flag: this is the outside-the-operation
  -- case, and it is the one that matters most.
  perform pg_temp.chk_like('end_time cannot be moved outside place_bid',
    pg_temp.refused(format($q$update public.auctions
       set end_time = end_time + interval '30 seconds',
           extension_count = extension_count + 1 where id = %L$q$, a)),
    '%only be extended by place_bid%');
end $$;

do $$
declare a uuid;
begin
  a := pg_temp.new_auction(interval '1 hour');
  -- Now WITH the flag — the strongest test available, because it grants the
  -- caller everything place_bid has and still refuses every wrong shape.
  -- Transaction-local, and this DO block is the transaction.
  perform set_config('dalal.in_place_bid', 'on', true);

  perform pg_temp.chk_like('end_time cannot move backwards',
    pg_temp.refused(format($q$update public.auctions
       set end_time = end_time - interval '30 seconds',
           extension_count = extension_count + 1 where id = %L$q$, a)),
    '%exactly 30 seconds%');

  perform pg_temp.chk_like('end_time cannot move by some other amount',
    pg_temp.refused(format($q$update public.auctions
       set end_time = end_time + interval '29 seconds',
           extension_count = extension_count + 1 where id = %L$q$, a)),
    '%exactly 30 seconds%');

  perform pg_temp.chk_like('end_time cannot move without the counter',
    pg_temp.refused(format($q$update public.auctions
       set end_time = end_time + interval '30 seconds' where id = %L$q$, a)),
    '%increment extension_count%');

  perform pg_temp.chk_like('the counter cannot move without end_time',
    pg_temp.refused(format($q$update public.auctions
       set extension_count = extension_count + 1 where id = %L$q$, a)),
    '%only change together with the end time%');

  -- The flag is not a skeleton key: it authorises the extension and nothing
  -- else. The pre-existing immutability rules must survive §2's rewrite.
  perform pg_temp.chk_like('starting_price is still immutable',
    pg_temp.refused(format($q$update public.auctions
       set starting_price = 500 where id = %L$q$, a)),
    '%creation-time terms are immutable%');

  perform pg_temp.chk_like('a legal extension is accepted, twenty times over',
    pg_temp.refused(format($q$
      do $inner$
      begin
        for i in 1..20 loop
          update public.auctions
             set end_time = end_time + interval '30 seconds',
                 extension_count = extension_count + 1
           where id = %L;
        end loop;
      end $inner$
    $q$, a)),
    'NO ERROR');
  perform pg_temp.chk('...leaving the counter at exactly 20',
                      (select extension_count::text from public.auctions where id = a), '20');
  perform pg_temp.chk_like('...and the twenty-first is refused by the constraint',
    pg_temp.refused(format($q$update public.auctions
       set end_time = end_time + interval '30 seconds',
           extension_count = extension_count + 1 where id = %L$q$, a)),
    '%auctions_extension_cap%');

  perform set_config('dalal.in_place_bid', '', true);
end $$;

-- ===========================================================================
-- L. A rejected bid never extends
--
-- The extension hangs off the bids insert, and place_bid returns before that
-- insert on every rejection path (BR-23). If it did not, a bidder could hold an
-- auction open forever with bids that never count.
-- ===========================================================================
do $$
declare
  owner uuid := '00000000-0000-0000-0000-0000000000a1';
  b1    uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb; t0 timestamptz;
begin
  a := pg_temp.new_auction(interval '10 seconds');
  select end_time into t0 from public.auctions where id = a;

  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '50');                 -- under the starting price
  perform pg_temp.chk('a too-low bid in the window is rejected',
                      coalesce(r->>'reason', 'ACCEPTED — BUG'), 'below_starting_price');
  perform pg_temp.chk('...and does not extend the auction',
                      (select (end_time = t0)::text from public.auctions where id = a), 'true');

  perform pg_temp.as_user(owner);
  r := public.place_bid(a, '500');                -- the seller (BR-02)
  perform pg_temp.chk('an owner bid in the window is rejected',
                      coalesce(r->>'reason', 'ACCEPTED — BUG'), 'owner_cannot_bid');
  perform pg_temp.chk('...and does not extend the auction either',
                      (select (end_time = t0)::text from public.auctions where id = a), 'true');
end $$;

-- ===========================================================================
-- M. Exposure and definer hygiene
-- ===========================================================================
do $$
begin
  -- T2 "on read" is a plain client call, including for a signed-out visitor.
  -- close_ended_auctions takes no identity and makes no identity-dependent
  -- decision, so calling it can only make the database agree sooner with
  -- something the clock already made true.
  perform pg_temp.chk('anon may execute close_ended_auctions',
    has_function_privilege('anon', 'public.close_ended_auctions(uuid)', 'execute')::text, 'true');
  perform pg_temp.chk('authenticated may execute close_ended_auctions',
    has_function_privilege('authenticated', 'public.close_ended_auctions(uuid)', 'execute')::text, 'true');

  -- Trigger functions are nobody's to call. PostgreSQL grants EXECUTE to
  -- PUBLIC on every new function, so this had to be revoked explicitly.
  perform pg_temp.chk('anon may not execute bids_extend_end_time',
    has_function_privilege('anon', 'public.bids_extend_end_time()', 'execute')::text, 'false');
  perform pg_temp.chk('anon may not execute auctions_guard_update',
    has_function_privilege('anon', 'public.auctions_guard_update()', 'execute')::text, 'false');
  -- ...and revoking it did not disable the triggers, which every assertion
  -- above would have caught, but state it directly.
  perform pg_temp.chk('the extension trigger is enabled',
    (select tgenabled from pg_trigger where tgname = 'bids_extend_auction'), 'O');

  perform pg_temp.chk('close_ended_auctions is SECURITY DEFINER',
    (select prosecdef::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'close_ended_auctions'), 'true');

  -- The six advisor findings this migration also closes. Counting the ones
  -- still unpinned rather than checking each: a seventh function added without
  -- search_path shows up here instead of being missed.
  perform pg_temp.chk('every function we own pins search_path',
    (select count(*)::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('place_bid','format_sar','sar_text','bid_reject',
                          'bids_are_append_only','bids_only_via_place_bid',
                          'auctions_guard_update','bids_extend_end_time',
                          'close_ended_auctions')
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
                         where c like 'search\_path=%')), '0');
end $$;
