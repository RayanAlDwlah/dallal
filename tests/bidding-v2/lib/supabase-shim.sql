-- ============================================================================
-- Minimal Supabase shim so the V2 migrations run on a stock PostgreSQL 17.
--
-- V1's schema needed only `auth`; V2's needs `storage` as well, and that one
-- addition is the whole reason V2 shipped without a database suite for a day.
-- `supabase/migrations/20260815100000_core_schema.sql` INSERTs two buckets and
-- creates four policies on `storage.objects` at top level — not inside a
-- conditional `do` block the way V1's `03-auc01` did — so on a bare container
-- the migration aborts at line 496 and nothing after it exists. No auctions
-- table, no place_bid, no suite.
--
-- Descended from `tests/bidding/lib/supabase-shim.sql` on `main` (V1). The auth
-- half is carried over almost verbatim, comments included, because every
-- comment in it records a measured defect. The realtime half is DROPPED: V2's
-- schema calls no `realtime.send()` — it publishes tables to
-- `supabase_realtime` and creates the publication itself when missing, which
-- works on a stock container with no help from us.
--
-- WHAT A SHIM MAY AND MAY NOT DO. It mirrors the platform objects the
-- migrations TOUCH, at the fidelity the assertions READ. It must never stand in
-- for something the suite then claims to have proven: a double that answers
-- every question is a double that tests nothing. Where this file diverges from
-- the platform, it says so on the line.
-- ============================================================================

create schema if not exists auth;

do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create table if not exists auth.users (
  id          uuid primary key,
  instance_id uuid,
  aud         text,
  role        text,
  email       text unique,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  -- The V2 signup trigger `public.handle_new_user()` reads the display name
  -- from here, exactly as GoTrue writes it from signUp's options.data — and
  -- falls back to the local part of the email, then to «مستخدم». All three
  -- paths are asserted in acceptance.sql, which is only possible because both
  -- columns exist here.
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz
);

-- NOTE where nullif sits: it wraps the SETTING, before the cast. Writing it the
-- other way round — current_setting(...)::json ->> 'sub' with nullif outside —
-- raises "invalid input syntax for type json" the moment the claim is empty,
-- i.e. for every unauthenticated caller. That surfaces as a crash rather than a
-- rejection, and it silently aborts any DO block that tests the anonymous path.
-- This exact bug hid four assertions in V1's suite once. Do not "simplify" it.
--
-- It matters more on V2 than it did on V1: `place_bid`'s FIRST branch is
-- `if v_user is null then return … 'auth_required'`, so the anonymous path is
-- an assertion in this suite rather than an edge case.
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;

-- ============================================================================
-- storage — new for V2, and the reason this file exists at all.
--
-- Three objects, because the migration touches exactly three:
--
--   storage.buckets      INSERT … ON CONFLICT (id) DO UPDATE, so it needs the
--                        primary key and the four columns named in the insert.
--   storage.objects      four policies are created ON it, so it must exist and
--                        must have RLS enabled — a policy on a table without
--                        RLS is accepted by PostgreSQL and enforces nothing,
--                        which would make every storage assertion vacuous.
--   storage.foldername() the policies call it inside their USING/WITH CHECK.
--
-- FIDELITY OF foldername() IS LOAD-BEARING AND IS NOT GUESSED. The real one
-- splits the object name on '/' and returns everything BUT the final segment,
-- so `foldername('<uid>/a.jpg')` is `{<uid>}` and `[1]` is the uid. An
-- implementation that returned all segments would put the FILENAME in `[1]` for
-- a top-level upload and the policies would read as passing while admitting
-- another user's folder. Written the same way the platform writes it.
-- ============================================================================
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  owner              uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  public             boolean default false,
  avif_autodetection boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata   jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored
);
alter table storage.objects enable row level security;

-- Mirrors the platform's grants: the verbs exist for both Data API roles and
-- are dead until a policy admits a row. That ordering is what lets
-- acceptance.sql assert the four storage policies do something rather than
-- read that they say so.
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

create or replace function storage.foldername(name text)
returns text[] language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end $$;
