-- ============================================================================
-- Acceptance suite for the realtime foundation (BID-08).
--
-- Run via ./run.sh — it needs the shim, the four migrations and the test-only
-- seed applied first, in that order.
--
-- What this suite can and cannot prove, said before the first assertion.
--
-- It CANNOT prove delivery. No websocket exists here, and the Realtime service
-- is not a PostgreSQL object. Delivery was proven separately, against
-- dallal-dev with a real anon browser client, and the literal payload output is
-- recorded in docs/BID-08-realtime-verification.md. Anything below that read
-- like a delivery claim would be the exact defect this project keeps catching:
-- a test that cannot fail for the reason it says it tests.
--
-- What it CAN prove is everything that decides whether delivery is safe:
--   * what the payload contains — RT-S1, RT-S2, SC-42, ARCH §14.4
--   * that every state change §14.3 lists announces itself, including each
--     auction in a multi-row sweep
--   * that a broadcast failure cannot take a bid with it — RT-R7, ADR-9
--   * that the policy is SELECT-only, so an anonymous visitor cannot fabricate
--     an event on a topic they choose
--
-- The realtime.send this runs against is the double in lib/supabase-shim.sql.
-- Its signature and its write are the deployed ones; its ONE divergence (it
-- raises instead of swallowing when told to) is what makes RT-R7 testable at
-- all, and is documented there.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

create or replace function pg_temp.chk(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %  (%)', rpad(label, 52), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 52), got, want;
  end if;
end $$;

create or replace function pg_temp.chk_like(label text, got text, pat text)
returns void language plpgsql as $$
begin
  if got like pat then
    raise notice 'PASS  %  (%)', rpad(label, 52), left(got, 60);
  else
    raise warning 'FAIL  %  got=%  want~=%', rpad(label, 52), got, pat;
  end if;
end $$;

-- Same fixture, same reason, as closing.sql: to test a closed auction the end
-- time has to move backwards, and nothing in the product can do that —
-- auctions_immutable_terms makes it monotonic and 30-second-quantised, which is
-- the property BID-15 exists to create. The fixture uses the back door in the
-- open; the assertions are what prove the front door is locked.
create or replace function pg_temp.expire(p_auction uuid, p_seconds integer default 1)
returns void language plpgsql as $$
begin
  alter table public.auctions disable trigger auctions_immutable_terms;
  update public.auctions
     set end_time = clock_timestamp() - make_interval(secs => p_seconds)
   where id = p_auction;
  alter table public.auctions enable trigger auctions_immutable_terms;
end $$;

create or replace function pg_temp.new_auction(p_end interval default interval '1 hour')
returns uuid language sql as $$
  insert into public.auctions
    (owner_id, status, end_time, starting_price, current_price,
     name, description, image_path)
  values ('00000000-0000-0000-0000-0000000000a1', 'active',
          clock_timestamp() + p_end, 100, 100,
          'ساعة اختبار', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/a.jpg')
  returning id;
$$;

-- Messages accumulate across the whole run: acceptance.sql and closing.sql bid
-- too, and now announce it. Every count below is therefore a DELTA on one
-- topic, never a total. Nothing is deleted — realtime.messages is append-only
-- in production and a suite that truncated it would be measuring a table
-- shape the product never sees.
create or replace function pg_temp.rt(p_auction uuid)
returns bigint language sql stable as $$
  select count(*) from realtime.messages where topic = 'auction:' || p_auction::text;
$$;


-- ###########################################################################
-- 1. The wiring — where the signal comes from, and what it is NOT
-- ###########################################################################
do $$
begin
  perform pg_temp.chk_like(
    'BID-08 announcement fires AFTER a committed row update',
    coalesce((select pg_get_triggerdef(t.oid) from pg_trigger t
               where t.tgrelid = 'public.auctions'::regclass
                 and t.tgname = 'auctions_broadcast'), '(no such trigger)'),
    '%AFTER UPDATE ON public.auctions FOR EACH ROW%');

  perform pg_temp.chk(
    'BID-08 broadcast function pins its search_path',
    coalesce((select array_to_string(p.proconfig, ',') from pg_proc p
               where p.proname = 'auctions_broadcast_change'), '(none)'),
    'search_path=""');

  -- §1 and §4 of the migration. If someone later uncomments the publication
  -- line 20260812120000 left behind, both paths run at once and the
  -- postgres_changes one re-introduces #103 and the bidder_id exposure that
  -- the trigger above was written to avoid. This is the assertion that says so.
  perform pg_temp.chk(
    'no auction or bid table is published for postgres_changes',
    (select count(*)::text from pg_publication_tables
      where schemaname = 'public' and tablename in ('auctions', 'bids')),
    '0');

  -- The other reflex fix for "the payload is missing columns". It would put
  -- the entire OLD row of every update into the WAL — strictly more exposure,
  -- for a stream this product does not use.
  perform pg_temp.chk(
    'REPLICA IDENTITY on auctions is default, not FULL',
    (select relreplident::text from pg_class where oid = 'public.auctions'::regclass), 'd');
  perform pg_temp.chk(
    'REPLICA IDENTITY on bids is default, not FULL',
    (select relreplident::text from pg_class where oid = 'public.bids'::regclass), 'd');
end $$;


-- ###########################################################################
-- 2. The payload — the whole privacy claim (RT-S1, RT-S2, SC-42, §14.4)
-- ###########################################################################
do $$
declare
  v_auction uuid;
  v_before  bigint;
  v_msg     realtime.messages%rowtype;
begin
  v_auction := pg_temp.new_auction();
  v_before  := pg_temp.rt(v_auction);

  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000b1')::text, false);
  perform public.place_bid(v_auction, '1250.75');

  perform pg_temp.chk('an accepted bid announces itself, exactly once',
    (pg_temp.rt(v_auction) - v_before)::text, '1');

  select * into v_msg from realtime.messages
   where topic = 'auction:' || v_auction::text
   order by inserted_at desc, id limit 1;

  -- §14.2: scoped per auction, never global. The topic IS the scope.
  perform pg_temp.chk('the topic names that one auction',
    v_msg.topic, 'auction:' || v_auction::text);
  perform pg_temp.chk('the event is named',            v_msg.event,   'auction_changed');
  perform pg_temp.chk('the message is private',        v_msg.private::text, 'true');

  -- The structural assertion. `id` is realtime.send's own message id, injected
  -- by the platform function; `auction_id` is ours. Nothing else may appear —
  -- and if a future change adds a key, this fails before it can leak anything.
  perform pg_temp.chk('the payload has exactly two keys: ours and the platform''s',
    (select string_agg(k, ',' order by k) from jsonb_object_keys(v_msg.payload) k),
    'auction_id,id');
  perform pg_temp.chk('and ours is the auction id the subscriber already had',
    v_msg.payload ->> 'auction_id', v_auction::text);

  -- RT-S2 by name, on the whole message rather than on the key list, so a
  -- future key that smuggles one of these in is caught by content too.
  perform pg_temp.chk('SC-42 — no bidder identifier anywhere in the message',
    (select count(*)::text from realtime.messages
      where topic = 'auction:' || v_auction::text
        and payload::text like '%00000000-0000-0000-0000-0000000000b1%'), '0');
  perform pg_temp.chk('SC-42 — no display name anywhere in the message',
    (select count(*)::text from realtime.messages
      where topic = 'auction:' || v_auction::text
        and payload::text like '%v1_bidder_1%'), '0');
  perform pg_temp.chk('SC-42 — no email address anywhere in the message',
    (select count(*)::text from realtime.messages
      where topic = 'auction:' || v_auction::text
        and payload::text like '%@test.local%'), '0');

  -- Money, tested by SHAPE rather than by value. Searching for "1250.75" would
  -- pass the day someone puts the price in as a JSON number and it arrives as
  -- 1250.7500000000001 (S0-12 §6, #103). A decimal point cannot occur in a
  -- uuid, so "no decimal number appears in any payload" is the assertion that
  -- catches every form of it, including the corrupted one.
  perform pg_temp.chk('no amount, in any form, reaches a payload',
    (select count(*)::text from realtime.messages
      where topic = 'auction:' || v_auction::text
        and payload::text ~ '[0-9]\.[0-9]'), '0');

  -- BR-23's shape, applied to the broadcast: a rejection changes nothing, so
  -- it has nothing to announce. Same reasoning as "a rejected bid never
  -- extends the end time" — if a rejected bid announced, anyone could drive
  -- traffic to every viewer of any auction with bids that never count.
  v_before := pg_temp.rt(v_auction);
  perform public.place_bid(v_auction, '1');            -- below current price
  perform pg_temp.chk('a rejected bid announces nothing',
    (pg_temp.rt(v_auction) - v_before)::text, '0');

  perform set_config('request.jwt.claims', '', false);
end $$;


-- ###########################################################################
-- 3. Coverage — every change §14.3 calls Must-deliver, including the sweep
-- ###########################################################################
do $$
declare
  v_a       uuid;
  v_b       uuid;
  v_ext     uuid;
  v_before  bigint;
  v_end     timestamptz;
begin
  ------------------------------------------------------------------------
  -- Status → Ended, winner, final price: one auction, one close.
  ------------------------------------------------------------------------
  v_a := pg_temp.new_auction();
  perform pg_temp.expire(v_a);
  v_before := pg_temp.rt(v_a);
  perform public.close_ended_auctions(v_a);
  perform pg_temp.chk('closing announces the ended status and outcome',
    (pg_temp.rt(v_a) - v_before)::text, '1');

  ------------------------------------------------------------------------
  -- THE SWEEP. close_ended_auctions(null) closes MANY auctions in ONE
  -- UPDATE statement in one transaction, and every one of them has its own
  -- viewers watching their own topic.
  --
  -- This is the assertion that guards against the tempting optimisation.
  -- A bid in the final 15 seconds updates this row twice — the extension and
  -- then the price — so the endgame sends two events where one would do, and
  -- the obvious fix is a transaction-local "already announced" flag. Under
  -- the sweep that flag announces the first auction and silently drops the
  -- rest, leaving every other viewer on an ended auction that still reads as
  -- live. If this assertion ever returns 1, that is what happened.
  ------------------------------------------------------------------------
  v_a := pg_temp.new_auction();
  v_b := pg_temp.new_auction();
  perform pg_temp.expire(v_a);
  perform pg_temp.expire(v_b);
  perform public.close_ended_auctions();               -- null: the real sweep
  perform pg_temp.chk('a sweep announces EVERY auction it closes, not the first',
    (pg_temp.rt(v_a) + pg_temp.rt(v_b) - 2)::text,     -- -2: the two expire updates
    '2');

  ------------------------------------------------------------------------
  -- BR-36 as amended: end_time moves, so a subscriber has to be told.
  ------------------------------------------------------------------------
  v_ext := pg_temp.new_auction(interval '10 seconds');
  select end_time into v_end from public.auctions where id = v_ext;
  v_before := pg_temp.rt(v_ext);
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000b2')::text, false);
  perform public.place_bid(v_ext, '500');
  perform set_config('request.jwt.claims', '', false);

  perform pg_temp.chk('the extension really happened (fixture sanity)',
    (select (end_time > v_end)::text from public.auctions where id = v_ext), 'true');
  -- Two: the extension's update and STEP 9's price update, in that order.
  -- Deliberate, and cheaper than the flag that would collapse them — see the
  -- sweep assertion above and §2 of the migration.
  perform pg_temp.chk('an extended end time is announced (twice, by design)',
    (pg_temp.rt(v_ext) - v_before)::text, '2');
end $$;


-- ###########################################################################
-- 4. RT-R7 — the broadcast may fail. The bid may not.
--
-- "Bidding still works when realtime is unavailable — the paths are
-- independent" (FR-RT-11→13, ARCH §14.5, ADR-9). The trigger runs INSIDE
-- place_bid's transaction, so without the exception block in §1 of the
-- migration this is not a degraded broadcast, it is a rolled-back bid: a
-- realtime outage would present as a bidding outage. These five assertions
-- are that block, and they are the reason the shim's double raises instead of
-- swallowing.
-- ###########################################################################
do $$
declare
  v_auction uuid;
  v_result  jsonb;
begin
  v_auction := pg_temp.new_auction();
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000b3')::text, false);

  perform set_config('dalal.test_realtime_fail', 'on', true);
  v_result := public.place_bid(v_auction, '777.50');
  perform set_config('dalal.test_realtime_fail', 'off', true);

  perform pg_temp.chk('RT-R7 the bid is still accepted when realtime raises',
    (v_result ->> 'accepted'), 'true');
  perform pg_temp.chk('RT-R7 and it is in history — the transaction committed',
    (select count(*)::text from public.bids
      -- The literal is quoted, not bare. An unquoted 777.50 is already exact
      -- numeric in PostgreSQL, so this is not the float defect S0-12 §1 bans —
      -- but every other amount in this repo travels as text, and one assertion
      -- written the other way is the precedent a later `= 1e3` cites.
      where auction_id = v_auction and amount = '777.50'), '1');
  perform pg_temp.chk('RT-R7 and the price advanced with it',
    (select current_price::text from public.auctions where id = v_auction), '777.50');
  perform pg_temp.chk('RT-R7 and the event was simply lost, not queued',
    pg_temp.rt(v_auction)::text, '0');

  -- The sweep is the SC-26 guarantee: an auction closes whether or not anyone
  -- is watching. It must not become conditional on the broadcast either.
  perform pg_temp.expire(v_auction);
  perform set_config('dalal.test_realtime_fail', 'on', true);
  perform pg_temp.chk('RT-R7 closing also survives a failing broadcast',
    public.close_ended_auctions(v_auction)::text, '1');
  perform set_config('dalal.test_realtime_fail', 'off', true);

  perform set_config('request.jwt.claims', '', false);
end $$;


-- ###########################################################################
-- 5. Who may receive — and who may not WRITE
--
-- Measured on dev before this migration: realtime.messages has RLS enabled
-- and zero policies, while anon and authenticated already hold SELECT, INSERT
-- and UPDATE grants on it from the platform. The shim mirrors exactly that.
--
-- So the policy added by the migration is not only deciding who reads. It is
-- the thing standing between an anonymous visitor and an INSERT privilege the
-- platform already gave them. `for select` closes it; `for all` — the one-word
-- "simplification" — would open it, and the payload being content-free would
-- not help: a visitor could make every viewer of any auction re-read the
-- database as fast as they can post.
-- ###########################################################################
do $$
declare
  v_insert   text;
  v_in_scope boolean;
  v_out      boolean;
begin
  perform pg_temp.chk('exactly one policy governs realtime.messages',
    (select count(*)::text from pg_policies
      where schemaname = 'realtime' and tablename = 'messages'), '1');
  perform pg_temp.chk('and it is SELECT-only — never ALL',
    coalesce((select cmd from pg_policies
      where schemaname = 'realtime' and tablename = 'messages'
        and policyname = 'dalal_auction_broadcast_read'), '(no such policy)'), 'SELECT');
  -- anon belongs here: an auction page and its bid history are readable
  -- without signing in (SC-75), so a signed-out viewer must receive too.
  perform pg_temp.chk('for both anon and authenticated',
    (select array_to_string(roles, ',') from pg_policies
      where schemaname = 'realtime' and tablename = 'messages'
        and policyname = 'dalal_auction_broadcast_read'), 'anon,authenticated');

  ------------------------------------------------------------------------
  -- The predicate reads the topic being joined, not the row. That is how
  -- Supabase authorizes a subscription: the service sets realtime.topic to
  -- the topic the client asked for, then checks this policy. So what these
  -- two assert is the SCOPE — an auction topic is ours, anything else is not.
  ------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('realtime.topic', 'auction:probe', true);
  v_in_scope := exists (select 1 from realtime.messages);
  perform set_config('realtime.topic', 'presence:lobby', true);
  v_out := exists (select 1 from realtime.messages);

  begin
    insert into realtime.messages (topic, extension, payload, event, private)
    values ('auction:probe', 'broadcast', '{}'::jsonb, 'auction_changed', true);
    v_insert := 'NOT REFUSED';
  exception when others then
    v_insert := sqlstate;
  end;
  perform set_config('role', 'postgres', true);

  perform pg_temp.chk('a viewer of an auction topic is authorized', v_in_scope::text, 'true');
  perform pg_temp.chk('a viewer of any other topic is not',        v_out::text,      'false');
  perform pg_temp.chk('and nobody can fabricate an event — insert is refused',
    v_insert, '42501');
end $$;
