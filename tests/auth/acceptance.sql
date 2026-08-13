-- ============================================================================
-- Acceptance suite for the identity half of public.profiles (AUTH-01/AUTH-07).
--
-- Every assertion traces to a PRD requirement. A failure here is a product
-- failure, not a style problem.
--
-- Run via ./run.sh — it applies the shim and every file in supabase/migrations
-- first. Keep EXPECTED in run.sh in step with the number of chk() calls below.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

create or replace function pg_temp.chk(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %  (%)', rpad(label, 46), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 46), got, want;
  end if;
end $$;

/*
 * Attempts a signup exactly as GoTrue does — one insert into auth.users
 * carrying the display name in raw_user_meta_data — and reports either
 * 'accepted' or the SQLSTATE the trigger raised.
 *
 * The insert runs inside this function's own exception block, which gives it
 * a savepoint. That is what makes the rollback assertions meaningful: a
 * failure here undoes the auth.users row too, exactly as it would in the real
 * signup transaction.
 */
create or replace function pg_temp.signup(u uuid, mail text, name text)
returns text language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (u, mail, case when name is null then '{}'::jsonb
                        else jsonb_build_object('display_name', name) end);
  return 'accepted';
exception when others then
  return sqlstate;
end $$;

do $$
declare
  u1 uuid := '00000000-0000-0000-0000-00000000a001';
  u2 uuid := '00000000-0000-0000-0000-00000000a002';
  u3 uuid := '00000000-0000-0000-0000-00000000a003';
  u4 uuid := '00000000-0000-0000-0000-00000000a004';
  u5 uuid := '00000000-0000-0000-0000-00000000a005';
  u6 uuid := '00000000-0000-0000-0000-00000000a006';
  u7 uuid := '00000000-0000-0000-0000-00000000a007';
  u8 uuid := '00000000-0000-0000-0000-00000000a008';
  u9 uuid := '00000000-0000-0000-0000-00000000a009';
  got text;
begin
  -- FR-PROF-02: the profile is created by the account insert, not by the app.
  perform pg_temp.signup(u1, 'a1@test.local', 'Abdulrahman');
  perform pg_temp.chk('FR-PROF-02 signup creates the profile',
    (select display_name from public.profiles where id = u1), 'Abdulrahman');

  -- FR-PROF-01: the creation timestamp is one of the four required members.
  perform pg_temp.chk('FR-PROF-01 created_at is populated',
    (select (created_at is not null)::text from public.profiles where id = u1), 'true');

  -- BR-39 / FR-PROF-03: unique across all accounts.
  perform pg_temp.chk('BR-39 duplicate display name rejected',
    pg_temp.signup(u2, 'a2@test.local', 'Abdulrahman'), '23505');

  /*
   * The one that matters most: a rejected signup must leave NO account behind.
   * An orphaned auth.users row would be an account that can sign in and has no
   * public identity — it would reach the bid path with a null display name.
   */
  perform pg_temp.chk('FR-PROF-02 rejected signup leaves no account',
    (select count(*)::text from auth.users where id = u2), '0');

  -- FR-PROF-03: 2 to 50 characters, both boundaries inclusive.
  perform pg_temp.chk('FR-PROF-03 1 character rejected',
    pg_temp.signup(u3, 'a3@test.local', 'x'), '23514');
  perform pg_temp.chk('FR-PROF-03 51 characters rejected',
    pg_temp.signup(u4, 'a4@test.local', repeat('x', 51)), '23514');
  perform pg_temp.chk('FR-PROF-03 2 characters accepted',
    pg_temp.signup(u5, 'a5@test.local', 'xy'), 'accepted');
  perform pg_temp.chk('FR-PROF-03 50 characters accepted',
    pg_temp.signup(u6, 'a6@test.local', repeat('y', 50)), 'accepted');

  /*
   * BR-41 — the interface is Arabic, so one character is two bytes. Written
   * with octet_length instead of char_length the constraint would still pass
   * every Latin test above and silently cut the real limit to 25 Arabic
   * characters. These two assertions are the only thing that catches it.
   */
  perform pg_temp.chk('BR-41 2 Arabic characters accepted',
    pg_temp.signup(u7, 'a7@test.local', 'عب'), 'accepted');
  perform pg_temp.chk('BR-41 50 Arabic characters accepted',
    pg_temp.signup(u8, 'a8@test.local', repeat('ع', 50)), 'accepted');

  -- FR-PROF-02: an account with no display name must not be creatable.
  perform pg_temp.chk('FR-PROF-02 missing display name rejected',
    pg_temp.signup(u9, 'a9@test.local', null), '23502');
  perform pg_temp.chk('FR-PROF-02 whitespace-only name rejected',
    pg_temp.signup(u9, 'a9@test.local', '   '), '23502');
end $$;

/*
 * ADR-7 / SEC-P1 — the email privacy guarantee is structural. It holds because
 * there is no column here to leak, not because queries are careful. If this
 * assertion ever fails, every public read and every realtime payload that
 * joins profiles has become an email disclosure at the same moment.
 */
do $$
begin
  perform pg_temp.chk('ADR-7 profiles has no email column',
    (select count(*)::text from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name in ('email', 'email_address')), '0');
end $$;

/*
 * The write paths that must not exist. Each is the ABSENCE of a policy plus a
 * revoke, so each is tested by attempting it as the role that would use it.
 */
do $$
declare got text;
begin
  begin
    set local role anon;
    insert into public.profiles (id, display_name)
      values ('00000000-0000-0000-0000-00000000b001', 'Injected');
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('SEC-P1 anon cannot insert a profile', got, '42501');

  begin
    set local role authenticated;
    update public.profiles set display_name = 'Renamed'
      where id = '00000000-0000-0000-0000-00000000a001';
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  -- FR-PROF-05 is a Should Have and is not built; the absence of an update
  -- policy is what keeps historical attribution stable (FR-PROF-05's caveat).
  perform pg_temp.chk('FR-PROF-05 authenticated cannot rename', got, '42501');

  begin
    set local role authenticated;
    delete from public.profiles where id = '00000000-0000-0000-0000-00000000a001';
    got := 'accepted';
  exception when others then got := sqlstate;
  end;
  reset role;
  perform pg_temp.chk('profiles cannot be deleted by a user', got, '42501');
end $$;
