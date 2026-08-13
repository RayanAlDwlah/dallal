-- ============================================================================
-- AUC-18 — a user cannot modify or delete ANY auction, their own included.
--
-- SC-58 asks for "automated test per field" and SC-59 for an automated test.
-- Every assertion below traces to a requirement; a failure here is a product
-- failure, not a style problem.
--
-- The owner is the subject of most of these on purpose. "A stranger cannot edit
-- your auction" is the easy half and nobody gets it wrong. FR-SEC-04 says
-- **including their own**, and that is the half a well-meaning "let sellers fix
-- a typo" change would break.
--
-- Run via ./run.sh. Keep EXPECTED in run.sh in step with the chk() calls.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

create or replace function pg_temp.chk(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %  (%)', rpad(label, 52), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 52), got, want;
  end if;
end $$;

/* Signs up exactly as GoTrue does, so the AUTH-01 trigger builds the profile. */
create or replace function pg_temp.signup(u uuid, mail text, name text)
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (u, mail, jsonb_build_object('display_name', name));
end $$;

/*
 * Attempts one UPDATE as the auction's OWNER, through the `authenticated` role
 * so both gates apply — the table GRANT and then RLS. Returns 'accepted' or the
 * SQLSTATE. Each call is its own subtransaction, so a rejection does not abort
 * the ones after it.
 */
create or replace function pg_temp.owner_update(a uuid, owner uuid, assignment text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', owner)::text, true);
  execute 'set local role authenticated';
  execute format('update public.auctions set %s where id = %L', assignment, a);
  execute 'reset role';
  return 'accepted';
exception when others then
  execute 'reset role';
  return sqlstate;
end $$;

do $$
declare
  owner uuid := '00000000-0000-0000-0000-00000000c001';
  other uuid := '00000000-0000-0000-0000-00000000c002';
  a     uuid;
  got   text;
begin
  perform pg_temp.signup(owner, 'auc18-owner@test.local',  'auc18_owner');
  perform pg_temp.signup(other, 'auc18-other@test.local',  'auc18_other');

  -- Fixture written as postgres: RLS is bypassed, so this asserts nothing about
  -- the policy. The policy itself is asserted separately, below.
  insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
  values (owner, 'active', now() + interval '1 hour', 100, 100)
  returning id into a;

  -- ==========================================================================
  -- SC-58 / FR-SEC-09 — no UPDATE route, per field, AS THE OWNER.
  -- ==========================================================================
  perform pg_temp.chk('SC-58 owner cannot change end_time',
    pg_temp.owner_update(a, owner, 'end_time = now() + interval ''6 days'''), '42501');
  perform pg_temp.chk('SC-58 owner cannot change starting_price',
    pg_temp.owner_update(a, owner, 'starting_price = 1'), '42501');
  perform pg_temp.chk('SC-58 owner cannot change current_price',
    pg_temp.owner_update(a, owner, 'current_price = 999999'), '42501');
  perform pg_temp.chk('SC-58 owner cannot change created_at',
    pg_temp.owner_update(a, owner, 'created_at = now() - interval ''1 year'''), '42501');
  perform pg_temp.chk('SC-38 owner cannot reassign owner_id',
    pg_temp.owner_update(a, owner, format('owner_id = %L', other)), '42501');
  perform pg_temp.chk('SEC-Z5 owner cannot set status',
    pg_temp.owner_update(a, owner, 'status = ''ended'''), '42501');
  perform pg_temp.chk('SEC-Z6 owner cannot pre-set winner_id',
    pg_temp.owner_update(a, owner, format('winner_id = %L', other)), '42501');
  perform pg_temp.chk('SEC-Z6 owner cannot pre-set final_price',
    pg_temp.owner_update(a, owner, 'final_price = 1'), '42501');
  perform pg_temp.chk('SEC-Z6 owner cannot pre-set closed_at',
    pg_temp.owner_update(a, owner, 'closed_at = now()'), '42501');
  -- BR-36 as amended: extensions are automatic and happen only inside
  -- place_bid. A user reaching the counter directly would be buying time.
  perform pg_temp.chk('BR-36 owner cannot touch extension_count',
    pg_temp.owner_update(a, owner, 'extension_count = 0'), '42501');

  -- A non-owner is the easy case, asserted so the suite is total rather than
  -- because anyone doubts it.
  perform pg_temp.chk('SC-58 a stranger cannot change end_time',
    pg_temp.owner_update(a, other, 'end_time = now() + interval ''6 days'''), '42501');

  -- ==========================================================================
  -- SC-59 / FR-SEC-04 / BR-30 — no DELETE route, and no Cancelled state.
  -- ==========================================================================
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', owner)::text, true);
    set local role authenticated;
    delete from public.auctions where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SC-59 owner cannot delete their own auction', got, '42501');

  begin
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    delete from public.auctions where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SC-59 anon cannot delete an auction', got, '42501');

  /*
   * The Cancelled state is unreachable even for a role that bypasses RLS
   * entirely — the CHECK constraint admits exactly two values. This runs as
   * postgres deliberately: if it only held for client roles it would be a
   * policy, not a guarantee.
   */
  begin
    insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
    values (owner, 'cancelled', now() + interval '1 hour', 100, 100);
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.chk('BR-30 no Cancelled state exists, even for postgres', got, '23514');

  -- ==========================================================================
  -- "via crafted request" — the layer beneath RLS. Grants bind client roles;
  -- the auctions_guard_update trigger binds EVERYONE, including the table owner
  -- and any SECURITY DEFINER function. Without this, FR-SEC-09 would hold only
  -- for users who came through PostgREST.
  -- ==========================================================================
  begin
    update public.auctions set end_time = now() + interval '6 days' where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.chk('FR-SEC-09 even postgres cannot move end_time', got, 'P0001');

  begin
    update public.auctions set starting_price = 1 where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.chk('BR-31 even postgres cannot change starting_price', got, 'P0001');

  begin
    update public.auctions set owner_id = other where id = a;
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.chk('BR-10 even postgres cannot reassign the owner', got, 'P0001');

  -- ==========================================================================
  -- FR-SEC-03 / SC-39 — creation is attributed to the caller, never the payload.
  -- ==========================================================================
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', owner)::text, true);
    set local role authenticated;
    insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
    values (other, 'active', now() + interval '1 hour', 100, 100);
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SC-39 cannot create an auction owned by someone else', got, '42501');

  /*
   * The positive case, and it is not padding. Every assertion above passes
   * trivially if `authenticated` simply cannot write to this table at all —
   * which was exactly the state of main before AUC-18 added the INSERT grant.
   * Without this one, the suite would have reported a perfect score for a
   * product in which no auction can ever be created.
   */
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', owner)::text, true);
    set local role authenticated;
    insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
    values (owner, 'active', now() + interval '1 hour', 100, 100);
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('AUC-08 the owner CAN create their own auction', got, 'accepted');
end $$;

/*
 * ===========================================================================
 * The completeness guard.
 *
 * SC-58 says "per field", and this file names its fields by hand — so it goes
 * stale the moment a column is added. AUC-01/AUC-02 are adding name,
 * description and image_path right now, and those are precisely the fields
 * SC-58 cares most about.
 *
 * So the suite fails when it meets a column it does not cover, naming it. It
 * cannot silently keep reporting a full pass over a shrinking fraction of the
 * table.
 * ===========================================================================
 */
do $$
declare
  covered text[] := array[
    'id', 'owner_id', 'status', 'end_time', 'starting_price', 'current_price',
    'winner_id', 'final_price', 'closed_at', 'created_at', 'extension_count'
  ];
  missing text;
begin
  select string_agg(column_name, ', ' order by column_name)
    into missing
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'auctions'
     and column_name <> all (covered);

  perform pg_temp.chk('SC-58 every auctions column has an assertion',
                      coalesce(missing, 'none'), 'none');

  if missing is not null then
    raise warning 'uncovered column(s): % — add an immutability assertion above', missing;
  end if;
end $$;
