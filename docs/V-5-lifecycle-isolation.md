# V-5 — the full lifecycle, run locally and in isolation

| Field | Value |
|---|---|
| Spike | **V-5** (`#28`) — `ARCHITECTURE` §22, §21.4 |
| Owner | Rayan (`@RayanAlDwlah`) |
| Constrains | `NFR-MNT-03` (closing invocable without waiting real time) · `NFR-MNT-04` (full lifecycle runnable locally) |
| Date | 2026-08-14 |
| Verdict | **create → bid → close → winner runs with Docker and nothing else, in 5 seconds. Realtime *delivery* does not, by construction — and that is stated, not worked around.** |

---

## 0. The four acceptance criteria, answered one line each

| AC | Verdict |
|---|---|
| create → bid → close → see the winner **without shared infrastructure** | ✅ `tests/bidding/run.sh` — Docker only |
| **closing invocable directly**, not only by waiting | ✅ `close_ended_auctions()` is a plain function; every closing assertion calls it |
| **realtime works in the local setup** | 🟡 **partially, and the boundary is exact** — see §3 |
| the procedure is **documented** so all three can use it | ✅ this file, plus `tests/bidding/README.md` and `tests/realtime/README.md` |

## 1. What "isolation" turned out to mean here — measured, not asserted

```
$ ./tests/bidding/run.sh 8
    migration == contract, no drift
==> starting PostgreSQL 17
==> applying the Supabase shim (auth schema, auth.uid, PostgREST roles)
==> applying the migrations, then the test-only seed
==> acceptance   25 passed, 0 failed, 25 of 25 assertions reached
==> closing      50 passed, 0 failed, 50 of 50 assertions reached
==> terminal     30 passed, 0 failed, 30 of 30 assertions reached
==> realtime     33 passed, 0 failed, 33 of 33 assertions reached
==> sweep        22 passed, 0 failed, 22 of 22 assertions reached
==> BID-20 concurrency
    BID-20: PASS — 8/8 rounds clean
    BID-03 SC-17/SC-19: PASS — 8/8 rounds clean, 7 genuinely contended
SUITE PASSED
                                                        5.045 s total
```

**160 assertions plus 8 contended concurrency rounds, in 5.0 seconds wall clock, on a
throwaway `postgres:17` container.** No Supabase account. No network. No `.env.local`. No
shared database. Nothing that another developer can be mid-way through breaking.

That is `NFR-MNT-04` met in the strong form: not "a developer can reproduce the lifecycle
if they have credentials", but **a session with no credentials at all can**. It is why the
suite exists in this shape and it is worth saying out loud, because it is unusual.

Two properties of the runner make the isolation *honest* rather than merely convenient:

- **The migrations are the committed files, verbatim, in `supabase db push` order** —
  `01-migration` … `07-bid30`, then `08-seed` last. The seed is applied *separately and
  after* every migration, because it writes `auth.users` with reserved UUIDs, which the
  product never does. A suite that applied its own copy of the schema would keep passing
  while the schema drifted.
- **The contract is diffed against the migration before anything starts.**
  `docs/contracts/BID-02-bid-operation.md` prints the same SQL the migration contains;
  `run.sh` refuses to run if the two have diverged. Two copies of one artefact drift, and
  a suite that tolerates the drift is worse than no suite.

## 2. `NFR-MNT-03` — closing without waiting

`close_ended_auctions()` is an ordinary function, callable directly. Every assertion in
`closing.sql` calls it; none of them waits for a clock. The `expire()` fixture moves
`end_time` *backwards* after a bid has already been accepted, which is how a bid "just
before the end" is proven to count without a clock-injection point.

**`pg_cron` is absent in the container and that is a supported outcome, not a degraded
one.** `run.sh` says so in its own comments: the sweep is a *latency device*. A stack
without `pg_cron` loses timeliness, never correctness. Timeliness itself was measured
against a live project instead — unattended `pg_cron` closing, worst case **14.381 s**
against `FR-END-03`'s 30-second budget.

Three of the seven migrations degrade deliberately on stock `postgres:17` and each
announces it rather than failing: `02-bid15` (no `pg_cron`), `03-auc01` (no `storage`
schema, so no bucket), `05-bid08` (its RLS policy needs `realtime.messages`, which the
shim mirrors, which is what lets `realtime.sql` *assert* the policy is SELECT-only rather
than read that it says so).

## 3. The realtime boundary — where isolation stops, said precisely

**A bare `postgres:17` container has no Supabase Realtime service.** No amount of shim
changes that: Realtime is a separate Elixir process reading the WAL, not a PostgreSQL
feature. So the container proves everything up to the wire and nothing across it.

| | In the container | Where it is proven instead |
|---|---|---|
| the broadcast trigger fires on the right rows | ✅ `realtime.sql`, 33 assertions | — |
| the payload shape and its coverage | ✅ same | — |
| `realtime.messages` RLS is SELECT-only | ✅ same (the shim mirrors the table) | — |
| `RT-R7` — a bid never fails because realtime is absent | ✅ same, and it is the reason this degradation is safe | — |
| the client subscribes and re-reads | ✅ `tests/realtime/live-price-mount.check.mjs`, `ux-rules.check.mjs`, `convergence.check.mjs` — source and model, no network | — |
| **a viewer actually receives it** | ❌ **impossible here** | `#84` (CP-2): two browsers, **16 observations, max 793 ms** against a 2 s Must |
| connection loss is surfaced in 10 s | ❌ needs a live socket | `reconnect.check.mjs` — **7,079 ms**, needs `.env.local` |

**This is the one AC that is not fully met locally, and the substitute is a stated
measurement rather than an assumed equivalence.** A developer working offline gets the
whole product except delivery; delivery has a number, taken on a real deployment, with the
commit and the conditions recorded.

`docs/supabase-projects.md` §81 adds the caveat that matters for anyone re-measuring:
latency on `dallal-dev` is **worse than production**, so a dev measurement is a lower
bound on quality, never the certified one.

## 4. The full inventory — what runs with what setup

**Zero setup. No Docker, no network, no credentials. Under a second each.**

| Harness | Assertions |
|---|---|
| `tests/auth/validation.check.mjs` | 32 |
| `tests/auth/login-path.check.mjs` | 17 |
| `tests/auth/site-url.check.mjs` | 16 |
| `tests/realtime/ux-rules.check.mjs` | 14 |
| `tests/realtime/live-price-mount.check.mjs` | 12 |
| `tests/realtime/convergence.check.mjs` | 20 |
| `tests/integration/excluded-features.check.sh` | 17 |

**Docker only.**

| Suite | Content | Wall clock |
|---|---|---|
| `tests/bidding/run.sh` | 160 assertions + 8 concurrency rounds | **5.0 s** |
| `tests/auth/run.sh` | 65 pure + 22 SQL + display-name concurrency | **4.5 s** |
| `tests/auction/run.sh` | creation, duplicate, immutability | 🔴 **red on `main` — `#147`** |

**Needs `.env.local` and the network** (these are not lifecycle checks; they measure a
live service):
`tests/auth/session.check.mjs` · `tests/auth/identity-e2e.check.mjs` ·
`tests/realtime/reconnect.check.mjs`.

### The one red, named rather than left to be discovered

`tests/auction/run.sh` exits 1 on `main` today:
`ERR_MODULE_NOT_FOUND: Cannot find package '@/lib' imported from lib/auctions/validation.ts`.
`image-type.check.mjs` imports that module, which uses the `@/` alias, and bare Node has no
`package.json` `imports` field or `node_modules/@` symlink to resolve it. Traced to
`a59cadd` (`#136`) with `git log -S`; it is `@m7ya505`'s half (`lib/auctions/`,
`tests/auction/`) and is filed as **`#147`**. **V-5's verdict is scoped around it, not
over it:** the *bidding* lifecycle runs in isolation; the *auction-creation* suite does not
currently run at all.

## 5. A claim in `docs/BID-08-realtime-verification.md` that this spike falsifies

That document (§7) says the probe was left uncommitted *"since this project has no
JavaScript test harness at all"*, and raises adding a runner as shared infrastructure for
the team.

**The first half is now false and the second half resolved itself without a runner.** Ten
`.check.mjs`/`.check.sh` harnesses exist across four directories, and none of them needed
`package.json` to grow a `test` script: each is a file you run with `node`, each prints
`PASS`/`FAIL` lines, and each carries an `EXPECTED` count guard so a harness that aborts
partway cannot exit 0 having asserted nothing. The sentence is corrected in place, dated,
rather than overwritten — a verification document whose claims decay silently is the
defect this project keeps paying for (`#130`, and the `SC-15` row in the `BID-21` table
that read `COVERED` while `grep -rn 'SC-15' tests/` returned nothing).

Whether to *add* a runner remains open and remains shared infrastructure (`TEAM.md` rule
16). This spike does not decide it. It only removes the premise that there is nothing to
run.

## 6. What this spike does not show

1. **That the container's PostgreSQL is byte-identical to Supabase's.** It is stock
   `postgres:17` plus a shim that mirrors `auth`, `auth.uid()`, the PostgREST roles and
   `realtime.messages`. The shim is the assumption; where a behaviour depends on something
   the shim invents, the assertion belongs on a live project instead. The three
   deliberately-degrading migrations are exactly where that line falls.
2. **That realtime delivery works locally.** It does not, it cannot, and §3 says where it
   is measured instead.
3. **A local `next dev` run of the whole product.** Every number here is the test suites.
   The deployed product end to end is `INT-09` (`#91`), and the deployed environment is
   `INT-10` (`#92`).

---

*Measured 2026-08-14 on `main` at `53b0d4b`, macOS, Docker Desktop. Every count and every
wall clock above was executed, not estimated. `tests/realtime/convergence.check.mjs` is on
`feature/rayan-bid10-convergence` (PR `#150`) at the time of writing and is listed at its
merged state.*
