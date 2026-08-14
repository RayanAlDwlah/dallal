-- Minimal Supabase shim so the BID-02 migration can run on stock PostgreSQL 17.
-- Mirrors only what the migrations touch: the three PostgREST roles, the
-- auth schema, auth.users, auth.uid() reading request.jwt.claims — and, since
-- BID-08, the two realtime objects its broadcast trigger calls.
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
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  -- Added for tests/auth (AUTH-11, SC-70): real GoTrue has this column and
  -- leaves it NULL while "Confirm email" is off, which is the state BR-37
  -- requires. The SC-70 assertions read it to prove no verification step
  -- exists — and, more importantly, that none appears later: an implementation
  -- that quietly confirmed the address on first use would satisfy every other
  -- assertion in that block. Absent from the shim, the whole block aborted on
  -- its first statement and six assertions never ran.
  email_confirmed_at timestamptz
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

-- ============================================================================
-- realtime — added for tests/bidding/realtime.sql (BID-08).
--
-- Without this the BID-08 trigger would take its exception path on every bid,
-- and the suite could prove only that a broken broadcast does not break a bid.
-- It could not see the payload — which is the whole privacy claim (RT-S2,
-- SC-42, ARCH §14.4). So the two objects the trigger calls are mirrored here,
-- faithfully in the three ways the suite reads them:
--
--   * realtime.send's signature is byte-identical to the deployed one,
--     verified against dallal-dev on 2026-08-14:
--         realtime.send(payload jsonb, event text, topic text, private boolean default true)
--   * it WRITES A ROW rather than notifying, exactly as the real one does, so
--     the row this suite asserts on is the row production would have written
--   * realtime.messages carries production's columns and, like production,
--     has RLS enabled with the platform's anon/authenticated grants already in
--     place. That is what lets the suite prove the §3 policy is SELECT-only
--     rather than merely reading that it says so.
--
-- ONE DELIBERATE DIVERGENCE, and it is the point of the file:
-- the real realtime.send wraps its own INSERT in `exception when others then
-- raise warning`, so it swallows its own failures. This one does not swallow
-- when dalal.test_realtime_fail = 'on'. That is not a mismatch — it is the
-- only way to exercise the failures the real one CANNOT swallow, because they
-- happen before its body runs: the function missing on a stack without the
-- realtime extension, or EXECUTE revoked. RT-R7 is the requirement that an
-- accepted bid survives those, and a double that swallows everything would
-- report RT-R7 as proven while never testing it.
-- ============================================================================
create schema if not exists realtime;

create table if not exists realtime.messages (
  topic          text not null,
  extension      text not null,
  payload        jsonb,
  event          text,
  private        boolean default false,
  updated_at     timestamp not null default now(),
  inserted_at    timestamp not null default now(),
  id             uuid not null default gen_random_uuid(),
  binary_payload bytea
);
alter table realtime.messages enable row level security;

-- Mirrors the platform's own grants, measured on dev: anon and authenticated
-- hold select, insert AND update here. They are all dead until a policy exists
-- — that ordering is what tests/bidding/realtime.sql asserts.
grant usage on schema realtime to anon, authenticated, service_role;
grant select, insert, update on realtime.messages to anon, authenticated, service_role;

create or replace function realtime.topic() returns text language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '')::text;
$$;

create or replace function realtime.send(
  payload jsonb, event text, topic text, private boolean default true
) returns void language plpgsql as $$
declare
  generated_id uuid := gen_random_uuid();
begin
  if coalesce(current_setting('dalal.test_realtime_fail', true), '') = 'on' then
    -- Stands in for 42883 (function gone) or 42501 (execute revoked): raised by
    -- the CALL, which is precisely what realtime.send's internal handler cannot
    -- reach and what BID-08's own exception block exists for.
    raise exception 'injected realtime failure (tests/bidding/realtime.sql)';
  end if;

  execute format('set local realtime.topic to %L', topic);
  insert into realtime.messages (id, payload, event, topic, private, extension)
  values (generated_id,
          case when payload ? 'id' then payload
               else jsonb_set(payload, '{id}', to_jsonb(generated_id)) end,
          event, topic, private, 'broadcast');
end $$;
