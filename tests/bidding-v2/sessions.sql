-- ============================================================================
-- V2 live sessions — `public.place_lot_bid`, the SECOND bidding operation.
--
-- 73 assertions. Until this file existed, `tests/bidding-v2/` covered
-- `place_bid` and nothing covered this one, and the workflow header said so in
-- prose: "the newest bidding code in the tree and the least proven."
--
-- IT IS NOT A VARIANT OF `place_bid`. It is a sibling with its own row lock, on
-- a different table, with three things the auction path has no analogue for:
--
--   • a SESSION state above the lot — scheduled / live / ended / paused — so a
--     bid can be refused for the room's state rather than the item's
--   • an ENTRY GATE. `session_entries.approved` gates BIDDING and never
--     watching, and it is checked AFTER the row lock, which puts it in the same
--     class as `too_low` for the "a rejected bid never extends" rule
--   • a NULL `end_time`. V2.1 added open-ended lots («بدون مدة») on 2026-08-16,
--     and every clock comparison in the function is now guarded by
--     `end_time is not null`. A missing guard is a crash on the demo's headline
--     feature — or, in `advance_session`, an infinite loop. See §33–41.
--
-- The four properties CLAUDE.md §5 calls non-negotiable apply to this function
-- exactly as they do to `place_bid`, and are checks 45–46 (the quantum), 50–51
-- (the cap is a CONSTRAINT), 47–49 (a rejected bid never extends) and 52–53 (at
-- the cap a late bid is still accepted).
--
-- 29 CARRIES THE SAME UNRESOLVED CONTRADICTION AS `acceptance.sql` 19, on the
-- second path. Read CLAUDE.md §0 before touching either.
--
-- Each block is one transaction, because `t_login` writes a TRANSACTION-LOCAL
-- setting — the same scope PostgREST gives a request.
-- ============================================================================

\set ON_ERROR_STOP off

-- A missing null-guard in `advance_session` does not FAIL an assertion — it
-- HANGS. `open_next_lot` refuses an open-ended lot with `lot_still_running`,
-- nothing changes, and the loop reads the same row again, forever. A hung psql
-- is a CI job that burns its whole budget and reports nothing at all. This
-- turns that into a bounded, loud failure: the statement aborts, the block's
-- assertions never print, and run.sh's EXPECTED count says exactly how many
-- were lost. No block here takes a second.
set statement_timeout = '30s';

-- ---------------------------------------------------------------------------
-- 1. Identity comes from the verified session, never from an argument.
--
-- CLAUDE.md §6. `place_lot_bid` is SECURITY DEFINER — it bypasses every row
-- policy on `session_lots`, `session_entries` and `bids` — so its FIRST branch
-- must be the null-identity branch. There is no user-id parameter to spoof
-- because there is no user-id parameter.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid;
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_login(null);
  perform t_chk('1. an anonymous caller is rejected before anything is read — auth_required',
    public.place_lot_bid(l, '100.00') ->> 'error', 'auth_required');
end $$;

-- ---------------------------------------------------------------------------
-- 2–7. The amount, validated as text from a client, BEFORE the row is locked.
--
-- The bidder here has an approved seat on purpose: each rejection below must be
-- about the AMOUNT, and a suite where every refusal could equally have been
-- `entry_required` proves nothing about the amount at all.
--
-- 4 IS THE ONE THAT MATTERS MOST AND LOOKS LIKE THE LEAST. PostgreSQL `numeric`
-- accepts 'NaN', and both `NaN > 0` and `NaN = round(NaN, 2)` are TRUE. Without
-- `< 'Infinity'` a NaN bid is accepted, becomes the lot's `current_price`, and
-- every later comparison against it is false — the lot is unwinnable and the
-- room cannot move past it. `place_bid` carries the same clause and
-- `acceptance.sql` 6 pins it there; this is the second copy, and two copies of
-- a load-bearing clause need two assertions.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_entry(s, b);

  perform t_chk('2. a non-numeric amount is rejected, not coerced',
    t_lot_bid(l, b, 'abc') ->> 'error', 'invalid_amount');
  perform t_chk('3. …and so is one with more than two decimals — REJECTED, never rounded',
    t_lot_bid(l, b, '100.001') ->> 'error', 'invalid_amount');
  perform t_chk('4. NaN is refused. It passes `> 0` and `= round(…,2)`; only `< Infinity` stops it',
    t_lot_bid(l, b, 'NaN') ->> 'error', 'invalid_amount');
  perform t_chk('5. …and so is Infinity',
    t_lot_bid(l, b, 'Infinity') ->> 'error', 'invalid_amount');
  perform t_chk('6. zero is not an amount',
    t_lot_bid(l, b, '0') ->> 'error', 'invalid_amount');
  perform t_chk('7. …nor is a negative one',
    t_lot_bid(l, b, '-5.00') ->> 'error', 'invalid_amount');
end $$;

-- ---------------------------------------------------------------------------
-- 8–11. The lot, then the room. The ORDER of these is the assertion.
--
-- `place_lot_bid` walks: not_found → own_auction → session_not_live → paused →
-- ended → entry_required → too_low. Every one of those is a different exit and
-- three of them exist only on this path.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid;
  b uuid := '22222222-2222-2222-2222-222222222222';
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform t_chk('8. a lot that does not exist is not_found, not a crash',
    t_lot_bid(gen_random_uuid(), b, '100.00') ->> 'error', 'not_found');

  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_chk('9. the host may not bid in her own hall — own_auction',
    t_lot_bid(l, h, '100.00') ->> 'error', 'own_auction');

  -- A hall that has not opened. The lot is `waiting`, but the ROOM is judged
  -- first, so the caller is told why the room is shut rather than why the item
  -- is — the difference between «الجلسة ما بدأت» and «انتهت القطعة» on screen.
  s := t_session('scheduled', 'deposit', now() + interval '1 hour');
  l := t_lot(s, '100.00', '10', 600, 'waiting');
  perform t_entry(s, b);
  perform t_chk('10. a hall that has not opened refuses bids — session_not_live',
    t_lot_bid(l, b, '100.00') ->> 'error', 'session_not_live');

  s := t_session('ended');
  l := t_lot(s, '100.00', '10', 600, 'ended');
  perform t_entry(s, b);
  perform t_chk('11. …and so does one that is over',
    t_lot_bid(l, b, '100.00') ->> 'error', 'session_not_live');
end $$;

-- ---------------------------------------------------------------------------
-- 12. A paused hall refuses bids EXPLICITLY, and that is not belt-and-braces.
--
-- While paused, the open lot's `end_time` is still its old future value —
-- `resume_session` is what moves it, by the paused interval. So the clock alone
-- would happily accept this bid. The lot below ends in ten minutes; the only
-- thing refusing it is the `paused_at` branch.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_entry(s, b);
  update public.sessions set paused_at = clock_timestamp() where id = s;

  perform t_chk('12. a paused hall refuses bids EXPLICITLY — its clock still says there are ten minutes left',
    t_lot_bid(l, b, '100.00') ->> 'error', 'paused');
end $$;

-- ---------------------------------------------------------------------------
-- 13–16. The lot's own state, and LC-03 on this path.
--
-- 14 is the one that matters. There is a window in which a lot's `end_time` has
-- passed but its `status` still says `live` — nothing has swept it yet. A
-- status-gated check accepts bids in that window. The function must judge on
-- `clock_timestamp()`, and 15 proves the flag really did still say `live` when
-- it refused, so 14 cannot pass for the wrong reason.
--
-- 16 pins the ORDER of the two checks V2 put next to each other: the clock is
-- read before the seat. A bidder with no seat, on a lot whose time has gone, is
-- told the lot ended — which is true and which does not leak whether she would
-- have been allowed to bid.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid;
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
begin
  s := t_session();
  perform t_entry(s, b);

  l := t_lot(s, '100.00', '10', 600, 'waiting');
  perform t_chk('13. a lot that has not been reached yet takes no bids — ended',
    t_lot_bid(l, b, '100.00') ->> 'error', 'ended');

  l := t_lot(s);
  perform t_current(s, l);
  perform t_lot_end(l, now() - interval '1 second');
  perform t_chk('14. LC-03: the SERVER CLOCK decides, never the status flag',
    t_lot_bid(l, b, '100.00') ->> 'error', 'ended');
  perform t_chk('15. …and the flag really did still say live when it refused',
    (select status from public.session_lots where id = l), 'live');

  -- c has no entry row at all.
  perform t_chk('16. the clock is judged BEFORE the seat — an unseated bidder on a finished lot is told it ended',
    t_lot_bid(l, c, '100.00') ->> 'error', 'ended');
end $$;

-- ---------------------------------------------------------------------------
-- 17–19. The entry gate — the check the auction path has no analogue for.
--
-- «العربون يفتح المزايدة، مو المشاهدة». Nothing here gates watching: the seat
-- row exists for the unapproved watcher too, and `approved` is the only thing
-- that decides whether a bid lands. 18 is the invite-only case in the moment
-- before the host acts, and it is the state a real hall spends most of its time
-- in — a check that only tested "no row at all" would miss it entirely.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);

  perform t_chk('17. no seat in the hall — entry_required',
    t_lot_bid(l, b, '100.00') ->> 'error', 'entry_required');

  perform t_entry(s, b, false);
  perform t_chk('18. …a seat still awaiting the host is also no seat, and this is the common case',
    t_lot_bid(l, b, '100.00') ->> 'error', 'entry_required');

  perform t_entry(s, b, true);
  perform t_chk('19. …and an approved seat bids',
    t_lot_bid(l, b, '100.00') ->> 'ok', 'true');
end $$;

-- ---------------------------------------------------------------------------
-- 20–25. `join_session` — the only door onto `session_entries`.
--
-- The deposit is a SIMULATION and this is where that is visible: «عربون» halls
-- approve on entry, no gateway is called, no card field exists anywhere, and
-- nothing moves. Invite halls seat the watcher UNAPPROVED and wait for the
-- host. There is no client write path to this table — RLS grants SELECT only —
-- so these two functions are the whole surface.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session('live', 'deposit');
  l := t_lot(s);
  perform t_current(s, l);

  perform t_login(b);
  perform t_chk('20. an «عربون» hall approves the seat on entry — the deposit is simulated and nothing moves',
    public.join_session(s) ->> 'approved', 'true');
  perform t_chk('21. …and that seat bids at once',
    t_lot_bid(l, b, '100.00') ->> 'ok', 'true');
end $$;

do $$
declare s uuid; l uuid;
  b uuid := '22222222-2222-2222-2222-222222222222';
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session('live', 'invite');
  l := t_lot(s);
  perform t_current(s, l);

  perform t_login(b);
  perform t_chk('22. a «بدعوة» hall seats the watcher UNAPPROVED — watching is never gated',
    public.join_session(s) ->> 'approved', 'false');
  perform t_chk('23. …so the bid waits for the host',
    t_lot_bid(l, b, '100.00') ->> 'error', 'entry_required');

  perform t_login(h);
  perform public.approve_entry(s, b);
  perform t_chk('24. …and lands the moment she approves it',
    t_lot_bid(l, b, '100.00') ->> 'ok', 'true');

  perform t_login(h);
  perform t_chk('25. the host has no seat to take in her own hall',
    public.join_session(s) ->> 'error', 'host_cannot_join');
end $$;

-- ---------------------------------------------------------------------------
-- 26–32. The price, computed from the LOCKED row.
--
-- 29 IS THE OPEN CONTRADICTION, ON THE SECOND PATH. `acceptance.sql` 19 pins it
-- for `place_bid`; this pins the identical behaviour in `place_lot_bid`, and
-- the fact that it is identical is the useful part — whoever resolves it has to
-- resolve it in two functions, and a suite that only pinned one would go green
-- on a half-done fix.
--
-- `BR-32` (CLAUDE.md §5) says `+0.01` is as valid as `+1000` and that no
-- minimum raise exists. `D-01` §2 draws the line — "BR-32 governs what the
-- SERVER ACCEPTS. D-01 governs what the SCREEN OFFERS" — and `D-01` §4 required
-- an assertion that the server accepts a non-multiple of the increment. Both
-- shipped functions reject it. This pins WHAT SHIPPED, labelled UNRESOLVED, and
-- goes red in BOTH directions on purpose: fix the server and it fails, which is
-- the moment somebody has to say the decision was made; amend the documents and
-- it keeps passing, correctly. The only state it cannot describe is the one
-- where somebody changed the server and told nobody.
--
-- This has not been decided by anyone, and no session may settle it in code.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; r jsonb;
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  big text := '12345678901234567890123456789012345678.99';
begin
  s := t_session();
  perform t_entry(s, b);
  perform t_entry(s, c);

  l := t_lot(s);                                  -- starts at 100.00, +10
  perform t_current(s, l);
  perform t_chk('26. the FIRST bid may EQUAL the starting price (BR-29)',
    t_lot_bid(l, b, '100.00') ->> 'ok', 'true');

  l := t_lot(s);
  perform t_chk('27. …but not fall below it',
    t_lot_bid(l, b, '99.99') ->> 'error', 'too_low');

  l := t_lot(s);
  perform t_lot_bid(l, b, '100.00');
  perform t_chk('28. matching the current price is not raising it (BR-03)',
    t_lot_bid(l, c, '100.00') ->> 'error', 'too_low');

  r := t_lot_bid(l, c, '100.01');
  perform t_chk('29. UNRESOLVED (CLAUDE.md §0): the server REJECTS current+0.01, which D-01 §4 said it must accept',
    r ->> 'error', 'too_low');
  perform t_chk('30. …and hands the client the minimum as TEXT, not a float (§4 rule 7)',
    r ->> 'min_amount', '110.00');
  perform t_chk('31. current price plus the seller''s increment is what the button sends, and it lands',
    t_lot_bid(l, c, '110.00') ->> 'ok', 'true');

  -- BR-21 / SEC-R3: there is no maximum price and no bid ceiling. 38 integer
  -- digits is far past anything float64 can represent exactly, so a single
  -- `Number()` anywhere on this path changes the stored value.
  --
  -- The bid is placed as its own statement, and the first draft of this was
  -- not: it read `current_price` in the same subquery whose WHERE clause placed
  -- the bid, and came back NULL — the row was read in the scan that wrote it.
  -- It is written down rather than quietly patched because an assertion failing
  -- for its SETUP's reason rather than the schema's is exactly the failure this
  -- whole suite exists to catch, and it caught one of its own.
  l := t_lot(s, big, '10');
  perform t_current(s, l);
  r := t_lot_bid(l, b, big);
  perform t_chk('32. no ceiling — a 40-digit amount is accepted and stored digit for digit',
    (r ->> 'ok') || '/' || (select current_price::text from public.session_lots where id = l),
    'true/' || big);
end $$;

-- ---------------------------------------------------------------------------
-- 33–41. OPEN-ENDED LOTS («بدون مدة») — V2.1, 2026-08-16, decided by Rayan.
--
-- The newest branch in the newest bidding function, shipped the day before this
-- file. A lot with `duration_seconds` NULL opens with `end_time` NULL: it never
-- auto-closes, it has no anti-snipe window because there is no end to snipe,
-- and only the host closes it.
--
-- THAT NULL REACHES THREE FUNCTIONS AND EACH ONE FAILS DIFFERENTLY IF THE GUARD
-- IS MISSING:
--
--   place_lot_bid   `end_time <= v_now` on a NULL is NULL, so the pre-V2.1
--                   shape `status <> 'live' or end_time is null or …` read the
--                   null as EXPIRED and refused every bid with `ended`. That is
--                   check 34, and it is the whole feature.
--   advance_session without `end_time is null` in the loop's exit condition,
--                   the sweep calls open_next_lot, is refused with
--                   `lot_still_running`, changes nothing, and reads the same
--                   row again — FOREVER. Check 38. See the statement_timeout at
--                   the top of this file: a missing guard hangs rather than
--                   fails, and that has to be bounded.
--   open_next_lot   the 15-second «too close to the end» refusal compares
--                   against an end that does not exist. Check 39 is the branch
--                   that must not be reached at all.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; l2 uuid; r jsonb; adv boolean;
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s  := t_session();
  l  := t_lot(s, '100.00', '10', null);              -- «بدون مدة»
  l2 := t_lot(s, '50.00', '10', 600, 'waiting');     -- something to advance TO
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_entry(s, c);

  perform t_chk('33. an open-ended lot is LIVE with no end time — a real state, not a fixture invention',
    (select status || '/' || coalesce(end_time::text, 'null')
       from public.session_lots where id = l), 'live/null');

  r := t_lot_bid(l, b, '100.00');
  perform t_chk('34. …and it TAKES BIDS. Before V2.1 the null read as expired and this said "ended"',
    r ->> 'ok', 'true');
  perform t_chk('35. …reporting no extension, because there is no end to snipe',
    (r ->> 'extended') || '/' || (r ->> 'extension_count'), 'false/0');
  perform t_chk('36. …and carrying a null end time rather than inventing one for the countdown',
    coalesce(r ->> 'end_time', 'null'), 'null');

  perform t_chk('37. a second bid lands too — no clock exists that could have expired it',
    t_lot_bid(l, c, '110.00') ->> 'ok', 'true');

  adv := public.advance_session(s);
  perform t_chk('38. the server sweep leaves it alone and TERMINATES (a missing guard here hangs, it does not fail)',
    adv, false);
  perform t_chk('39. …and the lot it declined to close is still live',
    (select status from public.session_lots where id = l), 'live');

  perform t_login(h);
  perform t_chk('40. only the host closes it — «أغلق وافتح القطعة الجاية»',
    public.host_next_lot(s) ->> 'ok', 'true');
  perform t_chk('41. …and the winner is the last bidder, decided the same way a timed lot decides it',
    (select winner_id from public.session_lots where id = l), c);
end $$;

-- ---------------------------------------------------------------------------
-- 42. The host's close button is REFUSED in a lot's final 15 seconds.
--
-- From the approved design: closing a lot half a second after someone bid is
-- exactly what the extension mechanism exists to stop, so the host is not
-- allowed to do by hand what the server refuses to do by clock. This is the
-- only rule in the session schema that constrains the HOST rather than a
-- bidder, and it is a rule about fairness rather than about state.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session();
  l := t_lot(s, '100.00', '10', 600, 'live', now() + interval '10 seconds');
  perform t_lot(s, '50.00', '10', 600, 'waiting');
  perform t_current(s, l);

  perform t_login(h);
  perform t_chk('42. the host may not close a lot inside its final 15 seconds — too_close_to_end',
    public.host_next_lot(s) ->> 'error', 'too_close_to_end');
end $$;

-- ---------------------------------------------------------------------------
-- 43–44. Outside the window, nothing moves.
--
-- The negative case first: an implementation that extends on EVERY bid also
-- passes every "it extended" assertion below. Without this one the suite cannot
-- tell anti-snipe from an unconditional +30s.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; t0 timestamptz; r jsonb;
  b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session();
  l := t_lot(s);                                   -- ten minutes out
  perform t_current(s, l);
  perform t_entry(s, b);
  select end_time into t0 from public.session_lots where id = l;

  r := t_lot_bid(l, b, '100.00');
  perform t_chk('43. a bid outside the final 15s does not move the lot''s end time',
    (select end_time from public.session_lots where id = l), t0);
  perform t_chk('44. …and the reply says so, so the client does not animate a jump',
    r ->> 'extended', 'false');
end $$;

-- ---------------------------------------------------------------------------
-- 45–49. Inside the window: +30 seconds EXACTLY, and only on ACCEPTANCE.
--
-- "Exactly" is the assertion, and 45 compares against the lot's PREVIOUS end
-- time rather than against now(). `end_time + interval '30 seconds'` and
-- `clock_timestamp() + interval '30 seconds'` read almost identically and
-- differ enormously — the second resets the clock on every bid, so a contested
-- lot runs 30 seconds from the last bid instead of extending its own end. The
-- two cannot both pass this.
--
-- 47–49 are CLAUDE.md §5's "a rejected bid never extends", and this path has
-- TWO rejections after the row lock where the auction path has one. Both are
-- exercised: `too_low`, and `entry_required` — an unseated bidder who could
-- otherwise hold a lot open forever with bids that never count. Note the
-- deliberate reset before them: after the first extension the lot ends 40
-- seconds out, which is OUTSIDE the window, and a rejected bid would then fail
-- to extend for a reason that has nothing to do with being rejected.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; t0 timestamptz; t1 timestamptz;
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  d uuid := '44444444-4444-4444-4444-444444444444';
begin
  s := t_session();
  l := t_lot(s, '100.00', '10', 600, 'live', now() + interval '10 seconds');
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_entry(s, c);
  select end_time into t0 from public.session_lots where id = l;

  perform t_lot_bid(l, b, '100.00');
  select end_time into t1 from public.session_lots where id = l;
  perform t_chk('45. inside the window the end moves by EXACTLY 30s, measured from the OLD end and never from now()',
    t1, t0 + interval '30 seconds');
  perform t_chk('46. …and exactly one extension is counted',
    (select extension_count from public.session_lots where id = l), 1);

  -- Back inside the window, or the two rejections below would be outside it and
  -- would pass for the wrong reason.
  perform t_lot_end(l, now() + interval '10 seconds');
  select end_time into t1 from public.session_lots where id = l;

  perform t_chk('47. a too_low bid inside the window is refused…',
    t_lot_bid(l, c, '1.00') ->> 'error', 'too_low');
  perform t_chk('48. …and an unseated bidder is too — the rejection this path has and the auction path does not',
    t_lot_bid(l, d, '99999.00') ->> 'error', 'entry_required');
  perform t_chk('49. …and NEITHER extended the lot. A rejected bid holding a lot open forever is the defect.',
    (select end_time::text || '/' || extension_count::text from public.session_lots where id = l),
    t1::text || '/1');
end $$;

-- ---------------------------------------------------------------------------
-- 50–53. The cap: a CHECK CONSTRAINT, and what happens AT it.
--
-- 51 is the only way to tell a constraint from an `if` that happens to behave
-- like one today. Without the constraint a contested lot never ends, never
-- finalizes, and never has a winner — and the room behind it never advances,
-- which is worse here than on a standalone auction.
--
-- 52 is the property that reads like a bug and is not: the cap ends the
-- EXTENDING, not the BIDDING.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; t1 timestamptz; caught boolean;
  b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_entry(s, b);

  begin
    update public.session_lots set extension_count = 21 where id = l;
    caught := false;
  exception when check_violation then
    caught := true;
  end;
  perform t_chk('50. the 20-extension cap REJECTS a 21st at the storage layer', caught, true);

  perform t_chk('51. …and it is a CHECK constraint on the table, not a branch in a function',
    (select count(*) from pg_constraint
      where conrelid = 'public.session_lots'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%extension_count%'), 1::bigint);

  -- Driven to the cap directly: the count is data, and what is under test is
  -- the behaviour AT the cap, not the route taken to reach it.
  update public.session_lots set extension_count = 20 where id = l;
  perform t_lot_end(l, now() + interval '5 seconds');
  select end_time into t1 from public.session_lots where id = l;

  perform t_chk('52. AT THE CAP A LATE BID IS STILL ACCEPTED — the cap ends the extending, not the bidding',
    t_lot_bid(l, b, '100.00') ->> 'ok', 'true');
  perform t_chk('53. …and the end time did not move, so the lot can actually close',
    (select end_time::text || '/' || extension_count::text from public.session_lots where id = l),
    t1::text || '/20');
end $$;

-- ---------------------------------------------------------------------------
-- 54–57. Pause and resume — the OTHER door onto a lot's `end_time`.
--
-- `place_lot_bid` is not the only writer here, and that is a deliberate
-- difference from the auction path. `resume_session` adds the paused wall-clock
-- interval to the open lot's end, which keeps the direction rule (`end_time`
-- moves FORWARD) while giving the room back the time it lost.
--
-- 55 is the one worth stating: a pause is not a snipe. If resume touched
-- `extension_count`, a host could pause twenty times and exhaust the cap
-- without a single bid being placed, and the next contested lot would have no
-- anti-snipe protection left.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; t0 timestamptz; t1 timestamptz;
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  update public.session_lots set extension_count = 3 where id = l;
  select end_time into t0 from public.session_lots where id = l;

  perform t_login(h);
  perform public.pause_session(s);
  -- Age the pause rather than wait two real minutes. Setup only: the interval
  -- resume applies is still the one resume computes for itself.
  update public.sessions set paused_at = clock_timestamp() - interval '2 minutes' where id = s;
  perform public.resume_session(s);
  select end_time into t1 from public.session_lots where id = l;

  perform t_chk('54. resume moves the open lot''s end FORWARD by the paused interval',
    t1 between t0 + interval '119 seconds' and t0 + interval '125 seconds', true);
  perform t_chk('55. …and never touches the extension count. A pause is not a snipe.',
    (select extension_count from public.session_lots where id = l), 3);
end $$;

do $$
declare s uuid; l uuid;
begin
  s := t_session();
  -- Overdue: the ONLY thing stopping the sweep below is the pause.
  l := t_lot(s, '100.00', '10', 600, 'live', now() - interval '1 minute');
  perform t_lot(s, '50.00', '10', 600, 'waiting');
  perform t_current(s, l);
  update public.sessions set paused_at = clock_timestamp() where id = s;

  perform t_chk('56. a paused hall does not advance on the sweep, even with a lot long past due',
    public.advance_session(s), false);
  perform t_chk('57. …and the lot it would have closed is untouched',
    (select status from public.session_lots where id = l), 'live');
end $$;

-- ---------------------------------------------------------------------------
-- 58–60. One `bids` table, two kinds of auction, exactly one target.
--
-- V2.1 did not give lots their own bid table: one history shape, one ordering
-- rule (by `id`, never `created_at`), one place a reviewer has to look. The
-- constraint is what stops that from becoming a row that belongs to both or to
-- neither — and a bid belonging to neither is a row no query in the product
-- would ever return, which is the kind of orphan nobody finds.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; a uuid; caught boolean;
  b uuid := '22222222-2222-2222-2222-222222222222';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_lot_bid(l, b, '100.00');

  perform t_chk('58. a lot bid names the lot and NOT an auction',
    (select coalesce(auction_id::text, 'null') || '/' || (lot_id = l)::text
       from public.bids where lot_id = l order by id desc limit 1), 'null/true');

  a := t_auction('100.00', '10');
  begin
    insert into public.bids (auction_id, lot_id, bidder_id, amount) values (a, l, b, '200.00');
    caught := false;
  exception when check_violation then
    caught := true;
  end;
  perform t_chk('59. a bid may not name BOTH an auction and a lot', caught, true);

  begin
    insert into public.bids (bidder_id, amount) values (b, '200.00');
    caught := false;
  exception when check_violation then
    caught := true;
  end;
  perform t_chk('60. …nor neither, which would be a row no query in the product returns', caught, true);
end $$;

-- ---------------------------------------------------------------------------
-- 61–65. What the room tells people, and what it must never tell them.
--
-- 65 is CLAUDE.md §6 asked from the other end. Rather than checking the three
-- payloads this block happens to build, it scans EVERY notification the whole
-- suite has produced — auctions and lots, every type — for an `@`. A join that
-- reintroduced an email would be caught by whichever suite ran, not by whoever
-- remembered to look.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; p jsonb;
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_entry(s, c);

  perform t_lot_bid(l, b, '100.00');
  perform t_lot_bid(l, c, '110.00');

  perform t_chk('61. the outbid notice reaches the previous leader, and only her',
    (select string_agg(distinct user_id::text, ',')
       from public.notifications where lot_id = l and type = 'outbid'), b::text);

  select payload into p from public.notifications
   where lot_id = l and type = 'outbid' order by id desc limit 1;
  perform t_chk('62. …with every amount in it a STRING on the wire (§4 rule 7)',
    jsonb_typeof(p -> 'amount') || '/' || jsonb_typeof(p -> 'increment'), 'string/string');
  perform t_chk('63. …and the hall named, so the client can route back into the room',
    p ->> 'session_id', s::text);
end $$;

do $$
declare s uuid; l uuid;
  b uuid := '22222222-2222-2222-2222-222222222222';
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session();
  l := t_lot(s);
  perform t_lot(s, '50.00', '10', 600, 'waiting');
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_lot_bid(l, b, '100.00');

  perform t_login(h);
  perform public.host_next_lot(s);

  perform t_chk('64. closing a lot tells the winner and the host, once each, with the amount as text',
    (select string_agg(type || ':' || (payload ->> 'amount'), ',' order by type)
       from public.notifications where lot_id = l and type in ('won', 'sold')),
    'sold:100.00,won:100.00');

  perform t_chk('65. NO EMAIL in ANY notification this suite has produced (§6) — asked of every row, not of three',
    (select count(*) from public.notifications where payload::text like '%@%'), 0::bigint);
end $$;

-- ---------------------------------------------------------------------------
-- 66. A lot nobody bid on tells the host, and nobody else.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session();
  l := t_lot(s);
  perform t_lot(s, '50.00', '10', 600, 'waiting');
  perform t_current(s, l);

  perform t_login(h);
  perform public.host_next_lot(s);

  perform t_chk('66. a lot that closes with no bids tells only the host',
    (select string_agg(type || ':' || user_id::text, ',')
       from public.notifications where lot_id = l),
    'ended_no_bids:' || h::text);
end $$;

-- ---------------------------------------------------------------------------
-- 67. The winner is the LAST BID BY `bids.id`.
--
-- Written directly, and this is the only setup in this file that bypasses the
-- product — for the same reason `closing.sql` 22 does. `place_lot_bid` only
-- ever produces an increasing sequence, so a suite built entirely from it
-- cannot tell `order by id desc` from `order by amount desc` or from
-- `order by created_at desc`: all three agree on every state the product
-- reaches on its own. Under contention it reaches this state by itself —
-- `created_at` defaults to `now()`, which is transaction START, before the bid
-- queued on the row lock.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid;
  b uuid := '22222222-2222-2222-2222-222222222222';
  c uuid := '33333333-3333-3333-3333-333333333333';
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session();
  l := t_lot(s);
  perform t_lot(s, '50.00', '10', 600, 'waiting');
  perform t_current(s, l);

  insert into public.bids (lot_id, bidder_id, amount, created_at)
  values (l, b, '200.00', now());                              -- higher, earlier id
  insert into public.bids (lot_id, bidder_id, amount, created_at)
  values (l, c, '150.00', now() - interval '1 minute');        -- lower, older stamp, LAST id

  perform t_login(h);
  perform public.host_next_lot(s);

  perform t_chk('67. the winner is the last bid by id — not the highest amount, not the latest created_at',
    (select winner_id from public.session_lots where id = l), c);
end $$;

-- ---------------------------------------------------------------------------
-- 68. Ending a hall early settles the open lot and closes the rest.
--
-- «القطعة المفتوحة تنتهي عادي والباقي ما وصلت» — the bidders on the open lot
-- keep their result; lots never reached end with no winner rather than being
-- deleted, so a bidder's history never loses a row it once showed.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; l2 uuid;
  b uuid := '22222222-2222-2222-2222-222222222222';
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s  := t_session();
  l  := t_lot(s);
  l2 := t_lot(s, '50.00', '10', 600, 'waiting');
  perform t_current(s, l);
  perform t_entry(s, b);
  perform t_lot_bid(l, b, '100.00');

  perform t_login(h);
  perform public.end_session(s);

  perform t_chk('68. ending a hall settles the open lot and closes the ones still waiting',
    (select status from public.sessions where id = s) || '/' ||
    (select status || ':' || coalesce(winner_id::text, 'none') from public.session_lots where id = l) || '/' ||
    (select status || ':' || coalesce(winner_id::text, 'none') from public.session_lots where id = l2),
    'ended/ended:' || b::text || '/ended:none');
end $$;

-- ---------------------------------------------------------------------------
-- 69–70. Once the room is live, no CLIENT may touch a lot's clock.
--
-- `authenticated` holds INSERT/UPDATE/DELETE on `session_lots` — the host has
-- to be able to build and reorder her lots before the hall opens. What stops
-- her reaching in mid-room is the policy's `status in ('draft','scheduled')`,
-- and this asserts it from the strongest position: the HOST herself, on her own
-- session, gets zero rows rather than an error.
--
-- Note what this is NOT. Like `closing.sql` 24–26, it is a PERMISSION boundary,
-- not a shape invariant, and permission boundaries do not constrain
-- SECURITY DEFINER code — which is what every function in this file is.
-- ---------------------------------------------------------------------------
do $$
declare s uuid; l uuid; t0 timestamptz; n integer;
  h uuid := '11111111-1111-1111-1111-111111111111';
begin
  s := t_session();
  l := t_lot(s);
  perform t_current(s, l);
  select end_time into t0 from public.session_lots where id = l;

  perform t_login(h);
  execute 'set local role authenticated';
  update public.session_lots set end_time = now() + interval '99 hours' where id = l;
  get diagnostics n = row_count;
  execute 'reset role';

  perform t_chk('69. once the hall is live even the HOST moves no lot clock — 0 rows, not an error', n, 0);
  perform t_chk('70. …and the end time is where the server left it',
    (select end_time from public.session_lots where id = l), t0);
end $$;

-- ---------------------------------------------------------------------------
-- 71–73. The grants, which are the FIRST gate.
--
-- A perfect policy still returns 42501 without a GRANT, and a missing REVOKE
-- lets a caller reach a SECURITY DEFINER function directly. This suite runs as
-- a superuser, so it cannot notice either by accident — the catalogue has to be
-- asked.
--
-- 73 is deliberate and looks wrong. `advance_session` is open to ANYONE,
-- including anonymous readers, because a watcher's page load is what closes a
-- due lot when pg_cron is not there. It is safe because it acts only on the
-- SERVER clock and can never do anything the clock did not already justify.
-- `open_next_lot`, which takes a `force` flag and would let a caller close a
-- live lot early, is revoked from everyone.
-- ---------------------------------------------------------------------------
do $$
begin
  perform t_chk('71. place_lot_bid is executable by signed-in callers and by nobody else',
    has_function_privilege('anon', 'public.place_lot_bid(uuid,text)', 'EXECUTE')::text || '/' ||
    has_function_privilege('authenticated', 'public.place_lot_bid(uuid,text)', 'EXECUTE')::text,
    'false/true');

  perform t_chk('72. open_next_lot is executable by NOBODY — its force flag closes a live lot',
    has_function_privilege('anon', 'public.open_next_lot(uuid,boolean)', 'EXECUTE')::text || '/' ||
    has_function_privilege('authenticated', 'public.open_next_lot(uuid,boolean)', 'EXECUTE')::text,
    'false/false');

  perform t_chk('73. advance_session IS open to everyone on purpose — it obeys the server clock and nothing else',
    has_function_privilege('anon', 'public.advance_session(uuid)', 'EXECUTE')::text || '/' ||
    has_function_privilege('authenticated', 'public.advance_session(uuid)', 'EXECUTE')::text,
    'true/true');
end $$;
