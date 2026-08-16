-- ============================================================================
-- دلال v2 — core schema
-- Tables, domains, indexes, triggers, RLS, atomic bidding, finalization,
-- storage buckets + policies, realtime publication, pg_cron schedule.
-- ============================================================================

-- ---------- money domains ---------------------------------------------------

-- No ceiling of any kind: unconstrained numeric (no typmod), exactly 2dp,
-- strictly positive. 'Infinity'/NaN are rejected (NaN = round(NaN) is TRUE in
-- PostgreSQL, but NaN < 'Infinity' is FALSE — that clause is load-bearing).
create domain public.sar_amount as numeric
  check (value > 0 and value = round(value, 2) and value < 'Infinity'::numeric);

-- Seller-chosen bid increment: positive whole multiples of 10 (per the
-- approved create-auction design: «المبلغ لازم يكون من مضاعفات العشرة»).
create domain public.sar_increment as numeric
  check (value > 0 and value = round(value, 0) and value % 10 = 0 and value < 'Infinity'::numeric);

-- ---------- profiles --------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public identity. Display name is the ONLY public identity — email never leaves the auth schema.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  v_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
  if char_length(v_name) < 2 then
    v_name := left(split_part(coalesce(new.email, ''), '@', 1), 40);
  end if;
  if char_length(v_name) < 2 then
    v_name := 'مستخدم';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- categories ------------------------------------------------------

create table public.categories (
  id bigint generated always as identity primary key,
  name_ar text not null,
  slug text not null unique,
  parent_id bigint references public.categories (id) on delete cascade,
  icon text,
  -- Optional, category-specific attribute field labels shown in the create
  -- form and on the auction page. Data-driven — never hard-coded in the UI.
  fields jsonb not null default '[]'::jsonb,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index categories_parent_idx on public.categories (parent_id, sort);

-- ---------- auctions --------------------------------------------------------

-- Image values are storage KEYS inside the auction-images bucket, never URLs.
create or replace function public.valid_image_paths(paths text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    bool_and(p ~ '^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$' and p !~ '\.\.'),
    true
  )
  from unnest(paths) as p;
$$;

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  category_id bigint not null references public.categories (id),
  images text[] not null default '{}'
    check (coalesce(array_length(images, 1), 0) <= 10 and public.valid_image_paths(images)),
  attributes jsonb not null default '{}'::jsonb,
  starting_price public.sar_amount not null,
  current_price public.sar_amount,
  bid_increment public.sar_increment not null,
  bid_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  start_time timestamptz,
  end_time timestamptz not null,
  extension_count integer not null default 0 check (extension_count between 0 and 20),
  winner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index auctions_active_end_idx on public.auctions (end_time) where status = 'active';
create index auctions_status_idx on public.auctions (status);
create index auctions_end_time_idx on public.auctions (end_time);
create index auctions_category_idx on public.auctions (category_id) where status = 'active';
create index auctions_seller_idx on public.auctions (seller_id);

-- Lifecycle guard: publish-time validation + forbidden transitions.
create or replace function public.auctions_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'ended' then
      raise exception 'auction_immutable' using errcode = 'P0001';
    end if;
    if old.status = 'active' and new.status = 'draft' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
  end if;

  -- The publish moment (insert as active, or draft → active).
  if new.status = 'active' and (tg_op = 'INSERT' or old.status = 'draft') then
    if coalesce(array_length(new.images, 1), 0) < 1 then
      raise exception 'images_required' using errcode = 'P0001';
    end if;
    if new.end_time < clock_timestamp() + interval '5 minutes' then
      raise exception 'end_time_too_soon' using errcode = 'P0001';
    end if;
    new.start_time := coalesce(new.start_time, now());
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger auctions_guard
  before insert or update on public.auctions
  for each row execute function public.auctions_guard();

-- ---------- bids ------------------------------------------------------------

-- History order is bids.id, never created_at: created_at defaults to now()
-- (= transaction start, before the bid queued on the row lock), so under
-- contention it can render a decreasing history. id follows lock order.
create table public.bids (
  id bigint generated always as identity primary key,
  auction_id uuid not null references public.auctions (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete cascade,
  amount public.sar_amount not null,
  created_at timestamptz not null default now()
);

create index bids_auction_idx on public.bids (auction_id, id desc);
create index bids_bidder_idx on public.bids (bidder_id, id desc);

-- ---------- notifications ---------------------------------------------------

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('outbid', 'won', 'sold', 'ended_no_bids')),
  auction_id uuid references public.auctions (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, id desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------- atomic bidding --------------------------------------------------

-- The ONLY write path for bids. Locks the auction row, validates against the
-- server clock and the locked current price, applies the anti-snipe extension
-- (an ACCEPTED bid in the final 15s moves end_time +30s, max 20 times),
-- inserts the bid, updates the auction and notifies the outbid leader —
-- atomically. Client-side amounts are never trusted beyond "is it enough".
create or replace function public.place_bid(p_auction_id uuid, p_amount text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_a public.auctions%rowtype;
  v_amount numeric;
  v_min numeric;
  v_now timestamptz := clock_timestamp();
  v_prev_leader uuid;
  v_new_end timestamptz;
  v_ext integer;
  v_bid_id bigint;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  begin
    v_amount := p_amount::numeric;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end;
  if not (v_amount > 0 and v_amount = round(v_amount, 2) and v_amount < 'Infinity'::numeric) then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  select * into v_a from public.auctions where id = p_auction_id for update;

  if not found or v_a.status = 'draft' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_a.seller_id = v_user then
    return jsonb_build_object('ok', false, 'error', 'own_auction');
  end if;
  -- Eligibility is the server clock against end_time, never the status flag
  -- alone: there is a window where time has passed but finalize has not run.
  if v_a.status = 'ended' or v_a.end_time <= v_now then
    return jsonb_build_object('ok', false, 'error', 'ended');
  end if;

  if v_a.current_price is null then
    v_min := v_a.starting_price;          -- first bid may EQUAL the start
  else
    v_min := v_a.current_price + v_a.bid_increment;
  end if;

  if v_amount < v_min then
    return jsonb_build_object(
      'ok', false, 'error', 'too_low',
      'min_amount', v_min::text,
      'current_price', v_a.current_price::text
    );
  end if;

  v_prev_leader := (
    select bidder_id from public.bids
    where auction_id = p_auction_id
    order by id desc limit 1
  );

  v_new_end := v_a.end_time;
  v_ext := v_a.extension_count;
  if v_a.end_time - v_now <= interval '15 seconds' and v_a.extension_count < 20 then
    v_new_end := v_a.end_time + interval '30 seconds';
    v_ext := v_a.extension_count + 1;
  end if;

  insert into public.bids (auction_id, bidder_id, amount)
  values (p_auction_id, v_user, v_amount)
  returning id into v_bid_id;

  update public.auctions
  set current_price = v_amount,
      bid_count = bid_count + 1,
      end_time = v_new_end,
      extension_count = v_ext
  where id = p_auction_id;

  if v_prev_leader is not null and v_prev_leader <> v_user then
    insert into public.notifications (user_id, type, auction_id, payload)
    values (
      v_prev_leader, 'outbid', p_auction_id,
      jsonb_build_object(
        'title', v_a.title,
        'amount', v_amount::text,
        'increment', v_a.bid_increment::text
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'bid_id', v_bid_id,
    'current_price', v_amount::text,
    'end_time', v_new_end,
    'extension_count', v_ext,
    'extended', v_ext > v_a.extension_count
  );
end;
$$;

revoke all on function public.place_bid(uuid, text) from public, anon;
grant execute on function public.place_bid(uuid, text) to authenticated;

-- ---------- finalization ----------------------------------------------------

-- Idempotent single-auction finalize. Safe for anyone to call: it only acts
-- when the auction is genuinely past its end time on the server clock.
create or replace function public.finalize_auction(p_auction_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.auctions%rowtype;
  v_winner uuid;
  v_winner_name text;
begin
  select * into v_a
  from public.auctions
  where id = p_auction_id
  for update skip locked;

  if not found or v_a.status <> 'active' or v_a.end_time > clock_timestamp() then
    return false;
  end if;

  v_winner := (
    select bidder_id from public.bids
    where auction_id = p_auction_id
    order by id desc limit 1
  );

  update public.auctions
  set status = 'ended', winner_id = v_winner
  where id = p_auction_id;

  if v_winner is not null then
    select display_name into v_winner_name from public.profiles where id = v_winner;

    insert into public.notifications (user_id, type, auction_id, payload)
    values
      (v_winner, 'won', p_auction_id,
        jsonb_build_object('title', v_a.title, 'amount', v_a.current_price::text)),
      (v_a.seller_id, 'sold', p_auction_id,
        jsonb_build_object('title', v_a.title, 'amount', v_a.current_price::text,
                           'winner_name', v_winner_name));
  else
    insert into public.notifications (user_id, type, auction_id, payload)
    values (v_a.seller_id, 'ended_no_bids', p_auction_id,
      jsonb_build_object('title', v_a.title));
  end if;

  return true;
end;
$$;

grant execute on function public.finalize_auction(uuid) to anon, authenticated;

-- Bulk sweep, called by pg_cron. Not callable by clients.
create or replace function public.finalize_expired_auctions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  v_count integer := 0;
begin
  for rec in
    select id from public.auctions
    where status = 'active' and end_time <= clock_timestamp()
  loop
    if public.finalize_auction(rec.id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.finalize_expired_auctions() from public, anon, authenticated;

-- A sweeper keeps «ended» true even for an auction nobody is watching. It is
-- a backstop, not the mechanism: finalize_auction() also runs on page load and
-- when a viewer's countdown hits zero, and bidding eligibility never trusts
-- the status flag anyway (place_bid compares the server clock to end_time).
-- pg_cron is therefore optional — a project without it stays correct.
do $$
begin
  create extension if not exists pg_cron;

  begin
    perform cron.schedule(
      'finalize-expired-auctions', '30 seconds',
      $cron$ select public.finalize_expired_auctions(); $cron$
    );
  exception when others then
    perform cron.schedule(
      'finalize-expired-auctions', '* * * * *',
      $cron$ select public.finalize_expired_auctions(); $cron$
    );
  end;
exception when others then
  raise notice 'pg_cron unavailable (%) — relying on on-demand finalization', sqlerrm;
end;
$$;

-- ---------- data API grants -------------------------------------------------

-- Explicit, so the schema is self-contained: new Supabase projects do NOT
-- auto-expose tables to the Data API roles. RLS below still decides which
-- ROWS each role may touch; these grants only decide which VERBS exist.
-- Note what is deliberately absent: no insert/update/delete on bids, ever —
-- the only door into that table is place_bid().
grant usage on schema public to anon, authenticated;

-- valid_image_paths() is called from a CHECK constraint, which evaluates as
-- the INSERTING role — without this, a seller's insert fails permission-denied
-- on a project where new functions are not auto-exposed.
grant execute on function public.valid_image_paths(text[]) to anon, authenticated;

grant select on public.categories to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant select on public.auctions to anon, authenticated;
grant insert, update, delete on public.auctions to authenticated;
grant select on public.bids to anon, authenticated;
grant select, update on public.notifications to authenticated;

-- ---------- row level security ----------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.auctions enable row level security;
alter table public.bids enable row level security;
alter table public.notifications enable row level security;

-- profiles: display identity is public; only the owner updates their row.
create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- categories: read-only reference data (written by migrations only).
create policy "categories are publicly readable"
  on public.categories for select using (true);

-- auctions: drafts visible to their owner only; owner edits drafts only
-- (published auctions are immutable to clients — bids/finalize go through
-- SECURITY DEFINER functions which are not subject to these policies).
create policy "active and ended auctions are publicly readable"
  on public.auctions for select
  using (status in ('active', 'ended') or seller_id = auth.uid());
create policy "users create own auctions"
  on public.auctions for insert to authenticated
  with check (seller_id = auth.uid() and status in ('draft', 'active'));
create policy "owners update own drafts"
  on public.auctions for update to authenticated
  using (seller_id = auth.uid() and status = 'draft')
  with check (seller_id = auth.uid() and status in ('draft', 'active'));
create policy "owners delete own drafts"
  on public.auctions for delete to authenticated
  using (seller_id = auth.uid() and status = 'draft');

-- bids: readable (they only exist for published auctions); NO client write
-- path — the only door is place_bid().
create policy "bids are publicly readable"
  on public.bids for select using (true);

-- notifications: strictly private; clients may only mark their own as read.
create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "users update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- storage ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('auction-images', 'auction-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Uploads go to a folder named by the uploader's uid; nobody touches another
-- user's assets. Public read is served by the public bucket flag.
create policy "public read of public buckets"
  on storage.objects for select
  using (bucket_id in ('auction-images', 'avatars'));

create policy "users upload into own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('auction-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own objects"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('auction-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('auction-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- realtime --------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  alter publication supabase_realtime add table public.auctions;
  alter publication supabase_realtime add table public.bids;
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then
  null;
end;
$$;

-- Realtime UPDATE payloads carry the primary key by default; the app refetches
-- through PostgREST on every event (money must arrive as ::text), so the
-- default REPLICA IDENTITY is exactly what is wanted here.
