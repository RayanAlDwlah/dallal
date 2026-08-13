# Bidding tests — `V-1` and `BID-20`

```bash
./tests/bidding/run.sh          # acceptance + 8 concurrency rounds  (~40s)
./tests/bidding/run.sh 30       # 30 rounds — run this before merging BID-02
KEEP=1 ./tests/bidding/run.sh   # leave the container up to poke at
```

**Needs Docker. That is the whole list** — no `python3`, no Supabase account, no
network, no credentials, no npm dependency. `awk` and `diff` do the contract
check and both ship with the shell you are already running.

> It used to need `python3` too. @Dem4t reported on PR #1 that he does not have
> it, so the suite did not run on his machine — while PR #5 asks him to review a
> migration whose only evidence *is* this suite. A runner one of three developers
> cannot execute is not a runner. `lib/extract-sql.py` → `lib/contract-sync.awk`.

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

**Acceptance — 19 assertions.** Each traces to a PRD scenario or business rule:

| Area | Covers |
|---|---|
| `S0-12` §5.2 | `place_bid`'s signature is `(uuid, text)`. With a `numeric` parameter PostgREST casts **before** the body runs, so the `EXCEPTION` block can never catch `22P02`/`22003` and every `malformed_amount` assertion below silently stops testing what it says it tests |
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
19 assertions were **reached**, and fails on any `ERROR:` from psql.

**A stale ordering assumption.** `bids.created_at` defaults to `now()`, which is
*transaction start* — not lock order. Ordering history by it renders a
**decreasing** bid history under contention (measured: 2 of 12 contended
auctions). Ordering authority is `bids.id`. See `BID-02-verification.md` §3.

## The migration is committed, and the suite applies *it*

`supabase/migrations/20260812120000_bid02_bid_acceptance.sql` is the contract's
first three ```sql blocks concatenated, verbatim. `run.sh` applies **that file**,
not a copy of it, so the suite proves the artefact that would ship.

The fourth block — V-1's seed — is **not** in the migration and never will be: it
writes `auth.users` directly with reserved UUIDs, which the product never does.
`lib/contract-sync.awk` extracts it for the test run and applies it separately.

**Committing it does not settle who owns the shape.** `S0-11` — the auction
record contract — is still awaiting Mohammed's sign-off, and `BID-02` §1c
declares the `auctions` table; `profiles` is Abdulrahman's. The file exists on a
branch, in a PR blocked on both, so they can review the exact bytes rather than a
description of them. Until those are ticked, this migration is a proposal that
runs, not a decision.

`contract-sync.awk` + a `diff` refuse to run the suite if the two copies ever
diverge, printing the offending lines. That is the whole reason it exists.

## Scope

Not covered here: finalization (`BID-15`), the Realtime payload path, RLS under
the real `anon`/`authenticated` roles rather than as superuser, and the client
tier. The shim reproduces `auth.uid()` faithfully but it is not Supabase.
