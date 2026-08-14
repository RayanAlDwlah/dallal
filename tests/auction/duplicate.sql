-- ============================================================================
-- AUC-03 — duplicate-submission prevention (#45).
--
-- EC-21 · FR-CREATE-26a · ARCHITECTURE §12.3 · PRD.md:1094
--
-- WHY THIS SUITE EXISTS AT THE DATABASE AND NOT IN THE COMPONENT
--
-- The review step and the disabled button in create-auction-form.tsx are the
-- visible half of AUC-03 and they are NOT what makes EC-21 hold. A double-click
-- on the confirm button issues two concurrent requests; neither one can see the
-- other, and no amount of React state prevents the second. What prevents it is
-- auctions_one_per_submission, so that is what gets asserted.
--
-- Everything below inserts through the `authenticated` role, the same two gates
-- a crafted HTTP request meets: the table GRANT, then auctions_owner_insert.
-- Nothing here calls isSubmissionKey() — that file is fast feedback and the
-- database is the authority (SEC-V6), exactly as creation.sql states.
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
 * One creation attempt carrying an explicit intent key.
 *
 * `key` is nullable on purpose: passing NULL omits the column entirely, which
 * is how a caller that does not send a key at all is modelled. That path must
 * keep working — see the DEFAULT assertions below.
 */
create or replace function pg_temp.try_create(
  owner uuid,
  key   uuid,
  nm    text default 'ساعة اختبار',
  ends  timestamptz default null
) returns text language plpgsql as $$
declare
  v_ends timestamptz := coalesce(ends, now() + interval '1 hour');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', owner)::text, true);
  execute 'set local role authenticated';

  if key is null then
    execute format(
      'insert into public.auctions
         (owner_id, status, end_time, starting_price, current_price, name, description, image_path)
       values (%L, %L, %L, 100, 100, %L, %L, %L)',
      owner, 'active', v_ends, nm, 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg');
  else
    execute format(
      'insert into public.auctions
         (owner_id, status, end_time, starting_price, current_price, name, description, image_path, submission_key)
       values (%L, %L, %L, 100, 100, %L, %L, %L, %L)',
      owner, 'active', v_ends, nm, 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg', key);
  end if;

  execute 'reset role';
  return 'accepted';
exception when others then
  execute 'reset role';
  return sqlstate;
end $$;

do $$
declare
  seller   uuid := '00000000-0000-0000-0000-00000000b001';
  other    uuid := '00000000-0000-0000-0000-00000000b002';
  intent   uuid := '11111111-1111-4111-8111-111111111111';
  intent2  uuid := '22222222-2222-4222-8222-222222222222';
  n        integer;
  d        integer;
begin
  perform pg_temp.signup(seller, 'auc03-seller@test.local', 'auc03_seller');
  perform pg_temp.signup(other,  'auc03-other@test.local',  'auc03_other');

  -- ==========================================================================
  -- EC-21 — the core guarantee: one intent, one auction.
  --
  -- The second insert is what a double-clicked confirm button and a
  -- retry-after-timeout both look like at the database. 23505 is the unique
  -- violation the action reads as "already published" and turns into the same
  -- redirect the first request got.
  -- ==========================================================================
  perform pg_temp.chk('EC-21 the first submission of an intent is accepted',
    pg_temp.try_create(seller, intent), 'accepted');
  perform pg_temp.chk('EC-21 replaying the same intent is refused',
    pg_temp.try_create(seller, intent), '23505');

  select count(*) into n from public.auctions
   where owner_id = seller and submission_key = intent;
  perform pg_temp.chk('EC-21 exactly one auction exists for that intent',
    n::text, '1');

  -- The replay is refused even when every other field differs. The unit of
  -- deduplication is the INTENT, not the content — a seller who edits the name
  -- and resubmits the same intent still has one auction, not two.
  perform pg_temp.chk('EC-21 a replay with different content is still refused',
    pg_temp.try_create(seller, intent, 'اسم مختلف تمامًا'), '23505');

  -- ==========================================================================
  -- The other direction, and it matters as much: the guard must not eat real
  -- auctions. Nothing in the PRD forbids listing two identical items, so
  -- identical CONTENT under a fresh intent is a normal, accepted creation.
  -- A content-hash constraint would fail this assertion, which is why the key
  -- is per-intent (see the migration's header).
  -- ==========================================================================
  perform pg_temp.chk('EC-21 identical content under a NEW intent is accepted',
    pg_temp.try_create(seller, intent2, 'ساعة اختبار'), 'accepted');

  -- ==========================================================================
  -- Owner scoping — the constraint is (owner_id, submission_key).
  --
  -- Every column of public.auctions is publicly readable (BR-40, FR-LIST-01),
  -- so a submission_key is not a secret. Globally unique, that would be a
  -- denial-of-service: read a key off the listing and burn it before its owner
  -- retries. Scoped to the owner, the same key under a different owner is a
  -- different row and the attack does nothing.
  -- ==========================================================================
  perform pg_temp.chk('SEC the same key under a DIFFERENT owner is accepted',
    pg_temp.try_create(other, intent), 'accepted');

  select count(*) into n from public.auctions where submission_key = intent;
  perform pg_temp.chk('SEC one auction per owner for a shared key',
    n::text, '2');

  -- ==========================================================================
  -- The DEFAULT — an insert that sends no key at all.
  --
  -- This is the assertion that catches the plausible-looking mistake. If the
  -- column were nullable, or defaulted to a constant, every key-less insert
  -- would collide with every other one and the seller's SECOND auction through
  -- that path would be silently refused as a "duplicate". A guard that eats
  -- real auctions is worse than the duplicate it prevents.
  -- ==========================================================================
  perform pg_temp.chk('DEFAULT an insert with no key is accepted',
    pg_temp.try_create(seller, null, 'بلا مفتاح ١'), 'accepted');
  perform pg_temp.chk('DEFAULT a SECOND insert with no key is also accepted',
    pg_temp.try_create(seller, null, 'بلا مفتاح ٢'), 'accepted');

  select count(distinct submission_key) into d from public.auctions
   where owner_id = seller and name like 'بلا مفتاح%';
  perform pg_temp.chk('DEFAULT the two key-less rows got distinct keys',
    d::text, '2');

  select count(*) into n from public.auctions where submission_key is null;
  perform pg_temp.chk('DEFAULT no row anywhere has a null key',
    n::text, '0');

  -- ==========================================================================
  -- Immutability of the key is NOT asserted here. immutability.sql owns SC-58
  -- and its completeness guard already forced an assertion for this column the
  -- moment it landed. A second copy would be the drift creation.sql's header
  -- warns about, and the copy that goes stale is never the one you are reading.
  -- ==========================================================================

  -- ==========================================================================
  -- S0-11 §10.3 — the column exists on the record and is NOT one of the six
  -- read fields. Nothing in the bid path may come to depend on it.
  -- ==========================================================================
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'auctions'
     and column_name = 'submission_key' and is_nullable = 'NO';
  perform pg_temp.chk('S0-11 submission_key is present and NOT NULL',
    n::text, '1');

  select count(*) into n
    from pg_constraint
   where conname = 'auctions_one_per_submission' and contype = 'u';
  perform pg_temp.chk('EC-21 the guarantee is a UNIQUE constraint, not an if',
    n::text, '1');
end $$;
