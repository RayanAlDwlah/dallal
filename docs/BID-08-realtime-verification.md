# BID-08 — realtime verification spike

| Field | Value |
|---|---|
| Issue | **BID-08** (#69) — realtime foundation |
| Owner | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah) |
| Ran against | `dallal-dev` (`cjrnakdigcwnsrvtyqhy`), PostgreSQL **17.6**, `@supabase/supabase-js` 2.112.3 |
| Date | 2026-08-14 |
| Status | **Decided — Option B, and implemented.** The open question in §4 was closed by measurement; see §5 |
| Teardown | Verified: 0 published tables, 0 spike tables, 0 spike policies remaining |

`ARCHITECTURE.md` §22 requires verification spikes before implementation. This is one.
Nothing here is a recommendation dressed as a measurement — every verdict below is
the literal output of a subscriber process.

---

## 1. The question

`ARCHITECTURE.md` §14.4 requires realtime privacy to be **structural, not filtered**:

> because RLS applies to realtime subscriptions, and because emails live in the auth
> record rather than in any publicly-readable table, there is no path by which an email
> can reach a subscriber.

`RT-S2` goes further than emails: *"Email addresses, **internal account identifiers
beyond what public display requires**, and any other private data must never appear in
a real-time payload."*

Two things would appear in a naive `postgres_changes` payload on `public.bids`:

- **`bidder_id`** — an internal account identifier. `FR-BID-22a` deliberately omits
  bidder UUIDs from the history projection, so it is *beyond what public display requires*.
- **`amount`** — a `numeric`, serialised as an **unquoted JSON number**. This is issue
  **#103**, in a payload rather than a REST read.

The proposed defence was a PostgreSQL **publication column list** (`PG15+`), which would
keep those columns out of the stream entirely. **That proposal was wrong.** §2 shows why.

---

## 2. Spike 1 — `postgres_changes` **ignores the publication column list**

Scratch table, published as `(id)` only:

```sql
create table public._rt_spike (id int primary key, secret text, amount numeric);
alter publication supabase_realtime add table public._rt_spike (id);
```

PostgreSQL accepted it — `pg_publication_tables.attnames` reads `{id}`, `relreplident` is
`d` (default). Then, from an **anon** browser client:

```
STATUS SUBSCRIBED
EVENT UPDATE keys(new)= ["id","amount","secret"]
  new = {"id":1,"amount":999.99,"secret":"LEAKED-UUID-2"}
  old = {"id":1}
EVENT INSERT keys(new)= ["id","amount","secret"]
  new = {"id":1,"amount":1.2345678901234568e+29,"secret":"LEAKED-EMAIL@example.com"}
  old = {}
VERDICT: COLUMN LIST NOT HONOURED — unpublished columns reached the client
```

**Two findings, both load-bearing.**

**(a) The column list is not a privacy boundary.** `secret` was never published and
arrived anyway. Supabase Realtime uses the publication to decide *which tables* to
stream, then delivers the whole row. Any future session that reaches for a column list
as a defence — as this one did — is wrong, and this is the measurement that says so.

**(b) Money corruption, reproduced end to end.** Inserted:

```
123456789012345678901234567890.99
```

Arrived in the browser as:

```
1.2345678901234568e+29
```

That is `CLAUDE.md` §4 rule 1 and issue **#103**, in a realtime payload. Note it is not a
formatting nuisance — the value is *destroyed* before any code can read it, and Dalal has
**no ceiling** by design (`BR-21`, `SEC-R3`), so large amounts are in scope, not hypothetical.

**Consequence:** with `postgres_changes`, `RT-R6` ("the event is a trigger to re-read,
never a display source") stops being a good convention and becomes the **only** defence.

---

## 3. Spike 2 — Broadcast from database delivers **exactly** the authored payload

`realtime.send(payload jsonb, event text, topic text, private boolean)` exists on the
project. A trigger authors the payload:

```sql
perform realtime.send(
  jsonb_build_object('id', new.id),   -- nothing else. no secret, no amount.
  'changed', 'spike2:' || new.id::text, true);
```

**First attempt, `private => false`: 0 events.** The rows *were* written —
`realtime.messages` held `{"id": 1}`, exactly as authored — but nothing was delivered.
Public broadcast topics are not a delivery path here.

**Second attempt, `private => true`** plus an RLS policy on `realtime.messages` and a
client that calls `supabase.realtime.setAuth()` and joins with `{ config: { private: true } }`:

```
STATUS SUBSCRIBED
BROADCAST {"type":"broadcast","event":"changed","payload":{"id":1},"meta":{...}}
VERDICT: CLEAN — only the trigger-authored payload arrived
```

`secret` and `amount` did not appear, because they were never put in the payload.
This is privacy that is **structural** in the sense §14.4 asks for.

---

## 4. The open decision — both work, and the trade-off is real

| | **A — `postgres_changes`** | **B — Broadcast from database** |
|---|---|---|
| Delivery | ✅ measured | ✅ measured (private + `setAuth()` + RLS) |
| Payload contents | **Every column.** `bidder_id`, `winner_id`, and money as a corrupted JSON number | **Exactly what the trigger writes.** `{auction_id}` and nothing more |
| `RT-S2` | Satisfied only by the client refusing to read the payload | Satisfied structurally |
| #103 in realtime | Present; must be defended by convention | Cannot occur |
| Setup | One `alter publication` | Trigger + RLS policy on `realtime.messages` + `setAuth()` on the client |
| **Cost inside `place_bid`** | **None.** The WAL is read after commit | **An `INSERT` into `realtime.messages` inside the bid transaction** |

**The last row is the one that needs the team's judgement, and it is not a small point.**

`place_bid` holds the auction row lock from `STEP 4` to commit, and every concurrent bid
on that auction queues behind it (`BR-11`, `BR-12`, `ARCH` §13.3). `GITHUB_PLAN` §263
scopes the accepted-bid write set to *"current price on each accepted bid and nothing
else"*. Option B adds a second table write inside that lock. The effect is likely small,
but "likely small" is not a measurement, and this is the one lock in the product where
contention is the requirement rather than an edge case.

### What is NOT in question

Whichever is chosen, **the event is a signal to re-read, never a display source**
(`RT-R6`, `ADR-9`, `BR-22`). The re-read goes through the text path — `bid_history` and a
`::text` select on the money columns — exactly as `lib/auctions/listing.ts` already does.
Spike 1 is the measurement that proves why: the payload's own number is already wrong.

The client API will express this in its type signature — the change callback takes **no
argument**, so no consumer can display payload data even if the payload carries it.

### What §4 said before this section existed

The original recommendation in this file was **Option A**, on the reasoning that A costs
the bid transaction nothing and that the exposure it leaves — `bidder_id` — is already
readable over REST via `bids_public_read` (`using (true)`) plus `grant select on
public.bids to anon`, so `RT-S3` holds and only `RT-S2`'s stricter wording is missed.

That reasoning was sound and it is **superseded**, not withdrawn: it rested on the cost of
B being unknown. §5 measured it. Kept here because a recommendation that was reversed by
data is more useful than one quietly deleted.

---

## 5. The decision — **Option B**, on three conditions, all now met

Chosen by the owner of the bidding behaviour (Rayan) on 2026-08-14, in answer to the
question *which option holds up long-term and can be trusted*. B is the answer only
because the three conditions below were stated **before** it was implemented, and each was
then discharged by measurement rather than by argument.

### Condition 1 — the broadcast can never harm a bid (`RT-R7`, `ADR-9`)

The `realtime.send` call is wrapped in its own `begin … exception when others` block. Any
failure warns and is discarded; the bid transaction is untouched.

Five assertions in `tests/bidding/realtime.sql` §4 exercise this against a shim double
that raises on demand: the bid is still **accepted**, it is **in history**, the **price
advanced**, the event was **lost rather than queued**, and `close_ended_auctions()`
survives the same failure.

> **A finding that changed the code.** `realtime.send` **already swallows its own errors**
> — its body ends in `exception when others then raise warning`. That is not enough, and
> the wrapper is not redundant: it cannot catch a failure of the *call itself*. On a stack
> where the function is absent (`42883`) or the caller lacks `execute` (`42501`), the
> failure happens before any of its handlers exist, and without our block a bid on a
> misconfigured project fails outright. That is the exact `RT-R7` violation this condition
> was written to prevent.

### Condition 2 — the cost inside the lock is measured, not assumed

Same container, same fixtures, alternating A/B by
`alter table public.auctions {enable,disable} trigger auctions_broadcast`.

| Measurement | Trigger **off** | Trigger **on** |
|---|---|---|
| `concurrency.sh 20 8`, three runs | 1.68 / 1.66 / 1.67 s | 1.73 / 1.67 / 1.69 s |
| Messages written during those runs | **0** | **24** |
| 2 000 sequential accepted bids, one auction, median | **221.2 ms** | **240.0 ms** |

The message counts are there because an A/B with no observable difference is
indistinguishable from a toggle that never took effect. It took effect.

**Marginal cost: 9.4 microseconds per accepted bid**, against a ~111 µs per-bid baseline —
about **8%** of an already sub-millisecond operation, and below the run-to-run spread of
the contention harness. `GITHUB_PLAN` §263's concern about a second write inside the lock
is real in principle and, measured, is not a concern here.

Stress at the same time: **BID-20 40/40 rounds clean** with the trigger on, BID-15
contention PASS, 3.35 s wall.

### Condition 3 — if the number had been bad, revert to A

Not triggered. Recorded so it is clear the decision was contingent on the measurement
rather than decorated by it.

### What the implementation measured that the spike had not

Two platform facts, both found by querying `dallal-dev` rather than by reading
documentation, and both of which shaped the migration:

1. **`realtime.messages` has RLS enabled and zero policies** — while `anon` and
   `authenticated` already hold `SELECT`, `INSERT` **and** `UPDATE` grants on it. RLS is
   the second gate, never the first: the grants are what a missing policy leaves standing.
   So the policy we add is `for select` only. A `for all` policy — the reflex shape —
   would combine with the existing `INSERT` grant to hand any anonymous visitor the
   ability to **fabricate** auction events. `tests/bidding/realtime.sql` §5 asserts the
   command is `SELECT` and that an anon insert is refused with `42501`.
2. **A privacy check across a whole corpus, not a sample.** Where it ran matters and the
   first draft of this line did not say: it was the **local test container**, after a full
   `run.sh` plus the 40-round stress, where the shim's `realtime.messages` had accumulated
   every message every bid in the session produced — 18 182 private messages across 141
   distinct auction topics, **0** containing a decimal number.

   Reproduce it: `KEEP=1 ./tests/bidding/run.sh 40 8`, then

   ```sql
   select count(*) filter (where private)                        as private_msgs,
          count(distinct topic)                                  as topics,
          count(*) filter (where payload::text ~ '[0-9]\.[0-9]') as with_decimal
   from realtime.messages;
   ```

   The exact counts move with the number of rounds — what does not move is the last
   column. The same query against `dallal-dev` after §6 returns `7 · 2 · 0`; dev has a
   corpus of seven because nothing but this verification has ever bid there.

### What was built

| Artefact | Role |
|---|---|
| `supabase/migrations/20260814140000_bid08_realtime_foundation.sql` | The trigger, the `RT-R7` wrapper, the SELECT-only policy |
| `tests/bidding/realtime.sql` | 31 assertions — wiring, payload, coverage, `RT-R7`, policy |
| `tests/bidding/lib/supabase-shim.sql` | A `realtime.send` double that can be made to fail |
| `lib/realtime/auction-channel.ts` | The subscription, with a change callback that takes **no argument** |
| `lib/realtime/use-auction-channel.ts` | The React binding — `status` plus a `revision` that is a dependency, not data |

The no-argument callback survives from §4's "what is NOT in question", and matters more
under B rather than less: the payload is now clean, so the temptation to read it is
larger. There is still nothing in it to read, and `RT-R6` is enforced by the type
signature rather than by a reviewer remembering it.

---

## 6. End-to-end delivery, on the deployed migration

§3 proved that `realtime.send` can deliver. This section proves that **this migration**
delivers, on `dallal-dev`, through the real trigger and the real policy, to a client
holding nothing but the anon key.

`supabase db push` applied `20260814130000` and `20260814140000`. Verified in place
afterwards:

```
trigger_def      CREATE TRIGGER auctions_broadcast AFTER UPDATE ON public.auctions
                 FOR EACH ROW EXECUTE FUNCTION auctions_broadcast_change()
policy on realtime.messages   1, cmd = SELECT, roles = {anon,authenticated}
published tables (auctions|bids)   0
```

Two auctions were created and a **signed-out** subscriber — `createClient(url, anonKey)`,
`realtime.setAuth()`, `channel(topic, { config: { private: true } })`, event
`auction_changed`, i.e. the parameters `lib/realtime/auction-channel.ts` uses — joined
both topics before either auction was written.

| t | What happened in the database | Delivered to the anon subscriber |
|---:|---|---|
| 3.9 s / 4.6 s | — | `SUBSCRIBED` on both topics |
| 29.3 s | `place_bid` accepted `137.25` on **A** | **1 event** |
| 65.0 s | **B** reached its end time and `pg_cron` swept it — nobody was watching the server | **1 event** on B |
| 117.2 s | `place_bid` accepted `150.00` on **A** with **4.1 s remaining** | **2 events**, same millisecond |
| 155.3 s | `pg_cron` closed **A** with a winner | **1 event** |

**Five events, all delivered, none missed.** Three findings worth naming:

1. **`SUBSCRIBED` at 3.9 s with no session at all.** The `for select … to anon,
   authenticated` policy is what authorized it, and `SC-75`'s signed-out visitor is
   therefore a first-class subscriber rather than an afterthought.
2. **The 117.2 s pair is the documented duplicate, observed.** A bid inside the final 15
   seconds writes the auction row twice — `bids_extend_end_time`, then `STEP 9` — and both
   events arrived in the same millisecond. `extension_count` went 0 → 1 and `end_time`
   moved forward exactly 30 s. This is the behaviour §2 of the migration refuses to
   de-duplicate, and `FR-RT-09` / `RT-R5` require it to be harmless: it is, because
   re-reading twice yields the same state.
3. **`pg_cron` is the publisher for both closings.** The events at 65.0 s and 155.3 s had
   no HTTP request behind them — the sweep runs every 15 s on dev. `FR-RT-05`'s "the
   viewer learns the auction ended without refreshing" holds on the unattended path, which
   is the only path that matters at an auction's end.

Final state: **A** `ended`, `extension_count` 1, `final_price` `150.00`, winner
`bid08_bidder`. **B** `ended` with no bids, no winner, `final_price` null.

Privacy over every message written to an `auction:%` topic on dev:

| Check | Count |
|---|---|
| Messages on auction topics | 7 |
| Not `private` | **0** |
| Payload containing a decimal number | **0** |
| Payload containing `@` | **0** |
| Payload key other than `auction_id` (and the platform's own `id`) | **0** |

### What this does not prove, stated so nobody reads it as more

- The subscriber is a **Node** client, not a browser. It is the same `supabase-js`
  transport with the same channel options, so it proves the database → Realtime → client
  path. Delivery to a **real browser** anon client was proven separately in §3.
- The bids were placed through `place_bid` with the session identity set at the SQL layer,
  not through PostgREST with a signed-in user. `place_bid` reads `auth.uid()` either way,
  and the REST path belongs to `BID-09` and to the auth issues.

### A document this spike contradicts — surfaced, not silently corrected

`CLAUDE.md` §2 requires a contradiction between documents to be raised rather than
resolved in code. This spike produces one, and it is in the very paragraph §1 quotes.

`ARCHITECTURE.md` §14.4 says privacy in payloads is structural, and gives the reason:

> This is satisfied **structurally**, not by filtering: because RLS applies to realtime
> subscriptions, and because emails live in the auth record rather than in any
> publicly-readable table (§9.2), there is no path by which an email can reach a
> subscriber. A policy mistake would have to grant read access to a table that does not
> contain the data.

**The conclusion is right and the reason given for it is not sufficient.** §14.4 reasons
only about *emails*, and `RT-S2` covers more than emails — "internal account identifiers
beyond what public display requires". `bidder_id` is exactly that, it lives in
`public.bids`, and `public.bids` **is** publicly readable (`bids_public_read`,
`using (true)`). So under `postgres_changes` the sentence "a policy mistake would have to
grant read access to a table that does not contain the data" does not hold: no policy
mistake is needed, because the policy that already exists is correct and permissive by
design. §2 of this document is the measurement — an unpublished column reached an anon
client.

After this change the conclusion holds again, for a different reason: the payload is
authored by a trigger and contains one auction id. Not *"RLS keeps the private column
away from the stream"*, but *"the private column is never in the stream"*.

**Recommended amendment to `ARCHITECTURE.md` §14.4** — for the team to take, not for this
PR to slip in: keep the "structural, not by filtering" claim, replace the justification
with the trigger-authored payload, and keep the email sentence as the second, narrower
guarantee it always was. Raised here rather than edited, because §14.4 is shared ground
and `CLAUDE.md` §2 says the surfacing is the required action.

### Footprint left on dev

Two auctions named `BID-08 · …` (both `ended`), two `@test.local` profiles
(`bid08_seller`, `bid08_bidder`), and two bids. Bids are append-only for everyone
(`BR-05`), so they stay. Nothing was left running and nothing production-shaped was
changed.
