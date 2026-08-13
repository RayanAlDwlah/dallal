-- ============================================================================
-- BID-15 — automatic auction closing, plus the anti-sniping end-time extension
--
-- Two things land together because they are one mechanism seen from two sides:
-- closing asks "has the end time passed", and the extension moves that end
-- time. Splitting them would leave one migration where the sweep chases a
-- deadline the other migration teaches it nothing about.
--
-- ---------------------------------------------------------------------------
-- PRODUCT DECISION RECORDED BEFORE ANY CODE READS IT
--
-- BR-36 used to say: "The auction end time is fixed and is never extended.
-- There is no anti-sniping mechanism." That was PRD Q7, answered "no" and
-- listed among the fifteen closed decisions.
--
-- It was REOPENED AND REVERSED by the project owner (@RayanAlDwlah) on
-- 2026-08-13, with @m7ya505 and @Dem4t agreeing in person. The new rule:
--
--     A bid accepted inside the final 15 SECONDS of an auction extends the
--     end time by 30 SECONDS. This repeats, up to a hard maximum of 20
--     EXTENSIONS, after which the end time is final no matter what.
--
-- The cap is the part that is not decoration. Without it a contested auction
-- never ends, never reaches finalization, and never has a winner. 20 x 30 s
-- bounds any auction at 10 minutes past its original deadline.
--
-- The amendment is written into PRD.md in the same pull request as this file,
-- because a decision made in a room does not reach the other two developers'
-- AI sessions — only the documents do.
-- ---------------------------------------------------------------------------
--
-- Also in here: `set search_path = ''` on the six BID-02 functions that lacked
-- it. Supabase's advisor reported all six as function_search_path_mutable, and
-- docs/supabase-cli.md records them as the only real warnings we own.
--
-- Nothing below edits 20260812120000. That file is byte-checked against
-- docs/contracts/BID-02-bid-operation.md by tests/bidding/run.sh, and an
-- applied migration is never edited (docs/supabase-cli.md). Everything here is
-- CREATE OR REPLACE / ALTER, so this file is the live definition of anything
-- it names.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The extension counter — and the cap as a CONSTRAINT, not as code
--
-- The cap lives in a CHECK rather than in an IF, so no future code path can
-- extend past it: not a second call site, not a hand-written UPDATE, not a
-- SECURITY DEFINER function, not the table owner. The IF in the trigger below
-- decides whether to extend; this constraint decides what is possible.
--
-- Why a stored counter and not a derived one. CLAUDE.md §5 prefers deriving
-- state from the bid table over adding a column, and that instinct is right —
-- but it does not reach here. Deriving the count would mean asking "how many
-- of these bids landed in a final-15-seconds window", and that window moved
-- every time it happened. The answer is not recoverable from bids alone; only
-- from a running total. So: one integer, bounded, written by exactly one
-- statement.
--
-- auctions is Mohammed's table (S0-11) and this is Rayan's column. It is
-- bidding behaviour — the same category as current_price, winner_id,
-- final_price and closed_at, which already live here for the same reason
-- (CLAUDE.md §1: ownership is by responsibility, not by file).
-- ----------------------------------------------------------------------------
alter table public.auctions
  add column if not exists extension_count integer not null default 0;

alter table public.auctions
  drop constraint if exists auctions_extension_cap;
alter table public.auctions
  add constraint auctions_extension_cap
  check (extension_count between 0 and 20);          -- BR-36 as amended: hard cap

comment on column public.auctions.extension_count is
  'Anti-sniping extensions applied so far (BR-36 as amended 2026-08-13). '
  'Capped at 20 by auctions_extension_cap. Written only by bids_extend_end_time.';

-- The sweep asks one question fifteen times a minute. A partial index makes it
-- read only the auctions that could possibly answer yes, and it shrinks to
-- nothing as auctions end rather than growing with the table.
create index if not exists auctions_due_for_close
  on public.auctions (end_time)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- 2. auctions_guard_update — end_time becomes conditionally mutable
--
-- Before this, end_time sat in the same "immutable creation-time term" list as
-- owner_id and starting_price, and any change to it raised. It cannot stay
-- there. But "mutable" is the wrong replacement: the guard now permits exactly
-- one shape of change and rejects every other, so the only reachable end-time
-- edit in the system is the one BR-36 as amended describes.
--
-- Four conditions, all required:
--   a. it happens inside place_bid       (dalal.in_place_bid, the ADR-2 flag)
--   b. it moves FORWARD, never back
--   c. by exactly one quantum, 30 seconds — not 29, not 31, not 300
--   d. extension_count increments by exactly 1 in the same statement
--
-- (d) is what makes the cap real. Without it, end_time could be walked forward
-- 30 seconds at a time forever while the counter stayed at 0 and the CHECK
-- constraint never noticed. The counter is not bookkeeping; it is the thing
-- being enforced, and this ties the two together so neither can move alone.
--
-- Note this guard fires for EVERY update path including SECURITY DEFINER ones
-- and the table owner, exactly as it did before.
-- ----------------------------------------------------------------------------
create or replace function public.auctions_guard_update()
returns trigger
language plpgsql
set search_path = ''            -- advisor: function_search_path_mutable
as $$
begin
  if new.owner_id       is distinct from old.owner_id
     or new.starting_price is distinct from old.starting_price
     or new.created_at  is distinct from old.created_at then
    raise exception 'auction creation-time terms are immutable (BR-31, BR-16, FR-SEC-09)';
  end if;

  if new.end_time is distinct from old.end_time then
    -- (a) only place_bid, via the same transaction-local flag that gates the
    -- bids insert. A bid and its extension are therefore inseparable: both
    -- commit or neither does.
    if coalesce(current_setting('dalal.in_place_bid', true), '') <> 'on' then
      raise exception 'the end time may only be extended by place_bid (BR-36 as amended)';
    end if;
    -- (b) + (c). "= old + 30s" covers both: it cannot be earlier and it cannot
    -- be a different size. An auction can never be shortened, which would let a
    -- seller end a live auction early — BR-30's "no cancellation" by another route.
    if new.end_time <> old.end_time + interval '30 seconds' then
      raise exception 'the end time may only move forward by exactly 30 seconds (BR-36 as amended)';
    end if;
    -- (d)
    if new.extension_count <> old.extension_count + 1 then
      raise exception 'an end-time extension must increment extension_count by exactly 1 (BR-36 as amended)';
    end if;
  elsif new.extension_count is distinct from old.extension_count then
    raise exception 'extension_count may only change together with the end time (BR-36 as amended)';
  end if;

  if old.status = 'ended' then
    raise exception 'ended auctions are terminal; outcomes are immutable (BR-15, NFR-DAT-07)';
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 3. The extension itself — an AFTER INSERT trigger on bids
--
-- Why here rather than inside place_bid. place_bid is the most-reviewed
-- function in the project, it is printed verbatim in docs/contracts/
-- BID-02-bid-operation.md, and tests/bidding/run.sh fails the whole suite if
-- the committed migration and that contract diverge by one byte. Adding a step
-- to it means CREATE OR REPLACE-ing 230 lines into this file — a second copy of
-- the operation, which is exactly the drift that check exists to prevent.
--
-- A trigger gives the same guarantees for a fraction of the surface:
--   * it fires inside place_bid's transaction, under the auction's row lock,
--     so the extension is atomic with the bid by construction
--   * it fires for the ONLY insert path that exists — ADR-2 and the
--     bids_insert_gate trigger make a bid outside place_bid impossible
--   * place_bid's step 4 already rejected anything at or after end_time, so by
--     the time this runs the bid is known to be inside the auction
--
-- The window is measured with clock_timestamp(), not now(), for the same
-- reason step 4 uses it: now() freezes at transaction start, before this bid
-- queued on the lock. A bid that waited 20 seconds on a contended auction
-- would be measured against where the clock was when it arrived, not where it
-- is now — and would extend an auction it should not, or fail to extend one it
-- should.
--
-- The auction row is re-read FOR UPDATE rather than trusted from the caller.
-- We already hold that lock (place_bid took it in step 2), so this costs
-- nothing and cannot block — but it means the trigger reads the end time as it
-- is now, including any extension a predecessor bid in the same lock queue
-- just committed.
-- ----------------------------------------------------------------------------
create or replace function public.bids_extend_end_time()
returns trigger
language plpgsql
set search_path = ''            -- advisor: function_search_path_mutable
as $$
declare
  v_end_time        timestamptz;
  v_extension_count integer;
begin
  select a.end_time, a.extension_count
    into v_end_time, v_extension_count
    from public.auctions a
   where a.id = new.auction_id
     for update;

  -- Inside the final 15 seconds, and not yet at the cap. Both halves matter:
  -- at the cap the auction runs out exactly as a fixed-end auction does, which
  -- is what guarantees it ends at all.
  if v_end_time - clock_timestamp() <= interval '15 seconds'
     and v_extension_count < 20 then
    update public.auctions
       set end_time        = end_time + interval '30 seconds',
           extension_count = extension_count + 1
     where id = new.auction_id;
  end if;

  return null;                  -- AFTER trigger; the return value is ignored
end $$;

drop trigger if exists bids_extend_auction on public.bids;
create trigger bids_extend_auction
  after insert on public.bids
  for each row execute function public.bids_extend_end_time();

-- ----------------------------------------------------------------------------
-- 4. close_ended_auctions — finalization. ONE idempotent operation (ARCH §15.3)
--
-- This is the second of the exactly two elevated-privilege operations the
-- architecture permits (§11.4). It writes winner_id, final_price and closed_at,
-- which no user role may write.
--
-- Its containment is different in kind from place_bid's and worth stating,
-- because "SECURITY DEFINER with EXECUTE granted to anon" reads alarming:
--
--   * it takes NO user identity, and no parameter that could carry one
--   * it makes NO identity-dependent decision — there is no branch in it that
--     a caller could steer
--   * everything it does is already entailed by the clock. Calling it can only
--     make the database agree sooner with something that is already true
--   * calling it on an auction that has not ended does nothing at all
--
-- So an anonymous caller invoking it in a loop achieves precisely what the
-- 15-second sweep achieves, and nothing else. That is why T2 (on-read) is
-- allowed to be a plain client call.
--
-- p_auction_id is an optimisation, not a scope limit: null means "every due
-- auction" (the sweep, T1), a uuid means "this one first" (T2 on-read, T3 on
-- bid attempt). The work is identical either way.
--
-- SKIP LOCKED is load-bearing. If a bid is mid-flight on an auction, place_bid
-- holds its row lock, and the sweep must not queue behind it — it has other
-- auctions to close. Skipping is also correct rather than merely convenient:
-- a locked auction is one being bid on, and a bid in flight either extends the
-- end time (so it is not due after all) or is about to be rejected by step 4
-- and trigger T3 will close it a moment later. Correctness never depended on
-- the sweep's timing in the first place (LC-03).
-- ----------------------------------------------------------------------------
create or replace function public.close_ended_auctions(p_auction_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_closed integer;
begin
  with due as (
    select a.id
      from public.auctions a
     where a.status = 'active'
       and clock_timestamp() >= a.end_time        -- LC-03: the clock, never the flag
       and (p_auction_id is null or a.id = p_auction_id)
     order by a.id                                -- stable order; one lock at a time
       for update skip locked
  ),
  outcome as (
    select d.id,
           w.bidder_id,
           w.amount
      from due d
      left join lateral (
        select b.bidder_id, b.amount
          from public.bids b
         where b.auction_id = d.id
         order by b.amount desc,                  -- BR-06: highest valid bid wins
                  b.id asc                        -- FR-END-06 tie-break: earlier-ordered
                                                  -- bid wins. Unreachable — the
                                                  -- (auction_id, amount) unique constraint
                                                  -- makes equal amounts impossible — but
                                                  -- defined so the outcome is total.
         limit 1
      ) w on true
      -- LEFT JOIN, not JOIN. An auction with zero bids MUST still close, with
      -- no winner and no final price, and that is a normal path rather than an
      -- error (BR-09, SC-31, EC-05). An inner join here would silently leave
      -- every bidless auction 'active' forever — the single easiest way to get
      -- this function wrong.
  )
  update public.auctions a
     set status      = 'ended',
         winner_id   = o.bidder_id,               -- null when there were no bids
         final_price = o.amount,                  -- null when there were no bids
         closed_at   = clock_timestamp()
    from outcome o
   where a.id = o.id;

  get diagnostics v_closed = row_count;

  -- NO reserve check (BR-35): the highest bid wins whatever its amount, and
  -- there is no third outcome. Exactly two exist — a winner, or no bids.
  --
  -- Idempotent (BR-17, SC-32): the status = 'active' predicate above is the
  -- already-closed check. A second call returns 0 and writes nothing, and the
  -- auctions_guard_update trigger would raise on an ended row regardless.
  --
  -- History is never touched (SC-33): bids is append-only and this function
  -- only reads it.
  return v_closed;
end $$;

comment on function public.close_ended_auctions(uuid) is
  'Finalization (BID-15/BID-16). Idempotent; safe to call from anywhere at any '
  'time. Returns the number of auctions closed by this call. Invoke directly '
  'in tests instead of waiting for the sweep (NFR-MNT-03).';

-- ----------------------------------------------------------------------------
-- 5. search_path on the remaining BID-02 functions
--
-- Six advisor warnings, all ours, all the same finding: a function with a
-- mutable search_path can be made to resolve an unqualified name to an
-- attacker-supplied object. auctions_guard_update (§2) and the new functions
-- above are already done; these are the rest.
--
-- The pattern is @Dem4t's from AUTH-01: set search_path = '' and revoke
-- EXECUTE from the roles that never need it. format_sar and sar_text keep
-- their grants — clients call them through bid_history.
--
-- Bodies are unchanged, byte for byte. Only the settings differ. pg_catalog
-- remains implicitly resolvable with an empty search_path, so round(),
-- split_part(), regexp_replace(), current_setting() and jsonb_build_object()
-- all still resolve; every non-catalog reference in these bodies was already
-- schema-qualified.
-- ----------------------------------------------------------------------------
create or replace function public.format_sar(a public.sar_amount) returns text
language sql immutable strict
set search_path = ''
as $$
  SELECT regexp_replace(split_part(round(a,2)::text, '.', 1), '(\d)(?=(\d{3})+$)', '\1,', 'g')
      || '.' || split_part(round(a,2)::text || '.00', '.', 2)
$$;

create or replace function public.sar_text(a public.sar_amount) returns text
language sql immutable strict
set search_path = ''
as $$ select round(a, 2)::text $$;

create or replace function public.bid_reject(
  p_reason    text,
  p_price_key text default null,
  p_price     public.sar_amount default null
) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('accepted', false, 'reason', p_reason)
         || case when p_price is null then '{}'::jsonb
                 else jsonb_build_object(p_price_key, public.sar_text(p_price))
            end
$$;

create or replace function public.bids_are_append_only()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  raise exception 'bids are append-only; no update or delete path exists for anyone (BR-05, SEC-I1)';
end $$;

create or replace function public.bids_only_via_place_bid()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('dalal.in_place_bid', true), '') <> 'on' then
    raise exception 'bids may only be inserted by place_bid (ADR-2, SEC-Z4)';
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Exposure
--
-- Trigger functions are revoked from everyone. PostgreSQL grants EXECUTE on a
-- new function to PUBLIC by default, so these were callable — harmlessly, they
-- raise when called outside a trigger context, but a function nobody should
-- call should not be callable. This does NOT disable the triggers: PostgreSQL
-- checks EXECUTE on a trigger function when the trigger is CREATED, not when it
-- fires (measured in tests/auth, PR #3).
-- ----------------------------------------------------------------------------
revoke execute on function public.bids_are_append_only()   from public, anon, authenticated;
revoke execute on function public.bids_only_via_place_bid() from public, anon, authenticated;
revoke execute on function public.auctions_guard_update()  from public, anon, authenticated;
revoke execute on function public.bids_extend_end_time()   from public, anon, authenticated;

-- Finalization is callable by clients — that IS trigger T2, "on read"
-- (ARCH §15.3). anon included: a signed-out visitor opening an ended auction
-- should see it ended, and §4 above explains why that is safe.
revoke execute on function public.close_ended_auctions(uuid) from public;
grant  execute on function public.close_ended_auctions(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Trigger T1 — the scheduled sweep. The SC-26 guarantee.
--
-- 15 seconds, not 30, and that is deliberate. FR-END-03 gives a 30-second
-- budget from end_time to Ended. An auction's end time falls at an arbitrary
-- point between two fires, so the sweep's period is the WORST-CASE latency,
-- not the typical one: a 30-second sweep spends the entire budget on
-- scheduling and then overruns it by the jitter. V-2 measured a '30 seconds'
-- job at 30.034 s mean and 30.276 s worst — over budget on jitter alone.
-- 15 seconds costs nothing at this granularity (V-2 also held a '10 seconds'
-- job at 10.014 s) and leaves room for the sweep's own runtime.
-- Full measurement: docs/V-2-scheduling-verification.md.
--
-- Guarded because pg_cron does not exist on stock PostgreSQL, and this
-- migration must apply unmodified inside tests/bidding/run.sh's throwaway
-- container. The sweep is a LATENCY device; everything it does can be done by
-- calling close_ended_auctions() directly, which is what the tests do
-- (NFR-MNT-03). A stack without pg_cron loses timeliness, never correctness.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    -- schedule() upserts by job name, so re-running this migration re-points
    -- the existing job rather than creating a second one.
    execute $cron$
      select cron.schedule('dalal-close-ended-auctions', '15 seconds',
                           $job$select public.close_ended_auctions()$job$)
    $cron$;
    raise notice 'BID-15: sweep scheduled every 15 seconds (FR-END-03, SC-26)';
  else
    raise notice 'BID-15: pg_cron unavailable — no sweep scheduled. Closing still '
                 'works via close_ended_auctions() (T2 on-read, T3 on bid attempt). '
                 'Expected on a plain PostgreSQL test container; NOT expected on Supabase.';
  end if;
end $$;
