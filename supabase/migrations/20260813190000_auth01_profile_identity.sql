-- ============================================================================
-- AUTH-01 / AUTH-07 — the half of public.profiles that belongs to identity.
--
-- DEPENDS ON 20260812120000_bid02_bid_acceptance.sql, which declares
-- public.profiles. Rayan declared it minimally and asked, in PR #5, whether
-- two columns were enough and whether the 2-50 length check belonged to him.
-- They are not, and it does not: both live here, with the signup trigger,
-- because they are properties of the write path and the write path is mine.
--
-- Nothing in this file touches auctions, bids, or place_bid.
-- Sources: PRD v3.0 FR-PROF-01/02/03, FR-AUTH-19/20/21, BR-39, ADR-7,
--          docs/identity-contract.md §8.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. created_at — FR-PROF-01.
--
-- FR-PROF-01 fixes the profile's contents exactly: internal identifier, email
-- (private, in auth.users), display name, and the creation timestamp. The
-- timestamp was the one member with nowhere to live.
--
-- Email is deliberately NOT added here and must never be. Its absence from
-- this table is what makes the privacy guarantee structural rather than
-- procedural (ADR-7, SEC-P1, CLAUDE.md §6): public reads and realtime payloads
-- join profiles, so a column here is a column in every one of them.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 2. display_name length — FR-PROF-03, 2 to 50 characters.
--
-- char_length, not octet_length: the interface is Arabic (BR-41), where one
-- character is two or more bytes. octet_length would silently make the real
-- limit about 25 Arabic characters.
--
-- Uniqueness is already on the column from the BID-02 migration and is left
-- exactly as declared — case-sensitive, matching PostgreSQL text comparison.
-- Making it case-insensitive would reject names BR-39 permits, which is a
-- product decision nobody has recorded (TEAM.md rule 16).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname  = 'profiles_display_name_length'
  ) then
    alter table public.profiles
      add constraint profiles_display_name_length
      check (char_length(display_name) between 2 and 50);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. The signup trigger — FR-PROF-02.
--
-- "Every account must have a display name before it can bid." A trigger makes
-- that structural: the profile row is inserted in the SAME TRANSACTION as the
-- auth.users row, so an account without a profile cannot be committed. Doing
-- it from the application instead would leave an orphaned account behind every
-- failed second step, and that account could still sign in.
--
-- The failure modes are deliberate:
--   * display_name missing  -> NOT NULL violation -> signup rolls back.
--     Registration always supplies one (FR-PROF-02, first branch), so this
--     only fires for an account created outside the form. Failing loudly beats
--     deriving a name from the email local part, whose collision behaviour the
--     PRD does not specify and which would publish part of an address.
--   * display_name taken    -> unique violation   -> signup rolls back, and
--     registerAction re-reads the name to report it precisely (FR-PROF-03).
--
-- security definer: the caller is the anon role mid-signup, and profiles has
-- no insert policy for anyone. That absence is intentional — the trigger is
-- the only way a row gets here.
--
-- search_path = '' with fully qualified names: without it, a schema earlier on
-- the search path could shadow `profiles` and capture the insert.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Whitespace-only is not a display name. nullif turns it into the NOT NULL
    -- violation above rather than a blank name in public bid history.
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  -- created_at is left to the column default so it takes the transaction's
  -- own now(), which is the same instant as the auth.users row.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. Write paths — the absence of each one is the requirement.
--
-- profiles already has RLS enabled and one public read policy (BID-02 §3a).
-- No insert, update or delete policy exists, and none should:
--
--   insert  -> only the trigger above, so a profile always matches an account
--   update  -> editing the display name is FR-PROF-05, a Should Have, and is
--              not built. A row policy is what would authorise it later.
--   delete  -> accounts are never deleted in the MVP; bids reference profiles.
--
-- The revoke is belt and braces against Supabase's default broad grants to the
-- anon and authenticated roles, in the same spirit as the bids revoke.
-- ----------------------------------------------------------------------------
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Not callable directly (PostgreSQL refuses to invoke a trigger function), but
-- a SECURITY DEFINER function is never left broadly executable on principle.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
