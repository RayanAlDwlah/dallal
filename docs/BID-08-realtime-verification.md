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
| `tests/bidding/realtime.sql` | 33 assertions — wiring, payload, coverage, `RT-R7`, policy |
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

**Amendment to `ARCHITECTURE.md` §14.4 — raised here, then taken.** It was first written up
as a recommendation for the team, because §14.4 is shared ground and `CLAUDE.md` §2 makes
surfacing the required action. **The project owner then approved it directly (2026-08-14)
and asked for it to be applied in this PR rather than deferred**, so §14.4 now keeps the
"structural, not by filtering" claim, rests it on the trigger-authored payload, keeps the
email sentence as the second and narrower guarantee it always was, and **quotes the old
wording with the reason it was insufficient** rather than deleting it. Two neighbouring
sections were corrected in the same pass, for the same reason — they described a mechanism
this PR replaces:

| Section | Was | Now |
|---|---|---|
| §14.1 | *"Supabase Realtime detects the committed change"* — CDC by implication | Names the trigger, names the re-read, and states that neither table may join the `supabase_realtime` publication |
| §14.3 | Source column read as *what arrives*; "New bid in history ← **Bid insert**" | Renamed to *what fires the event*; one `auctions` UPDATE wakes every row, and the BR-36 end-time move is listed as its own row |
| §14.4 | Justified only by emails; `bidder_id` fell through the gap | Justified by the payload's contents; emails retained as the narrower second guarantee |

The approval is recorded here so a reviewer can check the decision, not just the diff —
these are edits to a shared document made from a bidding branch, and that is exactly the
shape that should be questioned by default.

### Footprint left on dev

Two auctions named `BID-08 · …` (both `ended`), two `@test.local` profiles
(`bid08_seller`, `bid08_bidder`), and two bids. Bids are append-only for everyone
(`BR-05`), so they stay. Nothing was left running and nothing production-shaped was
changed.

---

## 7. What an adversarial review found **after** all of the above

Everything in §1–§6 had been done, the suite was green, `/code-review` had run on both
axes, and the work was committed and pushed. Then the question was asked directly: *is
this actually at a professional standard?* The honest way to answer it is not to re-read
one's own work agreeing with oneself — it is to hand it to reviewers whose brief is to
**find defects**, and to check every claim they make against the installed library source
rather than against memory.

Two reviewers ran, one on the client transport and one on the SQL and the policy. **Four
findings were real. One of them was critical, and it had shipped.**

### 7.1 CRITICAL — a reconnect restored the word "live" and nothing else

`ARCHITECTURE.md` §14.5 lists this as a **Must**:

> Reconnected → **Resynchronize to authoritative current state** — re-read price, history,
> status. Do not resume from the last-seen event — FR-RT-12, RT-R3

The first version did not do it. `subscribe()`'s callback only reported status, so the
sequence `CHANNEL_ERROR → auto-rejoin → SUBSCRIBED` moved the badge back to `"live"` and
never moved `revision`. A viewer who lost the network for ten seconds during an endgame
kept the pre-drop price **permanently**, under a badge telling them it was current.

That is worse than showing no data. Missing data is visible; stale data wearing a fresh
badge is not, and this product's entire realtime contract (`RT-R6`, `BR-22`) rests on the
client re-reading.

**Verified before fixing, in the installed packages rather than from memory:**

| Question | Answer | Where |
|---|---|---|
| Does `SUBSCRIBED` re-fire on a rejoin, or only on the first join? | **Re-fires.** Phoenix resends the join push, and `Push.reset()` clears the ref and the response but **not** `recHooks` — so the `'ok'` hook runs again | `@supabase/phoenix/assets/js/phoenix/push.js:73`, `:37` |
| Is a token expiry a second, separate hole? | **No.** `supabase-js` registers an auth listener at construction and pushes refreshed tokens to live channels | `@supabase/supabase-js/dist/index.mjs:673`, `:836`, `:841` |

The fix: **every successful join calls `onChange`.** On the first join too — the page is
read on the server and the channel joins a second or two later, so a bid landing in that
window was previously never signalled at all. Re-reading when nothing changed is free by
construction (`FR-RT-09`, `RT-R5`), which is what makes this affordable.

### 7.2 HIGH — the comment asserted the behaviour the code lacked

`use-auction-channel.ts` said, of `revision`: *"and a reconnect re-reads without moving
it."* Nothing made that true.

This is worth naming rather than quietly deleting, because it is **the defect this project
keeps producing** — prose that asserts a behaviour nobody implemented, in a codebase whose
comments are long enough to be trusted. A reviewer reading that sentence had no reason to
check. The replacement comment says what happens *and* records what the old one claimed.

### 7.3 HIGH — the page's own architecture broke the transport

`supabase-js` returns the **same** channel object for a repeated topic
(`RealtimeClient.js:329-338` — `getChannels().find(...)`, and `return exists`). The first
version created a channel per caller and tore it down on unmount, so **the first component
to unmount called `removeChannel` and killed delivery for every other component watching
the same auction** — which then sat on `"live"` receiving nothing. §7.1's failure mode
again, by a different route.

This is not an edge case: `ARCHITECTURE.md` §14.6 puts the price region, the bid control,
the history and the outcome banner in **separate components on one auction page**, and
several are marked "Subscribed". The naive version was broken for the documented layout.

Now one reference-counted watch per auction id fans out to every subscriber, the channel
is torn down when the **last** one leaves, and a subscriber arriving after the join is told
the current status on a microtask instead of sitting on `"connecting"` forever.

### 7.4 MEDIUM — a test that could not fail the way its own comment described

The sweep assertion read:

```sql
(pg_temp.rt(v_a) + pg_temp.rt(v_b) - 2) = 2
```

with a comment explaining that it guards against a de-duplication flag announcing the
first auction and dropping the rest. It does catch **that** shape. It does not catch a
sweep that announces `v_a` twice and `v_b` not at all — that also sums to 2, and every
viewer of `v_b` is left on an ended auction reading as live. **A total is not a coverage
check.** It is now two per-auction deltas.

### 7.5 MEDIUM — a broadcast could still roll back a bid

`when others` does not catch `query_canceled` (57014), which is what `statement_timeout`
raises. `realtime.messages` is a partitioned table this project does not own, written by
every trigger on the stack, and the INSERT into it happens **inside `place_bid`'s
transaction while the auction row is held**. A lock wait there would have run until the
statement timeout fired — and rolled back an accepted bid because a broadcast was slow.
That is the exact inversion `RT-R7` exists to forbid, and the original comment
characterised it as working as intended.

`set lock_timeout = '50ms'` on the function turns that case into `lock_not_available`
(55P03), an ordinary error the handler catches. It is a **function-level** setting, not a
`set local` in the body, so PostgreSQL restores the previous value on exit and
`place_bid`'s own locking does not inherit it. 50 ms against a measured 9.4 µs cost is a
~5000× margin.

**Stated as a narrowing, not a closure.** A `statement_timeout` expiring mid-INSERT for a
reason that is not lock contention still aborts the transaction, and nothing available in
PL/pgSQL can catch that. `RT-R7` is now much harder to violate; it is not unconditional.

### 7.6 Reviewed, considered, and deliberately NOT changed

**The `auction:%` policy predicate makes the whole prefix anon-readable.** A reviewer
proposed narrowing it to `dalal:auction:%`. Declined, and the reasoning is recorded in the
migration: renaming the namespace does not change the property, because the next person to
add a topic adds it under the new prefix just as readily. What the rename would buy is the
*appearance* of a structural fix for something that is a **convention** — and dressing a
convention as structure is the specific criticism §6 makes of the old §14.4. So it is
labelled a convention instead: *the `auction:` namespace is public-read by policy; never
publish anything to it that is not already public.* Today one writer with a content-free
payload enforces it, and `tests/bidding/realtime.sql` §2 pins the payload.

**Subtransaction cost.** Every `BEGIN/EXCEPTION` in PL/pgSQL opens a savepoint, and
subtransaction pressure is a real PostgreSQL production hazard. At this workload it is not
one: the measured marginal cost is 9.4 µs and the platform is a demonstration. Recorded so
that whoever does run this at thousands of bids per second knows where to look first.

### 7.7 NFR-RT-01 — the requirement that had no evidence at all

`NFR-RT-01` requires delivery **within 2 seconds**, and §5/§6 never measured it. §6 proved
that events arrive; it did not prove *when*. That gap is on the same list as the others:
a Must with no number against it.

#### The first two attempts were thrown away, and why that matters

The obvious method is to compare `realtime.messages.inserted_at` — stamped by the database
— against the local time the event lands, correcting for clock skew estimated from the
PostgREST `Date` header. Two runs three minutes apart gave **≈0.3 s** and **≈3.2 s** for
the same kind of event.

The tempting move is to report the good one. The correct move is to notice that the `Date`
header has **one second of resolution — half the entire budget being measured** — and that
`cron.job_run_details` shows the producing transaction lasting **4–20 ms**, so the system
was not what varied. A ruler whose error bar is wider than the thing it is checking cannot
check it. Both runs were discarded. **Neither number appears in this document as a
result**, and the 3.2 s figure in particular is not evidence of a problem.

#### The method that replaced them — one process, one clock

No clock is crossed at all. A single Node process holds three clients:

| Client | Role |
|---|---|
| `viewer` — anon | subscribes to `auction:<id>` exactly as `lib/realtime/auction-channel.ts` does. **This is the party `NFR-RT-01` is about** |
| `bidder` — authenticated | calls `place_bid` through PostgREST, the real path |
| `seller` — authenticated | creates the auction through the real `auctions_owner_insert` policy |

Three timestamps, all from the same `Date.now()`:

- `t0` — immediately before the `place_bid` request leaves
- `t_commit` — when the RPC response arrives, i.e. when a client could first know the bid exists
- `t_event` — when the broadcast lands on the viewer

**`total = t_event − t0`** is the number held against the budget, because it is the one
that cannot flatter the system: the request, the row lock, the commit and the fan-out all
fall inside it. `after_commit = t_event − t_commit` is reported alongside to show where
the time actually goes.

#### Result — 10 real bids on one auction

```
bid  11.00  rpc  348 ms  total  461 ms  after-commit   113 ms  accepted=true
bid  12.00  rpc  290 ms  total  310 ms  after-commit    20 ms  accepted=true
bid  13.00  rpc  285 ms  total  315 ms  after-commit    30 ms  accepted=true
bid  14.00  rpc  287 ms  total  309 ms  after-commit    22 ms  accepted=true
bid  15.00  rpc  293 ms  total  313 ms  after-commit    20 ms  accepted=true
bid  16.00  rpc  443 ms  total  442 ms  after-commit    -1 ms  accepted=true
bid  17.00  rpc  272 ms  total  291 ms  after-commit    19 ms  accepted=true
bid  18.00  rpc  316 ms  total  348 ms  after-commit    32 ms  accepted=true
bid  19.00  rpc  552 ms  total  469 ms  after-commit   -83 ms  accepted=true
bid  20.00  rpc  299 ms  total  316 ms  after-commit    17 ms  accepted=true
```

| n = 10 | min | p50 | max | budget |
|---|---|---|---|---|
| **`total`** — bid submitted → another viewer is told | **291 ms** | **316 ms** | **469 ms** | 2000 ms |
| `after_commit` — fan-out alone | −83 ms | 20 ms | 113 ms | — |
| `rpc` — round trip to PostgREST, for scale | 272 ms | 299 ms | 552 ms | — |

**`NFR-RT-01` passes, with the worst case at 23 % of the budget.**

Two of the ten `after_commit` values are **negative**: the broadcast reached the viewer
*before* the bidder's own HTTP response came back. That is not an anomaly to explain away
— it is the shape of the answer. Delivery is not the cost here; the round trip to the
region is, and it dominates `total` by roughly 15×. The realtime path contributes tens of
milliseconds.

#### What this measurement does not claim

- **One client, one network, one region, ten samples.** It is not a percentile under load,
  and `NFR-RT-02`'s twenty concurrent viewers were measured separately in §5, not here.
- **It is an upper bound, not a decomposition.** `total` contains the commit; the fan-out
  is smaller than any number in that column.
- **It says nothing about a degraded network** — which is precisely why §7.1 exists. The
  reconnect re-read is what covers the case this measurement cannot reach.

The probe is throwaway and lives outside the repository; it is reproduced in the PR
discussion rather than committed, since this project has **no JavaScript test harness at
all** (see below).

#### A gap this raised, for the team rather than for me

`package.json` has `dev`, `build`, `start`, `lint`, `typecheck` — and no test runner. The
SQL side has a real suite (`tests/bidding/run.sh`, 33 assertions in `realtime.sql` alone);
the TypeScript side has none, so `auction-channel.ts` — where the critical defect was —
is verified by throwaway scripts and reading. Adding a runner is **shared infrastructure
that lands on all three developers**, so it is raised here rather than decided from a
bidding branch. `TEAM.md` rule 16 applies to tooling the same way it applies to product.

#### Footprint left on dev by §7

On `dallal-dev` only — nothing touched `dallal-prod`:

| What | Count | Note |
|---|---|---|
| `bid08-lat-*@dallal.test` accounts | 4 | two from a first attempt that failed on `profiles.display_name`'s UNIQUE constraint before creating anything |
| Auction `BID-08 latency probe` | 1 | `6046f85e`, `image_path` points at no object; closes itself via `pg_cron` at its `end_time` |
| Bids | 10 | `11.00` … `20.00` |
| Schema changes | 0 | the only DDL was `alter function place_bid … set lock_timeout`, which is the §7.5 fix and is in the migration |

Left in place rather than deleted, for the same reason §6's footprint was: bids are
append-only for everyone (`BR-05`), and removing them as `postgres` would exercise a path
the product does not have. Nothing is left running.

