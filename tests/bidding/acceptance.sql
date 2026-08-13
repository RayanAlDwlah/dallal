-- ============================================================================
-- Acceptance suite for the bid operation (BID-02).
--
-- Every assertion below traces to a PRD scenario or business rule. A failure
-- here is a product failure, not a style problem.
--
-- Run via ./run.sh — it needs the BID-02 migration and seed applied first.
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
    raise notice 'PASS  %  (%)', rpad(label, 44), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 44), got, want;
  end if;
end $$;

do $$
declare
  owner uuid := '00000000-0000-0000-0000-0000000000a1';
  b1    uuid := '00000000-0000-0000-0000-0000000000b1';
  b2    uuid := '00000000-0000-0000-0000-0000000000b2';
  a uuid; r jsonb; big text;
begin
  -- S0-12 §5.2 / §8.3: p_amount is TEXT, and every malformed_amount assertion below
  -- silently depends on it. With a `numeric` parameter PostgREST casts BEFORE the
  -- function body runs, so the BEGIN/EXCEPTION block can never catch 22P02 or 22003
  -- and 'abc' surfaces as a raw error leaking internals (SEC-T3, FR-SEC-16).
  --
  -- Pinned here because the failure is invisible from the other direction: those
  -- assertions would hard-ERROR rather than FAIL, and a money parameter typed `text`
  -- looks wrong at a glance, so "tightening" it is a plausible future refactor.
  perform pg_temp.chk('S0-12 §5.2 place_bid signature is (uuid, text)',
                      -- string_agg, not a bare scalar subquery: adding a numeric
                      -- OVERLOAD rather than replacing the function would make a
                      -- scalar subquery raise 21000 and abort this block, which
                      -- reports as an aborted run instead of a clean FAIL. This
                      -- renders the extra signature into the mismatch instead.
                      (select string_agg(pg_get_function_identity_arguments(p.oid),
                                         ' | ' order by p.oid)
                         from pg_catalog.pg_proc p
                         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                        where n.nspname = 'public' and p.proname = 'place_bid'),
                      'p_auction_id uuid, p_amount text');

  insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
  values (owner, 'active', now() + interval '1 hour', 100, 100) returning id into a;

  -- SC-55 / BR-29: the first bid may EQUAL the starting price. Inclusive.
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '100');
  perform pg_temp.chk('SC-55 first bid == starting price',
                      coalesce(r->>'accepted', '?'), 'true');

  -- SC-56 / BR-03: every bid after the first must be STRICTLY greater.
  perform pg_temp.as_user(b2);
  r := public.place_bid(a, '100');
  perform pg_temp.chk('SC-56a equal second bid rejected',
                      coalesce(r->>'reason', '?'), 'not_above_current');

  -- BR-32: there is no increment. +0.01 is as valid as +1000.
  r := public.place_bid(a, '100.01');
  perform pg_temp.chk('SC-56b +0.01 SAR accepted',
                      coalesce(r->>'accepted', '?'), 'true');

  -- S0-12 §8.1: numeric accepts NaN/Infinity, and NaN passes >0 and =round(,2).
  -- An accepted NaN bid makes the auction permanently unwinnable.
  perform pg_temp.chk('NaN rejected',
                      coalesce(public.place_bid(a, 'NaN')->>'reason', '?'), 'malformed_amount');
  perform pg_temp.chk('Infinity rejected',
                      coalesce(public.place_bid(a, 'Infinity')->>'reason', '?'), 'malformed_amount');
  perform pg_temp.chk('-Infinity rejected',
                      coalesce(public.place_bid(a, '-Infinity')->>'reason', '?'), 'malformed_amount');
  perform pg_temp.chk('whitespace inf rejected',
                      coalesce(public.place_bid(a, '  inf  ')->>'reason', '?'), 'malformed_amount');

  -- FR-BID-07 / EC-06: malformed is REJECTED, never rounded.
  perform pg_temp.chk('abc rejected',
                      coalesce(public.place_bid(a, 'abc')->>'reason', '?'), 'malformed_amount');
  perform pg_temp.chk('100.005 rejected not rounded',
                      coalesce(public.place_bid(a, '100.005')->>'reason', '?'), 'malformed_amount');
  perform pg_temp.chk('zero rejected',
                      coalesce(public.place_bid(a, '0')->>'reason', '?'), 'malformed_amount');
  perform pg_temp.chk('negative rejected',
                      coalesce(public.place_bid(a, '-5')->>'reason', '?'), 'malformed_amount');

  -- BR-23 / FR-BID-24: a rejection changes nothing at all.
  perform pg_temp.chk('state unchanged after rejections',
                      (select current_price::text from public.auctions where id = a), '100.01');
  perform pg_temp.chk('history holds only accepted bids',
                      (select count(*)::text from public.bids where auction_id = a), '2');

  -- BR-02: the owner may never bid on their own auction.
  perform pg_temp.as_user(owner);
  perform pg_temp.chk('owner cannot bid',
                      coalesce(public.place_bid(a, '999')->>'reason', '?'), 'owner_cannot_bid');

  -- BR-01: identity comes from the verified session, never the payload.
  perform pg_temp.as_anon();
  perform pg_temp.chk('unauthenticated rejected',
                      coalesce(public.place_bid(a, '999')->>'reason', '?'), 'not_authenticated');

  -- BR-21 / SEC-R3 / SC-57: no ceiling. A large bid is never rejected for size.
  perform pg_temp.as_user(b1);
  big := repeat('9', 40) || '.99';
  perform pg_temp.chk('BR-21 40-digit bid accepted',
                      coalesce(public.place_bid(a, big)->>'accepted', '?'), 'true');
  perform pg_temp.chk('40-digit stored with no drift',
                      (select current_price::text from public.auctions where id = a), big);
end $$;

-- LC-03: eligibility comes from the server clock, NEVER the stored status flag.
-- There is a window where end_time has passed but status still reads 'active';
-- a status-gated check accepts bids after the auction ended.
do $$
declare
  owner uuid := '00000000-0000-0000-0000-0000000000a1';
  b1    uuid := '00000000-0000-0000-0000-0000000000b1';
  a uuid; r jsonb;
begin
  insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
  values (owner, 'active', now() - interval '1 second', 100, 100) returning id into a;
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '500');
  perform pg_temp.chk('LC-03 past end_time, status still active',
                      coalesce(r->>'reason', 'ACCEPTED — BUG'), 'auction_ended');
end $$;

-- §3a table privileges. RLS is the second gate, not the first: PostgreSQL
-- checks the GRANT before it evaluates a policy, so `using (true)` on a table
-- the role cannot SELECT denies every read with 42501 and the policy never
-- runs. The migration used to rely on the host's default privileges for this.
-- It does not on this project's Supabase default (`anon=Dxtm`, no DML), and
-- public reads returned 401 on dev while all four policies were present and
-- correct. These assertions are what make the migration self-sufficient: this
-- container grants nothing, so they can only pass if the migration grants it.
do $$
begin
  perform pg_temp.chk('anon can select profiles',
                      has_table_privilege('anon', 'public.profiles', 'select')::text, 'true');
  perform pg_temp.chk('anon can select auctions',
                      has_table_privilege('anon', 'public.auctions', 'select')::text, 'true');
  perform pg_temp.chk('anon can select bids',
                      has_table_privilege('anon', 'public.bids', 'select')::text, 'true');
  perform pg_temp.chk('anon can select bid_history',
                      has_table_privilege('anon', 'public.bid_history', 'select')::text, 'true');
  -- and the grant stayed SELECT — every write path still goes through place_bid
  perform pg_temp.chk('anon cannot insert bids',
                      has_table_privilege('anon', 'public.bids', 'insert')::text, 'false');
  perform pg_temp.chk('anon cannot update auctions',
                      has_table_privilege('anon', 'public.auctions', 'update')::text, 'false');
end $$;
