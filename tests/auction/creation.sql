-- ============================================================================
-- AUC-19 — auction creation, validation boundaries, and the active-only listing.
--
-- AUC-19's acceptance criteria are explicit that these "exercise the server path
-- directly, bypassing the UI". So every assertion below inserts through the
-- `authenticated` role, which means the table GRANT and then the
-- auctions_owner_insert policy both apply — the same two gates a crafted HTTP
-- request meets. Nothing here calls a validator in lib/auctions/validation.ts:
-- that file is fast feedback, and FR-CREATE-11 / SEC-V6 put the authority on the
-- server. If the TypeScript and the database ever disagree, this suite reports
-- what the database actually does.
--
-- Covers SC-68 (both duration boundaries, inclusive), SC-71 (active-only
-- listing), FR-CREATE-04/05/06/16-18, BR-14, BR-20, BR-21, and the S0-12
-- finiteness clause. SC-39, SC-58 and SC-59 are NOT here — immutability.sql
-- owns them, and a second copy would drift.
--
-- Run via ./run.sh. Keep EXPECTED in run.sh in step with the chk() calls.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

create or replace function pg_temp.chk(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %  (%)', rpad(label, 56), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 56), got, want;
  end if;
end $$;

/* Signs up exactly as GoTrue does, so the AUTH-01 trigger builds the profile. */
create or replace function pg_temp.signup(u uuid, mail text, name text)
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (u, mail, jsonb_build_object('display_name', name));
end $$;

/*
 * One creation attempt as `owner`, through the `authenticated` role.
 *
 * The price is interpolated with %s rather than %L — deliberately. Quoting it
 * would make it a text literal and the cast to sar_amount would happen
 * somewhere this test does not control; unquoted it is a numeric literal of
 * whatever width was passed, which is what lets the BR-21 assertion below use a
 * 40-digit value without the harness itself imposing a ceiling.
 *
 * Each call is its own subtransaction, so a rejection does not abort the
 * assertions after it.
 */
create or replace function pg_temp.try_create(
  owner  uuid,
  ends   timestamptz,
  price  text,
  nm     text    default 'ساعة اختبار',
  descr  text    default 'وصف اختباري طوله كافٍ للحد الأدنى.',
  img    text    default 'test/a.jpg',
  st     text    default 'active',
  cur    text    default null
) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', owner)::text, true);
  execute 'set local role authenticated';
  execute format(
    'insert into public.auctions
       (owner_id, status, end_time, starting_price, current_price, name, description, image_path)
     values (%L, %L, %L, %s, %s, %L, %L, %L)',
    owner, st, ends, price, coalesce(cur, price), nm, descr, img);
  execute 'reset role';
  return 'accepted';
exception when others then
  execute 'reset role';
  return sqlstate;
end $$;

do $$
declare
  seller uuid := '00000000-0000-0000-0000-00000000a001';
  got    text;
  n      integer;
begin
  perform pg_temp.signup(seller, 'auc19-seller@test.local', 'auc19_seller');

  -- ==========================================================================
  -- SC-68 / BR-38 / FR-CREATE-09,10,10a — the duration window, INCLUSIVE at
  -- both ends.
  --
  -- These run inside one transaction, so now() is frozen: the value the policy
  -- compares against is the value used to build the timestamp. That is the
  -- point. The boundary is exact at the database, and this suite proves it —
  -- which is also what isolates the known application-layer gap on #44, where
  -- validation reads Node's clock at T1 and the policy reads PostgreSQL's at
  -- T2 > T1, so an exactly-five-minute auction is refused before it arrives.
  -- The rule is right here; the two-clock sequence in the action is not.
  -- ==========================================================================
  perform pg_temp.chk('SC-68 exactly 5 minutes is accepted',
    pg_temp.try_create(seller, now() + interval '5 minutes', '100'), 'accepted');
  perform pg_temp.chk('SC-68 exactly 7 days is accepted',
    pg_temp.try_create(seller, now() + interval '7 days', '100'), 'accepted');
  perform pg_temp.chk('SC-68 one second under 5 minutes is rejected',
    pg_temp.try_create(seller, now() + interval '5 minutes' - interval '1 second', '100'), '42501');
  perform pg_temp.chk('SC-68 one second over 7 days is rejected',
    pg_temp.try_create(seller, now() + interval '7 days' + interval '1 second', '100'), '42501');

  -- ==========================================================================
  -- FR-CREATE-04 — name, 3 to 100 AFTER trimming.
  --
  -- The untrimmed case is the one worth having: "   ab   " is nine characters
  -- and passes a naive 3-100 length check while carrying a two-character name.
  -- ==========================================================================
  perform pg_temp.chk('FR-CREATE-04 name of 3 characters is accepted',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'أبج'), 'accepted');
  perform pg_temp.chk('FR-CREATE-04 name of 2 characters is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'أب'), '23514');
  perform pg_temp.chk('FR-CREATE-04 name of 100 characters is accepted',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', repeat('x', 100)), 'accepted');
  perform pg_temp.chk('FR-CREATE-04 name of 101 characters is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', repeat('x', 101)), '23514');
  perform pg_temp.chk('FR-CREATE-04 an untrimmed name is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', '   أبج   '), '23514');

  -- ==========================================================================
  -- FR-CREATE-05 — description, 10 to 2000 after trimming.
  -- ==========================================================================
  perform pg_temp.chk('FR-CREATE-05 description of 10 characters is accepted',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم', repeat('y', 10)), 'accepted');
  perform pg_temp.chk('FR-CREATE-05 description of 9 characters is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم', repeat('y', 9)), '23514');
  perform pg_temp.chk('FR-CREATE-05 description of 2000 characters is accepted',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم', repeat('y', 2000)), 'accepted');
  perform pg_temp.chk('FR-CREATE-05 description of 2001 characters is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم', repeat('y', 2001)), '23514');
  perform pg_temp.chk('FR-CREATE-05 an untrimmed description is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم', '  ' || repeat('y', 20) || '  '), '23514');

  -- ==========================================================================
  -- The money rules — sar_amount, S0-12. Each clause of the domain, separately.
  --
  -- The NaN assertion is the one that looks redundant and is not: PostgreSQL
  -- `numeric` accepts NaN, and NaN > 0 and NaN = round(NaN, 2) are BOTH true.
  -- Only `VALUE < 'Infinity'` refuses it. An accepted NaN starting price makes
  -- the auction permanently unwinnable (S0-12 §8.1), so if someone ever
  -- "simplifies" that clause, this line is what says so.
  -- ==========================================================================
  perform pg_temp.chk('BR-20 a starting price of zero is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '0'), '23514');
  perform pg_temp.chk('NFR-DAT-05 three decimals is REJECTED, never rounded',
    pg_temp.try_create(seller, now() + interval '1 hour', '10.001'), '23514');
  perform pg_temp.chk('S0-12 NaN is rejected by the finiteness clause',
    pg_temp.try_create(seller, now() + interval '1 hour', '''NaN'''), '23514');

  /*
   * BR-21 / SEC-R3 / FR-CREATE-07 — THERE IS NO MAXIMUM. A forty-digit starting
   * price is a legal value and must be stored exactly. This is the assertion
   * that fails the moment somebody "tightens" sar_amount to numeric(12,2) —
   * which S0-12 names as the single most likely hygiene refactor on this
   * codebase, and as a violation rather than hygiene.
   */
  perform pg_temp.chk('BR-21 a 40-digit starting price is accepted',
    pg_temp.try_create(seller, now() + interval '1 hour',
                       '1234567890123456789012345678901234567890.99'), 'accepted');

  -- ==========================================================================
  -- Birth state — the policy's WITH CHECK, which is what a crafted request meets.
  -- ==========================================================================
  perform pg_temp.chk('FR-CREATE-28 current price must equal the starting price',
    pg_temp.try_create(seller, now() + interval '1 hour', '100',
                       'اسم', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg',
                       'active', '999'), '42501');
  perform pg_temp.chk('BR-14 an auction cannot be created already ended',
    pg_temp.try_create(seller, now() + interval '1 hour', '100',
                       'اسم', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg',
                       'ended'), '42501');

  /*
   * SEC-Z6 — no user pre-sets an outcome. Inline rather than through the helper
   * because it is the only case that needs a column the helper does not take,
   * and widening the helper for one caller would make every other call noisier.
   */
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', seller)::text, true);
    set local role authenticated;
    insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                                 name, description, image_path, winner_id)
    values (seller, 'active', now() + interval '1 hour', 100, 100,
            'اسم', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg', seller);
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SEC-Z6 a winner cannot be pre-set at creation', got, '42501');

  -- ==========================================================================
  -- FR-CREATE-15 — image_path is a storage KEY, never a URL.
  --
  -- Storing a URL would let a seller point a listing at an arbitrary remote
  -- origin, so the shape constraint is a security control rather than tidiness.
  -- ==========================================================================
  perform pg_temp.chk('FR-CREATE-15 an image_path with a scheme is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم',
                       'وصف اختباري طوله كافٍ للحد الأدنى.', 'https://evil.example/x.jpg'), '23514');
  perform pg_temp.chk('FR-CREATE-15 an absolute image_path is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم',
                       'وصف اختباري طوله كافٍ للحد الأدنى.', '/etc/passwd'), '23514');
  perform pg_temp.chk('FR-CREATE-15 a traversing image_path is rejected',
    pg_temp.try_create(seller, now() + interval '1 hour', '100', 'اسم',
                       'وصف اختباري طوله كافٍ للحد الأدنى.', 'a/../../b.jpg'), '23514');

  -- ==========================================================================
  -- SC-71 / FR-LIST-05 — the listing shows ACTIVE auctions only, and the filter
  -- is TWO conditions.
  --
  -- The second row below is the one that matters. `status = 'active'` alone is
  -- not enough: the closing sweep runs on a schedule (BID-15), so there is a
  -- window in which the end time has passed and the flag still says active. A
  -- listing gated on the flag alone keeps a finished auction on the marketplace
  -- with a countdown reading 00:00:00. Written as postgres because no user role
  -- can produce either row.
  -- ==========================================================================
  insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                               name, description, image_path)
  values (seller, 'ended', now() + interval '3 hours', 100, 100,
          'منتهٍ صراحةً', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/ended.jpg'),
         (seller, 'active', now() - interval '1 minute', 100, 100,
          'انقضى وقته', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/expired.jpg');

  select count(*) into n
    from public.auctions
   where status = 'active' and end_time > now()
     and name in ('منتهٍ صراحةً', 'انقضى وقته');
  perform pg_temp.chk('SC-71 neither an ended nor an expired auction is listed',
                      n::text, '0');

  select count(*) into n from public.auctions where name = 'انقضى وقته';
  perform pg_temp.chk('FR-END-12 an unlisted auction is still readable by id',
                      n::text, '1');
end $$;
