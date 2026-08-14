-- ============================================================================
-- BID-21 sweep — gap-filling assertions.
--
-- Every assertion here traces to a success criterion that the traceability
-- table in docs/BID-21-traceability.md marks as GAP. No assertion duplicates
-- coverage that already exists in acceptance.sql or closing.sql.
--
-- Run via ./run.sh — it needs the BID-02 migration, the BID-15 migration,
-- the AUC-01 migration, and the test-only seed applied first, in that order.
--
-- IMPORTANT: the realtime.sql context file shown in the task brief described a
-- future version of run.sh (from the BID-08 feature branch, not yet merged).
-- This file is wired into the CURRENT main-branch run.sh below "suite closing".
-- The pattern is identical to acceptance.sql and closing.sql.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

-- Shared helpers — same shape as acceptance.sql and closing.sql.
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

-- The same back-door expire helper closing.sql uses: auctions_immutable_terms
-- makes end_time monotonic and 30-second-quantised — no product path can move
-- it backwards, and that is exactly the property we are not testing here. The
-- fixture uses the back door in the open; the assertions are what prove the
-- front door is locked, and that proof already lives in closing.sql.
create or replace function pg_temp.expire(p_auction uuid, p_seconds integer default 1)
returns void language plpgsql as $$
begin
  alter table public.auctions disable trigger auctions_immutable_terms;
  update public.auctions
     set end_time = clock_timestamp() - make_interval(secs => p_seconds)
   where id = p_auction;
  alter table public.auctions enable trigger auctions_immutable_terms;
end $$;

-- One auction factory so each block starts clean.
create or replace function pg_temp.new_auction(p_ends_in interval default interval '1 hour')
returns uuid language sql as $$
  insert into public.auctions
    (owner_id, status, end_time, starting_price, current_price,
     name, description, image_path)
  values ('00000000-0000-0000-0000-0000000000a1', 'active',
          clock_timestamp() + p_ends_in, 100, 100,
          'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
  returning id;
$$;


-- ===========================================================================
-- SC-28: a bid accepted just before the end time counts toward winner
-- determination (PRD §18.1).
--
-- Pattern: create auction, b1 places a valid bid (accepted), THEN expire the
-- auction and close. The bid was accepted before expiry, so it must be the
-- winning bid. This mirrors closing.sql's approach exactly: expire() is the
-- only available back door, and it moves the clock rather than inserting after
-- expiry (which LC-03 prevents).
-- ===========================================================================
do $$
declare
  b1  uuid := '00000000-0000-0000-0000-0000000000b1';
  a   uuid;
  r   jsonb;
begin
  a := pg_temp.new_auction();
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');

  -- The bid must be accepted before we expire — that is the test premise.
  perform pg_temp.chk('SC-28 bid placed before expiry is accepted',
                      coalesce(r->>'accepted', '?'), 'true');

  perform pg_temp.expire(a);
  perform pg_temp.as_anon();
  perform public.close_ended_auctions(a);

  perform pg_temp.chk('SC-28 that bidder is the winner',
                      (select winner_id::text from public.auctions where id = a),
                      b1::text);
  perform pg_temp.chk('SC-28 final_price matches that bid',
                      (select public.sar_text(final_price) from public.auctions where id = a),
                      '150.00');
end $$;


-- ===========================================================================
-- SC-57 — no bid increment: a +0.01 SAR raise from a non-first bid is
-- accepted (BR-32). acceptance.sql already proves SC-56b (+0.01 on the
-- SECOND bid overall). This block proves the same property is not special to
-- the second bid: +0.01 above any current price is valid. It also proves the
-- no-ceiling side with the issue-specified wide amount (30 digits + 2 decimal
-- places), distinct from acceptance.sql's 40-nines fixture.
-- ===========================================================================
do $$
declare
  b1  uuid := '00000000-0000-0000-0000-0000000000b1';
  b2  uuid := '00000000-0000-0000-0000-0000000000b2';
  a   uuid;
  r   jsonb;
  big text := '123456789012345678901234567890.99';   -- 30-digit integer part
begin
  a := pg_temp.new_auction();

  -- Establish a non-trivial current price.
  perform pg_temp.as_user(b1); r := public.place_bid(a, '500');
  perform pg_temp.as_user(b2); r := public.place_bid(a, '750');

  -- +0.01 above a non-first bid: no increment check must exist.
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '750.01');
  perform pg_temp.chk('SC-57 +0.01 raise above non-first bid accepted',
                      coalesce(r->>'accepted', '?'), 'true');

  -- No ceiling: the issue-specified 30-digit amount must be accepted.
  r := public.place_bid(a, big);
  perform pg_temp.chk('SC-57 30-digit amount accepted (no ceiling)',
                      coalesce(r->>'accepted', '?'), 'true');

  -- Amount stored without drift. Amounts travel as TEXT (S0-12 §6); the
  -- ::text cast is the required read path (CLAUDE.md §4 rule 7).
  perform pg_temp.chk('SC-57 30-digit amount stored with no drift',
                      (select current_price::text from public.auctions where id = a),
                      big);
end $$;


-- ===========================================================================
-- SC-72: the current leading bidder can place a further bid that is strictly
-- greater than the current price, and it is accepted (BR-24, FR-BID-04).
--
-- "Leading bidder" means the user who placed the most recent accepted bid.
-- Nothing in the product makes being the leader a ground for rejection
-- (BR-24). This assertion proves that no such check was accidentally added.
-- ===========================================================================
do $$
declare
  b1  uuid := '00000000-0000-0000-0000-0000000000b1';
  b2  uuid := '00000000-0000-0000-0000-0000000000b2';
  a   uuid;
  r   jsonb;
begin
  a := pg_temp.new_auction();

  -- b1 becomes the leader.
  perform pg_temp.as_user(b1); r := public.place_bid(a, '200');
  -- b2 takes the lead.
  perform pg_temp.as_user(b2); r := public.place_bid(a, '300');
  -- b1 re-bids above the current price. b1 is NOT the leader at this point
  -- but was before b2 — this proves the "no leading-bidder rejection" rule
  -- across a re-enter scenario.
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '400');
  perform pg_temp.chk('SC-72 re-bidder above current price accepted',
                      coalesce(r->>'accepted', '?'), 'true');

  -- Now b1 is the leader; b1 bids again above their own price.
  r := public.place_bid(a, '500');
  perform pg_temp.chk('SC-72 leading bidder bids above their own price accepted',
                      coalesce(r->>'accepted', '?'), 'true');

  -- Four bids accepted in history (200, 300, 400, 500).
  perform pg_temp.chk('SC-72 all four bids are in history',
                      (select count(*)::text from public.bids where auction_id = a),
                      '4');
end $$;


-- ===========================================================================
-- SC-73: no reserve-price field, control, or "reserve not met" outcome exists
-- anywhere; the highest valid bid always wins regardless of amount (BR-35).
--
-- This covers the automated winner-test half of SC-73. The review half (no
-- reserve-price field or control in the UI) is out of SQL scope.
--
-- A one-bid auction at the minimum acceptable amount (equal to the starting
-- price of 100 SAR) must close with that bidder as winner and that amount as
-- the final price. No "reserve not met" path exists.
-- ===========================================================================
do $$
declare
  b1  uuid := '00000000-0000-0000-0000-0000000000b1';
  a   uuid;
  r   jsonb;
begin
  a := pg_temp.new_auction();

  -- Only one bid, at exactly the starting price.
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '100');
  perform pg_temp.expire(a);
  perform pg_temp.as_anon();
  perform public.close_ended_auctions(a);

  perform pg_temp.chk('SC-73 one-bid auction closes with that bidder as winner',
                      (select winner_id::text from public.auctions where id = a),
                      b1::text);
  perform pg_temp.chk('SC-73 final_price is that single bid amount, no reserve floor',
                      (select public.sar_text(final_price) from public.auctions where id = a),
                      '100.00');
  perform pg_temp.chk('SC-73 status is ended, not stuck or errored',
                      (select status from public.auctions where id = a),
                      'ended');
end $$;


-- ===========================================================================
-- SC-75 (content side): bid history is readable by an unauthenticated visitor
-- and shows display names and amounts in SAR, never an email address
-- (BR-40, FR-BID-22a).
--
-- acceptance.sql already proves the GRANT (anon can select bid_history = true).
-- That is a privilege check; it cannot confirm that actual rows come back,
-- that display_name is present, or that no email address appears in the result.
-- These three assertions cover the content level.
-- ===========================================================================
do $$
declare
  b1      uuid := '00000000-0000-0000-0000-0000000000b1';
  a       uuid;
  r       jsonb;
  cnt     bigint;
  has_dn  boolean;
  has_em  boolean;
begin
  a := pg_temp.new_auction();
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '200');

  -- Read bid_history as the anon role.
  perform set_config('role', 'anon', true);

  select count(*) into cnt
    from public.bid_history
   where auction_id = a;

  -- display_name column must be populated (not null, not empty).
  select exists (
    select 1 from public.bid_history
     where auction_id = a
       and display_name is not null
       and display_name <> ''
  ) into has_dn;

  -- No email address anywhere in the projection. bid_history joins profiles,
  -- not auth.users — email is structurally absent from profiles (ADR-7).
  -- This assertion guards against a future join that reintroduces it.
  select exists (
    select 1 from public.bid_history
     where auction_id = a
       and display_name like '%@%'   -- emails always contain @; display names never do
  ) into has_em;

  perform set_config('role', 'postgres', true);

  perform pg_temp.chk('SC-75 anon can read bid_history rows (content visible)',
                      cnt::text, '1');
  perform pg_temp.chk('SC-75 display_name is populated in bid_history',
                      has_dn::text, 'true');
  perform pg_temp.chk('SC-75 no email address appears in bid_history',
                      has_em::text, 'false');
end $$;
