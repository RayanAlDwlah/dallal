-- ============================================================================
-- دلال v2 — the messages a session owes the people who booked a seat
--
-- Delivery was already realtime; the sessions feature simply never SENT
-- anything at the two moments that matter to someone who is not looking at
-- the page. Booking a seat and then hearing nothing when the room opens is
-- the gap this closes.
--
-- Deliberately only two moments, and neither is per-lot: a twelve-lot session
-- announcing every lot would send twelve messages to every attendee, which
-- trains people to ignore the bell. People inside the hall already see lots
-- change live; the notification is for the ones who left the page.
-- ============================================================================

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
$$;

revoke all on function public.open_next_lot(uuid, boolean) from public, anon, authenticated;
