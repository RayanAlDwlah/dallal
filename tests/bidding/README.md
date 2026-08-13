# Bidding tests — `V-1` and `BID-20`

```bash
./tests/bidding/run.sh          # acceptance + 8 concurrency rounds  (~40s)
./tests/bidding/run.sh 30       # 30 rounds — run this before merging BID-02
KEEP=1 ./tests/bidding/run.sh   # leave the container up to poke at
```

Needs **Docker** and **`python3`** (the SQL is extracted from
`docs/contracts/BID-02-bid-operation.md` by `lib/extract-sql.py`, so the contract
stays the single source and cannot drift from what is tested). Nothing else — no
Supabase account, no network, no credentials, no npm dependency.

---

## Why this exists

`GITHUB_PLAN.md:463` calls the concurrency test **"the single most important
test in the project"** and asks for it to be run **repeatedly, not once**.

But GitHub Actions is prohibited in six places across the planning documents,
no issue creates a test runner, and the only trace of test infrastructure
anywhere was a `playwright-report/` line in `.gitignore`. So the most important
test in the project had no way to be run, and would have been run manually once
and then forgotten.

This directory is that missing runner. It is deliberately **local and
zero-dependency**, because the property it proves — that a per-auction row lock
serialises concurrent bids — is a property of the PostgreSQL engine, not of our
hosting. Anyone on the team can prove it on their own machine, including an AI
session with no credentials.

## What it proves

**Acceptance — 18 assertions.** Each traces to a PRD scenario or business rule:

| Area | Covers |
|---|---|
| `SC-55` / `BR-29` | the first bid may **equal** the starting price |
| `SC-56` / `BR-03` | every bid after it must be **strictly** greater; `+0.01` is enough (`BR-32` — no increment exists) |
| `S0-12` §8.1 | `NaN`, `Infinity`, `-Infinity`, `"  inf  "` are rejected. PostgreSQL `numeric` accepts these, and `NaN > 0` and `NaN = round(NaN,2)` are both true — an accepted `NaN` bid makes the auction permanently unwinnable |
| `FR-BID-07` / `EC-06` | `100.005` is **rejected, never rounded** |
| `BR-23` | a rejection changes nothing — price, history, all untouched |
| `BR-02` / `BR-01` | the owner cannot bid; identity comes from the session, never the payload |
| `BR-21` / `SEC-R3` / `SC-57` | a 40-digit bid is accepted and stored with no drift. **There is no ceiling** |
| **`LC-03`** | an auction past its `end_time` whose `status` column still reads `active` **rejects the bid**. Eligibility is the server clock, never the stored flag |

**Concurrency — `BID-20`.** Per round, N connections bid the *same* amount on
one auction simultaneously. Every round must show:

- exactly one acceptance (`BR-12`, `SC-16`)
- history rows equal to acceptances — nothing lost, nothing duplicated (`FR-BID-14`, `NFR-REL-04`)
- every submission answered (`FR-BID-16`)
- `current_price` equal to the max accepted bid, zero tolerance (`BR-13`, `NFR-DAT-01`)
- losers distinguishable: `outbid_race` vs `not_above_current` (`SC-18`, `EC-01`)

The race/too-low split **varies between rounds**. That variation is the point —
it shows the pre-lock/post-lock distinction is doing real work under real
contention rather than being decorative.

## Two things the harness itself guards against

**A false pass.** A `DO` block that aborts partway emits neither `PASS` nor
`FAIL`, so counting only those reports a clean run while assertions silently
never executed. This happened during development: a wrong `nullif` placement in
the shim's `auth.uid()` crashed on the anonymous path and hid the last four
assertions — and the suite printed `SUITE PASSED`. `run.sh` now asserts that all
18 assertions were **reached**, and fails on any `ERROR:` from psql.

**A stale ordering assumption.** `bids.created_at` defaults to `now()`, which is
*transaction start* — not lock order. Ordering history by it renders a
**decreasing** bid history under contention (measured: 2 of 12 contended
auctions). Ordering authority is `bids.id`. See `BID-02-verification.md` §3.

## Why the SQL is extracted, not committed as a migration

`lib/extract-sql.py` pulls the migration out of
`docs/contracts/BID-02-bid-operation.md` at run time.

That is not laziness. `S0-11` — the auction record contract — is still awaiting
Mohammed's sign-off, and `BID-02` §1c declares the `auctions` table. Committing
that as `supabase/migrations/*.sql` would freeze a shape its owner has not
agreed to, which `TEAM.md` rule 16 forbids.

So the contract stays the single source and the tests read from it. **When
`S0-11` comes back ticked, the SQL blocks move to `supabase/migrations/` and
`extract-sql.py` is deleted.**

## Scope

Not covered here: finalization (`BID-15`), the Realtime payload path, RLS under
the real `anon`/`authenticated` roles rather than as superuser, and the client
tier. The shim reproduces `auth.uid()` faithfully but it is not Supabase.
