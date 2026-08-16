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

-- ---------------------------------------------------------------------------
-- The session path. Same convention, same reasons — see `sessions.sql`.
--
-- Sessions carry NO publish guard (auctions do), so a status is written
-- directly here. That is setup, never an assertion: nothing in `sessions.sql`
-- claims a session reached `live` through the product, and the two blocks that
-- DO exercise the product's own transitions — `open_next_lot`, `host_next_lot`,
-- `advance_session`, `end_session` — build their state with these and then call
-- the real function.
-- ---------------------------------------------------------------------------

create or replace function t_session(
  p_status     text default 'live',
  p_entry_mode text default 'deposit',
  p_start      timestamptz default now() - interval '1 minute',
  p_host       uuid default '11111111-1111-1111-1111-111111111111'
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.sessions
    (host_id, title, description, city, start_time, deposit, entry_mode, status)
  values
    (p_host, 'جلسة اختبار',
     'وصف طويل بما يكفي لتجاوز الحد الأدنى البالغ عشرين حرفًا في القيد.',
     'الرياض', p_start, '500.00'::public.sar_amount, p_entry_mode, p_status)
  returning id into v_id;
  return v_id;
end $$;

-- One lot, at the next free position.
--
-- `p_duration => null` is V2.1's OPEN-ENDED lot («بدون مدة»), and the end_time
-- this computes is the one `open_next_lot` computes: `now() + duration` for a
-- timed lot, and NULL for an open-ended one, because `make_interval(secs =>
-- null)` is null and `now() + null` is null. A live lot with a null end_time is
-- therefore a REAL state the product reaches, not a shape invented here — which
-- is the whole reason the null-guard branch exists to be tested.
create or replace function t_lot(
  p_session  uuid,
  p_start    text default '100.00',
  p_inc      text default '10',
  p_duration integer default 600,
  p_status   text default 'live',
  p_end      timestamptz default null
) returns uuid language plpgsql as $$
declare v_id uuid; v_pos integer; v_end timestamptz;
begin
  select coalesce(max(position), 0) + 1 into v_pos
  from public.session_lots where session_id = p_session;

  if p_end is not null then
    v_end := p_end;
  elsif p_status = 'live' and p_duration is not null then
    v_end := now() + make_interval(secs => p_duration);
  else
    v_end := null;
  end if;

  insert into public.session_lots
    (session_id, position, title, description, category_id, images,
     starting_price, bid_increment, duration_seconds, status, end_time)
  values
    (p_session, v_pos, 'قطعة اختبار', 'وصف القطعة في جلسة الاختبار.',
     (select id from public.categories order by id limit 1),
     array['11111111-1111-1111-1111-111111111111/a.jpg'],
     p_start::public.sar_amount, p_inc::public.sar_increment,
     p_duration, p_status, v_end)
  returning id into v_id;
  return v_id;
end $$;

-- Point a session at its open lot, the way `open_next_lot` would have. Setup
-- only — the blocks that test `open_next_lot` itself still call it.
create or replace function t_current(s uuid, l uuid) returns void
language sql as $$
  update public.sessions set current_lot_id = l where id = s;
$$;

-- Move a lot's end_time without going through place_lot_bid — same reasoning as
-- t_expire() above, and the same warning: the mechanism under test must never
-- be the mechanism that sets up the test.
create or replace function t_lot_end(l uuid, p_end timestamptz) returns void
language sql as $$
  update public.session_lots set end_time = p_end where id = l;
$$;

-- A seat in the hall. `approved` is what gates BIDDING; watching is never
-- gated. `t_entry(s, u, false)` is the invite-only case before the host acts.
create or replace function t_entry(s uuid, u uuid, ok boolean default true) returns void
language sql as $$
  insert into public.session_entries (session_id, user_id, deposit_paid, approved)
  values (s, u, ok, ok)
  on conflict (session_id, user_id) do update set approved = excluded.approved;
$$;

create or replace function t_lot_bid(l uuid, who uuid, amount text) returns jsonb
language plpgsql as $$
declare r jsonb;
begin
  perform t_login(who);
  select public.place_lot_bid(l, amount) into r;
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
