-- ============================================================================
-- BID-08 — realtime foundation. FR-RT-01, ARCH §14.1/§14.2/§14.4, ADR-9, BR-22.
--
-- One sentence of scope: this file makes a committed change to an auction
-- announce ITSELF to the viewers of that auction, and nothing more. It carries
-- no price, no bidder, no status and no time. BID-09 does the reading.
--
-- ---------------------------------------------------------------------------
-- Why this is a trigger and not `alter publication supabase_realtime add table`
--
-- 20260812120000 line 546 left a comment saying the publication line was all
-- that remained. It was written before anyone had measured what a
-- postgres_changes payload actually contains. It was measured on 2026-08-14
-- against dallal-dev, and the record is docs/BID-08-realtime-verification.md.
-- Two findings decided this file:
--
--   1. A publication COLUMN LIST is not a privacy boundary. PostgreSQL 15+
--      accepts `add table t (id)`, and pg_publication_tables then reports
--      attnames = {id} — but Supabase Realtime uses the publication only to
--      decide WHICH TABLES to stream and then delivers the whole row. A column
--      never published arrived at an anon browser client in the spike. Any
--      future session reaching for a column list as a defence — as that one
--      did — is reaching for something that does not work.
--
--   2. postgres_changes serialises `numeric` as an unquoted JSON NUMBER.
--      123456789012345678901234567890.99 was inserted and 1.2345678901234568e+29
--      arrived. That is CLAUDE.md §4 rule 1 and issue #103, inside a payload,
--      and Dalal has NO ceiling by design (BR-21, SEC-R3) so large amounts are
--      in scope rather than hypothetical. The value is destroyed before any
--      client code can decline to trust it.
--
-- So with postgres_changes, RT-S2 and §14.4's "structural, not filtered" would
-- both rest on the client choosing not to read a payload it was handed. That is
-- a convention. `realtime.send` from a trigger delivers EXACTLY the jsonb this
-- file authors, so the same guarantee is a property of the schema instead.
--
-- The cost is one row written inside place_bid's transaction, under the auction
-- row lock. That is the one lock in this product where contention is the
-- requirement rather than an edge case, so it was measured rather than assumed:
-- tests/bidding/concurrency.sh with the trigger alternately enabled and
-- disabled, plus 2000 sequential accepted bids on one auction. The marginal
-- cost is 9.4 microseconds per accepted bid against a ~111 microsecond
-- baseline. Method and raw numbers: docs/BID-08-realtime-verification.md §5.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The signal
--
-- The payload is DELIBERATELY content-free: an auction id that the subscriber
-- already had (it is in the page URL and in the topic name), and nothing else.
-- That is not minimalism for its own sake, it is what makes four separate
-- requirements fall out for free instead of needing client code:
--
--   * RT-S2 / SC-42 / §14.4 — a payload with no money, no bidder_id, no
--     winner_id and no display name cannot leak any of them. There is nothing
--     to filter and nothing to get wrong later.
--   * RT-R6 / ADR-9 / BR-22 — "the event is a trigger to re-read, never a
--     display source". Here it is not a rule anyone can forget: there is
--     nothing in the event that COULD be displayed.
--   * RT-X5 / FR-RT-10 — out-of-order delivery cannot show a price moving
--     downward, because the event carries no price. Every event resolves to
--     one authoritative read of current state.
--   * RT-R5 / FR-RT-09 — duplicate delivery is free for the same reason.
--
-- DO NOT "improve" this by putting the new price, the bid, or the end time in
-- the payload. Each of those re-creates a defect this project already paid for:
-- the amount would have to travel as text to survive JSON (S0-12 §6), the
-- bidder would breach RT-S2, and the end time would give the client a second
-- source of truth to disagree with the read.
-- ----------------------------------------------------------------------------
create or replace function public.auctions_broadcast_change()
returns trigger
language plpgsql
set search_path = ''            -- advisor: function_search_path_mutable
as $$
begin
  -- ==========================================================================
  -- RT-R7 IS THIS BLOCK. "Bidding still works when realtime is unavailable —
  -- the paths are independent." Without the block they are not independent:
  -- this trigger runs INSIDE place_bid's transaction, so anything it raises
  -- rolls back an ALREADY-ACCEPTED bid. A broadcast problem would silently
  -- become a bidding outage, which is the exact inversion of ADR-9 — realtime
  -- is a projection of committed state, never a gate on committing it.
  --
  -- What each layer actually catches, since one of them is easy to over-trust:
  --
  --   * realtime.send's own body already wraps its INSERT in
  --     `exception when others then raise warning`. So a full realtime.messages,
  --     a partition problem, an RLS refusal — those never reach us anyway.
  --   * It cannot catch a failure of the CALL ITSELF: the function not existing
  --     (a stack without the realtime extension, e.g. the test container, or a
  --     platform rename), or EXECUTE being revoked. Those are raised by the
  --     executor before the body runs. THAT is what this block is for.
  --
  -- `when others` does not catch query_canceled or assert_failure in PL/pgSQL,
  -- so a statement timeout or a cancelled bid still propagates as it should.
  -- ==========================================================================
  begin
    perform realtime.send(
      jsonb_build_object('auction_id', new.id),   -- nothing else. ever.
      'auction_changed',
      'auction:' || new.id::text,                 -- §14.2: per auction, not global
      true                                        -- private: delivery is gated by
                                                  -- the policy in §3, not open to
                                                  -- anyone who guesses a topic
    );
  exception when others then
    -- Loud enough to find in the logs, quiet enough that the bidder never
    -- learns realtime exists. The bid is already committed-in-progress and
    -- stays that way.
    raise warning 'BID-08: broadcast skipped for auction % — % (%). The bid is unaffected (RT-R7).',
      new.id, sqlerrm, sqlstate;
  end;

  return null;                  -- AFTER trigger; the return value is ignored
end $$;

comment on function public.auctions_broadcast_change() is
  'BID-08 — announces that an auction row changed, to that auction''s topic only. '
  'Content-free by design (RT-S2, RT-R6). Can never fail a bid (RT-R7).';

-- ----------------------------------------------------------------------------
-- 2. The trigger — AFTER UPDATE on auctions, and only there
--
-- Why auctions and not bids. Every accepted bid updates this row in the same
-- transaction, unconditionally: 20260812120000 STEP 9 is the only statement in
-- the system that writes current_price, and BID-05 requires it to be
-- inseparable from the insert it derives from. So an auctions UPDATE is a
-- complete signal for a new bid, AND it covers the three things a bid is not:
-- status → ended, winner_id / final_price at finalization, and the BR-36
-- end-time extension. One trigger, all of §14.3.
--
-- Why AFTER and not BEFORE. The subscriber's job on receipt is to re-read. It
-- must not be able to read a state that has not committed. Both the message row
-- and the auction row are written in the one transaction and become visible
-- together, so by the time an event is delivered the change it announces is
-- durable. A pre-commit notification would be a race by construction.
--
-- Why FOR EACH ROW, and why there is no de-duplication
-- ---------------------------------------------------
-- A bid inside the final 15 seconds produces TWO updates to this row: the
-- extension (bids_extend_end_time, AFTER INSERT on bids) and then STEP 9's
-- price write. So the endgame sends two events per bid where one would do.
--
-- That is deliberate, and the obvious fix is a bug. The tempting shape is a
-- transaction-local "already sent" flag — and close_ended_auctions() closes
-- MANY auctions in a single UPDATE statement in one transaction. A per-
-- transaction flag would announce the first of them and silently drop the rest,
-- so every viewer of every other auction in that sweep would sit on an ended
-- auction showing it as live. The duplicate is worth one extra re-read; the
-- de-duplication costs correctness on the sweep. Duplicates are explicitly
-- required to be harmless anyway (FR-RT-09, RT-R5) and the payload carries
-- nothing that could be applied twice.
--
-- No INSERT trigger: the listing page is not subscribed (§14.2) and a brand-new
-- auction has no viewers to tell.
-- ----------------------------------------------------------------------------
drop trigger if exists auctions_broadcast on public.auctions;
create trigger auctions_broadcast
  after update on public.auctions
  for each row execute function public.auctions_broadcast_change();

-- ----------------------------------------------------------------------------
-- 3. Who may receive — the policy on realtime.messages
--
-- Guarded on the same principle as 20260814000000's pg_cron block and
-- 20260814120000's storage block: realtime.messages belongs to the platform,
-- and tests/bidding runs on a stock postgres:17 container. A stack without it
-- loses delivery, never bidding correctness, so this file must apply either
-- way rather than needing a second copy that drifts.
--
-- SELECT, and SELECT ONLY. This is the line to read twice.
--
-- Measured on dev before this migration: realtime.messages has RLS ENABLED and
-- ZERO policies, while anon and authenticated already hold SELECT, INSERT and
-- UPDATE grants on it from the platform. RLS is the second gate, never the
-- first (see 20260814120000 §2) — and here that order is what saves us: the
-- grants are live but no policy exists, so every one of them is refused.
--
-- Adding `for all` instead of `for select` would therefore not be a widening of
-- read access. It would hand every anonymous visitor the INSERT privilege the
-- platform already granted them, on a topic they choose. They could fabricate
-- `auction_changed` on any auction — not to corrupt state, since the payload is
-- content-free and the client re-reads the database, but to make every viewer
-- of any auction re-read on demand, as fast as they can post. That is an
-- unauthenticated amplifier against the same database place_bid needs.
--
-- The topic predicate is a scope, not a secret: auction pages are public and a
-- visitor may read bid history without signing in (SC-75), so anon belongs
-- here. `auction:%` keeps us out of every other topic namespace on the project.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'BID-08: no realtime schema — broadcast policy skipped (local test stack). The trigger above still applies and still cannot fail a bid.';
    return;
  end if;

  execute 'drop policy if exists dalal_auction_broadcast_read on realtime.messages';
  execute $p$
    create policy dalal_auction_broadcast_read
      on realtime.messages
      for select
      to anon, authenticated
      using ( (select realtime.topic()) like 'auction:%' )
  $p$;
end $$;

-- ----------------------------------------------------------------------------
-- 4. What this file deliberately does NOT do
--
--   * It does not add public.auctions or public.bids to the supabase_realtime
--     publication, and nothing later should. §1 is why. If a future session
--     finds that line commented out in 20260812120000 and enables it, both
--     paths run at once and the postgres_changes one re-introduces #103 and the
--     bidder_id exposure that this file was written to remove.
--   * It does not set REPLICA IDENTITY FULL on anything. That is the other
--     reflex fix for "the payload is missing columns", and it would put the
--     entire OLD row in the WAL — strictly more exposure, for a stream we do
--     not use.
--   * It does not touch place_bid. That function is printed byte-for-byte in
--     docs/contracts/BID-02-bid-operation.md and tests/bidding/run.sh fails the
--     whole suite if the two diverge; the extension in 20260814000000 §3 chose
--     a trigger over editing it for exactly this reason, and so does this.
--   * It does not carry a sequence number, revision or timestamp for the client
--     to order events by. Ordering is a property of the read, not the stream
--     (§14.5, RT-R3): on reconnect the client resynchronizes to authoritative
--     current state rather than resuming a partial one.
-- ----------------------------------------------------------------------------
