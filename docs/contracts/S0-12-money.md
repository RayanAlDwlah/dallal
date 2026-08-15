# S0-12 — The SAR Money Contract

| Field | Value |
|---|---|
| Document | S0-12 — Money representation contract (SAR) |
| Status | **FINAL — binding on all workstreams** |
| Date | 2026-08-12 |
| Resolves | Gap G-1 (ARCHITECTURE §2, §19.2), TEAM.md §11 "The money representation rule (SAR)" |
| Governed by | PRD v3.0 §8.6, §9, §17.2 (NFR-DAT-\*), SC-55/56/57, SEC-R3, EC-06, EC-25 · ARCHITECTURE v1.1 §9, §11, §13, §13.2a, §13.5, §15, §21.2, ADR-2, ADR-8 |
| Consumers | Mohammed (auction creation + all price display), Rayan (bid comparison, current price, closing), Abdulrahman (no money surface, but bound by the session rules in §9) |

---

## 0. AMENDMENT — canonical display format, approved 2026-08-12

> **Amended by the whole team on 2026-08-12. Applied by Mohammed (`@m7ya505`) with Rayan (`@RayanAlDwlah`) as reviewer.**

This contract originally specified `1250.00 SAR` and **banned thousands separators** (§7). The team decided the canonical format is:

```text
1,250.00 SAR
```

**What changed:** §7 only — the rendered string now carries grouped thousands. Recorded in `PRD.md` as **BR-43** and **Q16**.

**What did NOT change — every other clause stands verbatim:**

| Unchanged | § |
|---|---|
| `numeric` + `sar_amount` DOMAIN, no typmod, **no ceiling** | §1, §3 |
| **No minor units**, no conversion factor anywhere | §1, §8.2 |
| String transport at every boundary, both directions | §6 |
| Exact SQL comparison under the per-auction lock, no epsilon | §4, §5 |
| BR-28 rule verbatim; no increment, maximum, leading-bidder or reserve check | §5.1, §9.5 |
| Always exactly two decimals | §7 |
| Latin `SAR` suffix, no other currency, no "Demo Points" | §7, §9.10 |
| **`to_char` with a format picture remains BANNED** | §7, §9.2 |
| One formatter, no second implementation | §9.8 |

### ⚠️ 0.1 Consequence requiring Rayan's engineering decision

Grouping is **not** a trivial server-side change, because the obvious mechanism is exactly the one this contract bans for sound reasons:

- `to_char(a, ...)` needs a **fixed-width picture**, which renders wider values as `###` — a hidden display ceiling that violates SEC-R3 and EC-25. **The ban stands.**
- So a grouped server-side `format_sar` needs a **width-unbounded** implementation (string manipulation over the digit run), not a format picture.

**Two ways to satisfy the approved format. Rayan chooses:**

| Option | Shape | Note |
|---|---|---|
| **(i)** Client-only grouping | Server keeps returning the exact canonical decimal string (`1250.00`); the single client formatter adds grouping and the suffix | Removes the dual-implementation burden entirely. Grouping is presentational, and no server-generated string is user-visible without passing through the client |
| **(ii)** Mirrored grouping | `format_sar` gains a width-unbounded grouping implementation; the §7 golden byte-identity test is extended to cover grouped output at 40 digits | Preserves the existing mirrored design at the cost of a second grouping implementation |

**The client half is implemented either way** — `lib/money.ts`, width-unbounded string arithmetic, grouped, verified against a 40-digit fixture. **No server-side SQL was written or altered by this amendment.**

### 0.2 Rayan's answer — **option (ii), and it is already built and measured**

**Chosen: (ii) mirrored grouping.** Not on preference — the objection to (ii) was that it
needs a width-unbounded server implementation, and that implementation now exists and was
run against real PostgreSQL 17.10 before this answer was written.

```sql
-- Width-unbounded by construction: a regex over the digit run, NOT a format picture,
-- so there is no ceiling at any number of digits (BR-21, SEC-R3).
CREATE FUNCTION format_sar_digits(a sar_amount) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT regexp_replace(split_part(round(a,2)::text, '.', 1), '(\d)(?=(\d{3})+$)', '\1,', 'g')
      || '.' || split_part(round(a,2)::text || '.00', '.', 2)
$$;
```

Measured, not asserted:

| Check | Result |
|---|---|
| `to_char(12345678901234567890, 'FM999,999,999,999.00')` | `###,###,###,###.##` — **the banned mechanism's ceiling, reproduced.** The ban is correct and stands |
| The regex form at 40 digits | `9,999,…,999.99` — **all 42 digits**, correctly grouped, no truncation, no scientific notation |
| **Golden byte-identity vs the client `formatSar`** | **11 fixtures identical**, including the 40-digit value and `12345678901234567890.55` (above 2⁵³) |

So §7's golden test is **extended to grouped output at 40 digits and passing today** — the
condition option (ii) was priced at is already paid.

**Why (ii) rather than (i), briefly.** Option (i) would make the server's string
non-canonical — `format_sar` would return something no user ever sees, and NFR-DAT-08's
"one format everywhere" would hold only by convention rather than by construction. It also
silently assumes no amount is ever rendered outside the client, which is true today and is
exactly the kind of assumption that stops being true without anyone noticing.

**Note on the indicator:** `format_sar_digits` deliberately returns the number *without*
`SAR`. The indicator is appended by the caller as a separate element so it can sit outside
the number's `<bdi>` isolate in the RTL document (`BR-41`, `BR-42`). Concatenating it in
SQL would force the isolate boundary into the wrong place.

---

## 1. The decision

**Every SAR amount in Dalal is a PostgreSQL unconstrained `numeric` wrapped in a single DOMAIN, `sar_amount`, whose CHECK enforces positivity, finiteness, and at-most-two-decimal scale — with no precision typmod, no minor-units conversion, no ceiling of any kind, string transport for amounts across every API boundary in both directions, and exactly one display format: `<digits>.<two decimals> SAR`.**

This is the winning design from adversarial review (approved with conditions, 43.5/50), with the conditions discharged in §5.2, §6, and §9, the boundary discipline of the halalas proposal grafted in (§6, §9), and the NaN/Infinity hole that sank the bare-CHECK proposal closed structurally in the domain itself (§3, §8).

Why not the alternatives, in one line each:

- **`numeric(P,2)` for any P** — choosing a precision is choosing a ceiling (`numeric field overflow`, SQLSTATE 22003, verified at 10⁽ᴾ⁻²⁾), which is literally a bid rejected for being large. BR-21, SEC-R3, FR-BID-08, FR-CREATE-07, EC-25, and SD-05 prohibit an implementer from choosing that number. Additionally, the typmod silently **rounds** a three-decimal input (`100.005::numeric(10,2)` → `100.01`) instead of rejecting it, violating FR-BID-07/EC-06.
- **Integer halalas (`bigint` cents)** — ceiling at 2⁶³−1 halalas (~9.2×10¹⁶ SAR), a rejection-for-size the eight-reason contract of ARCHITECTURE §13.5 cannot even report; plus a permanent, silent 100× unit-mix hazard on every display surface. Judged fatally flawed as packaged.
- **`money` type, `float`, `double`** — `money` is 8-byte capped and locale-bound; floating point is prohibited outright by NFR-DAT-05 ("never floating point") and cannot hold the SC-56 knife edge (`100.01::float8 - 100.00::float8 = 0.0100000000000051`, verified).
- **Bare `numeric` + CHECK without a finiteness clause** — rejected by its judge as fatally flawed: PostgreSQL `numeric` accepts `'NaN'` and `'Infinity'`, and NaN passes both `x > 0` and `x = round(x,2)` (numeric NaN equals itself and sorts above everything). An accepted NaN bid permanently bricks an auction. See §8 for how this contract closes that hole.

---

## 2. Scope of this contract

One DOMAIN, three columns, one write path, one formatter. Nothing else may hold, transport, or render a SAR amount.

| Surface | Owner | Bound by |
|---|---|---|
| `auctions.starting_price` | Mohammed (written once at creation, FR-CREATE-06) | §3, §6 |
| `auctions.current_price` | Rayan's bid operation ONLY (BR-07, BR-13, SC-40) | §3, §5 |
| `bids.amount` | Rayan's bid operation ONLY (ADR-2, SEC-Z4) | §3, §5 |
| Every display of any amount — listing, detail, bid-input hint, history, rejection messages, all three result views | Mohammed and Rayan via the ONE formatter | §7 (NFR-DAT-08) |

---

## 3. The DDL

This block is the S0-12 deliverable. It is committed once, in one migration, and every money column declares the domain.

```sql
-- ============================================================================
-- sar_amount — THE money representation for Dalal. PRD BR-21, BR-33,
-- NFR-DAT-05. Do not add a precision/scale typmod. Do not add a magnitude
-- check. Do not "simplify" the finiteness clause. See docs/contracts/S0-12-money.md
-- ============================================================================
CREATE DOMAIN sar_amount AS numeric
  CONSTRAINT sar_amount_valid CHECK (
        VALUE > 0                          -- (a)
    AND VALUE < 'Infinity'::numeric        -- (b)  DO NOT REMOVE — see below
    AND VALUE = round(VALUE, 2)            -- (c)
  );

-- auctions
--   starting_price  sar_amount NOT NULL       (FR-CREATE-06, BR-20)
--   current_price   sar_amount NOT NULL       (BR-07, BR-13 — bid op writes only)
-- bids
--   amount          sar_amount NOT NULL       (ADR-2, SEC-Z4 — bid op inserts only)
```

**Reasoning for each clause:**

**(a) `VALUE > 0`** — BR-20 (starting price strictly positive) and FR-BID-07 (a bid is greater than zero). This clause also incidentally rejects `-Infinity`.

**(b) `VALUE < 'Infinity'::numeric`** — the load-bearing clause, and the one a well-meaning developer is most likely to delete as "redundant." It is not redundant. Unconstrained `numeric` accepts the special values `'NaN'` and `'Infinity'` (case-insensitively, whitespace-tolerantly, straight from a JSON string through PostgREST). In PostgreSQL, **numeric NaN equals itself and sorts greater than everything** — so NaN passes clause (a) (`NaN > 0` is true) and passes clause (c) (`NaN = round(NaN,2)` is true). Only this clause stops it: `NaN < Infinity` is false and `Infinity < Infinity` is false. Without it, a crafted request bids NaN, the bid is accepted, `current_price` becomes NaN, and every subsequent honest bid fails `> NaN` — the auction is permanently unwinnable, violating NFR-DAT-01/03/04/05, BR-12, and EC-06 in one stroke. This was verified live against PostgreSQL 17 during review. **The comment in the DDL and the mandated test in §10 exist so this clause survives refactoring.**

**(c) `VALUE = round(VALUE, 2)`** — BR-21 / FR-BID-07 / NFR-DAT-05: at most two decimal places, enforced as a **rejection**, not a silent rounding. This is precisely what the `numeric(P,2)` typmod gets wrong — the typmod rounds `100.005` to `100.01` and accepts it, making §13.5's "Malformed amount" reason unreachable for the decimals case and violating EC-06's explicit requirement that more-than-two-decimals is rejected. The CHECK form rejects. Trailing zeros are correctly tolerated (`100.010 = round(100.010, 2)` is true, because numeric equality is value equality).

**Why no typmod and no upper bound:** BR-21/SEC-R3 say, in the strongest terms the PRD uses anywhere, that there is no maximum and large values must **never** be rejected for being large. SD-05 makes introducing a ceiling a prohibited act; ARCHITECTURE Risk 10 classifies re-adding a removed check as a bug. Unconstrained `numeric` (practical range: 131,072 digits before the decimal point) is the only PostgreSQL representation with no chosen ceiling. The residual physical limit (~10¹³¹⁰⁷²) is unreachable by any input smaller than a ~128 KB literal and is handled as malformed input, never as "too large" — see §8.3.

---

## 4. Comparison semantics

`numeric` comparison is exact, value-based, and scale-insensitive at any magnitude: `100 = 100.0 = 100.00` all true; `100.01 > 100.00` true; a 0.01 delta is detected exactly at a 40-digit magnitude (verified). **No epsilon, no tolerance, ever.** All authoritative comparisons happen in SQL, inside the bid operation, inside the per-auction row lock (ARCHITECTURE §13.2 steps 2–3: lock, then re-read — anything read before the lock is stale).

---

## 5. The bid function's amount handling — exact expressions

### 5.1 The BR-28 rule, verbatim, and nothing else

Evaluated at step 7 of ARCHITECTURE §13.2, against state re-read **inside** the lock:

```sql
IF v_bid_count = 0 THEN
  -- BR-28 / BR-29 / SC-55: first bid — INCLUSIVE
  IF v_amount >= v_starting_price THEN
    v_ok := true;
  ELSE
    RETURN reject('below_starting_price', v_starting_price);   -- §13.5 reason 6
  END IF;
ELSE
  -- BR-28 / BR-03: subsequent bid — STRICTLY greater
  IF v_amount > v_current_price THEN
    v_ok := true;
  ELSIF v_amount > v_price_before_lock THEN
    -- The bid beat the price the bidder could have seen, but not the price
    -- committed while they queued on the lock. They did nothing wrong.
    RETURN reject('outbid_race', v_current_price);              -- §13.5 reason 8, EC-01
  ELSE
    RETURN reject('not_above_current', v_current_price);        -- §13.5 reason 7
  END IF;
END IF;

-- DELIBERATELY ABSENT (ARCHITECTURE §13.2a — adding ANY of these is a BUG):
--   no increment check        (BR-32 — none exists; +0.01 is as valid as +1,000)
--   no maximum check          (BR-21, SEC-R3 — no ceiling exists)
--   no leading-bidder check   (BR-24, FR-BID-04 — leading is never grounds for rejection)
--   no reserve check          (BR-35 — none exists)
```

### 5.1a Correction required — the `outbid_race` branch as written is wrong

**The `ELSIF v_amount > v_price_before_lock` line above cannot reproduce this document's
own worked trace in §10.** Take the raced case §10 Bid 2 describes: a first bid of `100`
against a 100 SAR starting price, which loses the lock race. Pre-lock state had no bids,
so `v_price_before_lock = 100.00`, and `100.00 > 100.00` is **false** — the branch falls
through to `not_above_current` and reports a genuine race as a plain too-low bid,
contradicting §10 and degrading §13.5's eight distinguishable reasons.

The evident intent is *"the bid would have been accepted against the newest state the
bidder could have seen"* — which requires the **inclusive** comparison when there were no
bids pre-lock, mirroring the first-bid branch. `BID-02` implements the intent, and its
verification run against PostgreSQL 17.10 shows `outbid_race` firing 0–4 times per
contended round across 12 rounds, so this branch is load-bearing rather than cosmetic
(`docs/contracts/BID-02-verification.md` §2).

**Proposed as a revision, not applied quietly** — this document's closing rule requires
all three developers to agree a change. Unlike §0 it changes behaviour, not rendering.

---

`v_price_before_lock` is `current_price` read by the function itself immediately before acquiring the lock — the race/too-low distinction (ARCHITECTURE §13.5, last row) is decided **entirely server-side**. No client-supplied "seen price" parameter exists, so distinguishability does not degrade for direct callers (SC-43), and no client input ever influences validity (BR-08).

On acceptance, steps 8–9 are inseparable in the same transaction (BR-07, BR-13, SC-40, NFR-DAT-01):

```sql
INSERT INTO bids (auction_id, bidder_id, amount) VALUES (p_auction_id, auth.uid(), v_amount);
UPDATE auctions SET current_price = v_amount WHERE id = p_auction_id;
```

Steps 1–5 (authentication from the session never the payload — BR-01; auction exists and end time not passed **by the database clock, never the stored status flag** — BR-04/LC-03/FR-BID-18; caller is not the owner — BR-02) precede the amount rule exactly as ARCHITECTURE §13.2 specifies and are unchanged by this contract.

### 5.2 The parameter is `text`, cast inside the function

```sql
CREATE FUNCTION place_bid(p_auction_id uuid, p_amount text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_num    numeric;
  v_amount sar_amount;
BEGIN
  -- Well-formedness gate (§13.2 step 6). The parameter is TEXT deliberately:
  -- with a numeric parameter, PostgREST casts BEFORE the body runs, so 'abc'
  -- or an overflow surfaces as a raw PostgREST error — breaking §13.5's
  -- 'malformed_amount' contract and leaking internals (SEC-T3, FR-SEC-16).
  BEGIN
    v_num := p_amount::numeric;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN reject('malformed_amount');            -- §13.5 reason 5; covers 'abc'
  END;                                            -- AND the ~10^131072 physical limit

  IF v_num IS NULL
     OR NOT (v_num > 0)                           -- zero, negative, -Infinity
     OR NOT (v_num < 'Infinity'::numeric)         -- NaN and +Infinity — see §3(b)
     OR v_num <> round(v_num, 2)                  -- >2 decimals: REJECTED, never rounded (EC-06)
  THEN
    RETURN reject('malformed_amount');
  END IF;

  v_amount := round(v_num, 2);   -- value-preserving scale canonicalization only:
                                 -- '100' → 100.00. Never changes the value.
  ...
```

**This is the only rounding call in the entire system, and it is a proven no-op in value terms** (the `<>` check above guarantees it). Any other `round()` on money, anywhere, fails review (NFR-DAT-05: no rounding drift).

Amount travels **as a string** from the `<input>` through the JSON body into `p_amount`. It must never pass through a JavaScript `Number`: decimal fractions are unrepresentable in binary floats, and integers above 2⁵³ silently corrupt — the exactness NFR-DAT-05 demands would die before the SQL ever ran.

---

## 6. Transport: amounts are strings at every boundary, both directions

BR-21 makes arbitrarily large amounts *legal*, and the first thing that actually breaks on large values is not PostgreSQL — it is `JSON.parse` producing an IEEE 754 double, exact only to 2⁵³ (~9×10¹⁵). PostgreSQL fails 10¹³¹⁰⁵⁶ times later. Therefore string transport is a **consequence of BR-21**, not gold-plating:

| Boundary | Rule |
|---|---|
| Bid submit (write) | Input field string → JSON string → `place_bid(p_amount text)` (§5.2). No `parseFloat`, no `Number()`, ever |
| Auction creation (write) | Starting price submitted as a string; the client insert path relies on the `sar_amount` domain as the authoritative gate (ARCHITECTURE §12.4); the form maps constraint `sar_amount_valid` (SQLSTATE 23514) to the specific field message so users never see database noise (SEC-T3) |
| Reads (listing, detail, history, results) | Views/RPC returns expose `amount::text` / `format_sar(amount)` — **never raw `numeric` through JSON** |
| RPC rejection payloads | `starting_price` / `current_price` in rejection responses returned as text of the canonical scale-2 string, formatted client-side by the one formatter (BR-27, FR-BID-10, FR-BID-13) |
| **Realtime (Tier 4)** | `postgres_changes` payloads carry raw numerics as JSON numbers that the browser corrupts above ~9×10¹⁵. **The event is a trigger, never a source**: on receipt, re-read the price/history via the text-returning read path. This is exactly ARCHITECTURE §14.5's existing posture — realtime is a projection; the authoritative read recovers correctness (FR-RT-01, RT-R6) |
| Supabase TypeScript codegen | Generated types map `numeric` → `number`, nudging toward float handling. The generated types for `starting_price`, `current_price`, `amount` are **overridden to `string`**, and a branded type (`type SarAmount = string & { __sar: true }`) is used in the shared money module |

---

## 7. The single canonical display format

**`<grouped integer digits>.<exactly two decimal digits> SAR`** — Western digits, **grouped thousands with `,`**, always exactly two decimals, one space, `SAR` suffix. **Amended 2026-08-12 — see §0.**

Canonical example: **`1,250.00 SAR`**.

```sql
-- Reference implementation (server). round(a,2) forces display scale 2 so
-- stored 100, 100.0, 100.00 all render identically; numeric-to-text NEVER
-- uses scientific notation and NEVER overflows, at any number of digits.
CREATE FUNCTION format_sar(a sar_amount) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS
$$ SELECT round(a, 2)::text || ' SAR' $$;
```

The client mirror, `formatSAR(amount: SarAmount): string`, lives in the one shared money module, operates on the decimal **string** (split on `'.'`, pad the fraction to 2 — pure string arithmetic, no floats, correct beyond 2⁵³), and a golden test asserts byte-identity with `format_sar` over a fixture set that includes a 40-digit value.

**Worked examples:**

| Stored value | Displayed — everywhere, identically |
|---|---|
| `100` | `100.00 SAR` |
| `100.5` | `100.50 SAR` |
| `100.01` | `100.01 SAR` |
| `1234567.89` | `1,234,567.89 SAR` |
| `9999999999999999999999999999999999999999.00` (40 digits) | `9,999,999,999,999,999,999,999,999,999,999,999,999,999.00 SAR` — all 40 digits grouped, no scientific notation, no truncation, **no width ceiling** (SC-57, EC-25) |

**Rationale and rulings:**

- **Always two decimals is hereby ratified.** PRD prose examples like `100 SAR` (§1, FR-CREATE-13) illustrate the SAR *indicator*, not decimal policy. NFR-DAT-05's exact-two-decimal rule plus NFR-DAT-08's one-format rule make fixed `.00` the only choice that guarantees the same value never renders two ways (`100 SAR` on the listing vs `100.00 SAR` in history would violate NFR-DAT-08). This closes the ratification gap the review flagged; nobody may "fix" the format back to trimmed zeros.
- **`to_char` with a format picture is BANNED.** A fixed picture renders values wider than the picture as `###` — a hidden **display ceiling**, violating SEC-R3's "displaying them … without error," which explicitly forbids dodging a display problem with a ceiling. Verified live.
- **Thousands separators — AMENDED 2026-08-12: now required.** This clause previously excluded grouping, partly because the Arabic-RTL question was unresolved against the PRD's English-only statements. **Both are now decided:** the interface is Arabic RTL (`PRD.md` BR-41, §1.2) and the canonical format is `1,250.00 SAR` (BR-43). The digit set stays **Western** (BR-42) and the indicator stays Latin **`SAR`**. The implementation consequence — grouping must be width-unbounded, since `to_char` stays banned — is set out in §0.1 and is Rayan's call.
- Layout robustness for very wide values (EC-25 "no layout breakage") is a CSS obligation (wrapping/containment) on Mohammed's surfaces, independent of this format.
- The word **"Demo Points" is prohibited** (BR-33, ARCHITECTURE §21.2). The suffix is `SAR`, always.

---

## 8. Fatal flaws found in review, and how this design avoids each

### 8.1 NaN / +Infinity bricking an auction (fatal flaw of the bare-CHECK candidate)

The judge verified live that `'NaN'` and `'Infinity'` pass `x > 0` and `x = round(x,2)`, pass a naive well-formedness gate, get **accepted** as bids, and make the auction permanently unwinnable (`anything > NaN` is false). This contract closes the hole **three times over**:

1. **Structurally** — domain clause (b), `VALUE < 'Infinity'::numeric`, on every money column including the direct-insert `starting_price` path, so `INSERT INTO auctions (..., starting_price) VALUES (..., 'NaN')` fails at Tier 2.
2. **At the function gate** — the explicit `NOT (v_num < 'Infinity'::numeric)` check in §5.2 returns the product-level `malformed_amount` reason instead of a constraint error.
3. **By mandated test** (§10) — submitting `"NaN"`, `"Infinity"`, `"-Infinity"`, `"  inf  "` via crafted requests (FR-SEC-11) must yield `malformed_amount`, so the clause cannot be silently "simplified" away later.

### 8.2 The minor-units ceiling and the 100× unit-mix hazard (fatal flaw of the halalas candidate)

BIGINT halalas overflows with SQLSTATE 22003 at ~9.2×10¹⁶ SAR — a rejection for size that ARCHITECTURE §13.5's eight reasons cannot legally report, violating BR-21/SEC-R3/EC-25 by type. This design stores SAR directly: **there is no conversion factor anywhere in the system**, so there is no 2⁶³ ceiling, no ×100/÷100 site for three developers to diverge on, and no silent 100× display bug that type-checks. The halalas proposal's genuinely good boundary rules are what §6 and §7 graft instead: string transport everywhere including Realtime, one shared validation helper, one formatter, always-two-decimals.

### 8.3 The winner's own conditions (required by its judge before S0-12 closes)

1. **Unimplementable overflow catch → fixed.** "Catch 22003 on the parameter cast" cannot work with a `numeric` parameter (PostgREST casts before the body runs). §5.2 makes the parameter `text` and casts inside `BEGIN/EXCEPTION`, so `'abc'` and a 200,000-digit payload both surface as the §13.5 `malformed_amount` reason — never a raw error leaking internals (SEC-T3), and never a temptation for a client-side length cap (which would be a ceiling). The residual physical limit (~10¹³¹⁰⁷² — a ~128 KB literal, a degenerate crafted payload, not a bid) is thereby mapped to "un-representable input," keeping SEC-R3's letter intact; this paragraph is the recorded accepted consequence, in the same manner PRD §21.2 records BR-21's.
2. **Realtime numeric corruption → fixed.** §6: Tier 4 payloads are triggers to re-read via the text path, never display sources.
3. **Team-wide pinning → done.** §9 puts the rules in the shared session instructions for all three developers simultaneously, plus the review checklist and mandated tests in §10.

---

## 9. What this forbids

Pinned verbatim into the shared `CLAUDE.md` so every AI-assisted session for all three developers is constrained at once — not policed per person. A PR doing any of the following is rejected on sight:

1. **No floating point, anywhere, ever.** No `float8`/`real` column, cast, index expression, `ORDER BY`, or test assertion on money; no JS `Number`, `parseFloat`, `Number()`, or arithmetic on amounts. (NFR-DAT-05)
2. **No ceiling of any kind.** No `numeric(P,2)` typmod on any money column — "tightening" `numeric` to `numeric(12,2)` is the single most likely hygiene refactor and it is a BR-21/SEC-R3/SD-05 violation, not hygiene. No length cap on the amount input. No `to_char` format picture. (ARCHITECTURE Risk 10)
3. **No bare `numeric` money column.** Every money column is `sar_amount` — omission is greppable: `grep -rn 'price\|amount' migrations/ | grep -v sar_amount`.
4. **No second write path.** Only `place_bid` inserts bids and writes `current_price`, in one transaction. Direct INSERT on `bids` is denied to every role including the bidder. (ADR-2, SEC-Z4–Z7, BR-07/BR-13/SC-40)
5. **No re-added checks.** No increment, no maximum, no leading-bidder rejection, no reserve — each is a finalized product decision whose *absence* is the requirement. (ARCHITECTURE §13.2a, BR-32, BR-21, BR-24, BR-35, SD-05) — **but read §9.5a before citing this against `D-01`.**
6. **No rounding of user input.** More than two decimals is **rejected** (`malformed_amount`), never rounded and accepted. The one `round(v,2)` in §5.2 is a verified value no-op. (FR-BID-07, EC-06)
7. **No amounts as JSON numbers.** Strings in, text out, on every path — including treating Realtime payload numerics as untrusted triggers. Typegen overridden to `string`. (NFR-DAT-05 at the display tier, SEC-R3)
8. **No second formatter, no raw `::text` on a display surface.** Every rendered amount goes through `format_sar` / `formatSAR`. Same amount, same string, everywhere. (NFR-DAT-08)
9. **No epsilon, no tolerance, no client-side authority.** Comparisons happen in SQL, in the bid function, under the lock; the client pre-check is Tier 1 UX only and uses the shared module. (BR-08, ARCHITECTURE §13.6)
10. **No "Demo Points", no currency other than SAR.** (BR-33)
11. **No removal of the `VALUE < 'Infinity'` clause** from `sar_amount`, ever, for any reason. (§8.1)

### 9.5a The word "increment" in rule 5 means a *check*, not a *column* — recorded `2026-08-15`

[`D-01`](../decisions/D-01-bid-increment-button.md) is a made owner decision: the bid control
becomes a **button carrying a seller-set increment**, and `V2-A3` adds a `bid_increment`
column. Rule 5's first two words are "No increment", so this note exists to say exactly what
rule 5 does and does not forbid, before someone greps it and blocks a decided feature — or,
worse, cites it to justify the constraint it was written to prevent.

**Rule 5 forbids a *rejection*.** It is a list of checks — increment, maximum,
leading-bidder, reserve — each one a reason the server might refuse a bid. Its subject is
what `place_bid` **accepts**. A column recording what the *screen offers* rejects nothing and
is not within its scope. `BR-32` governs the server; `D-01` governs the screen; a `+0.01`
raise from a crafted request stays valid at every increment setting, and `D-01` §4 requires
the test proving it to land in the same PR as the column.

**So the column does not violate rule 5 — and rule 5 becomes *more* load-bearing once it
exists, not less.** `D-01` §3 predicts the exact failure: a session sees a `bid_increment`
column, concludes the schema is missing a constraint, and adds
`check (amount = current_price + bid_increment)`. **That** is rule 5, squarely, and the
column is what makes it look like hygiene. **Rule 5 is not weakened by this note. Its blast
radius is narrowed to the thing it was always about, so that it still fires when it matters.**

Rule 5's wording is **not** amended here, because `O25`–`O30` are open and the honest edit
cannot be written yet. What `V2-A3` must do, in the PR that adds the column: amend this rule,
amend [`S0-11` §7](S0-11-auction-record.md) row 1, and narrow `INT-08` — **three artefacts,
of which only `INT-08` is named in `V2-A3`'s stated scope or in `CLAUDE.md` §9.**

### 9.6 The gap rule 1 leaves open — there is no sanctioned way to *add* two amounts

Rule 1 forbids "arithmetic on amounts" in JavaScript, and it is right to. But `D-01`'s button
must display and submit **`current_price + increment`**, which is an addition, on two amounts,
on the client. Today:

- **`lib/money.ts` has no addition.** Its exported values are exactly, and exhaustively:
  `SAR_SUFFIX`, `compareSar`, `formatSar`, `formatSarWithSuffix`, `isSar`, `meetsMinimum`,
  `minimumAcceptableBid`, `minimumBidHint`, `sar`, `trySar` — **ten, of which nine are
  functions, and not one of them combines two amounts into a third.** Validation
  (`sar`, `trySar`, `isSar`), comparison (`compareSar`, `meetsMinimum`,
  `minimumAcceptableBid`), presentation (`formatSar`, `formatSarWithSuffix`,
  `minimumBidHint`). The primitive `D-01` needs **does not exist**. *(That list is
  machine-checked against the module, so it is an inventory rather than a recollection — and
  the day an `addSar` appears, the check goes red and this section is what has to be
  rewritten.)*
- **The obvious implementation is banned on sight** by rule 1, and correctly: `Number(a) +
  Number(b)` corrupts above 2⁵³ and misrepresents decimal fractions below it.
- **§7's precedent shows the shape of the answer** — `formatSar` does "pure string arithmetic,
  no floats, correct beyond 2⁵³" on the decimal string. An `addSar` in the same module, in the
  same style, with the same 40-digit golden fixture, is the natural home.
- **`O29` makes this worse, not better.** It asks whether an off-grid price (after a crafted
  `+0.01`) means the button offers `current + increment` or **rounds up to the next multiple**.
  Round-up needs division and modulo on decimal strings, not just addition — a strictly larger
  primitive. **Whichever way `O29` is answered, something must be built here.**

**This is an engineering question, not a product one, so it does not wait on the owner** — but
it also is not decided, and no ticket names it. `V2-C3` (the bid-button contract) is where it
belongs. Two candidate answers, for whoever claims it: **(a)** the server returns the button's
amount as **text**, already computed, so the client never does arithmetic at all — consistent
with §6's "strings at every boundary" and with §9.9's "no client-side authority"; or **(b)**
an `addSar` in `lib/money.ts` mirroring `formatSar`'s string technique. **(a) is the smaller
change and the one that keeps rule 1 absolute rather than carved out** — but it costs a round
trip per price change on a live-updating surface, and that is a real cost that the person
building the button should weigh. Recorded here so the choice is made once and deliberately,
rather than three times by three sessions reaching for `Number()`.

---

## 10. Worked traces — SC-55 and SC-56

Setup: Mohammed's creation form submits starting price `"100"` (string). Domain check: `100 > 0` ✓, `100 < Infinity` ✓, `100 = round(100,2)` ✓ — stored; `current_price` initialized to the starting price (BR-13, FR-CREATE-28). Zero bids. Auction Active.

**Bid 1 — `"100"` → ACCEPTED (SC-55).**
Gate (§5.2): casts to `100`, positive ✓, finite ✓, `100 = round(100,2)` ✓; canonicalized to `100.00`. Pre-lock read: `v_price_before_lock = 100.00`. Row lock acquired (§13.2 step 2); re-read under the lock: end time not passed **by the database clock** (BR-04/LC-03), caller ≠ owner (BR-02), `v_bid_count = 0` → inclusive branch: `100.00 >= 100.00` → **TRUE** — numeric equality is exact and scale-insensitive, so this holds whether the client sent `"100"`, `"100.0"`, or `"100.00"`. Same transaction: `INSERT bids(amount = 100.00)`; `UPDATE auctions SET current_price = 100.00` (steps 8–9 inseparable). Commit; lock releases. Display: `100.00 SAR`.

**Bid 2 — `"100"` immediately after → REJECTED (SC-56 first half).**
Gate passes identically. Lock acquired after Bid 1's commit — the lock-acquisition order **is** the definitive order (BR-11). Re-read under the lock: `v_bid_count = 1`, `current_price = 100.00` → strict branch: `100.00 > 100.00` → **FALSE**. Reason selection: if this bidder loaded the page after Bid 1, `v_price_before_lock = 100.00` and `100.00 > 100.00` is false → `not_above_current`, "Your bid must be higher than 100.00 SAR" (§13.5 reason 7). If instead the two bids raced and this one queued on the lock, `v_price_before_lock` was the pre-Bid-1 state and the bid beat it → `outbid_race`, "Someone bid before you — the current price is now 100.00 SAR" (§13.5 reason 8, EC-01, FR-BID-13). Either way: rejection aborts before any write — state entirely unchanged (BR-23), nothing enters history (FR-BID-24). Exactly one bid exists at the 100.00 price level (BR-12, SC-16), and no scale representation of 100 can slip a second one in.

**Bid 3 — `"100.01"` → ACCEPTED (SC-56 second half).**
Gate: `100.01 = round(100.01, 2)` ✓. Lock; re-read: `100.01 > 100.00` → **TRUE, exactly** — the one-halala knife edge that floating point cannot be trusted with and that `numeric` decides exactly at 100 SAR and at 40-digit magnitudes alike (NFR-DAT-05: precision must not degrade at scale). No increment check exists to demand more (BR-32, §13.2a). History is now `[100.00, 100.01]` — strictly increasing (NFR-DAT-03, FR-BID-15, SC-17/SC-19); `current_price = 100.01`; displays `100.01 SAR` via the one formatter.

**Mandated automated tests locking this contract in** (in addition to SC-55/56 above): SC-57 end-to-end with a 30+ digit amount typed in a real browser through to history display; `"NaN"` / `"Infinity"` / `"-Infinity"` / `"100.005"` / `"abc"` / `"0"` / `"-5"` via direct crafted requests all yielding `malformed_amount` with unchanged state (FR-SEC-11, EC-06); the concurrent-bid race yielding exactly one acceptance and a distinguishable `outbid_race` (SC-16→SC-19, §13.5); the golden formatter byte-identity test (§7).

---

## 11. Requirement traceability

| Requirement | Satisfied by |
|---|---|
| **NFR-DAT-05** — exact decimal, two places, never floating point, exact at scale | `numeric` base type (exact decimal arithmetic at any magnitude) §3; domain clause (c) §3; rejection-not-rounding §5.2; string transport §6; float ban §9.1; no-rounding rule §9.6 |
| **BR-21 / SEC-R3 / FR-BID-08 / FR-CREATE-07 / EC-25 / SC-57 / SD-05** — no maximum, never rejected for size | No typmod, no minor units — no chosen ceiling §1, §3; no maximum check in the function §5.1; `to_char` ban (no display ceiling) §7; no input length cap §9.2; residual physical limit mapped to `malformed_amount` and recorded §8.3 |
| **BR-33** — SAR, simulated, "Demo Points" prohibited | `SAR` suffix in the one format §7; prohibition pinned §9.10 |
| **NFR-DAT-08** — one display format everywhere | One formatter per tier, byte-identical, golden-tested §7; second-formatter ban §9.8; always-two-decimals ratification §7 |
| **BR-28 / BR-29 / FR-BID-05 / FR-BID-06** — minimum acceptable bid, inclusive first / strict after | The two-branch expression, verbatim and exclusively §5.1 |
| **SC-55** — first bid equal to starting price accepted | `>=` inclusive branch; worked trace §10 Bid 1 |
| **SC-56** — equal second bid rejected; +0.01 accepted | `>` strict branch; worked traces §10 Bids 2–3 |
| **BR-11 / BR-12 / SC-16 / SC-17 / SC-19 / FR-BID-14 / FR-BID-15 / NFR-DAT-03** — one ordering, one bid per level, none lost, strictly increasing | Comparisons only under the per-auction row lock against re-read state §4, §5.1; trace §10 |
| **BR-02** — owner never bids | Step 5 precedes the amount rule §5.1 |
| **BR-04 / LC-03 / BR-19 / FR-BID-18/19** — database clock, never client, never the status flag | Step 4 under the lock uses the DB clock §5.1; trace §10 |
| **BR-07 / BR-13 / SC-40 / NFR-DAT-01** — current_price written only by the bid op, same transaction | Inseparable INSERT+UPDATE §5.1; write-path rule §9.4 |
| **ADR-2 / SEC-Z4–Z7** — one insert path; direct INSERT denied to every role | §2, §9.4 (RLS posture per ARCHITECTURE §11.2) |
| **ARCHITECTURE §13.2a** — the four deliberately absent checks | Stated inline in the function where an AI assistant will see them §5.1; forbidden list §9.5 |
| **ARCHITECTURE §13.5** — eight distinguishable reasons; race ≠ too-low | `malformed_amount` / `below_starting_price` / `not_above_current` / `outbid_race` mapping §5; server-side pre-lock/post-lock distinction, no client cooperation needed §5.1 |
| **BR-20** — starting price > 0 | Domain clause (a) §3 |
| **FR-BID-07 / EC-06** — numeric, > 0, ≤ 2 decimals; malformed rejected, never rounded | Domain clauses (a)+(c) §3; gate §5.2 |
| **BR-27 / SEC-T3 / FR-SEC-16** — specific product-level reasons, no leaked internals | Text parameter + exception mapping §5.2; creation-path 23514 mapping §6 |
| **FR-SEC-11 / SEC-V4** — correct under crafted requests | NaN/Infinity/overflow gate §5.2, §8.1; mandated tests §10 |
| **BR-24 / FR-BID-04 / BR-32 / BR-35** — no leading-bidder, increment, or reserve rules | Deliberately absent §5.1, §9.5 |
| **FR-BID-10 / FR-BID-13** — minimum and prices in messages, in SAR | Amounts returned as text, rendered by the one formatter §6, §7 |
| **NFR-DAT-04 / SC-29** — winner recomputable from history | Finalization compares the same exact `sar_amount` values; no conversion layer exists to diverge (ARCHITECTURE §15.7) |
| **G-1 / ARCHITECTURE §19.2 / §21.2 / TEAM §11 / ADR-8** — one representation, no developer invents another | This document; the domain makes divergence greppable §9.3; session rules pinned for all three developers at once §9 |

---

*This contract is final. Changing the format, the domain, or the transport rules is a revision of this document agreed by all three developers — never a code change.*