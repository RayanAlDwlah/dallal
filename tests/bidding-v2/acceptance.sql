-- ============================================================================
-- V2 bid acceptance — `public.place_bid`, the only write path into `bids`.
--
-- 32 assertions. Every one of them is a rule some document states in prose and
-- nothing mechanical was checking on this branch until this file existed.
--
-- Each block is one transaction, because `t_login` writes a TRANSACTION-LOCAL
-- setting — the same scope PostgREST gives a request. Session-scoped would
-- leak an identity from one assertion into the next, and the assertion that
-- caught it would be the one that no longer had an identity at all.
-- ============================================================================

\set ON_ERROR_STOP off

-- ---------------------------------------------------------------------------
-- 1–2. Identity arrives from the signup trigger, not from a fixture.
--
-- The seed inserts `auth.users` and NEVER `public.profiles`. If
-- `handle_new_user` were broken, every later block would fail on a foreign key
-- rather than reporting the real cause here.
-- ---------------------------------------------------------------------------
do $$
begin
  perform t_chk('1. signup creates a profile with the display name from metadata',
    (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
    'مزايد أ');

  -- buyer-c signed up with no display_name; handle_new_user falls back to the
  -- email's local part. Not a nicety: a null here is a NOT NULL violation that
  -- would make signup itself fail in production.
  perform t_chk('2. …and falls back to the email local part when metadata has none',
    (select display_name from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
    'buyer-c');
end $$;

-- ---------------------------------------------------------------------------
-- 3. Identity comes from the verified session, never from an argument.
--
-- CLAUDE.md §6. `place_bid` is SECURITY DEFINER, so it bypasses row policies —
-- which is exactly why its FIRST branch must be the null-identity branch. There
-- is no user-id parameter to spoof because there is no user-id parameter.
-- ---------------------------------------------------------------------------
do $$
declare a uuid;
begin
  a := t_auction('100.00', '10');
  perform t_login(null);
  perform t_chk('3. an anonymous caller is rejected — auth_required',
    public.place_bid(a, '100.00') ->> 'error', 'auth_required');
end $$;

-- ---------------------------------------------------------------------------
-- 4–9. The amount is validated BEFORE the row is locked, and it is validated
-- as text arriving from a client. CLAUDE.md §4: no floating point on an amount,
-- ever; more than two decimals is REJECTED, never rounded.
--
-- 6 IS THE ONE THAT MATTERS MOST AND LOOKS LIKE THE LEAST. PostgreSQL `numeric`
-- accepts 'NaN', and both `NaN > 0` and `NaN = round(NaN, 2)` are TRUE. Without
-- the `< 'Infinity'` clause a NaN bid is accepted, becomes `current_price`, and
-- every subsequent comparison against it is false — the auction is permanently
-- unwinnable. The clause looks redundant in review. It is the opposite.
-- ---------------------------------------------------------------------------
do $$
declare a uuid;
begin
  a := t_auction('100.00', '10');

  perform t_chk('4. a non-numeric amount is rejected, not coerced',
    t_bid(a, '22222222-2222-2222-2222-222222222222', 'abc') ->> 'error', 'invalid_amount');

  perform t_chk('5. three decimals is REJECTED, never rounded',
    t_bid(a, '22222222-2222-2222-2222-222222222222', '100.001') ->> 'error', 'invalid_amount');

  perform t_chk('6. NaN is rejected — it passes > 0 and = round(NaN,2) and would freeze the auction',
    t_bid(a, '22222222-2222-2222-2222-222222222222', 'NaN') ->> 'error', 'invalid_amount');

  perform t_chk('7. Infinity is rejected',
    t_bid(a, '22222222-2222-2222-2222-222222222222', 'Infinity') ->> 'error', 'invalid_amount');

  perform t_chk('8. zero is rejected',
    t_bid(a, '22222222-2222-2222-2222-222222222222', '0') ->> 'error', 'invalid_amount');

  perform t_chk('9. a negative amount is rejected',
    t_bid(a, '22222222-2222-2222-2222-222222222222', '-5.00') ->> 'error', 'invalid_amount');
end $$;

-- ---------------------------------------------------------------------------
-- 10–15. What the auction's own state does to a bid.
--
-- 14 is `LC-03` and it is the one a status-gated implementation gets wrong.
-- There is a window where `end_time` has passed but `finalize_auction` has not
-- run and the flag still says `active`. Eligibility is decided by the SERVER
-- CLOCK against `end_time`, never by the flag — and by `clock_timestamp()`,
-- not `now()`, because `now()` freezes at transaction start, before the bid
-- queued on the lock.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; d uuid; e uuid; w uuid;
begin
  d := t_auction('100.00', '10', now() + interval '1 hour', 'draft');
  perform t_chk('10. a bid on a DRAFT auction is refused — an unpublished listing is not biddable',
    t_bid(d, '22222222-2222-2222-2222-222222222222', '100.00') ->> 'error', 'not_found');

  perform t_chk('11. a bid on an auction that does not exist is refused',
    t_bid('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', '100.00')
      ->> 'error', 'not_found');

  a := t_auction('100.00', '10');
  perform t_chk('12. the seller cannot bid on their own auction',
    t_bid(a, '11111111-1111-1111-1111-111111111111', '100.00') ->> 'error', 'own_auction');

  e := t_auction('100.00', '10');
  perform t_expire(e, now() - interval '1 minute');
  perform public.finalize_auction(e);
  perform t_chk('13. a bid on an auction whose status is already ended is refused',
    t_bid(e, '22222222-2222-2222-2222-222222222222', '100.00') ->> 'error', 'ended');

  -- The window: time has passed, finalize has NOT run, the flag still lies.
  w := t_auction('100.00', '10');
  perform t_expire(w, now() - interval '1 second');
  perform t_chk('14. LC-03 — end_time in the past is refused even while status still says active',
    t_bid(w, '22222222-2222-2222-2222-222222222222', '100.00') ->> 'error', 'ended');
  perform t_chk('15. …and that auction really was still flagged active when the bid was refused',
    (select status from public.auctions where id = w), 'active');
end $$;

-- ---------------------------------------------------------------------------
-- 16–21. The price rules. Something must distinguish the first bid from the
-- rest — `BR-29`/`SC-55` let the first bid EQUAL the starting price, `BR-03`
-- makes every later one strictly greater. V2 derives it inside the row lock
-- from `current_price is null` rather than adding a column, which is what
-- CLAUDE.md §5 asks for.
--
-- 19 IS THE OPEN CONTRADICTION, PINNED AS IT SHIPPED — READ THE COMMENT.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; r jsonb;
begin
  a := t_auction('100.00', '10');

  perform t_chk('16. the first bid may EQUAL the starting price (BR-29, SC-55)',
    (t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00') ->> 'ok'), 'true');

  a := t_auction('100.00', '10');
  perform t_chk('17. …but not fall below it',
    t_bid(a, '22222222-2222-2222-2222-222222222222', '99.99') ->> 'error', 'too_low');

  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_chk('18. a later bid EQUAL to the current price is refused (BR-03, strictly greater)',
    t_bid(a, '33333333-3333-3333-3333-333333333333', '100.00') ->> 'error', 'too_low');

  -- ========================================================================
  -- 19. THE ASSERTION `D-01` §4 REQUIRED, INVERTED — AND THAT INVERSION IS
  --     THE FINDING, NOT A CHOICE THIS FILE MADE.
  --
  -- `D-01` §4 required this exact test to ship in the same PR as the
  -- `bid_increment` column, and it required the ANSWER TO BE `true`:
  --
  --     "the server accepts an amount that is NOT a multiple of the increment"
  --
  -- because `D-01` §2 says "BR-32 governs what the SERVER ACCEPTS. D-01 governs
  -- what the SCREEN OFFERS", and lists `current price + 0.01` among the amounts
  -- that "must still be accepted by place_bid". `BR-32` and `SD-05` say the
  -- same. The shipped server says `too_low`.
  --
  -- SO THIS ASSERTION PINS WHAT SHIPPED, NOT WHAT THE DOCUMENTS ASK FOR, AND
  -- IT IS LABELLED AS SUCH. Writing it the other way round would turn the
  -- suite red for reporting the truth, and someone would "fix" the suite. It
  -- goes red in BOTH directions on purpose, exactly like the doc-graph check
  -- that guards the same contradiction: resolve it way (a) — `place_bid` drops
  -- back to `> current_price` — and this fails, which is the moment someone
  -- must state that the decision was made. Resolve it way (b) — amend `BR-32`,
  -- `SD-05` and `PRD` §21.1 Q4 — and this keeps passing, correctly, because
  -- the code was right all along.
  --
  -- The only state in which this assertion is a lie is the one where somebody
  -- changed the server and told nobody. See CLAUDE.md §0.
  -- ========================================================================
  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  r := t_bid(a, '33333333-3333-3333-3333-333333333333', '100.01');
  perform t_chk('19. UNRESOLVED (CLAUDE.md §0): the server REJECTS current+0.01, which D-01 §4 said it must accept',
    r ->> 'error', 'too_low');
  perform t_chk('20. …and the rejection tells the client the minimum, as text not a float',
    r ->> 'min_amount', '110.00');

  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_chk('21. current price + increment is accepted',
    t_bid(a, '33333333-3333-3333-3333-333333333333', '110.00') ->> 'ok', 'true');
end $$;

-- ---------------------------------------------------------------------------
-- 22–24. The two checks CLAUDE.md §5 says must NOT exist, and their absence is
-- the requirement. Neither can be proven by reading — the absence of a check is
-- invisible in a diff. Only a bid that succeeds proves it.
-- ---------------------------------------------------------------------------
do $$
declare a uuid; big text;
begin
  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_chk('22. BR-24 — being the current leader is never grounds to reject',
    t_bid(a, '22222222-2222-2222-2222-222222222222', '110.00') ->> 'ok', 'true');

  -- BR-21 / SEC-R3: no maximum price and no bid ceiling. 40 digits is not a
  -- silly number here — it is the shape of the defect a `numeric(12,2)` typmod
  -- or a JS `Number` would introduce, and both are things this project has been
  -- warned about by name.
  big := '12345678901234567890123456789012345678.99';
  a := t_auction('100.00', '10');
  perform t_chk('23. BR-21 — no ceiling: a 40-digit bid is accepted',
    t_bid(a, '22222222-2222-2222-2222-222222222222', big) ->> 'ok', 'true');
  perform t_chk('24. …and is stored digit-for-digit, with no float anywhere on the path',
    (select amount::text from public.bids where auction_id = a), big);
end $$;

-- ---------------------------------------------------------------------------
-- 25–28. What an accepted bid does to the auction row and to the history.
--
-- 28 is the ordering rule. `created_at` defaults to `now()` = TRANSACTION
-- START, which is before the bid queued on the row lock, so sorting by it
-- renders a DECREASING bid history under contention — measured at 2 of 12
-- contended auctions on V1. `bids.id` follows lock order. The concurrency
-- runner proves this under real contention; this proves the column exists and
-- is monotonic in the simple case.
-- ---------------------------------------------------------------------------
do $$
declare a uuid;
begin
  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '110.00');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '120.00');

  perform t_chk('25. bid_count counts the accepted bids',
    (select bid_count from public.auctions where id = a), 3);
  perform t_chk('26. current_price is the last accepted amount, as text',
    (select current_price::text from public.auctions where id = a), '120.00');
  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '1.00');   -- refused: too_low
  perform t_chk('27. a rejected bid moves neither of them',
    (select bid_count::text || '/' || current_price::text from public.auctions where id = a),
    '3/120.00');
  perform t_chk('28. history ordered by bids.id is non-decreasing in amount',
    (select bool_and(ok) from (
       select amount >= lag(amount) over (order by id) as ok
       from public.bids where auction_id = a) s
     where ok is not null),
    true);
end $$;

-- ---------------------------------------------------------------------------
-- 29–31. The outbid notification. §6: email addresses are never visible to
-- anyone but their owner, "not in bid history, not in seller names, not in
-- results, not in realtime payloads". The notification payload is the newest
-- place that guarantee could leak from, so it is read here field by field.
-- ---------------------------------------------------------------------------
do $$
declare a uuid;
begin
  a := t_auction('100.00', '10');
  perform t_bid(a, '22222222-2222-2222-2222-222222222222', '100.00');
  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '110.00');

  perform t_chk('29. the outbid leader is notified, and only them',
    (select string_agg(user_id::text, ',' order by user_id) from public.notifications
     where auction_id = a and type = 'outbid'),
    '22222222-2222-2222-2222-222222222222');

  perform t_chk('30. §6 — no email address anywhere in the notification payload',
    (select bool_or(payload::text like '%@%') from public.notifications where auction_id = a),
    false);

  -- The leader raising their own bid must not notify themselves. `place_bid`
  -- guards it with `v_prev_leader <> v_user`; without that a bidder gets a push
  -- saying they were outbid by themselves.
  perform t_bid(a, '33333333-3333-3333-3333-333333333333', '120.00');
  perform t_chk('31. a leader raising their own bid notifies nobody',
    (select count(*) from public.notifications where auction_id = a and type = 'outbid'),
    1::bigint);
end $$;

-- ---------------------------------------------------------------------------
-- 32. There is no second door into `bids`.
--
-- Read from the catalogue rather than by attempting an insert: a failed insert
-- proves the policy said no, while this proves the VERB DOES NOT EXIST for
-- either Data API role — which is the stronger claim and the one
-- `core_schema.sql` makes in a comment ("no insert/update/delete on bids,
-- ever — the only door into that table is place_bid()"). RLS is the second
-- gate; a missing GRANT is the first.
-- ---------------------------------------------------------------------------
do $$
begin
  perform t_chk('32. neither anon nor authenticated may write to bids by any verb',
    (select string_agg(r || ':' || v, ' ' order by r, v)
     from unnest(array['anon','authenticated']) r,
          unnest(array['INSERT','UPDATE','DELETE']) v
     where has_table_privilege(r, 'public.bids', v)),
    null::text);
end $$;
