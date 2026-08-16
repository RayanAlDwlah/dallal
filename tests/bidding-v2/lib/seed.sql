-- ============================================================================
-- Test-only fixtures. NOT part of any migration, and deliberately separate.
--
-- Everything here writes `auth.users` directly with reserved UUIDs — something
-- the product never does, because GoTrue owns that table. Keeping it out of the
-- migration list is what makes "the migrations applied cleanly" a real
-- statement about production rather than a statement about this container.
--
-- The profiles are NOT inserted. They arrive through `on_auth_user_created`,
-- which is the shipped trigger — so the first thing this file proves, before a
-- single assertion runs, is that signup produces an identity. If the trigger
-- were broken, every later suite would fail on a missing foreign key rather
-- than passing quietly.
--
-- UUID convention: 1111… seller, 2222… bidder A, 3333… bidder B, 4444… a third
-- bidder used only by the concurrency runner. Readable in a psql error, and
-- collision-free against gen_random_uuid().
-- ============================================================================

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'seller@example.test',  '{"display_name":"بائع الاختبار"}'),
  ('22222222-2222-2222-2222-222222222222', 'buyer-a@example.test', '{"display_name":"مزايد أ"}'),
  ('33333333-3333-3333-3333-333333333333', 'buyer-b@example.test', '{"display_name":"مزايد ب"}'),
  -- No display_name: exercises handle_new_user's fallback to the email's local
  -- part. Asserted in acceptance.sql rather than assumed here.
  ('44444444-4444-4444-4444-444444444444', 'buyer-c@example.test', '{}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers the suites share. `t_*` so nothing here can be mistaken for product
-- code in a grep, and so a stray one left in a migration is obvious.
-- ---------------------------------------------------------------------------

-- Become a user, the way PostgREST does it: place the JWT claims into the
-- session setting auth.uid() reads. `t_login(null)` is the anonymous caller.
create or replace function t_login(u uuid) returns void language plpgsql as $$
begin
  if u is null then
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  end if;
end $$;

-- One published auction, with every NOT NULL the guard demands at publish time.
-- `p_end` is a MOMENT, not a duration, so a caller can place it inside the
-- 15-second window on purpose. The guard rejects a publish less than five
-- minutes out, so anything closer is inserted as `draft` and then moved by
-- t_expire(): the guard runs on the publish transition, not on every update.
create or replace function t_auction(
  p_start   text,
  p_inc     text,
  p_end     timestamptz default now() + interval '1 hour',
  p_status  text default 'active'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.auctions
    (seller_id, title, description, category_id, images,
     starting_price, bid_increment, status, end_time)
  values
    ('11111111-1111-1111-1111-111111111111',
     'سلعة اختبار',
     'وصف طويل بما يكفي لتجاوز الحد الأدنى البالغ عشرين حرفًا في القيد.',
     (select id from public.categories order by id limit 1),
     array['11111111-1111-1111-1111-111111111111/a.jpg'],
     p_start::public.sar_amount, p_inc::public.sar_increment, p_status, p_end)
  returning id into v_id;
  return v_id;
end $$;

-- Move an auction's end_time without going through place_bid. Used to set up
-- the "time has passed but finalize has not run" window, and to place an
-- auction inside the final 15 seconds without waiting for them.
--
-- It writes the column directly, which is exactly what NO product path does —
-- and that is the point: `end_time moves forward only inside place_bid` is an
-- assertion this suite makes, so the setup for it must not use the mechanism
-- under test. The auctions_guard trigger still runs and still bumps
-- updated_at; it does not gate an already-active auction's end_time.
create or replace function t_expire(a uuid, p_end timestamptz) returns void
language sql as $$
  update public.auctions set end_time = p_end where id = a;
$$;

-- place_bid returns jsonb; every assertion below wants one field of it.
create or replace function t_bid(a uuid, who uuid, amount text) returns jsonb
language plpgsql as $$
declare r jsonb;
begin
  perform t_login(who);
  select public.place_bid(a, amount) into r;
  return r;
end $$;

-- The assertion primitive. Prints exactly one PASS or FAIL line per call, and
-- the run.sh harness counts those lines against an EXPECTED total — so a DO
-- block that aborts partway is caught by the count rather than reported as a
-- clean run. Never make this swallow an exception: an assertion that cannot
-- crash cannot tell you the function under test crashed.
create or replace function t_chk(label text, got anyelement, want anyelement)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %', label;
  else
    raise notice 'FAIL  %  — got [%], want [%]', label, got, want;
  end if;
end $$;
