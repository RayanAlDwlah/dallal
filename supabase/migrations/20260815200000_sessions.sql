-- ============================================================================
-- دلال v2 — auction sessions (الجلسات)
--
-- A session is a KIND OF AUCTION, not a kind of account: any person or company
-- with several items can open one. Lots run in sequence in one room, each with
-- its own duration, starting price and increment. The host runs it live.
--
-- The rules below are the ones the approved design (create-session.html,
-- session-card.html) decides for the first time:
--   • lots open in order, one at a time, each for its own duration
--   • a lot closes on the SERVER clock; the host's button only closes it early
--   • that button is refused in a lot's final 15 seconds — a host closing a lot
--     half a second after someone bid is exactly what extension exists to stop
--   • extension applies to the OPEN LOT and delays only that lot
--   • the entry deposit is a SIMULATION: no gateway, no card field, anywhere
--   • watching is open to everyone; the deposit unlocks BIDDING, not viewing
-- ============================================================================

-- ---------- sessions --------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  cover_image text,
  city text check (city is null or char_length(btrim(city)) between 2 and 60),
  start_time timestamptz not null,
  -- null means «بدون عربون». Simulated either way.
  deposit public.sar_amount,
  entry_mode text not null default 'deposit' check (entry_mode in ('deposit', 'invite')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'ended')),
  current_lot_id uuid,
  -- when non-null the session is paused; resume adds this interval to the open
  -- lot's end_time, so end_time only ever moves FORWARD.
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_status_start_idx on public.sessions (status, start_time);
create index sessions_host_idx on public.sessions (host_id);
create index sessions_live_idx on public.sessions (start_time) where status in ('scheduled', 'live');

create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ---------- lots ------------------------------------------------------------

create table public.session_lots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category_id bigint not null references public.categories (id),
  images text[] not null default '{}'
    check (coalesce(array_length(images, 1), 0) <= 10 and public.valid_image_paths(images)),
  attributes jsonb not null default '{}'::jsonb,
  starting_price public.sar_amount not null,
  current_price public.sar_amount,
  bid_increment public.sar_increment not null,
  -- how long the lot stays open once it is reached — NOT an absolute end time.
  duration_seconds integer not null check (duration_seconds between 30 and 3600),
  bid_count integer not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'live', 'ended')),
  -- null until the lot opens; then clock + duration, extended by accepted bids.
  end_time timestamptz,
  extension_count integer not null default 0 check (extension_count between 0 and 20),
  winner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index session_lots_position_idx on public.session_lots (session_id, position);
create index session_lots_session_idx on public.session_lots (session_id, position);
create index session_lots_live_idx on public.session_lots (end_time) where status = 'live';

create trigger session_lots_touch_updated_at
  before update on public.session_lots
  for each row execute function public.touch_updated_at();

alter table public.sessions
  add constraint sessions_current_lot_fk
  foreign key (current_lot_id) references public.session_lots (id) on delete set null;

-- ---------- attendance ------------------------------------------------------

-- One row per person who entered the hall. `approved` is what gates BIDDING:
-- a paid (simulated) deposit approves immediately; invite-only waits for the
-- host. Nothing here gates watching.
create table public.session_entries (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  deposit_paid boolean not null default false,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index session_entries_user_idx on public.session_entries (user_id);

-- ---------- bids reach lots too --------------------------------------------

-- One bid table, one history shape, one ordering rule (by id, never
-- created_at). A bid belongs to exactly one of the two auction kinds.
alter table public.bids add column lot_id uuid references public.session_lots (id) on delete cascade;
alter table public.bids alter column auction_id drop not null;
alter table public.bids add constraint bids_target_exactly_one
  check (num_nonnulls(auction_id, lot_id) = 1);

create index bids_lot_idx on public.bids (lot_id, id desc);

-- Notifications can point at a lot as well.
alter table public.notifications add column lot_id uuid references public.session_lots (id) on delete cascade;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('outbid', 'won', 'sold', 'ended_no_bids', 'session_starting', 'lot_open'));

-- ---------- opening and closing lots ----------------------------------------

-- Closes the open lot (deciding its winner) and opens the next one by
-- position. Ends the session when there is no next lot. Idempotent and
-- lock-guarded: two callers racing produce one advance, not two.
create or replace function public.open_next_lot(p_session_id uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.sessions%rowtype;
  v_cur public.session_lots%rowtype;
  v_next public.session_lots%rowtype;
  v_now timestamptz := clock_timestamp();
  v_winner uuid;
  v_winner_name text;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found or v_s.status not in ('scheduled', 'live') then
    return jsonb_build_object('ok', false, 'error', 'not_running');
  end if;
  if v_s.paused_at is not null then
    return jsonb_build_object('ok', false, 'error', 'paused');
  end if;

  if v_s.current_lot_id is not null then
    select * into v_cur from public.session_lots where id = v_s.current_lot_id for update;

    if v_cur.status = 'live' then
      -- Not yet expired: only a deliberate host close may cut it short, and
      -- never inside the final 15 seconds — that window belongs to extension.
      if v_cur.end_time > v_now then
        if not p_force then
          return jsonb_build_object('ok', false, 'error', 'lot_still_running');
        end if;
        if v_cur.end_time - v_now <= interval '15 seconds' then
          return jsonb_build_object('ok', false, 'error', 'too_close_to_end');
        end if;
      end if;

      v_winner := (
        select bidder_id from public.bids where lot_id = v_cur.id order by id desc limit 1
      );

      update public.session_lots
      set status = 'ended', winner_id = v_winner
      where id = v_cur.id;

      if v_winner is not null then
        select display_name into v_winner_name from public.profiles where id = v_winner;
        insert into public.notifications (user_id, type, lot_id, payload)
        values
          (v_winner, 'won', v_cur.id,
            jsonb_build_object('title', v_cur.title, 'amount', v_cur.current_price::text,
                               'session_id', p_session_id)),
          (v_s.host_id, 'sold', v_cur.id,
            jsonb_build_object('title', v_cur.title, 'amount', v_cur.current_price::text,
                               'winner_name', v_winner_name, 'session_id', p_session_id));
      else
        insert into public.notifications (user_id, type, lot_id, payload)
        values (v_s.host_id, 'ended_no_bids', v_cur.id,
          jsonb_build_object('title', v_cur.title, 'session_id', p_session_id));
      end if;
    end if;
  end if;

  select * into v_next
  from public.session_lots
  where session_id = p_session_id and status = 'waiting'
  order by position
  limit 1
  for update;

  if not found then
    update public.sessions
    set status = 'ended', current_lot_id = null
    where id = p_session_id;
    return jsonb_build_object('ok', true, 'session_ended', true);
  end if;

  update public.session_lots
  set status = 'live', end_time = v_now + make_interval(secs => v_next.duration_seconds)
  where id = v_next.id;

  update public.sessions
  set status = 'live', current_lot_id = v_next.id
  where id = p_session_id;

  return jsonb_build_object(
    'ok', true,
    'lot_id', v_next.id,
    'position', v_next.position,
    'end_time', v_now + make_interval(secs => v_next.duration_seconds)
  );
end;
$$;

revoke all on function public.open_next_lot(uuid, boolean) from public, anon, authenticated;

-- The host's «أغلق وافتح القطعة الجاية» button.
create or replace function public.host_next_lot(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_host uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;
  select host_id into v_host from public.sessions where id = p_session_id;
  if v_host is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_host <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  return public.open_next_lot(p_session_id, true);
end;
$$;

grant execute on function public.host_next_lot(uuid) to authenticated;

-- The idempotent server-side sweep: starts scheduled sessions whose time has
-- come and closes lots whose time is up. Safe for anyone to call for one
-- session — it only acts when the SERVER clock says so.
create or replace function public.advance_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.sessions%rowtype;
  v_cur public.session_lots%rowtype;
  v_acted boolean := false;
begin
  select * into v_s from public.sessions where id = p_session_id;
  if not found or v_s.status not in ('scheduled', 'live') or v_s.paused_at is not null then
    return false;
  end if;

  if v_s.status = 'scheduled' then
    if v_s.start_time > clock_timestamp() then
      return false;
    end if;
    perform public.open_next_lot(p_session_id, false);
    return true;
  end if;

  -- live: close the open lot when its time is up, and keep going while later
  -- lots are already past due (a tab left closed must not stall the room).
  loop
    select * into v_cur from public.session_lots
    where session_id = p_session_id and status = 'live';
    exit when not found or v_cur.end_time > clock_timestamp();
    perform public.open_next_lot(p_session_id, false);
    v_acted := true;
    select * into v_s from public.sessions where id = p_session_id;
    exit when v_s.status <> 'live';
  end loop;

  return v_acted;
end;
$$;

grant execute on function public.advance_session(uuid) to anon, authenticated;

create or replace function public.advance_all_sessions()
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
    select id from public.sessions
    where status in ('scheduled', 'live') and paused_at is null
  loop
    if public.advance_session(rec.id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.advance_all_sessions() from public, anon, authenticated;

-- ---------- pause / resume / end -------------------------------------------

-- Pause is the ONLY door onto end_time other than place_lot_bid, and it moves
-- it FORWARD by exactly the paused wall-clock interval. It never touches
-- extension_count, and a paused lot refuses bids explicitly — the clock alone
-- will not refuse them, because end_time has moved away.
create or replace function public.pause_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.sessions%rowtype;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_s.host_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  if v_s.status <> 'live' then
    return jsonb_build_object('ok', false, 'error', 'not_running');
  end if;
  if v_s.paused_at is not null then
    return jsonb_build_object('ok', true, 'already_paused', true);
  end if;

  update public.sessions set paused_at = clock_timestamp() where id = p_session_id;
  return jsonb_build_object('ok', true, 'paused', true);
end;
$$;

grant execute on function public.pause_session(uuid) to authenticated;

create or replace function public.resume_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.sessions%rowtype;
  v_paused interval;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_s.host_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  if v_s.paused_at is null then
    return jsonb_build_object('ok', true, 'already_running', true);
  end if;

  v_paused := clock_timestamp() - v_s.paused_at;

  update public.session_lots
  set end_time = end_time + v_paused
  where session_id = p_session_id and status = 'live';

  update public.sessions set paused_at = null where id = p_session_id;

  return jsonb_build_object('ok', true, 'resumed_after_seconds', extract(epoch from v_paused));
end;
$$;

grant execute on function public.resume_session(uuid) to authenticated;

-- Host ends the session early. The open lot is settled normally (its bidders
-- keep their result); lots never reached end with no winner.
create or replace function public.end_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s public.sessions%rowtype;
  v_cur public.session_lots%rowtype;
  v_winner uuid;
  v_winner_name text;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_s.host_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;
  if v_s.status = 'ended' then
    return jsonb_build_object('ok', true, 'already_ended', true);
  end if;

  if v_s.current_lot_id is not null then
    select * into v_cur from public.session_lots where id = v_s.current_lot_id for update;
    if v_cur.status = 'live' then
      v_winner := (select bidder_id from public.bids where lot_id = v_cur.id order by id desc limit 1);
      update public.session_lots set status = 'ended', winner_id = v_winner where id = v_cur.id;
      if v_winner is not null then
        select display_name into v_winner_name from public.profiles where id = v_winner;
        insert into public.notifications (user_id, type, lot_id, payload)
        values
          (v_winner, 'won', v_cur.id,
            jsonb_build_object('title', v_cur.title, 'amount', v_cur.current_price::text,
                               'session_id', p_session_id)),
          (v_s.host_id, 'sold', v_cur.id,
            jsonb_build_object('title', v_cur.title, 'amount', v_cur.current_price::text,
                               'winner_name', v_winner_name, 'session_id', p_session_id));
      end if;
    end if;
  end if;

  update public.session_lots
  set status = 'ended'
  where session_id = p_session_id and status = 'waiting';

  update public.sessions
  set status = 'ended', current_lot_id = null, paused_at = null
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'ended', true);
end;
$$;

grant execute on function public.end_session(uuid) to authenticated;

-- ---------- entering the hall ----------------------------------------------

-- The deposit is simulated: this records that the person accepted it, and
-- nothing moves. Invite-only halls create an unapproved row for the host.
create or replace function public.join_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_s public.sessions%rowtype;
  v_approved boolean;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  select * into v_s from public.sessions where id = p_session_id;
  if not found or v_s.status = 'draft' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_s.host_id = v_user then
    return jsonb_build_object('ok', false, 'error', 'host_cannot_join');
  end if;

  v_approved := (v_s.entry_mode = 'deposit');

  insert into public.session_entries (session_id, user_id, deposit_paid, approved)
  values (p_session_id, v_user, v_approved and v_s.deposit is not null, v_approved)
  on conflict (session_id, user_id) do nothing;

  return jsonb_build_object('ok', true, 'approved', v_approved);
end;
$$;

grant execute on function public.join_session(uuid) to authenticated;

create or replace function public.approve_entry(p_session_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_host uuid;
begin
  select host_id into v_host from public.sessions where id = p_session_id;
  if v_host is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_host <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;

  update public.session_entries
  set approved = true
  where session_id = p_session_id and user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.approve_entry(uuid, uuid) to authenticated;

-- ---------- bidding on a lot ------------------------------------------------

-- Deliberately the same shape as place_bid(): lock the row, judge on the
-- server clock, compute the minimum from the LOCKED price, extend only on
-- acceptance. It is a sibling rather than a shared body because the row it
-- locks is a different table — keep the two in step when either changes.
create or replace function public.place_lot_bid(p_lot_id uuid, p_amount text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_lot public.session_lots%rowtype;
  v_s public.sessions%rowtype;
  v_amount numeric;
  v_min numeric;
  v_now timestamptz := clock_timestamp();
  v_prev_leader uuid;
  v_new_end timestamptz;
  v_ext integer;
  v_bid_id bigint;
  v_entry public.session_entries%rowtype;
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

  select * into v_lot from public.session_lots where id = p_lot_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_s from public.sessions where id = v_lot.session_id;
  if v_s.host_id = v_user then
    return jsonb_build_object('ok', false, 'error', 'own_auction');
  end if;
  if v_s.status <> 'live' then
    return jsonb_build_object('ok', false, 'error', 'session_not_live');
  end if;
  -- A paused lot refuses bids explicitly: its end_time has moved away, so the
  -- clock alone would happily accept them.
  if v_s.paused_at is not null then
    return jsonb_build_object('ok', false, 'error', 'paused');
  end if;

  if v_lot.status <> 'live' or v_lot.end_time is null or v_lot.end_time <= v_now then
    return jsonb_build_object('ok', false, 'error', 'ended');
  end if;

  select * into v_entry from public.session_entries
  where session_id = v_s.id and user_id = v_user;
  if not found or not v_entry.approved then
    return jsonb_build_object('ok', false, 'error', 'entry_required');
  end if;

  if v_lot.current_price is null then
    v_min := v_lot.starting_price;
  else
    v_min := v_lot.current_price + v_lot.bid_increment;
  end if;

  if v_amount < v_min then
    return jsonb_build_object(
      'ok', false, 'error', 'too_low',
      'min_amount', v_min::text,
      'current_price', v_lot.current_price::text
    );
  end if;

  v_prev_leader := (select bidder_id from public.bids where lot_id = p_lot_id order by id desc limit 1);

  v_new_end := v_lot.end_time;
  v_ext := v_lot.extension_count;
  if v_lot.end_time - v_now <= interval '15 seconds' and v_lot.extension_count < 20 then
    v_new_end := v_lot.end_time + interval '30 seconds';
    v_ext := v_lot.extension_count + 1;
  end if;

  insert into public.bids (lot_id, bidder_id, amount)
  values (p_lot_id, v_user, v_amount)
  returning id into v_bid_id;

  update public.session_lots
  set current_price = v_amount,
      bid_count = bid_count + 1,
      end_time = v_new_end,
      extension_count = v_ext
  where id = p_lot_id;

  if v_prev_leader is not null and v_prev_leader <> v_user then
    insert into public.notifications (user_id, type, lot_id, payload)
    values (
      v_prev_leader, 'outbid', p_lot_id,
      jsonb_build_object('title', v_lot.title, 'amount', v_amount::text,
                         'increment', v_lot.bid_increment::text, 'session_id', v_s.id)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'bid_id', v_bid_id,
    'current_price', v_amount::text,
    'end_time', v_new_end,
    'extension_count', v_ext,
    'extended', v_ext > v_lot.extension_count
  );
end;
$$;

revoke all on function public.place_lot_bid(uuid, text) from public, anon;
grant execute on function public.place_lot_bid(uuid, text) to authenticated;

-- ---------- grants ----------------------------------------------------------

grant select on public.sessions to anon, authenticated;
grant insert, update, delete on public.sessions to authenticated;
grant select on public.session_lots to anon, authenticated;
grant insert, update, delete on public.session_lots to authenticated;
grant select on public.session_entries to anon, authenticated;

-- ---------- row level security ----------------------------------------------

alter table public.sessions enable row level security;
alter table public.session_lots enable row level security;
alter table public.session_entries enable row level security;

-- Drafts belong to their host; everything published is watchable by anyone.
create policy "published sessions are readable"
  on public.sessions for select
  using (status <> 'draft' or host_id = auth.uid());
create policy "hosts create own sessions"
  on public.sessions for insert to authenticated
  with check (host_id = auth.uid() and status in ('draft', 'scheduled'));
-- Only before the room opens. Once live, the only writers are the SECURITY
-- DEFINER functions above — a host cannot reach in and move a clock.
create policy "hosts edit sessions before they start"
  on public.sessions for update to authenticated
  using (host_id = auth.uid() and status in ('draft', 'scheduled'))
  with check (host_id = auth.uid() and status in ('draft', 'scheduled'));
create policy "hosts delete sessions before they start"
  on public.sessions for delete to authenticated
  using (host_id = auth.uid() and status in ('draft', 'scheduled'));

create policy "lots of readable sessions are readable"
  on public.session_lots for select
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and (s.status <> 'draft' or s.host_id = auth.uid())
  ));
-- «تقدر تضيف قطعة أو تعيد الترتيب قبل بداية الجلسة فقط» — enforced here.
create policy "hosts manage lots before the session starts"
  on public.session_lots for insert to authenticated
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.host_id = auth.uid() and s.status in ('draft', 'scheduled')
  ));
create policy "hosts update lots before the session starts"
  on public.session_lots for update to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.host_id = auth.uid() and s.status in ('draft', 'scheduled')
  ))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.host_id = auth.uid() and s.status in ('draft', 'scheduled')
  ));
create policy "hosts delete lots before the session starts"
  on public.session_lots for delete to authenticated
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.host_id = auth.uid() and s.status in ('draft', 'scheduled')
  ));

-- Attendance is public as a COUNT and as display names; there is no email in
-- it and no client write path — join_session() is the only door.
create policy "entries are readable"
  on public.session_entries for select using (true);

-- ---------- realtime + sweep ------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.sessions;
  alter publication supabase_realtime add table public.session_lots;
  alter publication supabase_realtime add table public.session_entries;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'advance-sessions', '10 seconds',
    $cron$ select public.advance_all_sessions(); $cron$
  );
exception when others then
  begin
    perform cron.schedule(
      'advance-sessions', '* * * * *',
      $cron$ select public.advance_all_sessions(); $cron$
    );
  exception when others then
    raise notice 'pg_cron unavailable (%) — sessions advance on demand instead', sqlerrm;
  end;
end;
$$;
