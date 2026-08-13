-- Minimal Supabase shim so the BID-02 migration can run on stock PostgreSQL 17.
-- Mirrors only what the migration touches: the three PostgREST roles, the
-- auth schema, auth.users, and auth.uid() reading request.jwt.claims.
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
  -- Added for tests/auth: the AUTH-01 signup trigger reads the display name
  -- from here, exactly as GoTrue writes it from signUp's options.data.
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- NOTE where nullif sits: it wraps the SETTING, before the cast. Writing it the
-- other way round — current_setting(...)::json ->> 'sub' with nullif outside —
-- raises "invalid input syntax for type json" the moment the claim is empty,
-- i.e. for every unauthenticated caller. That surfaces as a crash rather than a
-- rejection, and it silently aborts any DO block that tests the anonymous path.
-- This exact bug hid four assertions in this suite once. Do not "simplify" it.
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
