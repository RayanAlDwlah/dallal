-- ============================================================================
-- BID-19 — terminal-state enforcement.
-- BR-15 · FR-END-18 · SC-34 · TEAM R-23
--
-- "No route exists to reopen, extend, or re-run an ended auction (SC-34).
-- Outcome fields are not user-writable. Ended is terminal."
--
-- Run via ./run.sh — it needs the BID-02 migration, the BID-15 migration, the
-- AUC-01 product-field migration, the AUC-18 authorization migration, the BID-08
-- realtime migration, and the test-only seed applied first, in that order.
--
-- ============================================================================
-- WHAT IS ALREADY PROVEN ELSEWHERE — not duplicated here
--
-- closing.sql §A (BR-04):   place_bid on a closed auction returns 'auction_ended'.
-- closing.sql §A (SC-32):   a second close call returns 0 and writes nothing.
-- closing.sql §A (SC-33):   closing does not touch bid history.
-- closing.sql §K:            end_time guard on ACTIVE auctions (all shapes).
-- acceptance.sql (LC-03):   place_bid at or after end_time returns 'auction_ended'.
-- immutability.sql (SC-59): authenticated/anon cannot DELETE an auction (active).
-- immutability.sql (SEC-Z5/Z6): authenticated cannot set status/outcome fields
--                            on ACTIVE auctions (no UPDATE grant → 42501).
--
-- WHAT THIS FILE ADDS
--
-- The common element: every existing test operates on an ACTIVE auction. The
-- trigger's terminal-state branch — `if old.status = 'ended' then raise` — is
-- never exercised by any existing suite. This file exercises it.
--
-- Five gap groups:
--   A. The trigger fires for RLS-subject roles on an ended auction (grant gate).
--   B. The trigger fires for the postgres role on an ended auction (trigger gate).
--   C. Post-close outcome fields cannot be altered or cleared by anyone.
--   D. Post-close end_time cannot be moved (even by postgres, even with the flag).
--   E. place_bid on an ended auction writes nothing and extends nothing.
--      (The rejection reason is proven in closing.sql; the write-nothing and
--       extend-nothing properties are not.)
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

-- ---------------------------------------------------------------------------
-- Helpers — same idiom as closing.sql, 52-char label padding.
-- pg_temp functions from other suites do not carry across psql invocations.
-- ---------------------------------------------------------------------------
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

create or replace function pg_temp.chk_like(label text, got text, pat text)
returns void language plpgsql as $$
begin
  if got like pat then
    raise notice 'PASS  %  (%)', rpad(label, 52), left(got, 60);
  else
    raise warning 'FAIL  %  got=%  want~=%', rpad(label, 52), got, pat;
  end if;
end $$;

-- Runs a statement that should raise and returns the error message.
-- 'NO ERROR' is the sentinel the assertions fail on; it is never a valid msg.
create or replace function pg_temp.refused(stmt text)
returns text language plpgsql as $$
begin
  execute stmt;
  return 'NO ERROR';
exception when others then
  return sqlerrm;
end $$;

-- Disables the guard trigger, pushes end_time one second into the past, and
-- re-enables it — exactly as closing.sql does. The assertions prove the front
-- door is locked; this opens the back door to reach a closeable state.
create or replace function pg_temp.expire(p_auction uuid, p_seconds integer default 1)
returns void language plpgsql as $$
begin
  alter table public.auctions disable trigger auctions_immutable_terms;
  update public.auctions
     set end_time = clock_timestamp() - make_interval(secs => p_seconds)
   where id = p_auction;
  alter table public.auctions enable trigger auctions_immutable_terms;
end $$;

-- Creates a new auction owned by the seed user a1, places one bid from b1 so
-- winner_id and final_price will be populated, expires the auction, closes it
-- with close_ended_auctions(), and returns the id of the now-ended auction.
-- Raises if the close did not actually set status='ended' — every assertion
-- below is vacuously true if the fixture quietly produces an active auction.
create or replace function pg_temp.ended_auction()
returns uuid language plpgsql as $$
declare
  a  uuid;
  b1 uuid := '00000000-0000-0000-0000-0000000000b1';
begin
  insert into public.auctions (owner_id, status, end_time, starting_price,
                               current_price, extension_count,
                               name, description, image_path)
  values ('00000000-0000-0000-0000-0000000000a1', 'active',
          clock_timestamp() + interval '1 hour', 100, 100, 0,
          'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
  returning id into a;

  perform set_config('request.jwt.claims',
    json_build_object('sub', b1)::text, false);
  perform public.place_bid(a, '150');
  perform set_config('request.jwt.claims', '', false);

  -- place_bid sets dalal.in_place_bid = 'on' TRANSACTION-locally and never
  -- clears it — in production each RPC is its own transaction, so there is
  -- nothing to clear. A DO block is one transaction, so without this reset the
  -- flag leaks into every assertion that follows the fixture, and a "no flag"
  -- test silently runs WITH the flag. Found when D1 below reported the
  -- terminal-guard message instead of the end-time-guard one.
  perform set_config('dalal.in_place_bid', '', true);

  perform pg_temp.expire(a);
  perform public.close_ended_auctions(a);

  if (select status from public.auctions where id = a) <> 'ended' then
    raise exception 'pg_temp.ended_auction: fixture failed — auction is not ended';
  end if;
  return a;
end $$;


-- ===========================================================================
-- A. The grant gate for client roles on an ended auction
--
-- For authenticated and anon the UPDATE grant was revoked (BID-02 §3a,
-- AUC-18 §2), so PostgreSQL's grant check fires before the trigger and
-- returns 42501. SC-34's "no route exists to reopen" requires BOTH gates to
-- refuse; §B below proves the trigger is the second gate.
-- ===========================================================================
do $$
declare
  owner uuid := '00000000-0000-0000-0000-0000000000a1';
  other uuid := '00000000-0000-0000-0000-0000000000b2';
  a uuid; got text;
begin
  a := pg_temp.ended_auction();

  -- Owner tries to flip their own ended auction back to active.
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', owner)::text, true);
    set local role authenticated;
    update public.auctions set status = 'active' where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk(
    'SC-34 owner cannot reopen ended auction (grant gate)',
    got, '42501');

  -- A stranger — different user, still no UPDATE grant.
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', other)::text, true);
    set local role authenticated;
    update public.auctions set status = 'active' where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk(
    'SC-34 a stranger cannot reopen ended auction (grant gate)',
    got, '42501');

  -- anon has no UPDATE grant on auctions.
  begin
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    update public.auctions set status = 'active' where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk(
    'SC-34 anon cannot reopen ended auction (grant gate)',
    got, '42501');

  -- Auction must still be ended after all three attempts.
  perform pg_temp.chk(
    'status remains ended after three reopen attempts',
    (select status from public.auctions where id = a), 'ended');
end $$;


-- ===========================================================================
-- B. The trigger gate for the postgres role on an ended auction
--
-- Grants bind client roles; the auctions_guard_update trigger fires for EVERY
-- role, including the table owner and SECURITY DEFINER functions. These three
-- assertions exercise the `if old.status = 'ended' then raise` branch of the
-- trigger that no existing suite reaches.
-- ===========================================================================
do $$
declare a uuid;
begin
  a := pg_temp.ended_auction();

  -- The direct reopen: flip status back to active.
  perform pg_temp.chk_like(
    'BR-15 postgres cannot reopen ended auction (trigger gate)',
    pg_temp.refused(format(
      'update public.auctions set status = ''active'' where id = %L', a)),
    '%ended auctions are terminal%');

  -- current_price is the running price. Rewriting it would diverge the
  -- displayed price from bid history.
  perform pg_temp.chk_like(
    'FR-END-18 postgres cannot alter current_price on ended auction',
    pg_temp.refused(format(
      'update public.auctions set current_price = 9999 where id = %L', a)),
    '%ended auctions are terminal%');

  -- Both fields in one statement — same result.
  perform pg_temp.chk_like(
    'SC-34 postgres cannot alter status + current_price together',
    pg_temp.refused(format(
      'update public.auctions set status = ''active'', current_price = 1 where id = %L', a)),
    '%ended auctions are terminal%');
end $$;


-- ===========================================================================
-- C. Post-close outcome fields cannot be altered or cleared by postgres
--
-- winner_id, final_price, and closed_at are written exactly once by
-- close_ended_auctions(). The trigger's terminal check must stop any attempt
-- to rewrite or clear them afterwards, regardless of the role.
-- ===========================================================================
do $$
declare
  other uuid := '00000000-0000-0000-0000-0000000000b2';
  a uuid;
begin
  a := pg_temp.ended_auction();

  -- Clear the winner — makes the auction look like it never had one.
  perform pg_temp.chk_like(
    'SEC-Z7 postgres cannot clear winner_id after close',
    pg_temp.refused(format(
      'update public.auctions set winner_id = null where id = %L', a)),
    '%ended auctions are terminal%');

  -- Swap the winner to a different user.
  perform pg_temp.chk_like(
    'SEC-Z7 postgres cannot swap winner_id after close',
    pg_temp.refused(format(
      'update public.auctions set winner_id = %L where id = %L', other, a)),
    '%ended auctions are terminal%');

  -- Rewrite the final price to a different value.
  perform pg_temp.chk_like(
    'SEC-Z7 postgres cannot alter final_price after close',
    pg_temp.refused(format(
      'update public.auctions set final_price = 1 where id = %L', a)),
    '%ended auctions are terminal%');

  -- Clear final_price — makes it look like a bidless close.
  perform pg_temp.chk_like(
    'SEC-Z7 postgres cannot clear final_price after close',
    pg_temp.refused(format(
      'update public.auctions set final_price = null where id = %L', a)),
    '%ended auctions are terminal%');

  -- Clear closed_at — makes it look like finalization never ran.
  perform pg_temp.chk_like(
    'FR-END-18 postgres cannot clear closed_at after close',
    pg_temp.refused(format(
      'update public.auctions set closed_at = null where id = %L', a)),
    '%ended auctions are terminal%');

  -- Back-date closed_at.
  perform pg_temp.chk_like(
    'FR-END-18 postgres cannot alter closed_at after close',
    pg_temp.refused(format(
      'update public.auctions'
      ' set closed_at = now() - interval ''1 year'' where id = %L', a)),
    '%ended auctions are terminal%');

  -- Confirm the outcome is intact after all six attempts.
  perform pg_temp.chk(
    'outcomes intact after all attempted rewrites',
    (select (winner_id is not null
             and final_price is not null
             and closed_at is not null)::text
       from public.auctions where id = a),
    'true');
end $$;


-- ===========================================================================
-- D. Post-close end_time cannot be moved
--
-- The guard (20260814000000 §2) checks end_time changes BEFORE the
-- terminal-state check — verified against the function body, and then
-- verified the hard way: the first run of D1 reported the TERMINAL message,
-- because the fixture's place_bid had leaked dalal.in_place_bid='on' into the
-- test transaction (see ended_auction()), so the "no flag" path was never on
-- the flag-less branch at all. With the fixture fixed:
--
-- D1 (without flag): "may only be extended by place_bid" — end_time guard.
-- D2 (with flag, correct shape): "ended auctions are terminal" — terminal guard.
-- Both guard independently; this proves the terminal guard is not bypassed by
-- the flag that was designed to permit extensions on ACTIVE auctions.
-- ===========================================================================
do $$
declare a uuid;
begin
  a := pg_temp.ended_auction();

  -- D1: postgres, no flag — end_time guard fires before terminal check.
  perform pg_temp.chk_like(
    'BR-16 postgres cannot move end_time on ended auction (no flag)',
    pg_temp.refused(format($q$
      update public.auctions
         set end_time = end_time + interval '30 seconds',
             extension_count = extension_count + 1
       where id = %L$q$, a)),
    '%only be extended by place_bid%');

  -- D2: with the place_bid flag, correct 30-second shape — the shape check
  -- passes and the terminal guard fires. This proves the flag is not a
  -- skeleton key for ended auctions.
  perform set_config('dalal.in_place_bid', 'on', true);
  perform pg_temp.chk_like(
    'BR-15 in_place_bid flag does not bypass terminal check',
    pg_temp.refused(format($q$
      update public.auctions
         set end_time = end_time + interval '30 seconds',
             extension_count = extension_count + 1
       where id = %L$q$, a)),
    '%ended auctions are terminal%');
  perform set_config('dalal.in_place_bid', '', true);
end $$;


-- ===========================================================================
-- E. place_bid on an ended auction writes nothing and extends nothing
--
-- closing.sql §A already proves that place_bid returns reason='auction_ended'
-- after the auction's end_time has passed. This block proves two properties
-- that closing.sql leaves implicit — that no bid row is written and that
-- end_time and extension_count do not move.
--
-- The distinction matters: a future refactor that records rejected bids or
-- extends the end_time as a "probe" would pass closing.sql but fail here.
-- ===========================================================================
do $$
declare
  b2 uuid := '00000000-0000-0000-0000-0000000000b2';
  a  uuid;
  r  jsonb;
  n_bids_before integer;
  n_bids_after  integer;
  end_before    timestamptz;
  ext_before    integer;
begin
  a := pg_temp.ended_auction();

  -- Snapshot AFTER close, BEFORE the bid attempt.
  select count(*) into n_bids_before from public.bids where auction_id = a;
  select end_time, extension_count
    into end_before, ext_before
    from public.auctions where id = a;

  -- Attempt the bid as a different user (b2 did not place the winning bid).
  perform pg_temp.as_user(b2);
  r := public.place_bid(a, '999');
  perform pg_temp.as_anon();

  -- Sanity: the reason must be auction_ended for the subsequent assertions to
  -- have a clear causal story. If place_bid returns something else (e.g.,
  -- malformed_amount), the write-nothing checks are vacuously true.
  perform pg_temp.chk(
    'E sanity — reason is auction_ended',
    coalesce(r->>'reason', 'ACCEPTED — BUG'), 'auction_ended');

  -- The load-bearing properties.
  select count(*) into n_bids_after from public.bids where auction_id = a;
  perform pg_temp.chk(
    'SC-34 rejected post-close bid writes no bid row',
    n_bids_after::text, n_bids_before::text);

  perform pg_temp.chk(
    'SC-34 rejected post-close bid does not move end_time',
    (select (end_time = end_before)::text from public.auctions where id = a),
    'true');

  perform pg_temp.chk(
    'SC-34 rejected post-close bid does not increment extension_count',
    (select extension_count::text from public.auctions where id = a),
    ext_before::text);
end $$;
