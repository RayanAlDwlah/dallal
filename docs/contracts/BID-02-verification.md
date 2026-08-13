# BID-02 — Verification record (executed, not reviewed)

| Field | Value |
|---|---|
| Document | Empirical verification of `docs/contracts/BID-02-bid-operation.md` |
| Status | **Executed 2026-08-12 against PostgreSQL 17.10** — passed; two findings below |
| Method | Docker `postgres:17`, minimal Supabase shim (`auth` schema, `auth.users`, `auth.uid()`, the three PostgREST roles). Migration applied unmodified. |
| Why this exists | BID-02 was recovered from a dead agent transcript and had never been executed. `GITHUB_PLAN.md:463` calls the concurrency test "the single most important test in the project"; reading it is not the same as running it. |

The whole migration — domain, three tables, `place_bid`, `format_sar`, four triggers,
RLS policies, grants, the public view — **applied with no error and no edit**.

> **Re-verified after the `S0-12` §0 amendment.** `format_sar` was rewritten for grouped
> thousands (`1,250.00`, `BR-43`) using a width-unbounded regex rather than `to_char`, and
> no longer concatenates the indicator so it can sit outside the `<bdi>` isolate. The
> migration re-applied cleanly, the acceptance suite is still 17/17, concurrency is still
> exactly one acceptance per round, and `format_sar` emits all 42 digits at 40-digit
> magnitude with no `#`. **Nothing below changed as a result of that edit.**

---

## 1. Acceptance suite — 17/17

| # | Assertion | Requirement | Result |
|---|---|---|---|
| 1 | First bid exactly equal to starting price → accepted | SC-55, BR-29 | ✅ |
| 2 | Identical second bid → `not_above_current` | SC-56, BR-03 | ✅ |
| 3 | `+0.01 SAR` raise → accepted | SC-56, BR-32 | ✅ |
| 4–7 | `NaN`, `Infinity`, `-Infinity`, `"  inf  "` → `malformed_amount` | S0-12 §8.1, FR-SEC-11 | ✅ |
| 8 | `abc` → `malformed_amount` | §13.5 reason 5 | ✅ |
| 9 | `100.005` → `malformed_amount` (**rejected, not rounded**) | FR-BID-07, EC-06 | ✅ |
| 10–11 | `0`, `-5` → `malformed_amount` | BR-20, FR-BID-07 | ✅ |
| 12 | Every rejection left state byte-identical | BR-23 | ✅ |
| 13 | History held exactly the two accepted bids | FR-BID-24 | ✅ |
| 14 | Owner bidding → `owner_cannot_bid` | BR-02 | ✅ |
| 15 | No session identity → `not_authenticated` | BR-01 | ✅ |
| 16 | 40-digit bid accepted | BR-21, SEC-R3, SC-57 | ✅ |
| 17 | 40-digit value stored exactly, no drift | NFR-DAT-05 | ✅ |

**LC-03, verified the only way that counts.** An auction whose `status` column still
read `active` but whose `end_time` had passed rejected the bid with `auction_ended`.
Eligibility came from the server clock, not the stored flag — the premise the whole
≤30 s closing window rests on. The function uses `clock_timestamp()`, not `now()`;
`now()` freezes at transaction start, i.e. *before* a bid queues on the lock, so a bid
that waited 40 s across the end time would have passed a `now()` check.

**A rejection that was actually a pass.** The first attempt to simulate an ended auction
by `UPDATE auctions SET end_time = ...` was refused by a trigger:
`auction creation-time terms are immutable (BR-31, BR-16, FR-SEC-09)`. The test was
asking for something the product forbids.

---

## 2. Concurrency — the BID-20 claim, executed

**Identical-amount volley.** 12 rounds × 8 simultaneous connections, all bidding the
same amount on one auction:

```
round 1  accepted=1 history_rows=1 answered=8 | race=0 too_low=7 | current=250.00 max_bid=250.00 OK
round 2  accepted=1 history_rows=1 answered=8 | race=3 too_low=4 | current=250.00 max_bid=250.00 OK
...
round 12 accepted=1 history_rows=1 answered=8 | race=2 too_low=5 | current=250.00 max_bid=250.00 OK
```

Every round, without exception:

- **exactly one acceptance** — BR-12, SC-16
- **history rows == acceptances** — nothing lost, nothing duplicated (FR-BID-14, NFR-REL-04)
- **every submission answered** — 8/8, no hang, no silent drop (FR-BID-16)
- **`current_price` == max accepted bid, zero tolerance** — BR-13, NFR-DAT-01
- **`outbid_race` fires and varies (0–4 per round) and stays distinguishable from
  `not_above_current`** — SC-18, EC-01, §13.5. The split moves with real contention,
  which is what proves the pre-lock/post-lock distinction is doing work rather than
  being decorative.

**Ascending ladder.** 6 rounds × 32 simultaneous connections across four price levels
(150/200/250/300). 32/32 answered every round; 1–3 accepted depending on which
connection won the lock first; history strictly increasing in all 6 rounds; a `+0.01`
raise afterwards accepted every time.

---

## 3. Finding — `created_at` is an ordering trap, and it is not guarded

The first ladder run appeared to fail: history read `200.00 < 300.00 < 250.00`. It was
the test that was wrong, not BID-02 — the test ordered by `created_at`, and BID-02
(schema line 83) says: `FR-BID-23 display timestamp; ordering authority is id, not time`.
Re-ordered by `id`, all six runs are strictly increasing.

But the trap is real, frequent, and silent:

```
by id (correct) : 150.00 < 250.00 < 300.00 < 300.01
by created_at   : 150.00 < 300.00 < 250.00 < 300.01   ← visibly decreasing
```

**2 of 12 contended auctions produced disagreeing orderings.** The cause: `created_at`
defaults to `now()`, which is *transaction start* — so it records when a bid began
queueing, not the lock-acquisition order that BR-11 makes definitive. Under contention
those differ.

Why it matters: `created_at` is on the row, it is the obvious column to sort a history
by, and sorting by it renders a **decreasing** bid history — breaking SC-17, NFR-DAT-03
and FR-BID-15 on the display tier while the data underneath is perfectly correct. The
only thing standing between the product and that bug is a comment inside a migration
file, which is not a guardrail for three developers working in separate AI sessions.

**Required:** *"Bid history is ordered by `bids.id`, never by `created_at`."* — as a line
in the S0-11 contract (it governs a read path Mohammed owns) and in the root `CLAUDE.md`.

## 4. Finding — a real defect in S0-12 §5.1, confirmed

BID-02 §0 note 2 reports that S0-12 §5.1's literal `ELSIF v_amount > v_price_before_lock`
cannot reproduce S0-12's **own** worked trace in §10 (raced Bid 2): a raced first bid of
`100` against pre-bid state evaluates `100 > 100` = false, so a genuine race is reported
as a plain too-low bid. BID-02 implements the evident intent (inclusive first-bid branch)
instead, and the `outbid_race` counts above are non-zero because of it.

S0-12 is marked FINAL and its closing rule says changes are a revision of the document
agreed by all three developers, never a code change. **§5.1 needs that one-line revision.**

---

## 5. Reproducing this

```bash
docker run -d --name dalal-verify -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:17
# apply: 00-supabase-shim.sql, then §1 §2 §3 of BID-02, then the seed in §4
docker exec dalal-verify psql -U postgres -f /v/acceptance.sql   # 17 assertions
docker exec dalal-verify bash /v/conc.sh 12 8                    # identical-amount volley
docker exec dalal-verify bash /v/ladder.sh                       # ascending ladder
```

**Not covered here**, and still open: finalization (BID-15), the Realtime payload path,
RLS behaviour under the real `anon`/`authenticated` roles rather than as superuser, and
the client tier. The shim reproduces `auth.uid()` faithfully but is not Supabase.
