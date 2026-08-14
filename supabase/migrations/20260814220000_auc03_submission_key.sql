-- ============================================================================
-- AUC-03 — duplicate-submission prevention (#45)
--
-- EC-21 · FR-CREATE-26a · ARCHITECTURE §12.3 · PRD.md:1094
--
-- WHY THIS IS A CONSTRAINT AND NOT A CHECK IN THE ACTION
--
-- EC-21 is not a polish issue and PRD.md:1445 says so in bold: with no
-- cancellation (BR-30) and no editing (BR-31), a duplicate auction "cannot be
-- removed by anyone -- it will run to its end time and close." There is no
-- repair path, so the only place the guarantee can live is a place that cannot
-- be raced.
--
-- A `select ... then insert if absent` in the server action is not that place.
-- A double-click issues two requests that interleave: both select, both find
-- nothing, both insert. The application-level check narrows the window and
-- never closes it. A unique constraint closes it, because PostgreSQL resolves
-- the collision inside the index rather than in application time.
--
-- ARCHITECTURE §12.3 requires prevention "at submission" and prescribes no
-- mechanism, so the mechanism is an engineering choice and is recorded here
-- rather than invented silently (CLAUDE.md §8).
--
-- WHY A KEY PER INTENT, NOT A CONTENT HASH
--
-- The tempting shape is `unique (owner_id, name, description, starting_price,
-- end_time)` -- "the same auction twice". It is wrong, and wrong in the
-- direction that costs a product decision nobody made: a seller with two
-- identical items would be refused the second listing. Nothing in the PRD
-- forbids listing the same thing twice. EC-21's own wording is "two identical
-- auctions from a **single user intent**" -- the unit is the intent, not the
-- content, so the key identifies the intent.
--
-- The form mints one key when the seller reaches the review step and resends
-- that same key on every retry of that intent. A fresh visit to the form is a
-- fresh intent and a fresh key.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The column
--
-- `default gen_random_uuid()` is doing two jobs and the second one is subtle:
--
--   a. it backfills existing rows, each with a distinct value, so the unique
--      constraint below can be added to a populated table;
--   b. it makes an insert that OMITS the key harmless. Any other default --
--      a constant, or a nullable column -- would make every key-less insert
--      collide with every other one, so the second legitimate auction created
--      by that path would be silently swallowed as a "duplicate". A guard that
--      eats real auctions is worse than the duplicate it prevents.
--
-- Not null, because a NULL key is the same trap in a different costume: NULLs
-- never compare equal in a unique index, so a nullable key would silently opt
-- every row out of the guarantee.
--
-- NOT one of the S0-11 six. The bid path neither reads nor writes it, and it
-- must never become an input to bidding. Recorded so the next session finds a
-- contract entry rather than an unexplained column (S0-11 §10.3 establishes
-- this expectation for anything added to public.auctions).
-- ----------------------------------------------------------------------------
alter table public.auctions
  add column if not exists submission_key uuid not null default gen_random_uuid();

comment on column public.auctions.submission_key is
  'EC-21 -- identifies one creation INTENT, not the auction content. The form mints it once and resends it on every retry; auctions_one_per_submission turns the replay into a no-op. Never displayed, never an input to bidding.';

-- ----------------------------------------------------------------------------
-- 2. The constraint
--
-- Scoped to the owner, deliberately. A globally unique submission_key would
-- hand any authenticated user a denial-of-service: read a key off the public
-- auctions table -- every column is publicly readable by design (BR-40,
-- FR-LIST-01), so the key is not a secret -- and insert an auction carrying it
-- before its owner retries. Owner-scoped, that attack does nothing: a key
-- under a different owner_id is a different row in the index.
--
-- Which is also why nothing here treats the key as a capability. It is not a
-- token, it authorises nothing, and the insert policy's WITH CHECK still ties
-- owner_id to auth.uid() (SEC-Z2). The key only decides whether THIS owner has
-- already spent THIS intent.
-- ----------------------------------------------------------------------------
alter table public.auctions
  drop constraint if exists auctions_one_per_submission;

alter table public.auctions
  add constraint auctions_one_per_submission unique (owner_id, submission_key);

-- ----------------------------------------------------------------------------
-- 3. No immutability guard, and that is not an oversight
--
-- Every other creation-time term on this table is protected against UPDATE:
-- owner_id, starting_price and created_at by auctions_guard_update
-- (20260814000000 §2), and the record as a whole by the ABSENCE of any update
-- policy for any user (20260812120000 §3b, AUC-18).
--
-- submission_key needs no entry in that guard because it inherits the same
-- absence. No user role holds UPDATE on public.auctions -- PostgreSQL checks
-- the GRANT before any policy, and 20260814130000 grants INSERT and nothing
-- else. The only writers that reach the table with elevated privilege are
-- place_bid and close_ended_auctions, and neither names this column.
--
-- Adding a branch to auctions_guard_update would also mean CREATE OR REPLACE-ing
-- a function whose other branches are BR-36 behaviour Rayan owns, to defend
-- against a write path that does not exist (CLAUDE.md §1).
-- ----------------------------------------------------------------------------

do $$
begin
  raise notice 'AUC-03: submission_key + auctions_one_per_submission ready (EC-21)';
end $$;
