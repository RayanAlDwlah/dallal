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
  em_ctl  boolean;
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

  -- Positive control for the no-email assertion below: it can only ever fail
  -- if the fixture bidder's email actually contains '@'. That is true today
  -- (b1 = 'v1-bidder1@test.local', seeded from BID-02-bid-operation.md), but
  -- nothing guarded it — reseed b1 with an @-less email, or no email at all,
  -- and the negative assertion passes vacuously forever (#117). This control
  -- turns "able to fail" from a fact someone once read into an assertion that
  -- fails loudly. Read as postgres: anon cannot (and must not) see auth.users.
  select exists (
    select 1 from auth.users
     where id = b1
       and email like '%@%'
  ) into em_ctl;

  perform pg_temp.chk('SC-75 anon can read bid_history rows (content visible)',
                      cnt::text, '1');
  perform pg_temp.chk('SC-75 display_name is populated in bid_history',
                      has_dn::text, 'true');
  perform pg_temp.chk('SC-75 control: fixture bidder email contains @',
                      em_ctl::text, 'true');
  perform pg_temp.chk('SC-75 no email address appears in bid_history',
                      has_em::text, 'false');
end $$;


-- ===========================================================================
-- SC-15 — no mechanism to edit or delete a bid (BR-05, SEC-I1).
--
-- This criterion was marked COVERED in docs/BID-21-traceability.md citing
-- closing.sql's "SC-33 closing does not touch bid history" and an
-- "append-only trigger test" in acceptance.sql. Neither claim survives
-- reading: SC-33 asserts that ONE code path leaves history alone, which is
-- not the same as no path existing, and the only mention of
-- bids_are_append_only in the whole suite is inside closing.sql's
-- search_path assertion — that proves the function pins search_path, not
-- that it refuses anything. `grep -rn 'SC-15' tests/` returned nothing.
--
-- The property has TWO independent gates and the distinction matters:
--   * the grant gate  — authenticated/anon hold no UPDATE or DELETE on
--     public.bids, so the product roles are refused with 42501 before any
--     row is examined;
--   * the trigger     — bids_are_append_only raises unconditionally, so a
--     role that BYPASSES grants and RLS (postgres, service_role) is still
--     refused, with P0001.
--
-- Asserting only the first would make the guarantee depend on a GRANT that a
-- future migration could hand out without anyone noticing the criterion
-- broke. Asserting only the second would not prove the product path is shut.
-- Both are asserted, and the row is re-read afterwards so that "refused"
-- means "unchanged", not merely "raised".
-- ===========================================================================
do $$
declare
  b1  uuid := '00000000-0000-0000-0000-0000000000b1';
  a   uuid;
  r   jsonb;
  v_bid bigint;
  got text;
begin
  a := pg_temp.new_auction();
  perform pg_temp.as_user(b1);
  r := public.place_bid(a, '150');

  -- Premise. Without this the four assertions below can pass vacuously
  -- against zero rows (#117: a negative assertion with no subject always
  -- holds).
  perform pg_temp.chk('SC-15 control: a bid exists to attempt to edit',
                      coalesce(r->>'accepted', '?'), 'true');
  select id into v_bid from public.bids where auction_id = a;

  -- Gate 1 — the product role. The bidder attacks their OWN bid: if any
  -- ownership-based exception existed, this is where it would show.
  begin
    perform pg_temp.as_user(b1);
    set local role authenticated;
    update public.bids set amount = 999 where id = v_bid;
    got := 'ACCEPTED';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SC-15 bidder cannot UPDATE own bid (grant gate)',
                      got, '42501');

  begin
    perform pg_temp.as_user(b1);
    set local role authenticated;
    delete from public.bids where id = v_bid;
    got := 'ACCEPTED';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SC-15 bidder cannot DELETE own bid (grant gate)',
                      got, '42501');

  -- Gate 2 — no role at all. This block runs as the suite's own superuser,
  -- which bypasses both the grant gate and RLS; only the trigger can refuse
  -- it. P0001 is bids_are_append_only's bare `raise exception`.
  begin
    update public.bids set amount = 999 where id = v_bid;
    got := 'ACCEPTED';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.chk('SC-15 UPDATE refused even bypassing grants (trigger)',
                      got, 'P0001');

  begin
    delete from public.bids where id = v_bid;
    got := 'ACCEPTED';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.chk('SC-15 DELETE refused even bypassing grants (trigger)',
                      got, 'P0001');

  -- "Refused" must mean the row is untouched. A raise that fired AFTER the
  -- write would still be caught above.
  perform pg_temp.chk('SC-15 the bid row is unchanged after all four attempts',
                      (select public.sar_text(amount) from public.bids where id = v_bid),
                      '150.00');
end $$;
