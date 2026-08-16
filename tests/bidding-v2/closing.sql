-- ============================================================================
-- V2 anti-snipe extension, the cap, and finalization.
--
-- 26 assertions. `BR-36` was reversed on 2026-08-13 by the project owner: a bid
-- ACCEPTED in the final 15 seconds extends `end_time` by EXACTLY 30 seconds,
-- repeating, to a hard cap of 20 extensions. CLAUDE.md §5 names four properties
-- of that mechanism as non-negotiable and says each one is asserted in a test.
-- On V1 that was true. Between V2 shipping and this file, it was not.
--
-- The four are checks 4–6 (the quantum), 12–13 (the cap is a CONSTRAINT), 8–11
-- (a rejected bid never extends) and 14–16 (at the cap a late bid is still
-- accepted).
--
-- 26 IS A FINDING, NOT A PASS. Read it before trusting §5's fourth property.
-- ============================================================================

\set ON_ERROR_STOP off

-- ---------------------------------------------------------------------------
-- 1–3. Outside the window, nothing moves.
--
-- The negative case first, because an implementation that extends on EVERY bid
-- also passes every "it extended" assertion. Without this one the suite cannot
-- tell anti-snipe from an unconditional +30s.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; t0 timestamptz; r jsonb;
begin
  a := t_auction('100.00', '10');       -- ends in an hour
  select end_time into t0 from public.auctions where id = a;
  r := t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');

  perform t_chk('1. a bid outside the final 15s does not move end_time',
    (select end_time from public.auctions where id = a), t0);
  perform t_chk('2. …nor the extension count',
    (select extension_count from public.auctions where id = a), 0);
  perform t_chk('3. …and the reply says so, so the client does not animate a jump',
    r ->> 'extended', 'false');
end $$;

-- ---------------------------------------------------------------------------
-- 4–7. Inside the window: +30 seconds, EXACTLY, and one count per bid.
--
-- "Exactly" is the assertion. A `+ interval '30 seconds'` and a
-- `= clock_timestamp() + interval '30 seconds'` read almost identically and
-- differ enormously: the second RESETS the clock on every bid, so a contested
-- auction runs 30 seconds from the last bid instead of extending the auction's
-- own end. These compare against the PREVIOUS end_time, not against now(), so
-- the two implementations cannot both pass.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; t0 timestamptz; t1 timestamptz; r jsonb;
begin
  a := t_auction('100.00', '10');
  perform t_expire(a, now() + interval '10 seconds');   -- inside the final 15s
  select end_time into t0 from public.auctions where id = a;

  r := t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  select end_time into t1 from public.auctions where id = a;

  perform t_chk('4. a bid inside the final 15s extends end_time by EXACTLY 30s',
    t1, t0 + interval '30 seconds');
  perform t_chk('5. …and moves the count by exactly one, in the same statement',
    (select extension_count from public.auctions where id = a), 1);
  perform t_chk('6. …and the reply reports the extension and the new end',
    (r ->> 'extended') || ' ' || (r ->> 'extension_count'), 'true 1');

  -- Still inside: t1 is ~40s out, so put it back into the window and bid again.
  perform t_expire(a, now() + interval '10 seconds');
  select end_time into t0 from public.auctions where id = a;
  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '110.00');
  perform t_chk('7. a second extension is another +30s and count 2 — the quanta accumulate',
    (select (end_time = t0 + interval '30 seconds')::text || '/' || extension_count::text
     from public.auctions where id = a), 'true/2');
end $$;

-- ---------------------------------------------------------------------------
-- 8–11. A REJECTED bid never extends. CLAUDE.md §5: "otherwise an ineligible
-- bidder holds an auction open forever with bids that never count."
--
-- All three rejection paths are exercised, because they leave `place_bid` at
-- three different points and only one of them is after the row lock. An
-- implementation that extended before validating would pass a suite that only
-- tested `too_low`.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; t0 timestamptz;
begin
  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_expire(a, now() + interval '10 seconds');
  select end_time into t0 from public.auctions where id = a;

  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '100.50');   -- too_low
  perform t_chk('8. a too_low bid inside the window does not extend',
    (select end_time from public.auctions where id = a), t0);
  perform t_chk('9. …nor does it increment the count',
    (select extension_count from public.auctions where id = a), 0);

  perform t_bid(a, '11111111-1111-1111-1111-111111111111', '500.00');   -- own_auction
  perform t_chk('10. a seller''s own-auction bid inside the window does not extend',
    (select end_time from public.auctions where id = a), t0);

  perform t_bid(a, '33333333-3333-3333-3333-333333333333', 'NaN');      -- invalid_amount
  perform t_chk('11. an invalid amount inside the window does not extend — it never reaches the lock',
    (select end_time from public.auctions where id = a), t0);
end $$;

-- ---------------------------------------------------------------------------
-- 12–16. The cap.
--
-- CLAUDE.md §5, first property: "the cap is a `CHECK` constraint, not an `if`.
-- Without it a contested auction never ends, never finalizes, and never has a
-- winner." 13 reads the catalogue, because that is the only way to tell a
-- constraint from an `if` that happens to behave like one today.
--
-- 14–16 are the property that reads like a bug and is not: AT the cap a late
-- bid is STILL ACCEPTED. The cap ends the extending, not the bidding.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; t0 timestamptz; caught boolean := false; r jsonb;
begin
  a := t_auction('100.00', '10');

  begin
    update public.auctions set extension_count = 21 where id = a;
  exception when check_violation then caught := true;
  end;
  perform t_chk('12. the 20-extension cap REJECTS a 21st at the storage layer', caught, true);

  perform t_chk('13. …and it is a CHECK constraint on the table, not a branch in a function',
    (select count(*) from pg_constraint
     where conrelid = 'public.auctions'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%extension_count%'), 1::bigint);

  -- Drive it to the cap without 20 round trips: the count is data, and what is
  -- under test is the behaviour AT the cap, not the route taken to reach it.
  update public.auctions set extension_count = 20 where id = a;
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_expire(a, now() + interval '5 seconds');
  select end_time into t0 from public.auctions where id = a;

  r := t_bid(a, '33333333-3333-3333-3333-333333333333', '110.00');
  perform t_chk('14. AT the cap, a bid in the final 15s is STILL ACCEPTED', r ->> 'ok', 'true');
  perform t_chk('15. …but end_time does not move — the cap ends the extending, not the bidding',
    (select end_time from public.auctions where id = a), t0);
  perform t_chk('16. …and the count stays at 20',
    (select extension_count from public.auctions where id = a), 20);
end $$;

-- ---------------------------------------------------------------------------
-- 17–23. finalize_auction.
--
-- 19 is the ordering rule again, and it is the only assertion in this tree that
-- CANNOT be set up through the product. `place_bid` only ever produces an
-- increasing sequence, so a suite built entirely from `place_bid` cannot tell
-- `order by id desc` from `order by amount desc` or `order by created_at desc`
-- — all three agree on every state the product can reach on its own. The rows
-- are therefore written directly, with an amount and a created_at that
-- DISAGREE with the id, and the assertion is that the id wins. That the setup
-- has to bypass the product is exactly why the ordering is worth pinning:
-- under contention the product reaches this state by itself.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; n bigint;
begin
  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');

  perform t_chk('17. finalize_auction on a live auction does nothing and says so',
    public.finalize_auction(a), false);

  perform t_expire(a, now() - interval '1 second');
  perform t_chk('18. finalize_auction past the end time acts, and reports that it acted',
    public.finalize_auction(a), true);
  perform t_chk('19. …setting status to ended',
    (select status from public.auctions where id = a), 'ended');

  perform t_chk('20. finalize is idempotent — the second call is a no-op',
    public.finalize_auction(a), false);
  perform t_chk('21. …and does not duplicate the notifications',
    (select count(*) from public.notifications where auction_id = a and type in ('won','sold')),
    2::bigint);
end $$;

do $$
declare a uuid;
begin
  -- The state place_bid cannot produce: the LAST bid by id is the LOWEST by
  -- amount and the OLDEST by created_at. Only `order by id desc` picks 3333….
  a := t_auction('100.00', '10');
  insert into public.bids (auction_id, bidder_id, amount, created_at) values
    (a, '22222222-2222-2222-2222-222222222222', 200, now()),
    (a, '33333333-3333-3333-3333-333333333333', 150, now() - interval '1 minute');
  update public.auctions set current_price = 150, bid_count = 2 where id = a;
  perform t_expire(a, now() - interval '1 second');
  perform public.finalize_auction(a);

  perform t_chk('22. the winner is the last bid by bids.id — never by amount, never by created_at',
    (select winner_id from public.auctions where id = a),
    '33333333-3333-3333-3333-333333333333'::uuid);
end $$;

do $$
declare a uuid;
begin
  a := t_auction('100.00', '10');
  perform t_expire(a, now() - interval '1 second');
  perform public.finalize_auction(a);
  -- coalesce, not bare concatenation: winner_id IS the null under test, and
  -- `null || '/'` is null, so the unguarded form reports NULL whatever the
  -- notification says — it would pass for the wrong reason the day the winner
  -- became non-null and fail for no visible reason today.
  perform t_chk('23. an auction that ends with no bids has no winner and tells only the seller',
    (select coalesce(winner_id::text, 'no-winner') || ' / ' ||
            (select string_agg(type || ':' || user_id, ',')
             from public.notifications where auction_id = a)
     from public.auctions where id = a),
    'no-winner / ended_no_bids:11111111-1111-1111-1111-111111111111');
end $$;

-- ---------------------------------------------------------------------------
-- 24–26. What may move `end_time`, and what may not.
--
-- 26 IS A FINDING AND IT IS WRITTEN AS ONE. CLAUDE.md §5 says `end_time` moves
-- "forward only, in 30-second quanta, only inside `place_bid`, and only
-- together with `extension_count + 1`. Every other shape raises." On V1 a
-- trigger in `20260814000000_bid15_closing_and_extension.sql` made that true.
-- V2's `core_schema.sql` carries NO such trigger. What protects `end_time`
-- today is the RLS policy asserted in 25 — a PERMISSION boundary, not a shape
-- invariant, and permission boundaries do not constrain SECURITY DEFINER code,
-- which is what every RPC in this schema is.
--
-- So 26 asserts what is TRUE (a privileged write moves end_time backwards
-- unopposed) rather than what §5 says SHOULD be true. It is a passing
-- assertion that documents a gap, and the day someone adds the trigger it goes
-- red — which is the correct moment to delete it. Raised with the owner; do not
-- silently "fix" either side.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; t0 timestamptz; n integer; moved boolean;
begin
  a := t_auction('100.00', '10');
  select end_time into t0 from public.auctions where id = a;

  perform t_login('11111111-1111-1111-1111-111111111111');   -- the seller herself
  execute 'set local role authenticated';
  update public.auctions set end_time = now() + interval '99 hours' where id = a;
  get diagnostics n = row_count;
  execute 'reset role';

  perform t_chk('24. RLS lets no client move an ACTIVE auction''s end_time — 0 rows, not an error', n, 0);
  perform t_chk('25. …and the end time is where place_bid left it',
    (select end_time from public.auctions where id = a), t0);

  begin
    perform t_expire(a, now() + interval '10 minutes');
    perform t_expire(a, now() + interval '1 minute');     -- BACKWARD by nine
    moved := (select end_time from public.auctions where id = a) < now() + interval '5 minutes';
  exception when others then
    moved := false;                                        -- a shape trigger exists after all
  end;
  perform t_chk('26. FINDING (CLAUDE.md §5): no forward-only trigger — a privileged write moves end_time BACKWARD',
    moved, true);
end $$;
