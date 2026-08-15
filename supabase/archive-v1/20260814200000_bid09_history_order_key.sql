-- ============================================================================
-- BID-09 follow-up — give bid_history an EXPLICIT, public ordering key.
--
-- Raised by @Dem4t reviewing #109, and his reading of the docs is correct:
-- the view's internal `order by auction_id, id desc` reaches the client
-- through PostgREST's json_agg over a subquery, and PostgreSQL documents the
-- input order of an aggregate as unspecified unless ordered INSIDE the
-- aggregate — a sorted subquery "usually" works and is exactly the kind of
-- planner behaviour that is true until it is not. The failure mode would be
-- the already-measured one (S0-11 §6): a decreasing history, silent, under
-- load. His proposed fix — an explicit `.order()` — travels through the SAME
-- aggregate shape, so by itself it upgrades nothing; what closes the gap is a
-- key the CLIENT can sort by after receipt. This migration provides the key;
-- lib/bidding/live-snapshot.ts performs that sort, and that sort is the
-- contract.
--
-- The key is `seq` = row_number() over (partition by auction_id order by id):
--
--   * seq 1 is the FIRST bid taken under the row lock; display order is
--     seq descending (FR-BID-29 newest first). Faithful to BR-11 by
--     construction — it is a rank over bids.id, nothing else.
--   * STABLE FOREVER per row: bids are append-only (BR-05) and id is
--     monotonic, so a bid's rank in lock order can never change. That also
--     makes it a correct React list key.
--   * NOT bids.id itself. Internal identifiers stay internal (FR-BID-22a,
--     CLAUDE.md §6): the global id would leak platform-wide bid volume across
--     auctions; a per-auction rank reveals only what the ordered public list
--     already shows.
--   * cast to int: this is a COUNT, not money — no sar rules apply — and a
--     per-auction bid count beyond int range is not a state this platform
--     can reach (each bid is a human action on one auction).
--
-- CREATE OR REPLACE VIEW may only append columns, so seq goes LAST. The
-- SELECT grant on the view persists across the replace. The BID-02 contract
-- prints the ORIGINAL view in its §3b block and contract-sync pins that block
-- to the 20260812120000 migration, which this file does not touch — a later
-- migration evolving the view is the normal path and leaves the printed
-- history true.
-- ============================================================================

create or replace view public.bid_history
with (security_invoker = true)          -- runs with the caller's rights; the
                                        -- underlying tables are public-read
as
select b.auction_id,
       p.display_name,                  -- FR-BID-23, BR-26
       public.sar_text(b.amount) as amount,       -- S0-12 §6: text, client formats
       public.format_sar(b.amount) as amount_sar, -- NFR-DAT-08: the one format
       b.created_at,                    -- FR-BID-23; display only, never a key
       (row_number() over (partition by b.auction_id
                           order by b.id))::int as seq
                                        -- BR-11 as a public, sortable rank —
                                        -- see the header for why not b.id
  from public.bids b
  join public.profiles p on p.id = b.bidder_id
 order by b.auction_id, b.id desc;      -- kept: harmless, and psql readers of
                                        -- the bare view still see lock order
