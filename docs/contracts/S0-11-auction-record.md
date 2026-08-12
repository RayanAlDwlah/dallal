# S0-11 — The Auction Record Contract · عقد سجل المزاد
### Rayan's half — what bidding needs from the auction record

| Field | Value |
|---|---|
| Issue | **S0-11** — "Agree the auction record contract" (`GITHUB_PLAN.md:263`) |
| Record owner | **Mohammed** (`@m7ya505`) — he owns the table, the DDL and the access path (`TEAM.md` §4, §9.3) |
| Consumer | **Rayan** (`@RayanAlDwlah`) — bidding, current price, closing, winner |
| Status | 🟡 **Draft — awaiting Mohammed's sign-off.** Nothing here is decided until the boxes in §8 are ticked |
| Date | 2026-08-12 |
| Depends on | `S0-12` (money type, FINAL) · `S0-10` (identity contract, Abdulrahman) |
| Consumed by | `BID-01`, `BID-02`, `BID-05`, `BID-15`, and Mohammed's `AUC-08`/`AUC-14`/`M-10` |

> **Citation correction.** The S0-11 issue text cites "ARCHITECTURE §10.3" twice.
> `ARCHITECTURE.md:605` §10.3 is **Password reset**. The auction-record material is in
> `TEAM.md` §10.3, `ARCHITECTURE.md` §9.3–§9.4, and `ARCHITECTURE.md` §19.3. Once this
> document is agreed it becomes the single citable location, so no session has to follow
> the broken pointer again.

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

- [ ] **§2** — the six read fields are as listed, and `current_price` **is** the sixth (not "existence")
- [ ] **§2** — none of the six is renamed or removed without telling me first
- [ ] **§3.2** — your read path exposes a **derived** has-bids / bid-count; no stored column on `auctions`
- [ ] **§3.2** — *or*: you would rather I expose a counting view over `bids` for you to join → tell me
- [ ] **§4** — my writes are exactly: `current_price` per accepted bid, and the four close fields. Grants allow both
- [ ] **§4.1** — you initialise `current_price = starting_price` at creation; it is `NOT NULL`
- [ ] **§5** — `status` is displayed and written at close, but is **never** the bidding eligibility gate
- [ ] **§6** — bid history is ordered by `bids.id`; `created_at` is display-only
- [ ] **§7** — none of the four prohibited fields appears in your DDL
- [ ] **§9** — you agree the three items below go to the whole team, not to the two of us

Once ticked, this document — not `GITHUB_PLAN.md:263`, not `TEAM.md:421` — is the citable
contract, and the three conflicting field lists are superseded.

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

*Rayan's half of S0-11. Nothing in §2–§7 is binding until §8 is returned ticked.*
