-- ============================================================================
-- V2 — sessions (جلسات مزاد): a host, an ordered list of lots, one open at a
-- time.
--
-- THE LOAD-BEARING DECISION: **a lot IS an auction.** When the host opens lot
-- N, session_open_lot creates a real public.auctions row from the lot's
-- planned content — born active, fixed increment, end_time = now + the lot's
-- duration. From that moment every existing mechanism applies UNCHANGED:
-- place_bid_v2 under the same row lock, the anti-sniping extension and its
-- CHECK-capped counter, close_ended_auctions, bid_history, the realtime
-- broadcast. Sessions add ZERO new bidding machinery — which is exactly why
-- they can be trusted the night before a demo.
--
-- A planned lot is NOT a draft auction: `auctions.status` still has exactly
-- two values and no auction row exists before the host opens the lot. The
-- plan lives here, in session_lots, the way a filled-in form lives in the
-- browser before submit.
-- ============================================================================

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.profiles (id),
  title        text not null check (title = btrim(title) and char_length(title) between 3 and 100),
  description  text not null check (description = btrim(description) and char_length(description) between 10 and 2000),
  city         text,
  cover_path   text check (cover_path is null
                           or (length(cover_path) between 1 and 512
                               and cover_path !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
                               and cover_path !~ '^/'
                               and cover_path !~ '\.\.')),
  start_time   timestamptz not null,
  status       text not null default 'scheduled'
               constraint sessions_status_valid check (status in ('scheduled', 'live', 'ended')),
  created_at   timestamptz not null default now()
);

create table public.session_lots (
  session_id     uuid not null references public.sessions (id),
  position       integer not null check (position >= 1),
  -- The planned content — becomes the auction row when the host opens it.
  name           text not null check (name = btrim(name) and char_length(name) between 3 and 100),
  description    text not null check (description = btrim(description) and char_length(description) between 10 and 2000),
  image_path     text not null check (length(image_path) between 1 and 512
                                      and image_path !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
                                      and image_path !~ '^/'
                                      and image_path !~ '\.\.'),
  category_id    integer references public.categories (id),
  starting_price public.sar_amount not null,
  bid_increment  public.sar_amount not null
                 check (bid_increment = round(bid_increment, 0) and mod(bid_increment, 10) = 0),
  duration_seconds integer not null check (duration_seconds between 60 and 3600),
  -- Set once, by session_open_lot, when the lot goes live. NULL = not yet run.
  auction_id     uuid references public.auctions (id) unique,
  primary key (session_id, position)
);

create index session_lots_by_session on public.session_lots (session_id, position);

alter table public.sessions     enable row level security;
alter table public.session_lots enable row level security;
grant select on public.sessions, public.session_lots to anon, authenticated;

create policy sessions_public_read on public.sessions
  for select to anon, authenticated using (true);
create policy session_lots_public_read on public.session_lots
  for select to anon, authenticated using (true);

-- The host creates the session and its lots BEFORE it goes live; identity from
-- the session, never the payload (SEC-Z2's shape).
grant insert on public.sessions, public.session_lots to authenticated;
create policy sessions_host_insert on public.sessions
  for insert to authenticated
  with check (host_id = (select auth.uid()) and status = 'scheduled');
create policy session_lots_host_insert on public.session_lots
  for insert to authenticated
  with check (auction_id is null and exists (
    select 1 from public.sessions s
     where s.id = session_id
       and s.host_id = (select auth.uid())
       and s.status = 'scheduled'
  ));
-- No user update/delete policy on either table: lots are locked once published
-- (the add/reorder lock is the ABSENCE of these policies), and every state
-- change after that goes through session_open_lot / session_close below.

-- ----------------------------------------------------------------------------
-- session_open_lot — the host-only door that turns the next planned lot into a
-- live auction. Atomic: the session row lock serializes two impatient clicks,
-- and the loser finds the lot already opened.
-- ----------------------------------------------------------------------------
create function public.session_open_lot(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid;
  v_host    uuid;
  v_status  text;
  v_lot     record;
  v_open    integer;
  v_auction uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select s.host_id, s.status into v_host, v_status
    from public.sessions s
   where s.id = p_session_id
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session_not_found');
  end if;
  -- Host-only, decided from the verified server session — a bidder opening
  -- (or racing) lots is the attack this refuses (CLAUDE.md §6).
  if v_host <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'not_host');
  end if;
  if v_status = 'ended' then
    return jsonb_build_object('ok', false, 'reason', 'session_ended');
  end if;

  -- One lot open at a time: refuse while the current lot's auction still runs.
  select count(*) into v_open
    from public.session_lots l
    join public.auctions a on a.id = l.auction_id
   where l.session_id = p_session_id
     and a.status = 'active'
     and clock_timestamp() < a.end_time;
  if v_open > 0 then
    return jsonb_build_object('ok', false, 'reason', 'lot_still_open');
  end if;

  select * into v_lot
    from public.session_lots l
   where l.session_id = p_session_id
     and l.auction_id is null
   order by l.position
   limit 1;
  if not found then
    update public.sessions set status = 'ended' where id = p_session_id;
    return jsonb_build_object('ok', false, 'reason', 'no_more_lots');
  end if;

  insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                               name, description, image_path, category_id, bid_increment)
  values (v_host, 'active', clock_timestamp() + make_interval(secs => v_lot.duration_seconds),
          v_lot.starting_price, v_lot.starting_price,
          v_lot.name, v_lot.description, v_lot.image_path, v_lot.category_id, v_lot.bid_increment)
  returning id into v_auction;

  update public.session_lots
     set auction_id = v_auction
   where session_id = p_session_id and position = v_lot.position;

  update public.sessions set status = 'live' where id = p_session_id;

  return jsonb_build_object('ok', true, 'auction_id', v_auction, 'position', v_lot.position);
end;
$$;

revoke execute on function public.session_open_lot(uuid) from public;
grant  execute on function public.session_open_lot(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- session_end — the host closes the session after the current lot runs out.
-- It never shortens an auction: if a lot is still live the call is refused —
-- end_time moves for nobody (BR-36's guard stays the only authority).
-- ----------------------------------------------------------------------------
create function public.session_end(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid;
  v_host uuid;
  v_open integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  select s.host_id into v_host from public.sessions s where s.id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session_not_found');
  end if;
  if v_host <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'not_host');
  end if;
  select count(*) into v_open
    from public.session_lots l
    join public.auctions a on a.id = l.auction_id
   where l.session_id = p_session_id
     and a.status = 'active'
     and clock_timestamp() < a.end_time;
  if v_open > 0 then
    return jsonb_build_object('ok', false, 'reason', 'lot_still_open');
  end if;
  update public.sessions set status = 'ended' where id = p_session_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.session_end(uuid) from public;
grant  execute on function public.session_end(uuid) to authenticated;
