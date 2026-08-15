-- ============================================================================
-- SEC/#166 + BID/#161 + AUC/#135 — three changes that share one root cause:
-- the public read surface was granted at TABLE level, so every column of
-- auctions and bids reached anon, and every viewer-relative question had to be
-- answered by shipping an identifier to the client so it could compare.
--
-- CLAUDE.md §6: "Display name is the only public identity. Internal
-- identifiers stay internal." Before this migration that guarantee was a
-- PROJECTION — true of every select this repository writes, and false of the
-- schema underneath it. `curl` against PostgREST with `select=*` returned
-- bids.bidder_id, auctions.owner_id and auctions.winner_id to an
-- unauthenticated caller (#166, measured against the dev project).
--
-- The fix is column-level GRANTs, which is where the guarantee belongs. Two
-- consequences follow and both are handled here rather than discovered later:
--
--   1. public.bid_history is `security_invoker = true` and JOINS on
--      b.bidder_id. Revoking that column from the caller breaks the public
--      history — the join needs the privilege even though the projection does
--      not. The view becomes a DEFINER view: it runs with the view owner's
--      rights, projects no identifier, and is the only path to a bidder id.
--
--   2. Two application reads legitimately need an identifier as a PREDICATE:
--      the auction detail page asks "is the viewer the owner / the winner",
--      and auction creation asks "did I already submit this key". A revoked
--      column cannot appear in a WHERE clause either. Both become server-side
--      answers — a boolean view and a definer function — so the identifier is
--      compared where it lives and never crosses the wire.
--
-- Answering the viewer-relative question in SQL is also what unblocks #161:
-- FR-END-14 / SC-36 is a Must ("the winner sees that they won") and had no
-- implementation, because outcome-banner.tsx deliberately refused to compare
-- display names and there was no id to compare instead. There still is not —
-- there is a boolean.
--
-- Ownership: the read surface and the outcome data are Rayan's (bidding
-- behaviour). The Arabic wording and layout that consume the new booleans are
-- Mohammed's (CLAUDE.md §1). Nothing here decides copy.
--
-- NOT changed, deliberately: public.profiles. `?display_name=eq.X&select=id`
-- is still an oracle from a display name to an auth user id. Closing it means
-- rewriting the sign-up name-collision check and the self-read in
-- lib/auth/identity.ts, both of which are @Dem4t's identity behaviour. It is
-- named in the PR body rather than fixed quietly here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. bid_history stops needing the caller to hold bidder_id.
--
-- Its projection already omitted the bidder id (FR-BID-22a) — that was never
-- the leak. The leak was that `security_invoker = true` forced the CALLER to
-- carry SELECT on bidder_id for the join to plan at all, which is why the
-- table-level grant existed. As a definer view it needs nothing from the
-- caller. RLS on bids is `using (true)`, so no row becomes visible that was
-- not visible before: the view returns exactly the same rows, and the caller
-- simply loses the ability to ask the base table for the id directly.
-- ----------------------------------------------------------------------------
alter view public.bid_history set (security_invoker = false);

-- ----------------------------------------------------------------------------
-- 2. bids — column grants replace the table grant.
--
-- auction_id must stay granted: PostgREST's `bids(count)` embed used by the
-- listing, the detail read and the live snapshot resolves through that FK.
-- ----------------------------------------------------------------------------
revoke select on public.bids from anon, authenticated;
grant  select (id, auction_id, amount, created_at)
  on public.bids to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. auctions — column grants replace the table grant.
--
-- Withheld: owner_id, winner_id (the identifiers of #166) and submission_key
-- (an idempotency token; knowing another user's serves no read purpose, and
-- §4 of this file gives the one caller that needs it a definer path).
--
-- Everything else is public by design — it is what the auction IS.
-- extension_count is granted deliberately: BR-36's cap is public information
-- and a viewer being able to see that an auction has been extended is the
-- point, not a leak.
-- ----------------------------------------------------------------------------
revoke select on public.auctions from anon, authenticated;
grant  select (
         id, status, end_time, starting_price, current_price,
         final_price, closed_at, created_at, extension_count,
         name, description, image_path
       )
  on public.auctions to anon, authenticated;

-- The insert grant is untouched by the above — grants are per-privilege — but
-- is restated because a reader arriving at a revoke naturally asks.
grant insert on public.auctions to authenticated;

-- ----------------------------------------------------------------------------
-- 4. The two predicates that legitimately need an identifier.
-- ----------------------------------------------------------------------------

-- 4a. "Is the viewer the winner / the owner of this auction?"
--
-- A view, not a function, so PostgREST can answer it in the same round trip
-- shape as everything else, and so it composes with a filter on auction_id.
-- It returns BOOLEANS ONLY. An unauthenticated caller has auth.uid() = null,
-- so both columns are false — never null, so no consumer has to distinguish
-- "not signed in" from "read failed" (SC-21).
--
-- DEFINER for the same reason as bid_history: the caller no longer holds
-- SELECT on winner_id or owner_id, and this view is precisely the sanctioned
-- way to learn one bit about them.
create or replace view public.auction_viewer_outcome
with (security_invoker = false)
as
select a.id                                                        as auction_id,
       (a.winner_id is not null and a.winner_id = (select auth.uid())) as viewer_is_winner,
       (a.owner_id = (select auth.uid()))                          as viewer_is_owner
  from public.auctions a;

grant select on public.auction_viewer_outcome to anon, authenticated;

-- 4b. "Did I already submit this key?" (AUC-03 idempotency, #135's neighbour.)
--
-- The owner scope stays — it is what makes a guessed key useless — but it is
-- now applied on the server against the verified session, per CLAUDE.md §6:
-- identity comes from the session, never from a client-supplied user id.
-- Note the deliberate absence of a p_owner_id parameter.
create or replace function public.auction_for_submission(p_submission_key uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id
    from public.auctions a
   where a.submission_key = p_submission_key
     and a.owner_id = (select auth.uid())
   limit 1;
$$;

revoke execute on function public.auction_for_submission(uuid) from public, anon;
grant  execute on function public.auction_for_submission(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. AUC-04 / SEC-Z8 (#135) — an auction may not point at another user's image.
--
-- The storage side was already correct: auction_images_owner_insert forces an
-- uploaded object's first path segment to be the uploader's id. The gap was
-- that the AUCTIONS row could name any path in a bucket that is public-read,
-- including one uploaded by someone else, because image_path was validated for
-- SHAPE (auctions_image_path_shape, AUC-01) and never for OWNERSHIP.
--
-- This cannot be a CHECK constraint: auth.uid() is not immutable, and a CHECK
-- is re-evaluated by operations that have no session at all. It belongs in the
-- insert policy, next to the owner_id clause it mirrors — the same session,
-- the same statement.
--
-- Every other clause below is BID-02's, reproduced unchanged; a policy cannot
-- be altered in place, so it is dropped and recreated in full.
-- ----------------------------------------------------------------------------
drop policy if exists auctions_owner_insert on public.auctions;

create policy auctions_owner_insert on public.auctions
  for insert to authenticated
  with check (
        owner_id = (select auth.uid())            -- SEC-Z2, FR-CREATE-02: owner from
                                                  -- the session, never the payload
    and status = 'active'                         -- BR-14: born Active, no Draft
    and current_price = starting_price            -- BR-13 / FR-CREATE-28: birth value;
                                                  -- thereafter only place_bid writes it
    and winner_id is null
    and final_price is null
    and closed_at is null                         -- SEC-Z6: no user pre-sets an outcome
    and end_time >= now() + interval '5 minutes'
    and end_time <= now() + interval '7 days'     -- BR-38, SC-68, server clock (BR-19)
    and split_part(image_path, '/', 1)            -- SEC-Z8 (#135): the image is one the
        = (select auth.uid())::text               -- session itself uploaded, matching
  );                                              -- auction_images_owner_insert exactly
