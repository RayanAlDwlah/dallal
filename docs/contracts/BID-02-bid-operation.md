# BID-02 — The Bid Acceptance Operation (+ V-1 verification, BID-20 concurrency test)

**Scope:** GITHUB_PLAN BID-02 ("the trust boundary"), V-1, BID-20. Faithful to ARCHITECTURE.md §13 (13.2, 13.2a, 13.3, 13.5), §11, §15 (LC-03 posture), PRD §8.6, §9, §12, §17.2 (NFR-DAT-\*), and the S0-12 money contract. Everything below is runnable on PostgreSQL 17 / Supabase.

## 0. Faithfulness notes — three judgment calls, flagged openly

1. **Step order.** ARCHITECTURE §13.2 and the BID-02 acceptance criteria put "amount well-formed" at **step 6, after the owner check, inside the lock**. S0-12 §5.2 *prints* its well-formedness gate at the top of the function body but itself labels it "(§13.2 step 6)". I follow §13.2/BID-02 order exactly. Consequence: reason precedence follows §13.5's listing (an unauthenticated caller sending `"abc"` gets `not_authenticated`; an owner sending `"abc"` gets `owner_cannot_bid`), and a garbage amount holds the row lock for microseconds — harmless.
2. **`outbid_race` detection refined.** S0-12 §5.1's literal `ELSIF v_amount > v_price_before_lock` cannot reproduce S0-12's **own** worked trace (§10 Bid 2, raced branch): a raced first bid of `100` against pre-Bid-1 state has `100 > 100 = false`, which would misreport the race as a plain too-low bid. The evident intent — "the bid **would have been accepted** against the newest state the bidder could have seen" — requires the inclusive first-bid branch (`>= starting_price` when there were no bids pre-lock). I implement the intent. Per S0-12's closing rule, this should be recorded as a one-line revision of §5.1's exact expression, agreed by all three developers.
3. **`clock_timestamp()`, not `now()`, for the end-time check.** `now()` freezes at transaction start — i.e., **before** this bid queued on the lock. A bid that queued for 40 seconds across the end time would pass a `now()` check. BR-04/LC-03/FR-BID-18 require the database clock *at the moment the server evaluates it, inside the lock* — that is `clock_timestamp()`.

Out of scope here, referenced where they touch: finalization (BID-15) writes the four outcome fields; Realtime publication wiring (BID-09) — noted as a comment because S0-12 §6 makes those payloads triggers, never sources.

---

## 1. Schema

Save as `supabase/migrations/20260812120000_bid02_bid_acceptance.sql` (sections 1–3 concatenate into this one migration, in order).

```sql
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
```

> **READ THIS BEFORE IMPLEMENTING PAUSE — pause is now implemented on sessions.**
>
> `CLAUDE.md` §5 records exactly two doors onto `end_time`: `place_bid` (anti-sniping,
> 30-second quanta, `extension_count` locked) and the pause/resume operation (forward by
> the exact paused wall-clock interval, no `extension_count` touch). In V2, pause lives on
> `sessions.paused_at` and `resume_session()` moves `session_lots.end_time` — not
> `auctions.end_time` directly. This contract covers the V1 architecture (bids against
> `auctions`); the V2 session mechanism is in
> `supabase/migrations/20260815200000_sessions.sql`.
>
> **The one-flag overload:** in the V1 archive, `dalal.in_place_bid` is shared between the
> `bids_only_via_place_bid` gate and the `auctions_guard_update` end_time gate. If a future
> migration splits these flags, the guard's semantics change — any implementation that
> opens the end_time gate without the bids gate must re-read CLAUDE.md §5 and confirm both
> doors are still correctly accounted for. The guard as written raises for any unflagged
> update to `end_time`; "opening the gate" is the one operation §5 forbids doing silently.

---

## 2. The bid function — the trust boundary

```sql
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
```

**Result contract (all eight §13.5 reasons, machine-distinguishable):**

| Outcome | Payload |
|---|---|
| Accepted | `{"accepted": true, "bid_id": n, "amount": "150.00", "current_price": "150.00"}` |
| 1 Not authenticated | `{"accepted": false, "reason": "not_authenticated"}` |
| 2 Not found | `{"accepted": false, "reason": "auction_not_found"}` |
| 3 Ended | `{"accepted": false, "reason": "auction_ended"}` |
| 4 Owner | `{"accepted": false, "reason": "owner_cannot_bid"}` |
| 5 Malformed | `{"accepted": false, "reason": "malformed_amount"}` |
| 6 Below start | `{"accepted": false, "reason": "below_starting_price", "starting_price": "100.00"}` |
| 7 Not above current | `{"accepted": false, "reason": "not_above_current", "current_price": "100.00"}` |
| 8 Lost the race | `{"accepted": false, "reason": "outbid_race", "current_price": "100.00"}` — distinguishable from 7 because the user did nothing wrong (EC-01, SC-18) |

### 2.1 The client-side result type — decided `2026-08-13`

Mohammed's `BidPanel` (currently `design/components/bidding/bid-panel.tsx`, unmounted) declares
its own rejection taxonomy in `kebab-case`, and **three of the eight names differ by word, not
just by convention**: `owner_cannot_bid`→`caller-is-owner`, `not_above_current`→
`not-above-current-price`, `outbid_race`→`lost-race`. Its payload keys are camelCase
(`currentPrice`) against this contract's `current_price`.

The result contract is mine (CLAUDE.md §1 — "bid recording", "validation"), so the boundary
shape is my call. It is an interface decision, not a product decision: **no new product rule is
being invented, and the eight reasons themselves are unchanged.**

**Decision — the reason string crosses the boundary byte-identical. There is no translation
layer.** Three reasons:

1. **A translation layer needs a total function from `string` to the union, and its `default`
   branch is unimplementable.** It can only throw or emit a generic message — and `BR-27` /
   `NFR-USA-03` require every rejection to state what happened and what to do, which makes a
   generic error a defect by definition. The only design with no unreachable-but-required branch
   is the one with no branch.
2. **These eight strings are the tested reality.** They were verified against PostgreSQL 17.10,
   and `V-1` and `BID-20` both grep for the literals `outbid_race` and `not_above_current`
   (lines ~712, ~796, ~801). Renaming them client-side means the tests and the UI speak two
   vocabularies, and a later session grepping `lost-race` finds nothing in the test suite.
3. **It is the same discipline as the money formatter** (`S0-12` §9.8, `CLAUDE.md` §4.6): one
   string, byte-identical everywhere, no second implementation.

**The type. One variant per reason, so the compiler — not a code review — guarantees that the
payload field is present when the message needs it:**

```ts
/** Mirrors BID-02 §2's result contract exactly. Do not rename a reason. */
export type BidOutcome =
  | { accepted: true;  bid_id: BidId; amount: Sar; current_price: Sar }
  | { accepted: false; reason: "not_authenticated" }
  | { accepted: false; reason: "auction_not_found" }
  | { accepted: false; reason: "auction_ended" }
  | { accepted: false; reason: "owner_cannot_bid" }
  | { accepted: false; reason: "malformed_amount" }
  | { accepted: false; reason: "below_starting_price"; starting_price: Sar }
  | { accepted: false; reason: "not_above_current";    current_price: Sar }
  | { accepted: false; reason: "outbid_race";          current_price: Sar };
```

This closes a real defect in the current panel, not a stylistic one. Its rejected variant
declares `currentPrice?` and `startingPrice?` as optional **for every reason**, so
`below_starting_price` with the amount missing type-checks — and its own message renders as
`"المزايدة تبدأ من ."`, an empty amount and a dangling full stop. Under the union above that
state cannot be constructed.

**`bid_id` is opaque.** `bids.id` is `bigint` (§1d) and is the **definitive ordering authority**
(`BR-11`, `CLAUDE.md` §5). The client uses it as a React key and nothing else: **never sort by
it, never do arithmetic on it, never round-trip it through a narrowing numeric type.** The
server already returned history in `order by id`; the client renders the order it was given.
Type it as a branded string or `string | number` treated as a token — not as a `number` you
compute with.

**What this asks of Mohammed — small, and the rest of his panel stands.** Rename three union
members and use the wire key names; his four-state matrix, the no-optimistic-update submission
flow (correctly reasoned against `BR-12` and `FR-BID-16`), the never-block-a-too-low-submission
rule (`BR-08`, `SEC-V6`), the brass-not-red race treatment (`EC-01`, `SC-18`) and the
different-verb minimum hints (`NFR-USA-11`) are all correct and are adopted as-is.

**And the ask is already conceded on his side.** Commit `e246fb7` (PR #2, `2026-08-13`) rewrote
the panel's own header to the presentation/behaviour split and states it plainly:

> `PRESENTATION: Mohammed. BEHAVIOUR: Rayan` […] "Everything it *decides* still belongs to Rayan
> and arrives through props: `submitBid` performs the submission, **`BidResult` carries which of
> the eight rejection reasons applies**, and the current price is a value Rayan owns. This
> component **must never re-derive any of that**."

Which of the eight applies is exactly what the reason string names. A client taxonomy that
renames three of them is a re-derivation of that decision in a second vocabulary — the thing his
own header now forbids. So §2.1 is not a request to change his design; it is the naming his
header already defers to, written down.

> **Separate, and his to fix:** the panel's `rejectionMessage` builds
> `` `${formatSar(x)} ${SAR_SUFFIX}` `` as a plain string and interpolates it into Arabic prose
> with **no `<bdi>` and the indicator inside the unisolated run** — `CLAUDE.md` §3. Its accepted
> branch does it correctly, so this is an oversight, not a disagreement. Bidi isolation is
> presentation and therefore Mohammed's; raised, not edited.

---

## 3. RLS policies and grants

```sql
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
    and end_time >= now() + interval '5 minutes'  -- V1 insert-time bound (V2 uses a trigger;
                                                  -- end_time is written by place_bid or pause/resume
                                                  -- ONLY — see CLAUDE.md §5 for both doors)
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

-- Realtime wiring landed in BID-08 (20260814140000) — and NOT the way this
-- comment used to prescribe. It read "alter publication supabase_realtime add
-- table public.auctions, public.bids"; measured wrong twice over before any
-- code shipped: postgres_changes ignores publication column lists (an
-- unpublished column reached an anon client) and serialises numeric through a
-- JSON number (#103). Delivery is a content-free realtime.send broadcast from
-- an AFTER UPDATE trigger, and NOTHING may add these tables to that
-- publication (ARCHITECTURE §14.1). The event stays a TRIGGER to re-read,
-- never a display source (RT-R6, §14.5) — and the re-read has exactly ONE
-- ready-made text path: bid_history, via sar_text(). A plain auctions select
-- is NOT one, though this comment used to name it as one (#103's defect,
-- nearly shipped on that sentence): every sar_amount column needs ::text,
-- per column, at every read site.
```

---

## 4. V-1 — empirical verification of the locking semantics

V-1 (GITHUB_PLAN §4, ARCHITECTURE §22) must **prove**, not assume: (a) the row lock serializes concurrent bids on one auction, (b) exactly one acceptance per price level, (c) different auctions do not block each other. If any of these fails, **escalate immediately — do not design around it silently** (V-1 AC).

Save as `supabase/tests/v1_setup.sql`:

```sql
-- ============================================================================
-- V-1 / BID-20 seed. Run as postgres on a LOCAL / NON-PRODUCTION stack ONLY:
-- it writes auth.users directly, which the product never does (test-only).
-- Idempotent. Creates 1 owner + 8 bidders with profiles (ADR-7: a profile
-- must exist before a user can bid).
--
-- The display name travels in raw_user_meta_data because AUTH-01's signup
-- trigger reads it from there and inserts the profile in this same statement.
-- Without it the trigger hits its NOT NULL and the seed fails outright, taking
-- the whole suite with it (reproduced on PostgreSQL 17, 2026-08-13). The
-- profiles insert below is a no-op once that trigger exists; it is kept so the
-- seed still works on a stack where it does not.
-- ============================================================================
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at,
                        raw_user_meta_data)
select x.id, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', x.email, now(), now(),
       jsonb_build_object('display_name', x.name)
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'v1-owner@test.local',   'v1_owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'v1-bidder1@test.local', 'v1_bidder_1'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'v1-bidder2@test.local', 'v1_bidder_2'),
  ('00000000-0000-0000-0000-0000000000b3'::uuid, 'v1-bidder3@test.local', 'v1_bidder_3'),
  ('00000000-0000-0000-0000-0000000000b4'::uuid, 'v1-bidder4@test.local', 'v1_bidder_4'),
  ('00000000-0000-0000-0000-0000000000b5'::uuid, 'v1-bidder5@test.local', 'v1_bidder_5'),
  ('00000000-0000-0000-0000-0000000000b6'::uuid, 'v1-bidder6@test.local', 'v1_bidder_6'),
  ('00000000-0000-0000-0000-0000000000b7'::uuid, 'v1-bidder7@test.local', 'v1_bidder_7'),
  ('00000000-0000-0000-0000-0000000000b8'::uuid, 'v1-bidder8@test.local', 'v1_bidder_8')
) as x(id, email, name)
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
select x.id, x.name
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'v1_owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'v1_bidder_1'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'v1_bidder_2'),
  ('00000000-0000-0000-0000-0000000000b3'::uuid, 'v1_bidder_3'),
  ('00000000-0000-0000-0000-0000000000b4'::uuid, 'v1_bidder_4'),
  ('00000000-0000-0000-0000-0000000000b5'::uuid, 'v1_bidder_5'),
  ('00000000-0000-0000-0000-0000000000b6'::uuid, 'v1_bidder_6'),
  ('00000000-0000-0000-0000-0000000000b7'::uuid, 'v1_bidder_7'),
  ('00000000-0000-0000-0000-0000000000b8'::uuid, 'v1_bidder_8')
) as x(id, name)
on conflict (id) do nothing;

-- NOTE: no bid cleanup, ever — bids are append-only for EVERYONE (BR-05) and
-- the trigger enforces it. Repeatability comes from a FRESH auction per run.
```

Save as `supabase/tests/v1_verify.sh`:

```bash
#!/usr/bin/env bash
# ============================================================================
# V-1 — proves the row-locking semantics ARCHITECTURE §13.2-13.3 assumes.
#   (a) an exclusive row lock serializes concurrent bids on ONE auction
#   (b) exactly one acceptance per price level (BR-12, SC-16)
#   (c) bids on DIFFERENT auctions do NOT block each other (§13.3)
# Identity is simulated the way PostgREST provides it: request.jwt.claims,
# read by auth.uid(). LOCAL / NON-PRODUCTION ONLY.
# ============================================================================
set -euo pipefail
DB="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DIR="$(cd "$(dirname "$0")" && pwd)"
psqlq() { psql "$DB" -v ON_ERROR_STOP=1 -qAt "$@"; }

OWNER=00000000-0000-0000-0000-0000000000a1
B1=00000000-0000-0000-0000-0000000000b1
B2=00000000-0000-0000-0000-0000000000b2

claims() { printf '{"sub":"%s","role":"authenticated"}' "$1"; }
bid() {  # bid <bidder-uuid> <auction-uuid> <amount-string>  (amount is a STRING end-to-end — S0-12 §6)
  psqlq -c "select set_config('request.jwt.claims', '$(claims "$1")', false)" \
        -c "select public.place_bid('$2'::uuid, '$3')"
}
new_auction() {  # fresh auction per run: repeatability WITHOUT deleting history (BR-05)
  psqlq -c "insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
            values ('$OWNER', 'active', now() + interval '1 hour', 100, 100)
            returning id"
}
ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

psqlq -f "$DIR/v1_setup.sql" >/dev/null
A1=$(new_auction); A2=$(new_auction)
echo "V-1: A1=$A1  A2=$A2"

# ---- (a) the lock serializes bids on ONE auction ---------------------------
# Hold the exclusive row lock on A1 for 3 s — the same SELECT ... FOR UPDATE
# place_bid takes (§13.2 step 2) — then bid on A1 and measure the wait.
psql "$DB" -qAt -c "begin;
                    select id from public.auctions where id = '$A1' for update;
                    select pg_sleep(3);
                    commit;" &
HOLDER=$!
sleep 1                                    # let the holder acquire the lock
T0=$(ms); OUT=$(bid "$B1" "$A1" "150"); T1=$(ms)
wait "$HOLDER"
WAITED=$((T1 - T0))
echo "(a) bid on locked A1 waited ${WAITED} ms -> $OUT"
[ "$WAITED" -ge 1500 ] || { echo "V-1 FAIL (a): bid did not queue on the row lock"; exit 1; }
echo "$OUT" | grep -q '"accepted": true' || { echo "V-1 FAIL (a): queued bid not accepted after release"; exit 1; }
# Empirical meaning: place_bid BLOCKED until the lock released, then evaluated
# against post-lock state. Queue order IS the definitive ordering (BR-11).

# ---- (c) different auctions do NOT block each other (§13.3) ----------------
psql "$DB" -qAt -c "begin;
                    select id from public.auctions where id = '$A1' for update;
                    select pg_sleep(3);
                    commit;" &
HOLDER=$!
sleep 1
T0=$(ms); OUT=$(bid "$B2" "$A2" "150"); T1=$(ms)
WAITED=$((T1 - T0))
wait "$HOLDER"
echo "(c) bid on A2 while A1 locked took ${WAITED} ms -> $OUT"
[ "$WAITED" -lt 1500 ] || { echo "V-1 FAIL (c): unrelated auction was blocked (breaks NFR-SCA-01)"; exit 1; }
echo "$OUT" | grep -q '"accepted": true' || { echo "V-1 FAIL (c): bid on A2 should be accepted"; exit 1; }

# ---- (b) exactly one acceptance per price level (BR-12, SC-16) -------------
A3=$(new_auction)
OUTDIR=$(mktemp -d)
for i in 1 2 3 4 5 6 7 8; do
  BIDDER="00000000-0000-0000-0000-0000000000b$i"
  bid "$BIDDER" "$A3" "200" > "$OUTDIR/$i.json" &
done
wait
ACCEPTED=$(cat "$OUTDIR"/*.json | grep -c '"accepted": true' || true)
ROWS=$(psqlq -c "select count(*) from public.bids where auction_id = '$A3' and amount = 200")
BADREASON=$(cat "$OUTDIR"/*.json | grep '"accepted": false' \
            | grep -Evc '"reason": "(outbid_race|not_above_current)"' || true)
echo "(b) 8 simultaneous bids of 200: accepted=$ACCEPTED historyRows=$ROWS badReasons=$BADREASON"
[ "$ACCEPTED" -eq 1 ]  || { echo "V-1 FAIL (b): expected exactly ONE acceptance (BR-12)"; exit 1; }
[ "$ROWS" -eq 1 ]      || { echo "V-1 FAIL (b): expected exactly one history row (SC-16)"; exit 1; }
[ "$BADREASON" -eq 0 ] || { echo "V-1 FAIL (b): a loser got a non-§13.5 reason (raw error leaked?)"; exit 1; }

echo "V-1 PASS: (a) serialized on one auction, (b) one acceptance per price level, (c) no cross-auction blocking"
```

**How to run V-1, exactly:**

```text
# One-time: local Supabase stack (PostgreSQL 17, auth schema preinstalled)
supabase start
export DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Apply the BID-02 migration (or: supabase db reset, if it is in supabase/migrations/)
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260812120000_bid02_bid_acceptance.sql

# Run the verification
bash supabase/tests/v1_verify.sh
```

Write the observed timings and outputs into the V-1 GitHub Issue (V-1 AC: "results are written up in the Issue"). If (a), (b), or (c) fails, **escalate — the entire bidding design (ADR-2) rests on it.**

---

## 5. BID-20 — the concurrency test ("the single most important test in the project")

Genuine simultaneity is manufactured with an **advisory-lock start barrier**: a coordinator session holds `pg_advisory_lock(422000)`; every worker connects, sets its identity, and blocks on `pg_advisory_lock_shared(422000)`; when the coordinator disconnects, all workers release in the same instant and hit `place_bid` together. Every run creates a **fresh auction**, so it is repeatable forever without ever deleting history (BR-05 forbids deletion — for the test harness too).

Save as `supabase/tests/bid20.sh`:

```bash
#!/usr/bin/env bash
# ============================================================================
# BID-20 — automated concurrency test (NFR-MNT-02; ARCH §23 risk 2; SC-16→19).
# Asserts, per run:
#   1. same-amount volley: EXACTLY ONE acceptance          (BR-12, SC-16)
#   2. every loser gets a §13.5 reason; race losers get 'outbid_race',
#      distinguishable from a plain too-low bid            (SC-18, EC-01)
#   3. stress ladder: accepted-response count == history row count
#      — no bid lost, none duplicated                      (FR-BID-14, NFR-REL-04)
#   4. history STRICTLY increasing in definitive order     (BR-11, NFR-DAT-03, SC-17)
#   5. one bid per price level, structurally and observed  (BR-12)
#   6. current_price == max accepted bid, zero tolerance   (BR-13, NFR-DAT-01)
#   7. a +0.01 SAR raise afterwards is ACCEPTED            (SC-56, BR-32, NFR-DAT-05)
#   8. every submission got a definitive answer            (FR-BID-16)
# Repeatable: fresh auction per run. LOCAL / NON-PRODUCTION ONLY.
# Usage:   bash supabase/tests/bid20.sh [workers=8] [rounds=5]
#          REPEAT=20 bash supabase/tests/bid20.sh     # stress-repeat mode
# NOTE: no floating-point arithmetic anywhere in this harness — the +0.01 is
# computed in SQL numeric (S0-12 §9.1 applies to test tooling too).
# ============================================================================
set -euo pipefail
DB="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DIR="$(cd "$(dirname "$0")" && pwd)"
W="${1:-8}"; ROUNDS="${2:-5}"; BARRIER=422000
psqlq() { psql "$DB" -v ON_ERROR_STOP=1 -qAt "$@"; }
claims() { printf '{"sub":"00000000-0000-0000-0000-0000000000b%s","role":"authenticated"}' "$1"; }

run_once() {
  psqlq -f "$DIR/v1_setup.sql" >/dev/null
  local OWNER=00000000-0000-0000-0000-0000000000a1
  local A OUTDIR
  A=$(psqlq -c "insert into public.auctions (owner_id, status, end_time, starting_price, current_price)
                values ('$OWNER', 'active', now() + interval '1 hour', 100, 100) returning id")
  OUTDIR=$(mktemp -d)

  # ---- Phase 1: same-amount volley through the start barrier ---------------
  psql "$DB" -qAt -c "select pg_advisory_lock($BARRIER)" -c "select pg_sleep(4)" &  # coordinator
  local COORD=$!
  sleep 0.5   # coordinator holds the barrier before workers arrive
  for i in $(seq 1 "$W"); do
    psqlq -c "select set_config('request.jwt.claims', '$(claims "$i")', false)" \
          -c "select pg_advisory_lock_shared($BARRIER)" \
          -c "select public.place_bid('$A'::uuid, '200')" > "$OUTDIR/volley_$i.json" &
  done
  wait "$COORD"; wait
  local ACC ROWS BAD ANSWERS
  ANSWERS=$(cat "$OUTDIR"/volley_*.json | grep -c '"accepted"' || true)
  ACC=$(cat "$OUTDIR"/volley_*.json | grep -c '"accepted": true' || true)
  ROWS=$(psqlq -c "select count(*) from public.bids where auction_id = '$A'")
  BAD=$(cat "$OUTDIR"/volley_*.json | grep '"accepted": false' \
        | grep -Evc '"reason": "(outbid_race|not_above_current)"' || true)
  [ "$ANSWERS" -eq "$W" ] || { echo "BID-20 FAIL: a bid got no definitive answer (FR-BID-16)"; exit 1; }
  [ "$ACC" -eq 1 ]  || { echo "BID-20 FAIL: volley acceptances=$ACC, expected 1 (BR-12, SC-16)"; exit 1; }
  [ "$ROWS" -eq 1 ] || { echo "BID-20 FAIL: volley history rows=$ROWS, expected 1 (FR-BID-14)"; exit 1; }
  [ "$BAD" -eq 0 ]  || { echo "BID-20 FAIL: loser got a non-§13.5 reason"; exit 1; }
  grep -hq '"reason": "outbid_race"' "$OUTDIR"/volley_*.json \
    || echo "BID-20 note: no outbid_race in this volley (all losers read post-commit state) — legal, rerun to observe reason 8"

  # ---- Phase 2: stress ladder — W workers x ROUNDS rounds, distinct amounts,
  # arrival order arbitrary => genuine mix of acceptances and race rejections.
  for i in $(seq 1 "$W"); do
    (
      for r in $(seq 1 "$ROUNDS"); do
        AMT=$(( 200 + r * (W + 1) + i ))     # distinct integers; interleaved across workers
        psqlq -c "select set_config('request.jwt.claims', '$(claims "$i")', false)" \
              -c "select public.place_bid('$A'::uuid, '$AMT')"
      done
    ) > "$OUTDIR/ladder_$i.json" &
  done
  wait

  # ---- Assertions in SQL (BR-11/12/13, NFR-DAT-01/03, SC-17) ---------------
  psqlq -c "select set_config('bid20.aid', '$A', false)" -c "
do \$\$
declare
  v_aid   uuid := current_setting('bid20.aid')::uuid;
  v_bad   int;
  v_price numeric;
  v_max   numeric;
begin
  -- strictly increasing in definitive order (id = lock-acquisition order, BR-11)
  select count(*) into v_bad from (
    select amount, lag(amount) over (order by id) as prev
      from public.bids where auction_id = v_aid) x
   where x.prev is not null and x.amount <= x.prev;
  if v_bad > 0 then
    raise exception 'BID-20 FAIL: history not strictly increasing (NFR-DAT-03, SC-17)';
  end if;
  -- at most one bid per price level (BR-12) — also structurally guaranteed
  select count(*) into v_bad from (
    select amount from public.bids where auction_id = v_aid
     group by amount having count(*) > 1) d;
  if v_bad > 0 then
    raise exception 'BID-20 FAIL: duplicate price level (BR-12, SC-16)';
  end if;
  -- current_price == highest accepted bid, ZERO tolerance (BR-13, NFR-DAT-01)
  select current_price into v_price from public.auctions where id = v_aid;
  select max(amount)   into v_max   from public.bids     where auction_id = v_aid;
  if v_price is distinct from v_max then
    raise exception 'BID-20 FAIL: current_price % <> max(amount) % (NFR-DAT-01)', v_price, v_max;
  end if;
end \$\$;"

  # no accepted bid lost, none duplicated (FR-BID-14, NFR-REL-04):
  local LACC TOTAL
  LACC=$(cat "$OUTDIR"/volley_*.json "$OUTDIR"/ladder_*.json | grep -c '"accepted": true' || true)
  TOTAL=$(psqlq -c "select count(*) from public.bids where auction_id = '$A'")
  [ "$LACC" -eq "$TOTAL" ] || { echo "BID-20 FAIL: accepted responses=$LACC != history rows=$TOTAL (NFR-REL-04)"; exit 1; }

  # ---- Phase 3: the 0.01 knife edge (SC-56 second half, BR-32) -------------
  # Computed in SQL numeric — NEVER in shell/float arithmetic (NFR-DAT-05).
  local NEXT OUT
  NEXT=$(psqlq -c "select ((select max(amount) from public.bids where auction_id = '$A') + 0.01)::text")
  OUT=$(psqlq -c "select set_config('request.jwt.claims', '$(claims 1)', false)" \
              -c "select public.place_bid('$A'::uuid, '$NEXT')")
  echo "$OUT" | grep -q '"accepted": true' \
    || { echo "BID-20 FAIL: +0.01 raise '$NEXT' rejected (SC-56, BR-32, NFR-DAT-05)"; exit 1; }
  # and the SAME amount again is rejected (SC-56 first half, BR-28 strict):
  OUT=$(psqlq -c "select set_config('request.jwt.claims', '$(claims 2)', false)" \
              -c "select public.place_bid('$A'::uuid, '$NEXT')")
  echo "$OUT" | grep -Eq '"reason": "(not_above_current|outbid_race)"' \
    || { echo "BID-20 FAIL: equal re-bid of '$NEXT' not rejected with a §13.5 reason (SC-56)"; exit 1; }

  echo "BID-20 PASS: auction=$A  accepted=$((LACC + 1))  submissions=$((W + W * ROUNDS + 2))"
}

for n in $(seq 1 "${REPEAT:-1}"); do
  echo "=== BID-20 run $n ==="
  run_once
done
```

**How to run, exactly:**

```text
supabase start
export DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260812120000_bid02_bid_acceptance.sql
bash supabase/tests/bid20.sh            # one run
REPEAT=20 bash supabase/tests/bid20.sh  # stress: 20 full runs back to back
```

### Running BID-20 repeatedly without CI — and the risk, stated plainly

The team has forbidden GitHub Actions, so there is **no forced gate**. BID-20 therefore runs by these mechanisms, all of which are discipline, not enforcement:

1. **Checked-in git pre-push hook.** Commit a `.githooks/pre-push` that runs `bash supabase/tests/bid20.sh` against the local stack whenever the push touches `supabase/` or the bidding code; each developer activates it once with `git config core.hooksPath .githooks`. This is the closest thing to a gate available.
2. **PR review checklist.** Any PR labeled `area:bidding` must paste the `BID-20 PASS` output (and `REPEAT=20` output for changes to `place_bid` itself) into the PR before review — matching where GITHUB_PLAN already says review attention must concentrate.
3. **Shared `CLAUDE.md` pin.** All three developers build with AI sessions; add to the shared `CLAUDE.md`, alongside the S0-12 §9 rules: *"Before pushing any change under `supabase/` or to bidding code, run `bash supabase/tests/bid20.sh` and include its output in the PR."* This constrains every session at once instead of policing per person.

**RISK (record this in the BID-20 issue):** pre-push hooks are bypassable (`--no-verify`) and checklists get skipped under time pressure. ARCHITECTURE §23 Risk 2 names the bid operation the project's **single point of correctness**; without CI, a concurrency regression can merge silently and nothing will catch it until a demo. This is a real, accepted process gap so long as the GitHub Actions prohibition stands — it should be written down as such (in the same spirit as FR-SEC-18's "known gap" rule), and the prohibition revisited or replaced with any neutral runner (even a nightly `REPEAT=50` run on one developer's machine, on a calendar) if the team keeps it.

---

## 6. Requirement cross-check (condensed)

| Binding requirement | Where satisfied |
|---|---|
| NFR-DAT-05 (exact decimal, never float) | `sar_amount` domain (§1a); text transport in/out of `place_bid`; `sar_text`; no float anywhere including the test harness |
| BR-21 / SEC-R3 (no ceiling, never rejected for size) | no typmod, no magnitude check (§1a); no maximum check in step 6/7; overflow of the ~10^131072 physical cap mapped to `malformed_amount` (S0-12 §8.3) |
| BR-33 (SAR, no "Demo Points") | `format_sar` suffix; nothing else names a currency |
| NFR-DAT-08 (one format) | `format_sar` (server), `bid_history` view; clients render `sar_text` output via the one shared `formatSAR` |
| BR-28