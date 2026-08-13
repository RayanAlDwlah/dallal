-- ============================================================================
-- BID-02 migration — money domain, tables, the bid operation, RLS.
-- Sources of truth: PRD v3.0, ARCHITECTURE v1.1 §13, S0-12 (FINAL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. The money type — S0-12 §3, VERBATIM. Do not edit without an S0-12 revision.
-- ----------------------------------------------------------------------------
-- sar_amount — THE money representation for Dalal. PRD BR-21, BR-33,
-- NFR-DAT-05. Do not add a precision/scale typmod. Do not add a magnitude
-- check. Do not "simplify" the finiteness clause. See docs/contracts/S0-12-money.md
CREATE DOMAIN sar_amount AS numeric
  CONSTRAINT sar_amount_valid CHECK (
        VALUE > 0                          -- (a) BR-20, FR-BID-07
    AND VALUE < 'Infinity'::numeric        -- (b) DO NOT REMOVE — NaN passes (a) and (c);
                                           --     an accepted NaN bricks the auction (S0-12 §8.1)
    AND VALUE = round(VALUE, 2)            -- (c) at most two decimals, REJECTED not rounded
  );                                       --     (NFR-DAT-05, EC-06). No typmod: a typmod is
                                           --     a ceiling (BR-21, SEC-R3) and silently ROUNDS.

-- ----------------------------------------------------------------------------
-- 1b. profiles — ABDULRAHMAN'S TABLE (S0-10, ADR-7). Shown minimally: only
-- what the bid path needs. Email lives in auth.users, structurally absent
-- here, so no join or realtime payload can ever leak it (SEC-P1, RT-S2, §9.2).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id),
  display_name text not null unique          -- BR-39: unique across all accounts
);

-- ----------------------------------------------------------------------------
-- 1c. auctions — MOHAMMED'S TABLE (S0-11). This migration declares ONLY the
-- six frozen read fields of the S0-11 contract (id, owner, status, end time,
-- starting price, current price) plus the four close fields Rayan writes at
-- finalization (status, final price, winner, close time). Mohammed adds his
-- display columns (name, description, image path) and creation validation
-- (AUC-01/AUC-02) in his own migration. Renaming/removing any of the six
-- requires telling Rayan first (S0-11 AC).
-- ----------------------------------------------------------------------------
create table if not exists public.auctions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id),  -- BR-10: exactly one owner, forever
  status         text not null default 'active'
                 constraint auctions_status_valid
                 check (status in ('active', 'ended')),          -- PRD §12.1: two persisted states,
                                                                 -- no Cancelled, no Draft (BR-30, BR-14)
  end_time       timestamptz not null,                           -- BR-16 fixed at creation; timestamptz =
                                                                 -- one canonical zone (NFR-DAT-06)
  starting_price sar_amount not null,                            -- BR-20 (>0) via the domain; FR-CREATE-06
  current_price  sar_amount not null,                            -- BR-13; written ONLY by place_bid after
                                                                 -- creation (BR-07, SC-40)
  -- Outcome fields — written ONLY by finalization (BID-15), never by users (SEC-Z6, SEC-Z7):
  winner_id      uuid references public.profiles (id),
  final_price    sar_amount,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),

  constraint auctions_price_floor
    check (current_price >= starting_price),                     -- NFR-DAT-01 structural support:
                                                                 -- price starts AT starting_price
                                                                 -- (BR-13) and only ever rises
  constraint auctions_outcome_only_when_ended
    check (status = 'ended'
           or (winner_id is null and final_price is null and closed_at is null))
                                                                 -- FR-END-08: outcome exists only at close
);

-- ----------------------------------------------------------------------------
-- 1d. bids — RAYAN'S TABLE (S0-11/BID-01). Append-only, permanent (BR-05,
-- BR-18, SEC-I1, NFR-DAT-02).
-- ----------------------------------------------------------------------------
create table if not exists public.bids (
  id         bigint generated always as identity primary key,
             -- Inserts on one auction happen ONLY under that auction's row
             -- lock, so per-auction id order IS the one definitive ordering
             -- (BR-11) and the FR-END-06 "earlier-ordered" tie-break basis.
  auction_id uuid not null references public.auctions (id),
  bidder_id  uuid not null references public.profiles (id),
             -- FK to profiles, not auth.users: ADR-7's consequence — a profile
             -- must exist before a user can bid — made structural.
  amount     sar_amount not null,                                -- NFR-DAT-05 via the domain
  created_at timestamptz not null default now(),                 -- FR-BID-23 display timestamp;
                                                                 -- ordering authority is id, not time

  constraint bids_one_per_price_level unique (auction_id, amount)
             -- BR-12 / SC-16 made STRUCTURAL: at most one accepted bid per
             -- price level per auction. Unreachable while place_bid is the
             -- only insert path (the lock guarantees strictly-increasing,
             -- which is stronger); exists as defense in depth.
);

create index if not exists bids_auction_order on public.bids (auction_id, id);
             -- history reads and the winner recomputation (NFR-DAT-04, SC-29)

-- ----------------------------------------------------------------------------
-- 1e. Structural immutability — no modify/delete path may exist for ANYONE,
-- including elevated roles and future definer code (BR-05, SEC-I1, NFR-DAT-02).
-- ----------------------------------------------------------------------------
create or replace function public.bids_are_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'bids are append-only; no update or delete path exists for anyone (BR-05, SEC-I1)';
end $$;

create trigger bids_no_update_or_delete
  before update or delete on public.bids
  for each row execute function public.bids_are_append_only();

-- ADR-2 / SEC-Z4 made structural for EVERY role, including service_role and
-- postgres (which bypass RLS): a bid row can only be born inside place_bid.
-- The flag is transaction-local and set only by place_bid immediately before
-- its INSERT; any second code path setting it fails review (S0-12 §9.4).
create or replace function public.bids_only_via_place_bid()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('dalal.in_place_bid', true), '') <> 'on' then
    raise exception 'bids may only be inserted by place_bid (ADR-2, SEC-Z4)';
  end if;
  return new;
end $$;

create trigger bids_insert_gate
  before insert on public.bids
  for each row execute function public.bids_only_via_place_bid();

-- Auction immutability for ANY update path (BR-31, BR-16, BR-10, FR-SEC-09),
-- and Ended as terminal (BR-15, FR-END-18, NFR-DAT-07). place_bid's
-- current_price write and finalization's outcome write both pass this guard.
create or replace function public.auctions_guard_update()
returns trigger language plpgsql as $$
begin
  if new.owner_id       is distinct from old.owner_id
     or new.starting_price is distinct from old.starting_price
     or new.end_time    is distinct from old.end_time
     or new.created_at  is distinct from old.created_at then
    raise exception 'auction creation-time terms are immutable (BR-31, BR-16, FR-SEC-09)';
  end if;
  if old.status = 'ended' then
    raise exception 'ended auctions are terminal; outcomes are immutable (BR-15, NFR-DAT-07)';
  end if;
  return new;
end $$;

create trigger auctions_immutable_terms
  before update on public.auctions
  for each row execute function public.auctions_guard_update();
-- ----------------------------------------------------------------------------
-- 2a. Formatting / transport helpers — S0-12 §6, §7, and amendment §0/§0.2.
-- format_sar is the ONE server-side display format (NFR-DAT-08): grouped
-- thousands, exactly two decimals, canonical format 1,250.00 SAR (BR-43).
--
-- The grouping is a REGEX over the digit run, never to_char: a format picture
-- renders wider values as ### — a hidden display ceiling (SEC-R3, EC-25,
-- S0-12 §7). Verified on PostgreSQL 17.10: 40 digits render as all 42 digits
-- correctly grouped, and byte-identical to the client formatter (S0-12 §0.2).
--
-- It returns the NUMBER ONLY, with no ' SAR' concatenated. The indicator is
-- appended by the caller as a separate element so it can sit OUTSIDE the
-- number's <bdi> isolate in the RTL document (BR-41, BR-42) — concatenating
-- it here would force the isolate boundary into the wrong place.
-- ----------------------------------------------------------------------------
CREATE FUNCTION format_sar(a sar_amount) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT regexp_replace(split_part(round(a,2)::text, '.', 1), '(\d)(?=(\d{3})+$)', '\1,', 'g')
      || '.' || split_part(round(a,2)::text || '.00', '.', 2)
$$;

-- Canonical scale-2 API text (S0-12 §6: amounts leave SQL as strings of the
-- canonical scale-2 form; the client's formatSAR renders them). round(a,2)
-- is the same value-preserving display-scale coercion format_sar uses:
-- domain clause (c) guarantees a = round(a,2), so the VALUE never changes —
-- this is display-scale, not input rounding (NFR-DAT-05, S0-12 §9.6).
create function public.sar_text(a public.sar_amount) returns text
language sql immutable strict as
$$ select round(a, 2)::text $$;

-- Rejection payload builder — ARCHITECTURE §13.5 / S0-12 §6: prices travel as
-- canonical scale-2 TEXT, formatted client-side by the one formatter
-- (BR-27, FR-BID-10, FR-BID-13). Product-level reasons only; no internal
-- detail ever leaks (SEC-T3, FR-SEC-16, FR-SEC-17).
create function public.bid_reject(
  p_reason    text,
  p_price_key text default null,
  p_price     public.sar_amount default null
) returns jsonb
language sql immutable as
$$
  select jsonb_build_object('accepted', false, 'reason', p_reason)
         || case when p_price is null then '{}'::jsonb
                 else jsonb_build_object(p_price_key, public.sar_text(p_price))
            end
$$;

-- ----------------------------------------------------------------------------
-- 2b. place_bid — ONE serialized atomic operation, the ONLY path that can
-- insert a bid (ADR-2). Follows ARCHITECTURE §13.2 steps 1-10 exactly.
-- SECURITY DEFINER: this is one of exactly TWO elevated operations in the
-- system (§11.4) — it bypasses RLS, therefore it re-verifies identity and
-- ownership itself, and it accepts NO caller-supplied user identifier (SEC-Z1).
-- p_amount is TEXT both directions (S0-12 §5.2, §6): a JSON number would die
-- in IEEE 754 before the SQL ran (BR-21 makes >2^53 amounts legal).
-- Call via PostgREST: POST /rest/v1/rpc/place_bid
--   {"p_auction_id": "<uuid>", "p_amount": "150.00"}   -- amount is a STRING
-- ----------------------------------------------------------------------------
create or replace function public.place_bid(p_auction_id uuid, p_amount text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''            -- definer hygiene: no schema hijacking; all refs qualified
as $$
declare
  v_uid                  uuid;
  v_num                  numeric;
  v_amount               public.sar_amount;
  v_price_before_lock    numeric;
  v_had_bids_before_lock boolean := false;
  v_owner_id             uuid;
  v_end_time             timestamptz;
  v_starting_price       public.sar_amount;
  v_current_price        public.sar_amount;
  v_has_bids             boolean;
  v_valid_before_lock    boolean;
  v_bid_id               bigint;
begin
  ----------------------------------------------------------------------------
  -- STEP 1 — caller is authenticated (BR-01, FR-BID-01, §13.2 step 1).
  -- Identity comes from the verified session (auth.uid()), NEVER the payload
  -- (SEC-Z1, BR-08). No p_bidder parameter exists, by design (§11.4).
  ----------------------------------------------------------------------------
  v_uid := auth.uid();
  if v_uid is null then
    return public.bid_reject('not_authenticated');            -- §13.5 reason 1
  end if;

  ----------------------------------------------------------------------------
  -- Pre-lock snapshot — NOT a validity check (S0-12 §5.1). This is the newest
  -- state the bidder COULD have seen before queueing on the lock, captured so
  -- the race-vs-too-low distinction (§13.5 reason 8 vs 7) is decided entirely
  -- server-side: no client-supplied "seen price" exists, so distinguishability
  -- holds even for direct crafted callers (SC-43, BR-08). Deliberately stale.
  ----------------------------------------------------------------------------
  select a.current_price,
         exists (select 1 from public.bids b where b.auction_id = a.id)
    into v_price_before_lock, v_had_bids_before_lock
    from public.auctions a
   where a.id = p_auction_id;
  v_had_bids_before_lock := coalesce(v_had_bids_before_lock, false);

  ----------------------------------------------------------------------------
  -- STEP 2 — exclusive lock on THIS auction row (§13.2 step 2, BR-11).
  -- Concurrent bids on the same auction queue here; lock-acquisition order IS
  -- the one definitive ordering. Bids on DIFFERENT auctions lock different
  -- rows and never block each other (§13.3) — proven empirically by V-1.
  -- One row lock per transaction => no deadlock is possible.
  --
  -- STEP 3 — re-read state INSIDE the lock, same statement (§13.2 step 3).
  -- Under READ COMMITTED (the default — this function requires it, V-1
  -- verifies it) the locked read returns the LATEST committed row version,
  -- so every check below runs against post-predecessor state. Anything read
  -- before the lock is already stale (§13.2).
  ----------------------------------------------------------------------------
  select a.owner_id, a.end_time, a.starting_price, a.current_price
    into v_owner_id, v_end_time, v_starting_price, v_current_price
    from public.auctions a
   where a.id = p_auction_id
     for update;

  if not found then
    return public.bid_reject('auction_not_found');            -- §13.5 reason 2
  end if;

  ----------------------------------------------------------------------------
  -- STEP 4 — end time vs the DATABASE clock (§13.2 step 4; BR-04, BR-19,
  -- FR-BID-18/19, EC-17). The stored status flag is DELIBERATELY NOT read:
  -- from end_time onward bids are rejected even if the row still says
  -- 'active' (LC-03, FR-END-04) — this is what makes finalization latency
  -- harmless (§15.2). clock_timestamp(), not now(): now() freezes at
  -- transaction start, BEFORE this bid queued on the lock; a frozen clock
  -- would re-open exactly the window LC-03 closes. ">=" — a bid AT the end
  -- time is rejected (BR-04 "at or after"); a bid evaluating a fraction
  -- before it is accepted and counts (FR-BID-20, SC-28).
  ----------------------------------------------------------------------------
  if clock_timestamp() >= v_end_time then
    return public.bid_reject('auction_ended');                -- §13.5 reason 3; FR-BID-21
    -- NOTE: finalization trigger T3 ("on bid attempt", §15.3/§15.4) is wired
    -- here by BID-15 as a post-rejection nudge. It is a latency optimization
    -- only; correctness never depends on it (LC-03).
  end if;

  ----------------------------------------------------------------------------
  -- STEP 5 — caller is not the owner (§13.2 step 5; BR-02, FR-BID-02),
  -- compared against SERVER-HELD ownership and the SESSION identity — never
  -- a payload field (SEC-Z1, FR-SEC-02). No exceptions.
  ----------------------------------------------------------------------------
  if v_owner_id = v_uid then
    return public.bid_reject('owner_cannot_bid');             -- §13.5 reason 4
  end if;

  ----------------------------------------------------------------------------
  -- STEP 6 — amount well-formed (§13.2 step 6; S0-12 §5.2 exact expressions).
  -- The parameter is TEXT deliberately: with a numeric parameter PostgREST
  -- casts BEFORE this body runs, so 'abc' or a 200,000-digit payload would
  -- surface as a raw PostgREST error — breaking §13.5's 'malformed_amount'
  -- contract and leaking internals (SEC-T3, FR-SEC-16). The cast lives in its
  -- own block; the savepoint rollback on failure does NOT release the row
  -- lock (acquired before the block), and rejection commits with no writes.
  ----------------------------------------------------------------------------
  begin
    v_num := p_amount::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    return public.bid_reject('malformed_amount');             -- §13.5 reason 5: covers 'abc'
  end;                                                        -- AND the ~10^131072 physical
                                                              -- cap, mapped to "un-representable
                                                              -- input", never "too large"
                                                              -- (S0-12 §8.3, SEC-R3)
  if v_num is null
     or not (v_num > 0)                       -- zero, negative, '-Infinity' (FR-BID-07, BR-20)
     or not (v_num < 'Infinity'::numeric)     -- 'NaN' and '+Infinity': NaN passes BOTH other
                                              -- checks (NaN > 0 and NaN = round(NaN,2) are
                                              -- TRUE in PostgreSQL). DO NOT "simplify" this
                                              -- line away, ever (S0-12 §3(b), §8.1, §9.11)
     or v_num <> round(v_num, 2)              -- >2 decimals: REJECTED, never rounded
                                              -- (EC-06, FR-BID-07, NFR-DAT-05)
  then
    return public.bid_reject('malformed_amount');
  end if;

  -- Value-preserving scale canonicalization ONLY: '100' -> 100.00. The <>
  -- check above proves this round() is a value no-op — the one permitted
  -- round() on money input in the entire system (S0-12 §5.2, §9.6).
  v_amount := round(v_num, 2);

  -- NO maximum-amount check follows (BR-21, SEC-R3, FR-BID-08): no ceiling
  -- exists; a large value must NEVER be rejected for being large (SC-57).

  ----------------------------------------------------------------------------
  -- STEP 7 — the MINIMUM ACCEPTABLE BID (§13.2 step 7; BR-28), evaluated
  -- against state re-read INSIDE the lock. Exactly two branches. Nothing else
  -- is a rule of this product (§13.2a).
  ----------------------------------------------------------------------------
  select exists (select 1 from public.bids b where b.auction_id = p_auction_id)
    into v_has_bids;   -- fresh statement snapshot under the lock: sees every
                       -- bid committed before this one acquired the lock

  if not v_has_bids then
    -- First bid: INCLUSIVE (BR-28, BR-29, FR-BID-06, SC-55). numeric equality
    -- is exact and scale-insensitive: "100", "100.0", "100.00" all satisfy
    -- >= against a starting price of 100 (S0-12 §4). No epsilon, ever.
    if v_amount < v_starting_price then
      return public.bid_reject('below_starting_price',        -- §13.5 reason 6
                               'starting_price', v_starting_price);  -- FR-BID-10:
                                                              -- "Bidding starts at X SAR"
    end if;
  else
    -- Subsequent bid: STRICTLY greater (BR-28, BR-03, FR-BID-05, SC-56).
    -- numeric decides the 0.01 knife edge exactly, at 100 SAR and at 40-digit
    -- magnitudes alike (NFR-DAT-05: precision must not degrade at scale).
    if not (v_amount > v_current_price) then
      -- §13.5 reason 8 vs reason 7 (last row; EC-01, FR-BID-13, SC-18):
      -- if this bid WOULD HAVE BEEN ACCEPTED against the newest pre-lock
      -- state, the bidder did nothing wrong — they lost a race, and the UI
      -- must be able to say so, distinguishably from a plain too-low bid.
      -- "Valid against pre-lock state" includes the inclusive first-bid rule
      -- when no bids existed pre-lock: a bare "> price_before_lock" would
      -- misreport a raced first bid equal to the starting price
      -- (see S0-12 §10 Bid 2, raced branch, and Faithfulness note 2).
      v_valid_before_lock :=
        case when v_had_bids_before_lock
             then v_amount > v_price_before_lock
             else v_amount >= v_starting_price
        end;
      if v_valid_before_lock then
        return public.bid_reject('outbid_race',               -- §13.5 reason 8:
                                 'current_price', v_current_price);
                                 -- "Someone bid before you — the current
                                 --  price is now X SAR" (EC-01, FR-BID-13)
      else
        return public.bid_reject('not_above_current',         -- §13.5 reason 7:
                                 'current_price', v_current_price);
                                 -- "Your bid must be higher than X SAR"
      end if;
    end if;
  end if;

  ----------------------------------------------------------------------------
  -- DELIBERATELY ABSENT (ARCHITECTURE §13.2a — adding ANY of these four is a
  -- BUG, not a safeguard; PRD SD-05; ARCH Risk 10; S0-12 §9.5):
  --   * NO bid-increment check    (BR-32 — none exists; +0.01 SAR is exactly
  --                                as valid as +1,000 SAR)
  --   * NO maximum-amount check   (BR-21, SEC-R3 — no ceiling exists)
  --   * NO leading-bidder check   (BR-24, FR-BID-04 — leading is never
  --                                grounds for rejection; note the bidder's
  --                                identity was consulted ONLY for BR-01 and
  --                                BR-02 above, so this needs no logic at all)
  --   * NO reserve-price check    (BR-35 — no reserve exists)
  ----------------------------------------------------------------------------

  ----------------------------------------------------------------------------
  -- STEP 8 — append the bid (§13.2 step 8; BR-18). Bidder from the session
  -- (SEC-Z1). STEP 9 — update current_price in the SAME transaction (§13.2
  -- step 9; BR-07, BR-13, SC-40, NFR-DAT-01): steps 8 and 9 are inseparable —
  -- both commit or neither does, so price and history can never diverge.
  -- This UPDATE is the ONLY statement in the system that writes
  -- current_price after creation.
  ----------------------------------------------------------------------------
  perform set_config('dalal.in_place_bid', 'on', true);  -- transaction-local key
                                                         -- for the bids insert
                                                         -- gate (ADR-2, SEC-Z4)
  insert into public.bids (auction_id, bidder_id, amount)
  values (p_auction_id, v_uid, v_amount)
  returning id into v_bid_id;

  update public.auctions
     set current_price = v_amount
   where id = p_auction_id;

  ----------------------------------------------------------------------------
  -- STEP 10 — return; COMMIT occurs as the transaction ends, the row lock
  -- releases, and the next queued bid re-reads the state THIS bid produced
  -- (§13.2 step 10, BR-11). Every rejection above returned BEFORE any write:
  -- a rejected bid changes nothing and never enters history (BR-23, FR-BID-24,
  -- SEC-I5). Amounts return as canonical scale-2 TEXT, never JSON numbers
  -- (S0-12 §6); the client renders them with the one formatter (NFR-DAT-08).
  ----------------------------------------------------------------------------
  return jsonb_build_object(
    'accepted',      true,                          -- FR-BID-16: always definitive
    'bid_id',        v_bid_id,
    'amount',        public.sar_text(v_amount),     -- FR-BID-27
    'current_price', public.sar_text(v_amount)      -- FR-BID-28
  );
end;
$$;
-- ----------------------------------------------------------------------------
-- 3a. Default deny (ARCHITECTURE §11.1, ADR-5): RLS enabled + no policy =
-- everything denied. Every grant below is an explicit exception.
-- Do NOT add FORCE ROW LEVEL SECURITY: the two elevated definer operations
-- (§11.4) rely on table-owner bypass; their containment is that exactly two
-- exist, each self-authorizing — plus the bids insert gate in 1e, which binds
-- even the roles RLS cannot (service_role, postgres).
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.auctions enable row level security;
alter table public.bids     enable row level security;

-- Table privileges. RLS is the SECOND gate, never the first: PostgreSQL checks
-- the GRANT before it evaluates any policy, so `using (true)` on a table the
-- role holds no SELECT on denies every read with 42501 and the policy never
-- runs. This is NOT redundant with 3a and must not be "cleaned up".
-- It is also not inherited: this project's default for public tables is
-- `anon=Dxtm` — TRUNCATE, REFERENCES, TRIGGER, MAINTAIN, and no DML at all
-- (pg_default_acl, measured on the dev project). The broad GRANT ALL older
-- Supabase projects shipped is gone, so public read must be granted here.
-- Measured on dev before this line existed: GET /rest/v1/auctions -> 401
-- 42501 "permission denied for table auctions", and bid_history -> 401
-- "permission denied for table bids" (security_invoker reads the base tables
-- as the caller, so 3b's grant alone buys nothing). That is FR-LIST-01,
-- FR-DETAIL-01, BR-40 and FR-BID-22 all failing on a missing GRANT.
-- SELECT only. Not to service_role: nothing in this product may use it.
grant select on public.profiles, public.auctions, public.bids to anon, authenticated;

-- Public reads — anonymous read access is a first-class case (§11.2).
create policy profiles_public_read on public.profiles
  for select to anon, authenticated
  using (true);
  -- display_name is public (FR-BID-23, BR-40). Emails are STRUCTURALLY absent
  -- from this table (ADR-7) — no policy mistake here can leak one (SEC-P1, BR-26).

create policy auctions_public_read on public.auctions
  for select to anon, authenticated
  using (true);
  -- FR-LIST-01, FR-DETAIL-01; ended auctions stay readable forever (FR-END-12) —
  -- a status-filtered policy would break FR-END-12 (§9.6). Listing filters in
  -- the QUERY, not the policy (FR-LIST-05).

create policy bids_public_read on public.bids
  for select to anon, authenticated
  using (true);
  -- BR-40 / FR-BID-22: bid history is public, including to anonymous visitors.
  -- Also what lets anyone recompute the winner from history (NFR-DAT-04, SC-29),
  -- and what RLS-authorizes realtime subscriptions (SEC-Z9).

-- Auction creation — MOHAMMED'S POLICY to own (S0-11, AUC-02); included here
-- because it is the one write path whose WITH CHECK enforces bid-path invariants
-- at birth. There is NO update and NO delete policy on auctions for any user:
-- immutability (BR-31, FR-SEC-04/09), no cancellation (BR-30), and no
-- user-writable path to current_price, status, winner, or end time
-- (SC-40, SEC-Z5, SEC-Z6, SEC-Z7) are all the ABSENCE of a policy.
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
  );

-- Bids: NO insert, NO update, NO delete policy exists for ANY user role,
-- including the bidder. This is the load-bearing decision of the architecture
-- (§11.2): it is what forces every bid through place_bid (ADR-2, SEC-Z4).
-- The absence of policies IS the enforcement; the revokes below are belt and
-- braces in case a host default or a later hand-grant ever hands DML back —
-- the grant in 3a is SELECT and nothing else; the trigger in 1e covers even
-- RLS-exempt roles.
revoke insert, update, delete on public.bids     from anon, authenticated;
revoke update, delete         on public.auctions from anon, authenticated;

-- Function exposure: EXECUTE for anon too, so an unauthenticated crafted call
-- receives the product-level §13.5 reason 1 instead of a raw permission error
-- (SEC-T3, FR-SEC-16). Internal helpers are not callable by clients.
revoke execute on function public.place_bid(uuid, text)                          from public;
grant  execute on function public.place_bid(uuid, text)                          to anon, authenticated;
revoke execute on function public.bid_reject(text, text, public.sar_amount)      from public, anon, authenticated;
grant  execute on function public.format_sar(sar_amount)                         to anon, authenticated;
grant  execute on function public.sar_text(public.sar_amount)                    to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3b. The public history read path (BR-40, FR-BID-22/22a/23): display names
-- and canonical-text amounts — never emails (structurally impossible: the
-- joined tables contain none), never raw numeric through JSON (S0-12 §6),
-- and bidder UUIDs omitted from the projection (FR-BID-22a).
-- ----------------------------------------------------------------------------
create view public.bid_history
with (security_invoker = true)          -- runs with the caller's rights; the
                                        -- underlying tables are public-read
as
select b.auction_id,
       p.display_name,                  -- FR-BID-23, BR-26
       public.sar_text(b.amount) as amount,       -- S0-12 §6: text, client formats
       public.format_sar(b.amount) as amount_sar, -- NFR-DAT-08: the one format
       b.created_at                     -- FR-BID-23
  from public.bids b
  join public.profiles p on p.id = b.bidder_id
 order by b.auction_id, b.id desc;      -- FR-BID-29: newest first; id order is
                                        -- the definitive order (BR-11)

grant select on public.bid_history to anon, authenticated;

-- Realtime wiring belongs to BID-09, not BID-02. When Rayan enables it:
--   alter publication supabase_realtime add table public.auctions, public.bids;
-- and REMEMBER S0-12 §6: those payloads carry raw JSON numbers the browser
-- corrupts above ~9x10^15 — the event is a TRIGGER to re-read via the text
-- path (bid_history / auctions select), NEVER a display source (RT-R6, §14.5).
