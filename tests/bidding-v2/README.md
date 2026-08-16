# `tests/bidding-v2/` — the V2 database suite

```bash
./tests/bidding-v2/run.sh              # 150 assertions + 8 contended rounds (~50 s)
./tests/bidding-v2/run.sh 40 8         # 40 rounds of 8 simultaneous bidders
KEEP=1 ./tests/bidding-v2/run.sh       # leave the container up to poke at
```

Needs Docker and nothing else. **No Supabase account, no network, no shared
database, no credentials.** Everything it proves is a property of the PostgreSQL
engine and of the committed migration files, not of our hosting — so it runs
identically on a laptop, in CI, and in a Claude session that has no keys.

---

## Why it exists

V2 shipped on 2026-08-15 with **no database suite at all**. V1's
`tests/bidding/` proved the extension cap, the lock ordering, the `sar_amount`
domain and the concurrency behaviour — the four properties `CLAUDE.md` §5 calls
non-negotiable — and it was deleted along with the V1 tree it tested. V2 rewrote
`place_bid` in the same window. For a day the shipped bid operation was held up
by nothing but the text of a migration.

That was not free. `D-01` §4 required one assertion — *"the server accepts an
amount that is NOT a multiple of the increment"* — to ship in the same PR as the
`bid_increment` column. There was no suite to put it in, so it never shipped,
and the contradiction between `place_bid` and `BR-32` reached production
unnoticed. It is assertion 19 of `acceptance.sql` now. See `CLAUDE.md` §0.

---

## What runs, in order

| step | what it proves |
|---|---|
| `lib/supabase-shim.sql` | the platform objects the migrations touch exist |
| all 6 committed migrations, in `supabase db push` order, **from empty** | they apply at all |
| `lib/seed.sql` | four signups; the profiles come from the shipped trigger |
| `acceptance.sql` — 32 | `place_bid`: identity, amounts, state, price rules, notifications |
| `closing.sql` — 26 | anti-snipe quantum, the cap, `finalize_auction`, `end_time` |
| `money.sql` — 19 | the `sar_amount`/`sar_increment` domains, and money on the wire |
| `sessions.sql` — 73 | `place_lot_bid` and the rest of the live-session machinery |
| `concurrency.sh` | N real connections racing one auction, four invariants |

**Applying the migrations is itself a test, and it is the half nobody was
running.** `supabase db push` does not re-apply what a project already has, so a
syntax error, an unsatisfiable constraint, or a migration that depends on an
earlier one having run currently reaches production unchecked. This applies all
six against an empty database before an assertion executes.

The migration list is **discovered, never written down** — a hand-maintained
list goes stale silently, and the suite would keep passing against a schema
production no longer has.

---

## The shim, and the line it must not cross

`lib/supabase-shim.sql` mirrors `auth` and `storage`. It is the reason this was
harder than V1: V2's `core_schema.sql` INSERTs storage buckets and creates four
`storage.objects` policies **at top level**, not inside a conditional `do` block
the way V1's did, so a bare `postgres:17` aborts at `core_schema.sql:496` and
nothing after it exists — no auctions table, no `place_bid`, no suite.

A shim mirrors the platform objects the migrations **touch**, at the fidelity
the assertions **read**, and never stands in for something the suite then claims
to have proven. *A double that answers every question is a double that tests
nothing.* Where it diverges from the platform it says so on the line.

Two places in it are load-bearing and look like details:

- `auth.uid()` wraps `nullif` around the **setting**, before the cast. The other
  way round raises `invalid input syntax for type json` for every
  unauthenticated caller — a crash, not a rejection, which silently aborts any
  block testing the anonymous path. It hid four assertions once on V1, and it
  matters more here, because `place_bid`'s *first* branch is the null-identity
  branch.
- `storage.foldername()` returns every segment **but the last**. An
  implementation returning all of them would put the *filename* in `[1]` for a
  top-level upload, and the storage policies would read as passing while
  admitting another user's folder.

---

## Four assertions to read before trusting a green run

**`acceptance.sql` 19 and `sessions.sql` 29 — the contradiction, pinned as it
shipped, in both functions that carry it.** `D-01` §4,
`BR-32` and `SD-05` all say the server must ACCEPT `current price + 0.01`;
`D-01` §2 draws the line explicitly — *"BR-32 governs what the SERVER ACCEPTS.
D-01 governs what the SCREEN OFFERS."* The shipped server says `too_low`. The
assertion pins **what shipped, not what the documents ask for**, and is labelled
`UNRESOLVED`. Writing it the other way round would turn the suite red for
reporting the truth, and someone would "fix" the suite.

It goes red in **both** directions on purpose. Resolve it way (a) — `place_bid`
drops back to `> current_price` — and this fails, which is the moment somebody
has to state that the decision was made. Resolve it way (b) — amend `BR-32`,
`SD-05` and `PRD` §21.1 Q4 — and it keeps passing, correctly. The only state in
which it lies is the one where somebody changed the server and told nobody.

There are **two** of them because there are two functions. `place_lot_bid` is a
sibling of `place_bid`, not a caller of it, and it reproduces the same rejection
independently — so a half-done fix that changes one function goes red on the
other, instead of going green everywhere.

**`sessions.sql` 38 — the assertion that cannot fail, only hang.** V2.1's
open-ended lots («بدون مدة») put a NULL `end_time` into three functions, and
`advance_session` is the one where a missing `end_time is null` guard does not
return a wrong answer: it calls `open_next_lot`, is refused with
`lot_still_running`, changes nothing, and reads the same row again — forever. A
hung `psql` is a CI job that burns its whole budget and reports nothing at all,
so `sessions.sql` sets `statement_timeout = '30s'` at the top of the file. The
block then aborts, its assertions never print, and `run.sh`'s `EXPECTED` count
reports exactly how many were lost. That is the difference between a timeout
and a hang, and it is the only reason the number 73 appears in `run.sh`.

**`closing.sql` 26 — a finding, written as one.** `CLAUDE.md` §5 says `end_time`
moves *"forward only, in 30-second quanta, only inside `place_bid`, and only
together with `extension_count + 1`. Every other shape raises."* On V1 a trigger
in `20260814000000_bid15_closing_and_extension.sql` made that true. **V2 carries
no such trigger.** What protects `end_time` today is the RLS policy asserted in
24–25 — a *permission* boundary, not a shape invariant, and permission
boundaries do not constrain `SECURITY DEFINER` code, which is what every RPC in
this schema is. So 26 asserts what is **true** (a privileged write moves
`end_time` backwards unopposed) rather than what §5 says should be. It is a
passing assertion documenting a gap; the day someone adds the trigger it goes
red, which is the correct moment to delete it.

**`closing.sql` 22 — the only setup in this tree that bypasses the product.**
`place_bid` only ever produces an increasing sequence, so a suite built entirely
from `place_bid` cannot tell `order by id desc` from `order by amount desc` or
`order by created_at desc` — all three agree on every state the product can
reach on its own. The rows are therefore written directly, with an amount and a
`created_at` that **disagree** with the id. That the setup has to bypass the
product is exactly why the ordering is worth pinning: under contention the
product reaches this state by itself.

---

## Contention

`concurrency.sh` runs inside the container: N real client connections, one
auction, no coordination. Four invariants a lost update cannot satisfy:

| | |
|---|---|
| **A** | `bid_count` equals the number of rows in `bids` |
| **B** | `current_price` equals the last bid by `id` |
| **C** | `current_price` equals the maximum amount |
| **D** | amounts ordered by `id` are **strictly** increasing |

**D is the one that catches a lost update.** A and B survive it — the losing
transaction's own update is consistent with its own read. Only the total order
over `id` shows two bidders having seen the same price.

The last line is an **observation, not an assertion**: how often `created_at`
ordering disagreed with `id` ordering. `created_at` defaults to `now()` =
transaction *start*, before the bid queued on the lock, so ordering by it can
render a **decreasing** history — measured at 2 of 12 contended auctions on V1,
and at 4 of 4 on the first V2 run of this file. It depends on scheduling, so a
round where it does not happen proves nothing and must never fail the run.

---

## Two counting rules in `run.sh`, both from measured failures

- **`EXPECTED` per suite.** A `do` block that aborts partway emits neither PASS
  nor FAIL, so counting only PASS/FAIL reports a clean run while assertions
  silently never executed. Keep the numbers in step with the files.
- **`EXPECTED_SUITES`.** A merge conflict resolved by taking one side can drop a
  whole `suite X N` line — dozens of assertions disappear and `SUITE PASSED`
  still prints. That happened twice in one hour on V1 (#112, #114) and was
  caught by reading, not by structure. This is the structure.

The `ERROR:` scan is deliberately **un-anchored**. psql writes
`psql:/t/closing.sql:68: ERROR:  …`, never a bare `ERROR:` at line start; V1
anchored it on `^ERROR: `, matched nothing, and an aborted run printed no cause
at all (#116).

---

## Not covered

**Contention on `place_lot_bid`.** `concurrency.sh` races one *auction*, and
`sessions.sql` proves the lot path's logic one caller at a time. The two have
never met. That matters more here than the assertion count suggests: a live hall
is the one screen in this product where every bidder is looking at the same item
at the same second, so the lot path is where contention is *likeliest*, and it
is the path with no measured evidence under it. The four invariants transfer
unchanged (`bid_count` = row count; `current_price` = last bid by `id`;
`current_price` = max; **amounts by `id` strictly increasing**) — what is
missing is a second worker loop reading
`coalesce(current_price + bid_increment, starting_price)` off `session_lots`,
and a seat in `session_entries` for each worker.

**The screens.** Nothing here renders anything. A green run says the database
refuses what it should refuse; it says nothing about whether the bid button
sends the amount the server would accept. That is `tests/ui/` and `tests/v2/`.

**Realtime delivery.** The migrations add all four tables to the
`supabase_realtime` publication and this suite proves the statement *ran*. It
does not prove a payload arrives, or that it arrives without an email in it —
the second half is structural (§6: email never leaves the auth schema) and check
65 asks it of every notification row rather than of a wire capture.
