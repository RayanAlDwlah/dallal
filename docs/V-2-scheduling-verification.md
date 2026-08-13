# V-2 — Scheduling granularity (executed, not reviewed)

| Field | Value |
|---|---|
| Spike | `ARCHITECTURE.md` §22, V-2 — *"Determine the minimum scheduling frequency available in Supabase. Can a sweep run every ~30 s — directly, or via two offset sweeps?"* |
| Blocks | **R-17** — auction closing (`BID-15`), `FR-END-03` |
| Status | **Executed 2026-08-13 against `dallal-dev` (`cjrnakdigcwnsrvtyqhy`), PostgreSQL 17.6.1.155.** Answer: **sub-minute scheduling is available and accurate.** |
| Method | `pg_cron` 1.6.4 installed on the live project, a probe table stamped with `clock_timestamp()` by the job itself, two schedules measured back to back. Cleaned up afterwards — see §4. |
| Why this exists | `ADR-4` was *"Accepted, pending V-2"*, and §15.6 says in writing that `FR-END-03`'s 30 s must not be quietly relaxed to fit a platform limit. Reading pg_cron's changelog is not the same as watching it fire. |

---

## 1. The answer

**Directly. No offset sweeps needed.**

`ARCHITECTURE.md` §15.6 defines three outcomes in advance. The measured result is
the first row of that table:

> **is available** → Configure a ~30-second sweep. **FR-END-03 met exactly as written.**
> No further discussion. *Who decides: Nobody — it just works.*

`pg_cron` on Supabase accepts an interval schedule written in seconds
(`'30 seconds'`, `'10 seconds'`), not only the five-field cron syntax. The
one-minute floor the spike was written to guard against **does not apply here.**

Mitigation (a) — two sweeps offset by 30 s — is **not needed and should not be
built.** It is two jobs, two failure modes and two things to unschedule, to buy
granularity a single job already has.

## 2. Measurements

Both runs are the same job body — `insert into public.v2_cron_probe default values`
— against a table whose only column defaults to `clock_timestamp()`. The interval
is therefore measured from inside the fired statement, not from `cron.job_run_details`.

### `'30 seconds'` — 16 runs, 15 intervals, ~7 minutes

| | seconds |
|---|---|
| requested | 30 |
| minimum observed | **30.010** |
| maximum observed | **30.276** |
| mean | **30.034** |
| sample standard deviation | 0.067 |

`cron.job_run_details`: **16 succeeded, 0 failed.**

### `'10 seconds'` — 4 intervals

| | seconds |
|---|---|
| requested | 10 |
| minimum observed | **10.014** |
| maximum observed | **10.015** |
| mean | **10.014** |

The second run is what makes the answer *directly* rather than *just barely*: the
scheduler is not merely capable of 30 s, it is accurate well below it. Drift is
tens of milliseconds, and it does not accumulate — each fire is scheduled from the
clock, not from the previous fire.

## 3. What this means for `BID-15`, and the one number worth arguing about

**The sweep period should be 15 seconds, not 30.**

This is engineering inside `FR-END-03`, not a relaxation of it. `FR-END-03` and
`SC-25` give a **30-second budget** from `end_time` to the auction being marked
Ended. An auction's end time falls at an arbitrary point between two fires, so the
sweep's own period is the worst-case latency, not the typical one:

| sweep period | typical latency | **worst case** | inside the 30 s budget? |
|---|---|---|---|
| 30 s | ~15 s | **~30.3 s** + execution time | **no — marginally over** |
| 15 s | ~7.5 s | ~15.3 s + execution time | yes, with room |

A 30-second sweep spends the entire budget on scheduling and overruns it by the
measured 0.28 s of jitter alone. That is not a rounding error to wave through on a
project that writes its numeric requirements down. 15 s costs nothing — the
measurement above shows the scheduler holds 10 s comfortably — and leaves the
budget with headroom for the sweep's own runtime.

**None of this is a correctness question, and it must not be read as one.**
Per `LC-03` and §13 step 4, bid eligibility is decided by `clock_timestamp()`
against `end_time`, **never** by the stored `status` flag. No bid is accepted
after the end time regardless of when the sweep runs. What the sweep period
governs is how fast the *ended presentation* reaches somebody who is not
interacting — and triggers T2 (on-read) and T3 (on-bid-attempt) close that gap the
instant anyone is.

**`pg_cron` is not installed on either project yet.** It is available
(`pg_available_extensions` lists 1.6.4) but `installed_version` is null on both.
Installing it and scheduling the sweep belongs in the `BID-15` migration, where it
is reviewable, replayable onto `dallal-prod`, and visible in the repository —
not typed into a dashboard.

`NFR-MNT-03` requires the closing operation to be invocable directly in a test
environment without waiting real time. That is a property of the function
`BID-15` writes, not of the schedule: the sweep must be a thin `select
close_ended_auctions()` so the same operation can be called by hand. The schedule
must never be the only way to reach it.

## 4. Cleanup — verified, not assumed

Everything this spike created was removed from `dallal-dev`:

```sql
select cron.unschedule('v2-probe-10s');
drop table if exists public.v2_cron_probe;
drop extension if exists pg_cron;
```

Confirmed by direct catalog query afterwards, not by trusting the drop:

| check | result |
|---|---|
| `pg_extension` rows for `pg_cron` | 0 |
| `pg_namespace` rows for `cron` | 0 |
| `public.v2_cron_probe` in `pg_tables` | 0 |
| public tables | `auctions, bids, profiles` |
| public functions | `auctions_guard_update, bid_reject, bids_are_append_only, bids_only_via_place_bid, format_sar, handle_new_user, place_bid, rls_auto_enable, sar_text` |
| public domains | `sar_amount` |
| public views | `bid_history` |

That is exactly the two committed migrations plus Supabase's own
`rls_auto_enable`, and nothing else. `dallal-prod` was never touched by this
spike.

`supabase db diff --linked` was **not** used to confirm that, because it is
currently broken — see `docs/supabase-cli.md`. The catalog query above is the
substitute, and it is the stronger check anyway: it names what is there rather
than what changed.
