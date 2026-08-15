-- ============================================================================
-- V2 — place_bid_v2: the one-button bid for fixed-increment auctions.
--
-- The client sends NO amount to choose — the server computes the only legal
-- one inside the row lock (first bid = starting_price, after that
-- current_price + bid_increment, exactly). What the client DOES send is
-- p_expected: the amount the button displayed when the user pressed it.
-- If the computed amount no longer matches, the bid is REJECTED as a race,
-- never silently escalated — a user who confirmed 14,500.00 must not be
-- charged 15,000.00 because someone else was faster. Consent is to a number,
-- not to "whatever it costs now".
--
-- Everything structural is place_bid's, unchanged and shared:
--   * same row lock (concurrent V1/V2 bids on one auction serialize together)
--   * same insert path, so bids_insert_gate and the anti-sniping extension
--     trigger (bids_extend_end_time) apply as-is — a V2 bid in the final 15s
--     extends exactly like a V1 bid
--   * same clock rule (clock_timestamp() vs end_time, never the status flag)
--   * same rejection shape (bid_reject; amounts leave as canonical text)
--
-- place_bid itself is untouched: on a V1 auction it is the only path, and it
-- remains callable on a V2 auction (BR-32: the SERVER never enforces an
-- increment; the increment governs what the SCREEN offers — D-01). The V2
-- button is a UI contract, not a new server-side floor.
-- ============================================================================
create function public.place_bid_v2(p_auction_id uuid, p_expected text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid            uuid;
  v_expected       numeric;
  v_owner_id       uuid;
  v_end_time       timestamptz;
  v_starting_price public.sar_amount;
  v_current_price  public.sar_amount;
  v_increment      public.sar_amount;
  v_has_bids       boolean;
  v_amount         public.sar_amount;
  v_bid_id         bigint;
begin
  -- Identity from the verified session, never the payload (SEC-Z1).
  v_uid := auth.uid();
  if v_uid is null then
    return public.bid_reject('not_authenticated');
  end if;

  -- p_expected is TEXT for the same reason place_bid's p_amount is: a JSON
  -- number would be corrupted by IEEE 754 before this body ran (S0-12 §5.2).
  begin
    v_expected := p_expected::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return public.bid_reject('malformed_amount');
  end;
  if v_expected is null
     or not (v_expected > 0)
     or not (v_expected < 'Infinity'::numeric)
     or v_expected <> round(v_expected, 2) then
    return public.bid_reject('malformed_amount');
  end if;

  -- Exclusive lock on THIS auction row; state re-read inside the lock.
  select a.owner_id, a.end_time, a.starting_price, a.current_price, a.bid_increment
    into v_owner_id, v_end_time, v_starting_price, v_current_price, v_increment
    from public.auctions a
   where a.id = p_auction_id
     for update;

  if not found then
    return public.bid_reject('auction_not_found');
  end if;

  -- A V1 auction has no button: the caller must use place_bid with an amount.
  if v_increment is null then
    return public.bid_reject('amount_required');
  end if;

  -- The clock decides eligibility, never the stored flag (LC-03).
  if clock_timestamp() >= v_end_time then
    return public.bid_reject('auction_ended');
  end if;

  if v_owner_id = v_uid then
    return public.bid_reject('owner_cannot_bid');
  end if;

  -- The only legal amount, computed under the lock. Exact numeric arithmetic;
  -- no float exists on this path.
  select exists (select 1 from public.bids b where b.auction_id = p_auction_id)
    into v_has_bids;

  v_amount := case when v_has_bids then v_current_price + v_increment
                   else v_starting_price
              end;

  -- Consent check: the user pressed a button that displayed a number. If the
  -- number moved while they pressed it, they did nothing wrong — tell them the
  -- new offer distinguishably (same shape as place_bid's outbid_race) and let
  -- the UI re-arm the button. Numeric equality is exact and scale-insensitive.
  if v_expected <> v_amount then
    return public.bid_reject('outbid_race', 'next_offer', v_amount);
  end if;

  -- Append + price move, inseparable — same transaction-local key place_bid
  -- uses, set for the same purpose on the same shape of work (a bid insert
  -- plus its price/extension consequences; S0-12 §9.4's "second code path"
  -- warning is about paths that move end_time WITHOUT inserting a bid).
  perform set_config('dalal.in_place_bid', 'on', true);

  insert into public.bids (auction_id, bidder_id, amount)
  values (p_auction_id, v_uid, v_amount)
  returning id into v_bid_id;

  update public.auctions
     set current_price = v_amount
   where id = p_auction_id;

  return jsonb_build_object(
    'accepted',      true,
    'bid_id',        v_bid_id,
    'amount',        public.sar_text(v_amount),
    'current_price', public.sar_text(v_amount),
    'next_offer',    public.sar_text(v_amount + v_increment)
  );
end;
$$;

revoke execute on function public.place_bid_v2(uuid, text) from public;
grant  execute on function public.place_bid_v2(uuid, text) to anon, authenticated;
