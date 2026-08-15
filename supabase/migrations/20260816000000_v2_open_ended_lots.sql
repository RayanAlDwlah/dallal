-- ============================================================================
-- V2.1 — open-ended lots («بدون مدة») + custom durations, decided by Rayan
-- 2026-08-16. A lot may have duration_seconds NULL: it opens with end_time
-- NULL, never auto-closes (advance skips it), takes bids while live, has no
-- anti-snipe window (there is no end to snipe), and only the host closes it.
-- Custom durations up to 24h. All other closing semantics untouched.
-- ============================================================================

alter table public.session_lots
  drop constraint if exists session_lots_duration_seconds_check;
alter table public.session_lots
  alter column duration_seconds drop not null;
alter table public.session_lots
  add constraint session_lots_duration_seconds_check
  check (duration_seconds is null or duration_seconds between 30 and 86400);

CREATE OR REPLACE FUNCTION public.open_next_lot(p_session_id uuid, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_s public.sessions%rowtype;
  v_cur public.session_lots%rowtype;
  v_next public.session_lots%rowtype;
  v_now timestamptz := clock_timestamp();
  v_winner uuid;
  v_winner_name text;
  v_was_scheduled boolean;
begin
  select * into v_s from public.sessions where id = p_session_id for update;
  if not found or v_s.status not in ('scheduled', 'live') then
    return jsonb_build_object('ok', false, 'error', 'not_running');
  end if;
  if v_s.paused_at is not null then
    return jsonb_build_object('ok', false, 'error', 'paused');
  end if;

  v_was_scheduled := v_s.status = 'scheduled';

  if v_s.current_lot_id is not null then
    select * into v_cur from public.session_lots where id = v_s.current_lot_id for update;

    if v_cur.status = 'live' then
      if v_cur.end_time is null then
        -- Open-ended lot («بدون مدة»): never expires on its own, only the
        -- host closes it, and there is no snipe window to protect.
        if not p_force then
          return jsonb_build_object('ok', false, 'error', 'lot_still_running');
        end if;
      elsif v_cur.end_time > v_now then
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

  -- The room just opened: tell everyone who reserved a seat, once.
  if v_was_scheduled then
    insert into public.notifications (user_id, type, payload)
    select e.user_id, 'session_starting',
           jsonb_build_object('title', v_s.title, 'session_id', p_session_id)
    from public.session_entries e
    where e.session_id = p_session_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lot_id', v_next.id,
    'position', v_next.position,
    'end_time', v_now + make_interval(secs => v_next.duration_seconds)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.advance_session(p_session_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    exit when not found or v_cur.end_time is null or v_cur.end_time > clock_timestamp();
    perform public.open_next_lot(p_session_id, false);
    v_acted := true;
    select * into v_s from public.sessions where id = p_session_id;
    exit when v_s.status <> 'live';
  end loop;

  return v_acted;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.place_lot_bid(p_lot_id uuid, p_amount text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  if v_lot.status <> 'live' or (v_lot.end_time is not null and v_lot.end_time <= v_now) then
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
  if v_lot.end_time is not null and v_lot.end_time - v_now <= interval '15 seconds' and v_lot.extension_count < 20 then
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
$function$
;
