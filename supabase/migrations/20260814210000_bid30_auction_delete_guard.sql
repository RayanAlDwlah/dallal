-- ============================================================================
-- BR-30 — make "an auction cannot be cancelled" a GUARD, not a missing GRANT.
--
-- Raised by the INT-07 audit (#124). The measurement that started it:
--
--   has_table_privilege('postgres','public.auctions','DELETE')  ->  true
--   triggers on public.auctions -> auctions_broadcast, auctions_immutable_terms
--                                  (neither fires on DELETE)
--   triggers on public.bids     -> bids_no_update_or_delete
--                                  (fires on DELETE and UPDATE, for every role)
--
-- The asymmetry is real and it is backwards: a BID row cannot be deleted even
-- by the table owner, while the AUCTION that contains it can be. BR-30 ("no
-- cancellation, no Cancelled state") and BR-31 ("no editing after publish")
-- are the two rules that say an auction row is permanent, and BR-31 already
-- has auctions_guard_update standing behind it. BR-30 had nothing.
--
-- THIS IS NOT A VULNERABILITY REPORT. The `postgres` role is not reachable by
-- any client: PostgREST and realtime authenticate only anon / authenticated /
-- service_role, and `DELETE /auctions` with an anon key was measured returning
-- 401 · 42501. Only a holder of the direct connection string — the three of us
-- — reaches `postgres` at all. Practical exposure today is nil.
--
-- WHY ABSENCE-OF-GRANT IS STILL NOT ENOUGH.
-- A missing GRANT is a fact about today's configuration; BR-30 is a product
-- decision that is supposed to outlive it. The two come apart in ways that are
-- ordinary rather than exotic:
--
--   * someone adds a GRANT to a client role for an unrelated reason (a broader
--     `grant all on all tables in schema public`, a new role, a restore that
--     replays default privileges) and the rule silently stops being enforced.
--     Nothing raises; nothing is reviewed; the protection was never written
--     down in the database, so nothing notices it left.
--   * a maintenance session runs as `postgres` — which is precisely how this
--     project's own out-of-band work is done — and a mistaken DELETE succeeds
--     silently, taking the auction, its outcome, and the bid history's parent
--     with it.
--
-- The difference the guard buys is entirely in what happens on that day.
-- Today the row disappears with no signal. With the guard it raises, and the
-- exception names the rule it is protecting, so the person holding the psql
-- prompt learns the rule instead of discovering the consequence. That is the
-- same bargain bids_are_append_only struck for BR-05, in the same file, and
-- nobody has argued with it since.
--
-- WHAT THIS DOES NOT CLOSE OFF — PRD §4.3, the "accepted operational gap".
-- The PRD records that with no Admin role, no cancellation and no editing,
-- removing an abusive or mistaken listing is done out-of-band by a developer
-- with direct data access, as a deliberate manual process. That path is
-- untouched and remains available exactly as before: a `postgres` session can
-- `alter table public.auctions disable trigger auctions_no_delete`, act, and
-- re-enable — the identical two-step this repository already uses against
-- auctions_immutable_terms in four test fixtures. The guard does not remove
-- the operator's ability to act; it removes the ability to act BY ACCIDENT.
-- An out-of-band takedown stays possible and becomes explicit. No product
-- decision is changed here, and none is invented: BR-30, BR-31, FR-SEC-04 and
-- SEC-Z3 already say no delete route may exist for any user.
--
-- NO CASCADE IS BROKEN BY THIS. Checked before writing it, because a guard
-- that blocks a legitimate cascade is worse than the gap it closes. Every
-- foreign key into and out of auctions is plain NO ACTION — there is no
-- `on delete cascade` anywhere in supabase/migrations:
--
--   public.profiles.id      references auth.users (id)
--   public.auctions.owner_id references public.profiles (id)
--   public.bids.auction_id   references public.auctions (id)
--   public.bids.bidder_id    references public.profiles (id)
--
-- So deleting an auth.users row cannot reach an auction row today either: it
-- is already blocked by profiles, and AUTH-01 records the intent directly —
-- "accounts are never deleted in the MVP; bids reference profiles". This
-- trigger therefore makes no previously-working deletion fail. It only fires
-- on a DELETE aimed at auctions itself.
-- ============================================================================

-- Same shape as bids_are_append_only (BID-02 §1e): a BEFORE ... FOR EACH ROW
-- trigger whose function does nothing but raise. Row-level, not statement-
-- level, deliberately and for the same reason as the bids guard — a statement
-- trigger fires once even for a DELETE that matches no rows, so `delete from
-- public.auctions where id = <nonexistent>` would raise where it is currently
-- a harmless no-op, and the error would name a rule the caller did not break.
-- Row-level fires per doomed row: no row, no raise, and the rule is only ever
-- cited when an auction really was about to disappear.
--
-- search_path is pinned empty, as BID-15 pinned it on the other trigger
-- functions: a SECURITY INVOKER trigger still executes with the caller's
-- search_path, and this function must not be resolvable through a shadowed
-- schema.
create or replace function public.auctions_are_permanent()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  raise exception 'auctions cannot be cancelled or deleted; no delete path exists for anyone (BR-30, BR-31, FR-SEC-04)';
end $$;

drop trigger if exists auctions_no_delete on public.auctions;

create trigger auctions_no_delete
  before delete on public.auctions
  for each row execute function public.auctions_are_permanent();

-- Revoked for the same reason BID-15 §6 revoked the others: PostgreSQL grants
-- EXECUTE on a new function to PUBLIC by default, and a function nobody should
-- call should not be callable. This does NOT disable the trigger — EXECUTE is
-- checked when a trigger is CREATED, not when it fires (measured in tests/auth,
-- PR #3).
revoke execute on function public.auctions_are_permanent() from public, anon, authenticated;
