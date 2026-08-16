-- ============================================================================
-- The money contract, at the storage layer and on the wire.
--
-- 19 assertions against `docs/contracts/S0-12-money.md` and CLAUDE.md §4 — the
-- section that opens "the rules that break the product when violated".
--
-- Half of these are catalogue reads rather than behaviour, and deliberately.
-- The defects §4 warns about are not behaviours you can provoke; they are
-- DECLARATIONS somebody tightens during a hygiene pass. `numeric(12,2)` behaves
-- identically to `numeric` on every amount a demo ever enters, and differently
-- on the one that matters. A test that only places bids cannot see it. So the
-- declarations are read from `pg_type` and `pg_attribute`, where a hygiene
-- refactor cannot hide.
-- ============================================================================

\set ON_ERROR_STOP off

-- ---------------------------------------------------------------------------
-- 1–7. What `sar_amount` refuses.
--
-- 1 IS THE ONE CLAUDE.md §4 RULE 4 IS ABOUT, AND IT IS WHY THE DOMAIN LOOKS
-- REDUNDANT. PostgreSQL `numeric` accepts 'NaN'. `NaN > 0` is TRUE. `NaN =
-- round(NaN, 2)` is TRUE. Both of the obvious guards pass it. Only
-- `< 'Infinity'` — which is FALSE for NaN — refuses, and an accepted NaN
-- becomes `current_price`, after which every comparison against it is false and
-- the auction is permanently unwinnable.
-- ---------------------------------------------------------------------------
do $$
declare
  bad text[] := array['NaN', 'Infinity', '-Infinity', '1.001', '0', '-1.00'];
  why text[] := array[
    '1. sar_amount refuses NaN — the value that passes > 0 AND = round(v,2)',
    '2. sar_amount refuses Infinity',
    '3. sar_amount refuses -Infinity',
    '4. sar_amount refuses three decimals — REJECTED, never rounded',
    '5. sar_amount refuses zero',
    '6. sar_amount refuses a negative amount'];
  i int; caught boolean;
begin
  for i in 1 .. array_length(bad, 1) loop
    caught := false;
    begin
      perform bad[i]::public.sar_amount;
    exception when others then caught := true;
    end;
    perform t_chk(why[i], caught, true);
  end loop;

  -- BR-21 / SEC-R3: no maximum price and no bid ceiling. Forty digits is not a
  -- silly number — it is the exact input a `numeric(12,2)` typmod would reject
  -- and a JS `Number` would silently round.
  caught := false;
  begin
    perform '12345678901234567890123456789012345678.99'::public.sar_amount;
  exception when others then caught := true;
  end;
  perform t_chk('7. …and accepts a 40-digit amount — there is no ceiling of any kind', caught, false);
end $$;

-- ---------------------------------------------------------------------------
-- 8–10. The declarations themselves.
--
-- 8 is the single most likely hygiene refactor on this codebase, named as such
-- in CLAUDE.md §4 rule 2. `format_type(typbasetype, typtypmod)` prints the
-- typmod if one exists, so 'numeric' and 'numeric(12,2)' are distinguishable
-- here and nowhere else in this suite.
--
-- 9 guards the clause a reviewer deletes because it looks redundant. It is the
-- only thing standing between check 1 and a frozen auction.
-- ---------------------------------------------------------------------------
do $$
begin
  perform t_chk('8. sar_amount is unconstrained numeric — no typmod, ever (§4 rule 2)',
    (select format_type(t.typbasetype, t.typtypmod)
     from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'sar_amount' and n.nspname = 'public'), 'numeric');

  perform t_chk('9. …and its check still carries < ''Infinity'' (§4 rule 4 — do not remove it)',
    (select bool_or(pg_get_constraintdef(oid) like '%Infinity%')
     from pg_constraint where contypid = 'public.sar_amount'::regtype), true);

  -- §4 rule 3: every money column is the domain, never bare `numeric`. Asked
  -- from the other end — NOTHING in public is bare numeric — so a money column
  -- added tomorrow is covered without anyone remembering to list it here.
  perform t_chk('10. §4 rule 3 — no table column in public is bare numeric; every one is a domain',
    (select string_agg(c.relname || '.' || a.attname, ' ' order by c.relname, a.attname)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and a.attnum > 0 and not a.attisdropped
       and a.atttypid = 'pg_catalog.numeric'::regtype),
    null::text);
end $$;

-- ---------------------------------------------------------------------------
-- 11–14. `sar_increment`, which is NEW in V2 and has no V1 ancestor.
--
-- The approved create-auction design says «المبلغ لازم يكون من مضاعفات
-- العشرة», so the domain is positive whole multiples of ten. It is a separate
-- domain from `sar_amount` precisely so that this rule cannot leak onto bid
-- amounts — check 14 is that separation, stated as an assertion.
-- ---------------------------------------------------------------------------
do $$
declare caught boolean;
begin
  caught := false;
  begin perform '15'::public.sar_increment; exception when others then caught := true; end;
  perform t_chk('11. sar_increment refuses a non-multiple of ten', caught, true);

  caught := false;
  begin perform '10.50'::public.sar_increment; exception when others then caught := true; end;
  perform t_chk('12. sar_increment refuses a fractional increment', caught, true);

  caught := false;
  begin perform '0'::public.sar_increment; exception when others then caught := true; end;
  perform t_chk('13. sar_increment refuses zero — an increment of nothing is not an increment', caught, true);

  caught := false;
  begin perform '0.01'::public.sar_amount; exception when others then caught := true; end;
  perform t_chk('14. …and none of that leaks onto sar_amount: 0.01 is a valid AMOUNT', caught, false);
end $$;

-- ---------------------------------------------------------------------------
-- 15–19. On the wire.
--
-- §4 rule 7 is the one that gets missed, because it is invisible in the
-- application code: PostgREST serialises a bare `numeric` as an UNQUOTED JSON
-- number, and `JSON.parse` inside the Supabase client corrupts it before a line
-- of this repository runs. The float is produced with none of our code on the
-- stack. A review that greps for `Number(` passes the violation.
--
-- `place_bid` answers through `jsonb`, not through PostgREST's row serialiser,
-- so the cast has to be inside the function — and `jsonb_typeof` is the only
-- way to see whether it was done. 'number' here is the defect, in the reply
-- that carries the price the whole screen is built from.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; ok jsonb; low jsonb; big text := '12345678901234567890123456789012345678.99';
begin
  a := t_auction('100.00', '10');
  ok  := t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  low := t_bid(a, '33333333-3333-3333-3333-333333333333', '100.01');   -- refused
  -- An ACCEPTED second bid, because the outbid notification is a side effect of
  -- acceptance and `100.01` does not clear the increment. Reading 17 off the
  -- rejected bid returned NULL and the assertion failed for the setup's reason
  -- rather than the schema's — which is the failure mode this whole suite is
  -- built to avoid, so it is written down instead of quietly patched.
  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '110.00');

  perform t_chk('15. place_bid''s accepted reply carries current_price as a STRING, not a JSON number',
    jsonb_typeof(ok -> 'current_price'), 'string');
  perform t_chk('16. …and its too_low reply carries min_amount and current_price as strings',
    jsonb_typeof(low -> 'min_amount') || '/' || jsonb_typeof(low -> 'current_price'),
    'string/string');
  perform t_chk('17. …and the outbid notification''s amount and increment too',
    (select jsonb_typeof(payload -> 'amount') || '/' || jsonb_typeof(payload -> 'increment')
     from public.notifications where auction_id = a and type = 'outbid' limit 1),
    'string/string');

  -- 18–19: the round trip. A 40-digit amount survives storage, the reply and
  -- the notification digit-for-digit — which no float can do. IEEE 754 double
  -- carries ~15-17 significant digits; this has 40.
  a := t_auction('100.00', '10');
  ok := t_bid(a, '22222222-2222-2222-2222-222222222222', big);
  perform t_chk('18. a 40-digit amount survives place_bid''s reply digit-for-digit',
    ok ->> 'current_price', big);

  perform t_expire(a, now() - interval '1 second');
  perform public.finalize_auction(a);
  perform t_chk('19. …and finalize''s won/sold payloads carry it as a string, unrounded',
    (select string_agg(distinct payload ->> 'amount', '|')
     from public.notifications where auction_id = a and type in ('won','sold')),
    big);
end $$;
