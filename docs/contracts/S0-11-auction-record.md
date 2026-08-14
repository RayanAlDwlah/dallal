# S0-11 — The Auction Record Contract · عقد سجل المزاد
### Rayan's half — what bidding needs from the auction record

| Field | Value |
|---|---|
| Issue | **S0-11** — "Agree the auction record contract" (`GITHUB_PLAN.md:263`) |
| Record owner | **Mohammed** (`@m7ya505`) — he owns the table, the DDL and the access path (`TEAM.md` §4, §9.3) |
| Consumer | **Rayan** (`@RayanAlDwlah`) — bidding, current price, closing, winner |
| Status | 🟢 **AGREED — signed off by Mohammed 2026-08-14.** All ten boxes in §8 are returned, each against merged code rather than intent; §10 is the return and carries the two amendments §4 and §2 need. This document is now the citable contract |
| Date | 2026-08-12 · endorsement evidence recorded 2026-08-13 · **signed 2026-08-14 (§10)** |
| Depends on | `S0-12` (money type, FINAL) · `S0-10` (identity contract, Abdulrahman) |
| Consumed by | `BID-01`, `BID-02`, `BID-05`, `BID-15`, and Mohammed's `AUC-08`/`AUC-14`/`M-10` |

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

## 2. The six read fields — frozen

These are the fields the bid operation reads. All six are read **inside the per-auction
row lock** (`ARCHITECTURE` §13.2 steps 2–3); anything read before the lock is stale by
definition and is used only to distinguish a race from a too-low bid.

| # | Field | Why bidding needs it | Requirement |
|---|---|---|---|
| 1 | **auction id** | the row to lock | §13.2 step 2 |
| 2 | **owner identifier** | the owner may never bid | `BR-02`, `FR-BID-03` |
| 3 | **end time** | eligibility, compared to the **server clock** | `BR-04`, `LC-03`, `FR-BID-18` |
| 4 | **starting price** | the first bid's threshold, **inclusive** | `BR-28`, `BR-29`, `SC-55` |
| 5 | **current price** | every later bid's threshold, **strictly greater** | `BR-03`, `BR-28`, `SC-56` |
| 6 | **status** | see §5 — *not* an eligibility input | `LC-03` |

### 2.1 Resolving the "sixth field" conflict — please read this one

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
| **At close** | `status`, final price, winner, close time (`FR-END-08`, `BR-06`) | — |

I write nothing else to `auctions`, ever. Please make sure the grants allow exactly these
two and no more — if the per-bid `current_price` grant is missing, **every bid fails at
commit**.

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

And two more, from `S0-12` (FINAL): **no money column that is not the `sar_amount`
domain**, and **no floating point anywhere on an amount** — including in a sort, an index
expression, or a test assertion.

---

## 8. What I need from you — tick and return

Nothing below is decided until you tick it. Where you disagree, write the alternative and
I will build to it.

- [x] **§2** — the six read fields are as listed, and `current_price` **is** the sixth (not "existence")
- [x] **§2** — none of the six is renamed or removed without telling me first
- [x] **§3.2** — your read path exposes a **derived** has-bids / bid-count; no stored column on `auctions`
- [x] **§3.2** — *or*: you would rather I expose a counting view over `bids` for you to join → **declined, derived stands**
- [x] **§4** — my writes are exactly: `current_price` per accepted bid, and the four close fields. Grants allow both — **ticked as amended, §10.2: the set is now six fields, not five**
- [x] **§4.1** — you initialise `current_price = starting_price` at creation; it is `NOT NULL`
- [x] **§5** — `status` is displayed and written at close, but is **never** the bidding eligibility gate
- [x] **§6** — bid history is ordered by `bids.id`; `created_at` is display-only
- [x] **§7** — none of the four prohibited fields appears in your DDL
- [x] **§9** — you agree the three items below go to the whole team, not to the two of us

Once ticked, this document — not `GITHUB_PLAN.md:263`, not `TEAM.md:421` — is the citable
contract, and the three conflicting field lists are superseded.

> **Returned 2026-08-14 — see §10 for the evidence behind every tick, and for the two
> amendments (`§10.2`, `§10.3`) that the `BR-36` reversal forces on `§4` and `§2`.**

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

Seven boxes are untouched, and four of them (`§4.1`, `§5`, `§6`, `§7`) are the ones that
break bidding silently if he assumes otherwise. **`BID-02`, `BID-13`, `BID-15` and `BID-16`
are still building against a draft.**

> **Superseded 2026-08-14 by §10.** All ten boxes are now returned, the four named above
> among them. §8.1 is kept as the record of what was and was not agreed on 2026-08-13 —
> it was correct to refuse a commit message as a sign-off, and that refusal is why §10
> cites merged code line by line instead. Two of its subsidiary claims have since expired:
> the issues it says do not exist were created on 2026-08-13 (`S0-11` is `#20`), and
> `BID-02`, `BID-13`, `BID-15` and `BID-16` all shipped and closed against the draft — a
> risk that ran for two days and did not land, rather than one that was managed.

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

## 10. Mohammed's return — signed 2026-08-14

This is the tick §8 asked for, and it is deliberately **not** another commit message. §8.1
was right to refuse `32358bd`/`5adaad2` as a sign-off, and it would be right to refuse this
one too if it were only a statement of intent — so every box below is returned against
**merged code on `main`**, cited by file and line, not against what I meant to build.

Two boxes could not be ticked as written. They are ticked **as amended** in §10.2 and
§10.3, and the amendment is in both cases the same event: `BR-36` was reversed on
2026-08-13, four days after this contract was drafted, and the reversal changed the auction
record. Neither amendment is a product decision of mine — `CLAUDE.md` §5 records the
reversal as the project owner's, with both of you agreeing. I am only writing it into the
contract that it invalidated.

### 10.1 What I verified, per box

| § | Box | Evidence on `main` | Verdict |
|---|---|---|---|
| §2 | six read fields, `current_price` is the sixth | `20260812120000_bid02_bid_acceptance.sql:40–66` declares all six on `public.auctions` | ✅ **agreed** — and §2.1's resolution is right: existence is the outcome of the id lookup, not a column. `TEAM.md:421` and `TEAM.md:372` are superseded |
| §2 | no rename or removal without telling you | Standing commitment. The six are load-bearing for `place_bid` steps 3–6; I treat a rename as a contract change, not a refactor | ✅ **agreed** |
| §3.2 | derived has-bids / bid-count, no stored column | `lib/auctions/listing.ts:155`, `lib/auctions/detail.ts:222`, `lib/bidding/live-snapshot.ts:218` — all three read paths derive it as an aggregate count over `bids`. No `bid_count` column exists on `auctions` | ✅ **agreed** |
| §3.2 | *or* a counting view over `bids` | Not needed — the aggregate through the existing read path costs nothing extra and keeps the bid table's shape yours | ➖ **declined** |
| §4 | writes are `current_price` + the four close fields | `bid02:414` writes `current_price`; `bid15:286–291` writes `status`, `winner_id`, `final_price`, `closed_at`. **But `bid15:197–200` also writes `end_time` and `extension_count`** | 🟠 **agreed as amended — §10.2** |
| §4 | grants allow both | Correct, and by a route worth naming: there is **no** `UPDATE` grant to `authenticated`, and there must never be one. Both writes reach the table through `SECURITY DEFINER` functions (`bid02:209`, `bid15:248`). The absence of the grant is what `AUC-18` rests on | ✅ **agreed** |
| §4.1 | I initialise `current_price = starting_price`, `NOT NULL` | `bid02:50` declares it `sar_amount not null`; the `auctions_owner_insert` policy at `bid02:489–505` pins `current_price = starting_price` in its `WITH CHECK`, so birth value is enforced by the database, not by my action code | ✅ **agreed** — and to be explicit about the thing you asked me not to do: it is **not nullable**, and nothing in my read path writes `COALESCE(current_price, starting_price)` |
| §5 | `status` is never the eligibility gate | `bid02:263–264` reads four fields under the lock and `status` is **not** among them; `bid02:284` gates on `clock_timestamp() >= v_end_time`. `LC-03` holds structurally | ✅ **agreed** — I display `status`, I never gate on it |
| §6 | history ordered by `bids.id`, `created_at` display-only | Index `bids_auction_order` at `bid02:92`; `lib/bidding/live-snapshot.ts:46–47` records the absence of an `.order("created_at")` call as load-bearing | ✅ **agreed** — my surfaces order by the sequence key, never by the timestamp |
| §7 | none of the four prohibited fields in my DDL | `20260814120000_auc01_auction_product_fields.sql` adds `name`, `description`, `image_path` and nothing else. No `bid_increment`, no `max_price`, no `reserve_price`, no ceiling. No money column outside the `sar_amount` domain, and **no `numeric(P,2)` typmod anywhere** | ✅ **agreed** |
| §9 | the three items go to the whole team | Yes. §9.1 has since been answered by `BID-08`/`BID-12` (the payload carries the change, not the data), §9.2 is recorded as `S0-12` §5.1a and still needs the one-line revision all three of us sign, §9.3 was resolved in-flight | ✅ **agreed** |

### 10.2 Amendment to §4 — the write set is six fields, not five

§4 says, in bold: *"I write nothing else to `auctions`, ever."* On `main` today that
sentence is false, and it is false for a reason that was decided after it was written.

`bids_extend_end_time` (`20260814000000_bid15_closing_and_extension.sql:177–204`) fires
`AFTER INSERT` on `bids`, inside `place_bid`'s transaction and under the auction row lock,
and executes:

```sql
update public.auctions
   set end_time        = end_time + interval '30 seconds',
       extension_count = extension_count + 1
 where id = new.auction_id;
```

So the bid path writes **`end_time`** — a field §2 lists among the six I froze as *read*
inputs — and **`extension_count`**, a column that did not exist when §4 was written.

**I am not objecting.** `CLAUDE.md` §5 is explicit that `BR-36` was reversed by the project
owner on 2026-08-13 with both other developers agreeing, that a document still claiming the
end time is fixed is stale, and that the mechanism lives in exactly this migration. The
contract is the stale document here, not the code.

What I am doing is refusing to tick a sentence that a future session would read as
permission to treat an `end_time` write as a contract violation — or worse, as licence to
"restore" the contract by removing the trigger. `CLAUDE.md` §5 says the cap is a `CHECK`
constraint rather than an `if` precisely because that removal is the plausible mistake.

**§4's table is therefore amended to read:**

| When | Fields Rayan writes | Guard |
|---|---|---|
| **On each accepted bid** | `current_price` ← the accepted amount | `BR-07`, `BR-13`, `SC-40` |
| **On an accepted bid inside the final 15 seconds** | `end_time` **+30s** and `extension_count` **+1**, together, in the same statement | `BR-36` as amended; `auctions_guard_update` (`bid15:107–145`) raises on every other shape — wrong size, backwards, outside `place_bid`, or either field moving without the other |
| **At close** | `status`, `winner_id`, `final_price`, `closed_at` | `FR-END-08`, `BR-06` |

Nothing else. The `extension_count between 0 and 20` `CHECK` (`bid15:71`) is the cap, and I
am signing off on it as a constraint on **my** table: it is what guarantees a contested
auction ends at all, and I will not "tighten", parameterise or relocate it.

**One consequence for my side, stated so it is not discovered later:** `end_time` is no
longer immutable after creation, so no presentation of mine may cache it across a bid.
`AUC-13`'s countdown and `AUC-10`'s leave-on-end both re-read it from the live snapshot
rather than from the initial server render.

### 10.3 Amendment to §2 — `extension_count` is a seventh field on the record

§2 freezes six fields and §7 lists what must never be added. `extension_count` is neither:
it was added to **my** table by `bid15:65` without passing through this contract, which is
the correct outcome under `CLAUDE.md` §5 and the wrong outcome under §8 of this document.
Recording it now closes that gap rather than leaving the next session to find a column no
contract mentions.

| # | Field | Owner of the writes | Note |
|---|---|---|---|
| 7 | `extension_count` | **Rayan**, `+1` only, only with `end_time` | Not a read input to my surfaces. I do not display it, and `PRD` has no requirement that I should |

It is **not** a seventh read field for bidding, and it does **not** reopen §3.2 — it is not
a bid counter and must never be pressed into service as one. `extension_count` counts
extensions, and an auction with 40 bids and no late ones has `extension_count = 0`.

### 10.4 What this sign-off does not cover

Two things remain open and this document is not the place they get settled:

1. **`S0-12` §5.1a** — the `outbid_race` correction is still a pending one-line revision
   that all three of us sign (§9.2). My tick on §9 is agreement that it goes to the team,
   not agreement to the wording.
2. **The `GITHUB_PLAN.md:263` / `TEAM.md:421` / `TEAM.md:372` field lists** are superseded
   by §2 as of this sign-off, but the three documents still contain the old text. That is
   a documentation follow-up, filed rather than done here, because editing `TEAM.md`'s
   ownership tables in the same change as a contract sign-off would bury it.

---

*Rayan's half of S0-11 (§1–§9), returned and signed by Mohammed (§10) on 2026-08-14.
§2–§7 are binding as amended by §10.2 and §10.3.*
