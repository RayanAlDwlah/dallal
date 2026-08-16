# S0-11 — The Auction Record Contract · عقد سجل المزاد
### Rayan's half — what bidding needs from the auction record

| Field | Value |
|---|---|
| Issue | **S0-11** — "Agree the auction record contract" (`GITHUB_PLAN.md:263`) |
| Record owner | **Mohammed** (`@m7ya505`) — he owns the table, the DDL and the access path (`TEAM.md` §4, §9.3) |
| Consumer | **Rayan** (`@RayanAlDwlah`) — bidding, current price, closing, winner |
| Status | 🟡 **موقَّع جزئيًّا — عشرة من اثني عشر**، مسجّل في مراجعة @m7ya505 على #132 (2026-08-14) — وهي الأثر القابل للاستشهاد بحكم §10.4. صندوق مرفوض بوعي (§3.2 عرض العدّ). **صندوقان مفتوحان:** §2 ⚠️ حتى يُغلق #140، و§4 حتى تُعاد صياغته (§10.1a) |
| Date | 2026-08-12 · endorsement evidence recorded 2026-08-13 · **amended 2026-08-14 for the `BR-36` reversal — see the box below** |
| Depends on | `S0-12` (money type, FINAL) · `S0-10` (identity contract, Abdulrahman) |
| Consumed by | `BID-01`, `BID-02`, `BID-05`, `BID-15`, and Mohammed's `AUC-08`/`AUC-14`/`M-10` |

> ## ⚠️ Amendment 2026-08-14 — **do not sign the pre-amendment version**
>
> `BR-36` was **reversed on 2026-08-13**: a bid accepted in the final 15 seconds now extends
> `end_time` by exactly 30 seconds, to a hard cap of 20. This document was written on
> **2026-08-12**, one day before, and said in §4 *"I write nothing else to `auctions`,
> ever."* That sentence was true when written and has been **false since `20260814000000`
> landed**.
>
> Three things changed, and all three are in the half of the record **you** rely on:
>
> 1. **I write two more fields** — `end_time` and `extension_count` (§4, third row).
> 2. **`end_time` is no longer a creation-time constant** (§2, field 3). Signing the old
>    §4 would have entitled you to assume it was — and `CLAUDE.md` §5 says an implementation
>    built on that assumption breaks the counter.
> 3. **A column was added to your table by my migration** — `extension_count`, with its cap
>    as a `CHECK` constraint (§4.2). You own the DDL of `auctions` (§ header). You were
>    never asked. That is disclosed here rather than left for you to find.
>
> **None of this is a security defect.** The writes happen under `place_bid`, which is
> `SECURITY DEFINER`, and `authenticated` is revoked from `UPDATE` on `auctions`
> (`20260812120000:536`). The defect is one of **disclosure**: §4 is an inventory you read
> to know what moves under your hands, and it had gone stale.
>
> **Two new boxes in §8 cover the amendment.** Nothing in it is agreed until you tick them.

> **Citation correction — applied.** The S0-11 issue text cited "ARCHITECTURE §10.3" twice.
> `ARCHITECTURE.md:605` §10.3 is **Password reset**. The auction-record material is in
> `TEAM.md` §10.3, `ARCHITECTURE.md` §9.3–§9.4, and `ARCHITECTURE.md` §19.3, and
> `GITHUB_PLAN.md` S0-11 now points there. Once this document is agreed it becomes the
> single citable location, so no session has to follow the broken pointer again.

---

## 1. What S0-11 is, and what it is not

S0-11 is **a data contract, not code.** Its acceptance criteria contain no line asking for
an implementation. Mohammed writes the DDL; this document states what bidding reads, what
bidding writes, and what must never change without telling me first.

The plan lists S0-11 as depending on `S0-07` (the scaffold). That dependency is wrong: a
field agreement does not need a Next.js app to exist. **Do not wait for S0-07 on my
account** — this document is deliverable today and `S0-07` is now pushed anyway.

---

## 2. The seven read fields — frozen

*Six until 2026-08-13. The seventh arrived with the `BR-36` reversal.*

These are the fields the bid operation reads. All seven are read **inside the per-auction
row lock** (`ARCHITECTURE` §13.2 steps 2–3); anything read before the lock is stale by
definition and is used only to distinguish a race from a too-low bid.

| # | Field | Why bidding needs it | Requirement |
|---|---|---|---|
| 1 | **auction id** | the row to lock | §13.2 step 2 |
| 2 | **owner identifier** | the owner may never bid | `BR-02`, `FR-BID-03` |
| 3 | **end time** | eligibility, compared to the **server clock** — and **since `BR-36`'s reversal I also *write* it**, see §4 | `BR-04`, `LC-03`, `FR-BID-18`, `BR-36` as amended |
| 4 | **starting price** | the first bid's threshold, **inclusive** | `BR-28`, `BR-29`, `SC-55` |
| 5 | **current price** | every later bid's threshold, **strictly greater** | `BR-03`, `BR-28`, `SC-56` |
| 6 | **status** | see §5 — *not* an eligibility input | `LC-03` |
| 7 | **extension count** | *(new, 2026-08-14)* whether the anti-sniping cap is reached — the extension is skipped at 20 | `BR-36` as amended |

Field 7 is read by `bids_extend_end_time()` (`20260814000000:186`), which is part of the
bid operation: it is an `AFTER INSERT` trigger on `bids` that fires **inside `place_bid`'s
transaction**, and it re-reads the auction row `FOR UPDATE` — the same lock `place_bid`
already holds. So it is in the read set for the same reason the other six are.

**Field 3 needs one sentence of its own, because its character changed.** Before
2026-08-13, `end_time` sat with `owner_id`, `starting_price` and `created_at` in the
immutable-creation-terms list, and any update to it raised. It is now **conditionally
mutable** through exactly two doors: (1) inside `place_bid`, forward only, in 30-second
quanta, and only together with `extension_count + 1` — four conditions, all required,
enforced by `auctions_guard_update()` (`20260814000000:113`); or (2) inside the
pause/resume operation (`resume_session()`), which moves `end_time` forward by the
exact wall-clock interval the session was paused, and never touches `extension_count`.
Every other shape still raises. `CLAUDE.md` §5 records both doors as the governing rule.

> **⚠️ Superseded in part on 2026-08-15 — the word to distrust in the paragraph above is
> "only".** The owner decided that **pause is supported**: a host-only atomic operation
> moves `end_time` **forward by the paused duration**. `CLAUDE.md` §5 records it and
> governs — *"the sentence «only inside `place_bid`» is now «inside `place_bid`, **or**
> inside the pause/resume operation»"*. There are **two doors**, not one.
>
> **What did not move:** `end_time` is still **forward only**, under any mechanism, by any
> caller, ever. `place_bid` still owns extension — the 30-second quantum, the
> `extension_count + 1` lockstep and the `CHECK`-constrained cap of 20 are untouched, pause
> never increments `extension_count`, and an extension never records paused time. So of the
> four conditions above, **all four still describe the `place_bid` door exactly**; what is
> wrong is the claim that it is the only door.
>
> **This clause is deliberately not rewritten into its final form, and that is a statement
> about what is decided rather than about effort.** Pause is V2 work
> ([`D-03`](../decisions/D-03-sessions.md)), and two questions it depends on are open:
> **`O4`** — is a lot an `auctions` row with a nullable `session_id`, or a separate entity?
> — and **`O33`** — does pause take a *lot* or the *session*? Until those are answered this
> contract cannot honestly say which table, which column or which id the second door writes
> to, and a plausible guess here would be exactly the invented product decision `TEAM.md`
> rule 16 forbids. **Whoever answers `O4` and `O33` amends this paragraph in the same PR**,
> following `§10.3`'s precedent.
>
> Read this the way `§7`'s blockquote asks you to read the row that left it: a document
> still saying `end_time` moves through one door predates 2026-08-15, and `CLAUDE.md` §5
> governs over it. **Do not "restore" the single-door wording on the strength of an older
> copy** — including on the strength of the unamended paragraph directly above.

> **What this costs you.** Any surface that treats `end_time` as fixed after render — a
> countdown seeded once at mount, a cached "ends at" string, a `revalidate` window derived
> from it — will drift on a contested auction. The countdown is presentation, so it is
> yours; the fact that the number underneath it moves is mine to declare, and this is that
> declaration.

### 2.1 Resolving the "sixth field" conflict — please read this one

*(The "sixth" here is the sixth item of the three **external** lists below, all of which
predate the amendment and all of which have six items. The numbering in §2's own table is
now 1–7 and does not affect this argument.)*

Three documents state this list three different ways:

| Source | Sixth item |
|---|---|
| `GITHUB_PLAN.md:263` | **current price** |
| `TEAM.md:421` (§10.3) | *"whether the auction exists"* — current price absent |
| `TEAM.md:372` (§9.3) | *"existence of the auction"* — current price absent |

And `TEAM.md` contradicts itself three lines above its own list: `TEAM.md:369` says
*"BR-03 (bid must be higher) needs **the current price and starting price**."*

**Proposed resolution: `GITHUB_PLAN.md:263` is right, and "existence" is not a field.**
Existence is the *outcome of the id lookup* (`ARCHITECTURE` §13.2 step 4), not a column —
a row is there or it is not. Current price, by contrast, is a column that `BR-03`,
`ARCHITECTURE.md:831`, `ARCHITECTURE.md:953` and `ARCHITECTURE.md:1295` all require.

If instead we froze the `TEAM.md:421` list literally, Mohammed's access path would not
have to expose current price at all — and `BR-03` would become unimplementable through the
sanctioned path, forcing me either to write my own auction query (forbidden by `TEAM.md`
§9.3) or to go around the contract. That is why this one matters more than it looks.

---

## 3. The has-bids question — and it is **two** questions, not one

`BR-28` gives the amount rule two branches:

- **no bids yet** → `amount >= starting_price` (inclusive — `BR-29`, `SC-55`)
- **has bids** → `amount > current_price` (strictly greater — `BR-03`, `SC-56`)

So something must say which branch applies. **No frozen field list in any of the four
documents contains that fact.** The phrase "bid count" appears exactly **once** across
`PRD.md`, `ARCHITECTURE.md`, `TEAM.md` and `GITHUB_PLAN.md` — inside a diagram box at
`ARCHITECTURE.md:817` — and in no contract, no field list, and no ownership table.

And price equality cannot substitute for it. `TEAM.md:595` (M-09) sets
`current_price = starting_price` at publication, so `current_price == starting_price` is
true **both** before any bid **and** immediately after `SC-55`'s first equal bid. A
function comparing only `amount > current_price` rejects a 100 SAR bid on a 100 SAR
starting price — and `SC-55` says it must be accepted. **This is the first acceptance
test in bidding, and the documents as written fail it.**

### 3.1 Write path — mine, and it needs nothing from you

The bid operation derives it in-transaction from the bid table, inside the same row lock
it already holds. This is implemented and **verified against PostgreSQL 17.10**
(`docs/contracts/BID-02-verification.md`): 12 rounds × 8 simultaneous connections, exactly
one acceptance per round, every round.

**No seventh column. No `bid_count`. No `has_bids`. No nullable `current_price`.**
Three independent designs and the implementation all converged here, and it is the only
option that requires **zero** changes to any of the four documents — notably not to
`GITHUB_PLAN.md:263`'s *"Rayan writes current price on each accepted bid **and nothing
else**"*, which a stored counter would violate.

### 3.2 Read path — yours, and this is the open item

Your `design/lib/money.ts` already declares:

```ts
export interface AuctionPrice { readonly bidCount: number; }
minimumAcceptableBid = a => a.bidCount === 0 ? {inclusive: true} : {inclusive: false}
```

You are right to need it — `FR-DETAIL-06` and `FR-LIST-03` require the detail page and
every listing row to distinguish *"Starting price: 100 SAR (no bids yet)"* from
*"Current bid: 250 SAR"*. My in-lock derivation solves the write path and **gives your
pages nothing**.

**Proposed: your read path exposes it, derived — never stored.** A `bid_count` (or
`has_bids`) computed in the view/RPC you already own, so the fact still has exactly one
authoritative home (the bid table, `ARCHITECTURE.md:493`) and cannot drift. I own the bid
table; if you would rather I expose a counting view for you to join, say so in §8 and I
will build it. What I am asking you *not* to do is add a stored column to `auctions`.

---

## 4. What I write to the auction record — exhaustively

Quoting `TEAM.md:376–381` as the definitive statement, because `TEAM.md:373` three lines
above contradicts it by saying I *"never write to the auction record except… at close"* —
which read literally forbids the per-bid current-price update that `BR-13` requires.

| When | Fields I write | Nothing else |
|---|---|---|
| **On each accepted bid** | `current_price` ← the accepted amount, in the same transaction as the bid insert (`BR-07`, `BR-13`, `SC-40`) | — |
| **On an accepted bid inside the final 15 seconds** *(new, `BR-36` as amended)* | `end_time` ← `end_time + 30 seconds`, **and** `extension_count` ← `extension_count + 1`, in the same statement — skipped once `extension_count` reaches 20 | — |
| **At close** | `status`, final price, winner, close time (`FR-END-08`, `BR-06`) | — |

I write nothing else to `auctions`, ever.

**Three occasions, not two — and that number changed on 2026-08-13.** The middle row did
not exist when this document was written; `BR-36` had not yet been reversed, and this
section said in so many words that there were two. If you are reading a copy of this
contract that lists two, it predates the reversal and `CLAUDE.md` §5 governs over it.

> **⚠️ And it is about to change again — a fourth occasion is decided but not yet
> writable.** The pause decision of 2026-08-15 (`CLAUDE.md` §5, [`D-03`](../decisions/D-03-sessions.md))
> puts a **second writer on `end_time`**: a host-only atomic pause/resume moving it forward
> by the paused duration. That falsifies the sentence *"I write nothing else to `auctions`,
> ever"* above — **not because my write set grew, but because the set of writers did.**
>
> The distinction matters for what you are being asked to sign. Everything §4 promises about
> **my** three occasions still holds exactly: I still write `current_price` per accepted bid,
> `end_time`+`extension_count` on an in-window accepted bid, and the four close fields, and
> nothing else. What is no longer true is the *implied exclusivity* — that the three rows in
> that table are the only ways `end_time` ever moves. **A surface of yours that treats the
> table as exhaustive over writers, rather than exhaustive over mine, will be wrong.**
>
> As in `§2`, the concrete row is not written yet because **`O4`** (is a lot an `auctions`
> row?) and **`O33`** (does pause take a lot or the session?) are open — and if `O4` resolves
> to *separate entity*, the fourth occasion may not touch `auctions` at all and this table
> stays literally correct with only its exclusivity claim narrowed. Deciding that here would
> be deciding `O4` in a contract, which is not where it gets decided.

Two properties of the middle row are worth stating here rather than leaving in the
migration, because they are what make it safe for you to sign:

- **It is not a third write path.** It is an `AFTER INSERT` trigger on `bids`
  (`bids_extend_end_time`, `20260814000000:197`) firing inside `place_bid`'s transaction,
  under the lock `place_bid` already holds. A bid and its extension commit together or
  neither does. There is no way to extend an auction without accepting a bid on it.
- **A rejected bid never extends.** The trigger is on `INSERT`, and a rejected bid inserts
  no row. This is load-bearing: if rejections extended, an ineligible bidder could hold an
  auction open forever with bids that never count.

Please make sure the grants allow exactly these three and no more — if the per-bid
`current_price` grant is missing, **every bid fails at commit**.

> **The one thing I am asking you not to do here.** The cap of 20 is a `CHECK` constraint
> (`auctions_extension_cap`), not an `if` inside a function. It must stay a constraint. The
> `if` in the trigger is an optimisation that skips the update; the constraint is what makes
> an unbounded extension **impossible**. Without it a contested auction never ends, never
> finalizes, and never has a winner — and that failure is invisible until it happens in
> front of someone. `CLAUDE.md` §5 says the same thing in the same words.

### 4.1 Who initialises `current_price` at creation

`ARCHITECTURE.md:511` says current price is written by *"Only the bid operation"* with no
creation carve-out. `PRD` `FR-CREATE-28`, `TEAM.md:595` (M-09) and your `AUC-08` all say a
new auction has `current_price = starting_price`.

**Proposed: you set it once at creation** (column default or explicit insert — your
choice), and every write after that is mine, exclusively. This mirrors the carve-out
`ARCHITECTURE.md:510` already makes one row above for `status` ("initial status" is
system-assigned at creation, then outcome-only). It is a carve-out, not a contradiction.

`current_price` is **`NOT NULL` from creation onward.** Please do not make it nullable —
`NULL` would propagate into every listing row, every sort, and every
`COALESCE(current_price, starting_price)` a future session is tempted to write.

### 4.2 A column of mine now lives in your table — disclosed, not assumed

`extension_count integer not null default 0` was added to `public.auctions` by **my**
migration (`20260814000000:65`), together with the `auctions_extension_cap` CHECK
(`:71`) and a `comment on column`. A partial index `auctions_due_for_close` on
`(end_time) where status = 'active'` was added in the same file for the closing sweep.

**You own the DDL of this table** (see the header of this document) and you were not asked
first. I am not asking retroactively either — I am telling you, in the document you read to
know what is in your record, because the alternative is you discovering a column you did not
add. The reasoning I applied at the time is in the migration's own comment
(`20260814000000:59`):

> *"`auctions` is Mohammed's table (S0-11) and this is Rayan's column. It is bidding
> behaviour — the same category as `current_price`, `winner_id`, `final_price` and
> `closed_at`, which already live here for the same reason (`CLAUDE.md` §1: ownership is by
> responsibility, not by file)."*

That reasoning is consistent with `CLAUDE.md` §1, and I still think it is right. But
"consistent with the ownership model" is not the same as "you were told", and only one of
those two had happened. **§8 now carries a box for it.** If you would rather the column
lived elsewhere — its own table keyed by auction id, say — say so and I will move it; the
cap and the guard would move with it and nothing in the bid path would change shape.

---

## 5. `status` is in the record, but it is **not** how eligibility is decided

`TEAM.md:421–422` and `GITHUB_PLAN.md:263` both file `status` under *"the field set that
bid validation depends on."* Read plainly, that invites `if status != 'active' then reject`.

`PRD` `LC-03` forbids exactly that:

> *"Bidding eligibility is determined by server time against the end time, **not by the
> stored status flag**. From the end time onward, bids are rejected even if the record
> still says Active."*

This is not pedantry. There is a window — up to 30 seconds by `FR-END-03`, and longer if
the sweep is late — where the end time has passed but the flag still reads `active`. A
status-gated implementation **accepts bids after the auction has ended** in that window.

**Verified:** an auction whose `status` column still read `active` past its `end_time`
rejected the bid with `auction_ended`. The eligibility check uses `clock_timestamp()`, not
`now()` — `now()` freezes at transaction start, i.e. before a bid queues on the lock, so a
bid that waited across the end time would slip through.

`status` stays in the record and in the read set — I write it at close, it is the
finalization idempotency marker and the sweep's predicate, and you display it. **It is
just never the gate.**

---

## 6. Bid history is ordered by `id` — never by `created_at`

This is a read-path rule and it affects your pages, so it belongs in this contract.

`bids.created_at` defaults to `now()`, which is **transaction start** — when a bid began
queueing, not the order it acquired the lock. `BR-11` makes lock-acquisition order the
definitive ordering. Under contention the two differ:

```
by id (correct)  : 150.00 < 250.00 < 300.00 < 300.01
by created_at    : 150.00 < 300.00 < 250.00 < 300.01   ← visibly decreasing
```

Measured: **2 of 12 contended auctions produced disagreeing orderings.** The stored data is
perfectly correct in both cases — only the rendering is wrong, which makes it silent. It
would break `SC-17`, `NFR-DAT-03` and `FR-BID-15` on your surface while every server-side
test passes.

`created_at` is for **display only** (`FR-BID-23`). Ordering authority is `bids.id`, and
there is an index (`bids_auction_order`) on `(auction_id, id)` for it.

---

## 7. What I am **not** asking for

Listed explicitly because these are the four things an AI-assisted session adds while
trying to be helpful. `ARCHITECTURE` §13.2a classifies adding any of them as **a bug**,
and `ARCHITECTURE` Risk 10 classifies re-adding a removed check as a bug:

| Do not add | Why | Requirement |
|---|---|---|
| ❌ `bid_increment` / minimum raise | none exists; `+0.01` is as valid as `+1000` | `BR-32` |
| ❌ `max_price` / any ceiling or length cap | no maximum exists; large values must **never** be rejected for size | `BR-21`, `SEC-R3` |
| ❌ `reserve_price` | no reserve exists | `BR-35` |
| ❌ leading-bidder rejection | being the current leader is never grounds to reject | `BR-24`, `FR-BID-04` |

Also out of scope for the record, from `PRD` v3.0: no cancel, no edit, no draft state, no
`Cancelled` status. `status` has exactly two persisted values — `active` and `ended`
(`PRD` §12.1, `BR-30`, `BR-14`).

> **One item left this list on 2026-08-13 and it is the only one that ever has.** This
> section used to carry a fifth row: *"❌ anti-sniping / time extension — the end time is
> fixed."* **It is gone because the feature is real.** `BR-36` was reversed by the project
> owner with both other developers agreeing, and `CLAUDE.md` §5 records the reversal as
> governing over any document that still says the end time never moves. The four rows above
> are unaffected — none of them has ever been reversed, and adding any of them is still a
> bug. Do not restore the fifth row on the strength of an older document.

> **⚠️ Row 1 is on notice — and the notice is here because nothing else names it.**
> [`D-01`](../decisions/D-01-bid-increment-button.md) is a **made owner decision**: the bid
> control becomes a button carrying a **seller-set increment**, and `V2-A3` adds a
> `bid_increment` column. The day it lands, **row 1 above is false as written.**
>
> Three artefacts prohibit that column today, and **only one of them is named in the work
> that will break it.** `D-01` §6 and `CLAUDE.md` §9 both name `INT-08`
> (`tests/integration/excluded-features.check.sh`) and prescribe narrowing it *in the same
> PR*. Neither names **this row**, and neither names **`S0-12` §9.5** — both of which are
> rank-5 contract clauses that, per `CLAUDE.md` §2, *win* against an older document. Worse,
> `§10.1` of this contract records a **verification against merged `main`** that this row
> holds (*"No `bid_increment` … ✅ holds"*), so landing the column falsifies a countersigned
> finding, not merely a test. `V2-A3`'s ticket line says *"`bid_increment` + INT-08 narrowing
> + the BR-32 survival test"* — **that scope is incomplete by two documents.**
>
> **What must NOT be read into this.** Row 1 is *not* hereby amended, and nothing here
> approves the column. `O25`–`O30` are open — whether the increment is required, what the
> `CHECK` may say, whether there is an upper bound, whether it is mutable after publish — and
> `D-01` §5's own heading is *"do NOT pick an answer"*. **The prohibition stands until `V2-A3`
> amends it explicitly, in the PR that adds the column, alongside `S0-12` §9.5.**
>
> **The one thing that never moves, whatever `O25`–`O30` say:** `BR-32` governs what the
> *server accepts*, and `D-01` governs only what the *screen offers*. A `CHECK` constraining
> `amount` to a multiple of the increment is the bug this whole row exists to prevent, and
> `D-01` §4 requires the test asserting the server still accepts a non-multiple to land **in
> the same PR as the column** — not after it.

> **🔴 The day the notice above predicted arrived on 2026-08-15, and none of the four things
> the notice required happened. This paragraph is the record, not the resolution.**
>
> V2 shipped. `bid_increment public.sar_increment not null` is a column on `auctions`
> (`supabase/migrations/20260815100000_core_schema.sql:119`), and `place_bid` does not merely
> *offer* it on the screen — it **enforces** it, inside the row lock: `v_min :=
> v_a.current_price + v_a.bid_increment` (`:256`), then `if v_amount < v_min then … 'error',
> 'too_low'` (`:259`, `:261`). That is a **minimum-raise rejection on the server**, which is
> the exact thing the paragraph above says never moves — `BR-32` governs what the server
> accepts, and this rejects.
>
> Measure the four requirements against what shipped:
>
> | The notice required | What happened |
> |---|---|
> | row 1 amended **explicitly**, in the PR adding the column | not amended — row 1 above still reads as it always has |
> | `S0-12` §9.5 amended alongside it | not amended |
> | `INT-08` narrowed **in the same PR** | narrowed later, on `delivery/v2-app`, in a separate change — it now pins the increment *inside* `place_bid`'s lock instead of prohibiting it |
> | `D-01` §4's non-multiple survival test, in the same PR as the column | **does not exist.** V2 has no database suite at all (see `.github/workflows/ci.yml`) |
>
> **Row 1 is still not hereby amended.** Nothing here approves the column and nothing here
> retracts `BR-32`; a contract clause is not amended by the code disagreeing with it, which is
> the whole reason `CLAUDE.md` §2 ranks contracts where it does. What is recorded is that the
> code and the contract now **contradict** each other in production, that the contradiction is
> written up in full in `CLAUDE.md` §0, and that closing it is the **owner's** call — either
> `BR-32`/`PRD` §21.1 Q4 is amended, or `place_bid` stops rejecting below `v_min`. Until he
> answers, both sides stay exactly as they are, and this notice is what stops the disagreement
> from being discovered by someone reading only one of them.
>
> `tests/v2/graph.check.mjs` measures both sides of this every run, so neither can be quietly
> moved to make the other look right.

And two more, from `S0-12` (FINAL): **no money column that is not the `sar_amount`
domain**, and **no floating point anywhere on an amount** — including in a sort, an index
expression, or a test assertion.

---

## 8. What I need from you — tick and return

Nothing below is decided until you tick it. Where you disagree, write the alternative and
I will build to it.

- [ ] **§2** — the seven read fields are as listed, and `current_price` **is** in the set (not "existence")
- [ ] **§2** — none of the seven is renamed or removed without telling me first
- [ ] **§2** — ⚠️ *new* — you have read that **`end_time` is no longer fixed after render**, and no surface of yours assumes it is
- [ ] **§2 / §4** — ⚠️ *new `2026-08-15`* — you have read that **`end_time` now has two doors, not one** (`place_bid` *and* pause/resume), and that §4's table is exhaustive over **my** writes, not over **all** writers. Ticking this is **not** agreement to a pause design — there is none to agree to yet; `O4` and `O33` are open, and whoever answers them amends §2 and §4 and brings you a concrete box then
- [ ] **§3.2** — your read path exposes a **derived** has-bids / bid-count; no stored column on `auctions`
- [ ] **§3.2** — *or*: you would rather I expose a counting view over `bids` for you to join → tell me
- [ ] **§4** — my writes are exactly: `current_price` per accepted bid, `end_time` + `extension_count` on an accepted bid inside the final 15 s, and the four close fields. The writes reach the table through `SECURITY DEFINER`; no `UPDATE` grant exists and none must be added
- [ ] **§4.2** — ⚠️ *new* — `extension_count` and `auctions_extension_cap` stay in `auctions`, added by my migration · **or** tell me where you want them instead
- [ ] **§4.1** — you initialise `current_price = starting_price` at creation; it is `NOT NULL`
- [ ] **§5** — `status` is displayed and written at close, but is **never** the bidding eligibility gate
- [ ] **§6** — bid history is ordered by `bids.id`; `created_at` is display-only
- [ ] **§7** — none of the four prohibited fields appears in your DDL
- [ ] **§9** — you agree the three items below go to the whole team, not to the two of us

Once ticked, this document — not `GITHUB_PLAN.md:263`, not `TEAM.md:421` — is the citable
contract, and the three conflicting field lists are superseded.

> **Not returned. Nothing above is ticked.** What §10 adds is evidence, not a signature:
> the boxes that are *statements about code* have been checked against merged `main` and
> the file-and-line findings are in §10.1, so that ticking is a confirmation rather than a
> re-derivation. The boxes that are *undertakings* are listed in §10.2 and only @m7ya505
> can give them. The `BR-36` amendments to `§4` and `§2` are already in the body above —
> @RayanAlDwlah made them himself in `#133`.

### 8.1 Evidence of partial endorsement — recorded `2026-08-13`, **nothing ticked**

Mohammed drafted a competing S0-11 (commit `32358bd`, proposing a **stored `bid_count`
column**), then **withdrew it** in revert `5adaad2` and endorsed this document instead. His
words, verbatim from that commit message:

> Rayan had already published his half of the S0-11 contract at 18:15 on 2026-08-12, before
> this draft existed. Both found the same defect independently — current_price cannot
> distinguish "no bids" from "first bid equal to the starting price" (BR-29) — but his
> resolution is the better one. He derives the fact in-transaction inside the row lock he
> already holds, verified against PostgreSQL 17.10, and explicitly asks for no stored
> bid_count column, because a stored counter would widen his write set beyond GITHUB_PLAN
> §263's "current price on each accepted bid and nothing else". This draft proposed exactly
> that column. **Rayan's contract stands as the S0-11 document.**

**This is not a sign-off, and it is deliberately not being treated as one.** A commit
message on another branch is not the tick §8 asks for, and it does not reach nine of the ten
boxes. Mapped honestly:

| § | Box | Status after `5adaad2` |
|---|---|---|
| §3.2 | derived has-bids, **no stored column** | ✅ **explicitly endorsed, with his reasoning** |
| §3.2 | *or* a counting view instead | ➖ moot — he chose derived |
| §4 | writes are `current_price` per accepted bid + the four close fields | 🟡 **partial** — he affirms the `GITHUB_PLAN §263` write-set limit, but never names the four close fields |
| §2 | the six read fields; `current_price` **is** the sixth | 🟡 **partial** — he accepts the `BR-29` indistinguishability that §2.1 turns on, but never confirms the field list |
| §2 | no rename or removal without telling me | ⬜ **open** |
| §4.1 | he initialises `current_price = starting_price`, `NOT NULL` | ⬜ **open** |
| §5 | `status` is never the eligibility gate | ⬜ **open** |
| §6 | history ordered by `bids.id`; `created_at` display-only | ⬜ **open** |
| §7 | none of the four prohibited fields in the DDL | ⬜ **open** |
| §9 | the three items go to the whole team | ⬜ **open** |
| §2 | ⚠️ `end_time` is no longer fixed after render | ⬜ **open — did not exist on 2026-08-13** |
| §4.2 | ⚠️ `extension_count` + its CHECK stay in `auctions` | ⬜ **open — did not exist on 2026-08-13** |
| §2 / §4 | ⚠️ `end_time` has **two doors**; §4 is exhaustive over my writes, not all writers | ⬜ **open — did not exist on 2026-08-13, or on 2026-08-14** |

Ten boxes are untouched, and four of them (`§4.1`, `§5`, `§6`, `§7`) are the ones that
break bidding silently if he assumes otherwise. **`BID-02`, `BID-13`, `BID-15` and `BID-16`
are still building against a draft.**

**The last three are new, and they are new for a reason worth naming.** `5adaad2` was written
on 2026-08-13 against a document that said `end_time` never moves and said nothing about
`extension_count`. Even a full tick that day would not have covered them. So an endorsement
does not age into coverage of a change made after it — **a signature covers the version it
was given on, and this version is not that one.**

**The third one proves the rule twice over, because it post-dates the other two.** The
`§2 ⚠️` box was added on 2026-08-14 and says *"`end_time` is no longer fixed after render."*
A reader could reasonably think that box already covers pause — the end time moves, he has
been told the end time moves, what more is there? But that box was written when the only
mover was `place_bid`'s 30-second quantum, which is **bounded by a `CHECK` at 20 extensions**.
Pause is unbounded (`O31` is open precisely because it has no cap), it is driven by a **human
decision rather than by bidding**, and it can move the clock on a lot **nobody is bidding on**.
A surface built to survive *"up to 20 × 30 s of drift while bids land"* is not thereby built
to survive *"the host went to lunch."* **Same field, same direction, different failure** — so
it is a different box.

> **Recording mechanism — a problem worth naming.** `GITHUB_PLAN.md` §12.1 says agreement is
> recorded in the issue thread. **There are no issues.** `gh issue list --state all` returns
> zero on `RayanAlDwlah/dallal` (issues are enabled; none were ever created). The whole
> `GITHUB_PLAN` breakdown exists as a document only. Until that is fixed, the only durable
> record is this file plus a PR review — and Mohammed **has not reviewed PR #1 at all**; its
> single approval is Abdulrahman's (`Dem4t`, `2026-08-12T16:54Z`).

---

## 9. Not ours to decide — these go to the team

`TEAM.md` rule 16 makes `PRD.md` the product source of truth and forbids a developer
inventing a product decision in code. These three surfaced while writing this contract and
are **not** mine or yours to settle in a DM:

1. **The realtime payload.** `PRD` `RT-S1` requires bidder **display names** in live
   payloads and `RT-S2` forbids surplus internal identifiers. But `ARCHITECTURE` §14.1
   broadcasts committed **row changes**, and the bid row stores only an internal identifier
   — no display name. Proposed resolution: rows carry identifiers only; the client resolves
   identifier → display name from the public profile table (display name is the sole public
   profile field per `S0-10` §8.1, so this leaks nothing). Needs to be an explicit line
   somewhere, because today it is a gap.

2. **`S0-12` §5.1 has a defect.** Its literal `outbid_race` expression cannot reproduce
   `S0-12`'s **own** worked trace in its §10. `S0-12` is marked FINAL and its closing rule
   says changes are a document revision agreed by all three of us — never a code change.
   One-line revision needed.

3. ~~**The money format.**~~ **Resolved while this document was being written** — `S0-12`
   §0 sets the canonical format to `1,250.00 SAR` and `PRD` `BR-43` records it. I had
   briefly proposed `ر.س` and was wrong: I amended three PRD locations for the RTL
   decision and missed `FR-CREATE-13`, which names the indicator explicitly. Your version
   amended it. **Adopted as-is, and my competing edit is withdrawn** — `PRD.md` on this
   branch is now byte-identical to `main`, so the RTL amendment reaches `main` through
   your commit, not through a conflicting one of mine.

   I have answered the engineering question §0.1 left open, in **§0.2**: option **(ii)**,
   mirrored grouping — chosen because the width-unbounded server implementation it was
   priced at now exists and was measured. `to_char`'s ceiling reproduced (`###,###,###,###.##`),
   the regex form emits all 42 digits at 40-digit magnitude, and the golden byte-identity
   test against your `lib/money.ts` passes on 11 fixtures including one above 2⁵³.

**And one thing that was squarely my fault:** the Arabic-RTL decision was made verbally
and left unwritten, so `PRD.md` went on telling every Claude session the opposite while
Abdulrahman held 14 UI issues and had never been told. You two fixed it before I did, and
more completely — `§1.2` + `BR-41`/`BR-42`/`BR-43` + the `Q16` resolution is the right
shape, and it is what this contract now cites. Apologies for the duplicated effort; the
cause was mine.

---

## 10. Verification against merged code — @Dem4t, 2026-08-14. **This is not the sign-off.**

§8 asks @m7ya505 to tick and return. **This section does not do that, and cannot.** It is
one thing only: the boxes that are *statements about code* checked against merged `main`,
file and line, so that when he ticks he is confirming something already established rather
than re-deriving it.

An earlier revision of this section was written as though it were his return. It was not
his — it was authored from @Dem4t's account, in his voice. A signature that the signer did
not write records a review that did not happen, and four of these boxes are the ones §8.1
itself names as *breaking bidding silently* if he assumes otherwise. Those four are exactly
where a borrowed tick costs the most. Corrected here rather than left in history unexplained.

### 10.0 The split that matters — and why half of §8 is unreachable from here

The boxes are not one kind of thing:

- **Statements about code.** "Is `current_price` `NOT NULL`?" has an answer in the schema,
  the same answer for everyone, and reading it is not a decision. Those I checked.
- **Commitments.** "None of the **seven** is renamed without telling me first" is a promise
  about *future conduct*. No amount of code reading produces it. Neither does anyone else's
  reading. Only @m7ya505 can give those, and they are marked ⬜ below and left untouched.

That split is the whole point. Half of §8 is not a fact to be verified; it is an
undertaking, and an undertaking has to be given by the person who will keep it.

### 10.1 Checked — statements about code, on `main`

| § | Box | Evidence | Result |
|---|---|---|---|
| §2 | **seven** read fields, `current_price` among them | Fields 1–6 are declared on `public.auctions` by `20260812120000_bid02_bid_acceptance.sql:40–66`. **Field 7, `extension_count`, is not in that range and cannot be** — it is added later by `20260814000000:65`, and what makes it a *read* field is `bids_extend_end_time()` at `20260814000000:186`, which selects `a.end_time, a.extension_count … for update` and skips the extension at the cap | ✅ **holds, for all seven** — and §2.1's resolution stands: existence is the outcome of the id lookup, not a column |
| §3.2 | derived has-bids / bid-count, no stored column | `lib/auctions/listing.ts`, `lib/auctions/detail.ts`, `lib/bidding/live-snapshot.ts` — all three read paths derive it as an aggregate over `bids`. No `bid_count` column exists | ✅ **holds** |
| §4 | grants allow the writes | There is **no** `UPDATE` grant to `authenticated` — `bid02:512` revokes it — and the writes reach the table through `SECURITY DEFINER` (`bid02:209`). The absence of the grant is what `AUC-18` rests on, and it is why the write set is *not* enforced by grants at all | ✅ **holds** |
| §4.1 | `current_price = starting_price` at creation, `NOT NULL` | `bid02:50` declares `sar_amount not null`; `auctions_owner_insert` pins `current_price = starting_price` in its `WITH CHECK` (`bid02:495`), so the birth value is enforced by the database, not by application code | ✅ **holds** — and it is not nullable, and no read path writes `COALESCE(current_price, starting_price)` |
| §5 | `status` is never the eligibility gate | `bid02:284` gates on `clock_timestamp() >= v_end_time`; `status` is not among the fields read under the lock. `LC-03` holds structurally | ✅ **holds** |
| §6 | history ordered by `bids.id`, `created_at` display-only | The `bid_history` view orders `by b.auction_id, b.id desc` (`bid02:540`), and `20260814200000` adds `seq` as `row_number() over (… order by b.id)`. `lib/bidding/live-snapshot.ts` records the absence of an `.order("created_at")` call as load-bearing | ✅ **holds** |
| §7 | none of the four prohibited fields in the DDL | `20260814120000_auc01_auction_product_fields.sql` adds `name`, `description`, `image_path` and nothing else. No `bid_increment`, no `max_price`, no `reserve_price`, no ceiling, and no `numeric(P,2)` typmod anywhere | ✅ **holds** |

**Method.** Each was read on `main` at the commit that merged `#133`. None was taken from a
comment claiming it; where a comment and the code disagreed, the code decided. One earlier
claim of mine — that §4's grant instruction would break the extension — was **wrong**, and
was withdrawn on #20 once `bid02:512` and `place_bid`'s `SECURITY DEFINER` showed the
grants were never the mechanism.

A second correction, from review on this PR. The §2 row above read *"six read fields"* and
offered only the original `CREATE TABLE` as its evidence — a range that contains no
`extension_count`, because the column did not exist when it was written. The box it claims
to verify says **seven**. So the row was checking the pre-`BR-36` contract while sitting
under the post-`BR-36` one, and §10.5 invites @m7ya505 to tick on the strength of these
rows rather than re-audit — which would have had him confirm a seven-field set against a
six-field table definition. The seventh is precisely the field an earlier revision of §10.3
described wrongly and @RayanAlDwlah corrected, so it is the one place in this table where a
stale row costs the most. Fixed above, with the two citations the seventh field actually
needs.

### 10.1a A box that contradicted its own evidence

§8’s §4 box **used to end** *“Grants allow all three”* — corrected by this PR. The §4 row above proves the opposite in
its own cell: there is no `UPDATE` grant, `bid02:512` revokes it, and the write set is
**not enforced by grants at all** — it reaches the table through `SECURITY DEFINER`.

So the sentence @m7ya505 is being asked to tick is false as written, and a ✅ beside it
is an invitation to sign it. The cost is not wording: a later session reading the
**signed** contract concludes a grant is what permits the per-bid `current_price` write,
restores it, and reopens the hole that the absence of that grant is what closes (`AUC-18`).

**Raised on #132 and left untaken there**, because §8 is @RayanAlDwlah’s text and rewriting
another owner’s box from inside a verification of it is the exact thing that PR was stopped
for once. It merged unresolved, so the contradiction reached `main` and #20 closed over it.

**Now proposed as an edit rather than a note** — a PR he reviews and can reject, which is the
sanctioned way to touch another owner’s file, and the same shape @RayanAlDwlah used in #138
when he wired a live component into @m7ya505’s presentation and offered to withdraw the line
on request. @m7ya505 accepted this exact wording in his #132 signature and said he ticks §4
the moment it lands.

### 10.2 Not checkable from here — @m7ya505's alone

These stay ⬜ in §8 and nothing below substitutes for them:

| § | Box | Why it is his |
|---|---|---|
| §2 | no rename or removal without telling @RayanAlDwlah first | A promise about future conduct |
| §2 | ⚠️ he has read that **`end_time` is no longer fixed after render**, and no surface of his assumes it | Whether he has read it is a fact about him |
| §3.2 | a counting view over `bids` instead — accept or decline | A design choice on his own read path |
| §4.2 | ⚠️ `extension_count` and `auctions_extension_cap` stay in `auctions` — **or** say where they belong | A column was added to his table by someone else's migration. Only the owner accepts or relocates it |
| §9 | the three items go to the whole team | An agreement about scope |

### 10.3 On the two amendments

§4 and §2 were stale on `BR-36`'s reversal — the write set and the read set both predate
`end_time` moving and `extension_count` existing. That was raised on #20 and **@RayanAlDwlah
amended the contract himself in `#133`**, which is the right hand: he authored the sections
and he owns the behaviour they describe. Nothing in this section amends the contract; the
body above already carries his amendments, and the two new boxes in §8 come from them.

#### 10.3a A third amendment, `2026-08-15` — and it is a different *kind*

§2 and §4 went stale a second time, on the **pause** decision (`CLAUDE.md` §5,
[`D-03`](../decisions/D-03-sessions.md)), and for the same structural reason: both sections
assert that `end_time` moves through exactly one door, and as of 2026-08-15 it moves through
two. It was amended the same way and by the same hand, on the §10.3 precedent.

**What makes this one different is that it stops short on purpose.** The `BR-36` amendment
could state its rule completely — the quantum, the counter, the cap were all decided. The
pause amendment cannot: `O4` (is a lot an `auctions` row?) and `O33` (does pause take a lot
or the session?) are open, so the fourth write occasion has no table, no column and no id
yet. So §2 and §4 now record a **supersession plus a named gap**, not a rule.

That is deliberate, and the alternative was worse in a specific way. A contract that quietly
kept saying *"only inside `place_bid`"* would not merely be out of date — it would be a
**rank-5 document actively contradicting a made owner decision**, and `CLAUDE.md` §2 says a
contract *wins* against an older document. A session obeying the authority order correctly
would have concluded that a conforming pause implementation was a violation. **The stale
copy would have been armed, not merely wrong**, which is why this could not wait for `O4`.

§7 also gained a notice in the same pass, and it is **not** an amendment: row 1 (`bid_increment`)
is still prohibited and still in force. What the notice records is that `D-01` will falsify it,
that `§10.1` countersigned it as holding, and that `V2-A3`'s stated scope names `INT-08` but
neither this row nor `S0-12` §9.5.

**Nothing in §8 is ticked by any of this, and one box was added rather than reworded** —
§8.1's finding applies with full force here: *"a signature covers the version it was given
on."* A tick given before 2026-08-15 would not have covered a second door, so the second door
gets its own box instead of being folded into an existing one.

### 10.4 How the signature gets recorded — @RayanAlDwlah's answer, adopted

§8.1's own complaint was that there is no recording mechanism: `GITHUB_PLAN.md` §12.1 says
agreement lives in the issue thread, and it refused a commit message on another branch as
the tick. His review on #132 supplies the missing half, and it is better than what §8 asks
for:

> **@m7ya505 approves this PR with an explicit sentence** — "I confirm the §10.1 rows and
> tick the §8 boxes" — and that review becomes the citable artifact.

A review is bound to the exact revision of the document it was left on, which a commit
message is not. That is precisely the gap §8.1 named. On his approval the status line
becomes true as written: **signed by Mohammed, recorded in the review on #132**.

### 10.5 What is left

One person. Every statement about code in §8 has been checked and the evidence is above;
every undertaking in §8 is unticked and waiting. When @m7ya505 ticks, he is confirming
undertakings and countersigning findings — not auditing a codebase from scratch, which is
the cost this section exists to remove.
