-- ============================================================================
-- V2 fixed-increment suite — place_bid_v2, next_offer, and the BR-32 boundary.
--
-- The one assertion CLAUDE.md §9 demanded the day bid_increment landed is #7:
-- the SERVER still accepts an amount that is NOT a multiple of the increment,
-- through the V1 place_bid, on a V2 auction. D-01 scopes the increment to what
-- the SCREEN offers; BR-32 governs what the server accepts, and it is
-- unchanged. If #7 ever fails, someone added the increment check §13.2a
-- forbids — that is a bug, not a tightening.
--
-- Run via ./run.sh — needs the V2 migrations (categories, auction fields,
-- place_bid_v2) applied after the V1 set.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\set QUIET on

create or replace function pg_temp.as_user(u uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', u)::text, false)::void $$;

create or replace function pg_temp.as_anon() returns void language sql as
$$ select set_config('request.jwt.claims', '', false)::void $$;

create or replace function pg_temp.chk(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is not distinct from want then
    raise notice 'PASS  %  (%)', rpad(label, 44), got;
  else
    raise warning 'FAIL  %  got=%  want=%', rpad(label, 44), got, want;
  end if;
end $$;

do $$
declare
  owner uuid := '00000000-0000-0000-0000-0000000000a1';
  b1    uuid := '00000000-0000-0000-0000-0000000000b1';
  b2    uuid := '00000000-0000-0000-0000-0000000000b2';
  a     uuid;   -- the V2 fixed-increment auction
  v1a   uuid;   -- a V1 legacy auction (bid_increment null)
  dead  uuid;   -- an already-expired V2 auction
  r     jsonb;
  t     text;
  state text;
begin
  -- 1. Same transport rule as place_bid, for the same reason: a numeric
  --    p_expected would be cast by PostgREST before the body runs.
  perform pg_temp.chk('place_bid_v2 signature is (uuid, text)',
                      (select string_agg(pg_get_function_identity_arguments(p.oid),
                                         ' | ' order by p.oid)
                         from pg_catalog.pg_proc p
                         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
                        where n.nspname = 'public' and p.proname = 'place_bid_v2'),
                      'p_auction_id uuid, p_expected text');

  insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                               name, description, image_path, category_id, bid_increment)
  values (owner, 'active', now() + interval '1 hour', 1000, 1000,
          'اختبار الزيادة الثابتة', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/inc.jpg', 1, 500)
  returning id into a;

  insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                               name, description, image_path)
  values (owner, 'active', now() + interval '1 hour', 100, 100,
          'اختبار الوضع القديم', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/v1.jpg')
  returning id into v1a;

  -- 2. Fresh V2 auction: the only legal first amount is the starting price.
  select public.next_offer(x) into t from public.auctions x where x.id = a;
  perform pg_temp.chk('next_offer on a fresh V2 auction = starting', t, '1000.00');

  -- 3/4. The button's first bid: exactly the starting price (BR-29 inclusive).
  perform pg_temp.as_user(b1);
  r := public.place_bid_v2(a, '1000.00');
  perform pg_temp.chk('first button bid accepted at starting price',
                      (r->>'accepted') || '/' || (r->>'amount'), 'true/1000.00');
  perform pg_temp.chk('acceptance carries the NEXT offer', r->>'next_offer', '1500.00');

  -- 5/6. A stale expected is a race, never a silent escalation: the user
  --      consented to 1000, the price moved, the server refuses and re-arms.
  r := public.place_bid_v2(a, '1000.00');
  perform pg_temp.chk('stale expected rejected as outbid_race', r->>'reason', 'outbid_race');
  perform pg_temp.chk('race rejection carries the new offer', r->>'next_offer', '1500.00');

  -- 7. THE BR-32 ASSERTION. The V1 place_bid, on this V2 auction, accepts an
  --    amount that is NOT a multiple of 500 and not even whole. The increment
  --    governs the button; the server never enforces it (§13.2a, D-01).
  perform pg_temp.as_user(b2);
  r := public.place_bid(a, '1234.56');
  perform pg_temp.chk('BR-32: server accepts a non-multiple amount',
                      (r->>'accepted') || '/' || (r->>'amount'), 'true/1234.56');

  -- 8. next_offer follows exactly, at full decimal precision — no rounding to
  --    the increment grid, no float anywhere.
  select public.next_offer(x) into t from public.auctions x where x.id = a;
  perform pg_temp.chk('next_offer exact over a decimal price', t, '1734.56');

  -- 9. And the button keeps working from the odd price.
  perform pg_temp.as_user(b1);
  r := public.place_bid_v2(a, '1734.56');
  perform pg_temp.chk('button bid accepted from a decimal price',
                      (r->>'accepted') || '/' || (r->>'amount'), 'true/1734.56');

  -- 10. A V1 auction has no button: the caller is told to send an amount.
  r := public.place_bid_v2(v1a, '100.00');
  perform pg_temp.chk('V1 auction refuses the button path', r->>'reason', 'amount_required');

  -- 11. Owner may never bid, through this door either (BR-02).
  perform pg_temp.as_user(owner);
  r := public.place_bid_v2(a, '2234.56');
  perform pg_temp.chk('owner refused on the button path', r->>'reason', 'owner_cannot_bid');

  -- 12. Anonymous gets the product-level reason, not a raw error.
  perform pg_temp.as_anon();
  r := public.place_bid_v2(a, '2234.56');
  perform pg_temp.chk('anonymous refused on the button path', r->>'reason', 'not_authenticated');

  -- 13. The clock decides, same as place_bid (LC-03).
  insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                               name, description, image_path, category_id, bid_increment)
  values (owner, 'active', now() - interval '1 minute', 1000, 1000,
          'اختبار مزاد منتهٍ', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/dead.jpg', 1, 500)
  returning id into dead;
  perform pg_temp.as_user(b1);
  r := public.place_bid_v2(dead, '1000.00');
  perform pg_temp.chk('expired V2 auction refuses the button', r->>'reason', 'auction_ended');

  -- 14. The increment's shape is a constraint, not advice: whole multiples of
  --     10 only (auctions_increment_shape).
  state := '';
  begin
    insert into public.auctions (owner_id, status, end_time, starting_price, current_price,
                                 name, description, image_path, category_id, bid_increment)
    values (owner, 'active', now() + interval '1 hour', 100, 100,
            'اختبار زيادة مشوهة', 'وصف اختباري طوله كافٍ للحد الأدنى.', 'test/bad.jpg', 1, 55);
  exception when others then
    state := SQLSTATE;
  end;
  perform pg_temp.chk('a non-multiple-of-10 increment is a 23514', state, '23514');

  -- 15. The increment is a creation-time term: immutable, like the starting
  --     price it modulates (auctions_guard_update).
  state := '';
  begin
    update public.auctions set bid_increment = 1000 where id = a;
  exception when others then
    state := SQLSTATE;
  end;
  perform pg_temp.chk('bid_increment is immutable after creation', state, 'P0001');
end $$;
