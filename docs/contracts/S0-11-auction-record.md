# Auction record contract — `S0-11`

**The auction fields Rayan's bid validation reads, and the fields Rayan writes at close.**

| Field | Value |
|---|---|
| Issue | `S0-11` · TEAM.md task `M-01` · ARCHITECTURE §10.3 |
| Owner | **Mohammed** (`m7ya505`) — owns the auction record (TEAM.md §4) |
| Must be agreed with | **Rayan** (`RayanAlDwlah`) — his bid operation and finalization read and write it |
| Status | **Draft — awaiting Rayan's written confirmation** |
| Blocks | `BID-02` (bid acceptance), `BID-13` (end-time boundary), `BID-15` (closing), `BID-16` (winner determination) |

> **This is the second-highest-priority item on the team** (GITHUB_PLAN §10.2). Until Rayan confirms it, the entire bidding workstream is building against guesses.
>
> **Once agreed, the six read fields are frozen.** Renaming or removing any of them requires telling Rayan first (ARCHITECTURE §10.3).

---

## 1. A problem this contract exists to catch

**`current_price` alone cannot tell you whether an auction has bids.**

BR-29 allows the first bid to *equal* the starting price. So on an auction starting at `100.00`, after one accepted bid of exactly `100.00`:

```text
starting_price = 100.00
current_price  = 100.00     ← identical
```

Anything that branches on "does this auction have bids?" by comparing the two prices is **wrong**, and it is wrong in the exact case BR-29 was written to allow. That branch appears in two places that matter:

| Where | What breaks |
|---|---|
| **Bid validation** (BR-28) | The rule flips from `>= starting_price` to `> current_price` on the first bid. Get it wrong and a second bid of `100.00` is accepted — violating BR-03 and SC-56 |
| **The price block** (FR-DETAIL-06) | The UI would keep showing "سعر البداية · لا توجد مزايدات" after a bid had already landed |

**Resolution: a seventh field, `bid_count`.** Written by the bid operation in the same transaction as the bid and the price, so it can never disagree with history. Proposed below and **flagged for Rayan's explicit sign-off** — it adds a field to his write set that ARCHITECTURE §10.3 did not anticipate.

---

## 2. The record

Timestamps are `timestamptz`, stored UTC, displayed in the viewer's local zone (FR-CREATE-14, NFR-DAT-06).

Money is exact decimal with **at most two decimal places and no upper bound** (BR-21, NFR-DAT-05, SEC-R3). Recommended: unconstrained `numeric` plus a check constraint on scale — **not** `numeric(10,2)`, which would impose the ceiling BR-21 forbids, and never a float.

### 2.1 System-assigned at creation

| Field | Type | Null | Written by | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | system | Stable, permanent |
| `owner_id` | `uuid` → profile | no | system | **From the verified session, never the request payload** (FR-CREATE-02, SC-39). Permanent and non-transferable (BR-10, FR-CREATE-22) |
| `created_at` | `timestamptz` | no | system | Server clock |
| `status` | `'active' \| 'ended'` | no | system at creation, **finalization thereafter** | Starts `active` immediately (BR-14). **No `draft`, no `cancelled`** (BR-30, §12.4) |

### 2.2 User-supplied at creation, then immutable (BR-31)

No update path exists for any of these, for anyone including the owner (FR-SEC-04, SC-58).

| Field | Type | Null | Constraint |
|---|---|---|---|
| `product_name` | `text` | no | 3–100 chars after trimming (FR-CREATE-04) |
| `product_description` | `text` | no | 10–2000 chars after trimming (FR-CREATE-05) |
| `starting_price` | `numeric` | no | `> 0`, scale ≤ 2. **No maximum** (FR-CREATE-06, FR-CREATE-07, BR-20) |
| `ends_at` | `timestamptz` | no | Between 5 minutes and 7 days after `created_at`, **inclusive at both ends**, by server time (BR-38, FR-CREATE-10a, SC-68). **Never extended** (BR-36) |
| `image_path` | `text` | no | Storage object path, owner-scoped (FR-CREATE-21, SEC-Z8) |

**There is no `reserve_price` field** (BR-35). There is no `updated_at` — nothing updates.

### 2.3 Derived — written only by the bid operation

| Field | Type | Null | Notes |
|---|---|---|---|
| `current_price` | `numeric` | no | `= starting_price` at creation, then always the highest accepted bid (BR-13). **No user may write it** (BR-07, SEC-Z5) |
| `bid_count` | `integer` | no | Default `0`. **See §1** — the only reliable answer to "does this auction have bids?" |

### 2.4 Outcome — written only by finalization

All null until close. Once written, immutable (SEC-I2, BR-17).

| Field | Type | Null | Notes |
|---|---|---|---|
| `final_price` | `numeric` | **yes** | The winning bid. **Null when the auction closed with zero bids** — a normal outcome, not an error (BR-09, FR-END-09, SC-31) |
| `winner_id` | `uuid` → profile | **yes** | Null on zero bids. **Never claimable or grantable** (BR-06, SEC-Z6) |
| `closed_at` | `timestamptz` | **yes** | Actual close time, distinct from `ends_at` (FR-END-08) |

`final_price`, `winner_id` and `closed_at` are null together or non-null together, except the zero-bid case where `closed_at` is set and the other two stay null. Worth a check constraint.

---

## 3. The agreed boundary

### 3.1 What Rayan reads — **the frozen six, plus `bid_count`**

```text
id · owner_id · status · ends_at · starting_price · current_price · bid_count
```

| Field | Which rule needs it |
|---|---|
| `id` | Row lock target — bids on different auctions must not block each other (ARCH §13.3) |
| `owner_id` | BR-02 — the owner cannot bid |
| `status` | Presentation only. **Never the bidding gate** — see §3.3 |
| `ends_at` | BR-04 — compared against the **database** clock |
| `starting_price` | BR-28/BR-29 — the inclusive first-bid threshold |
| `current_price` | BR-03 — the exclusive threshold for every later bid |
| `bid_count` | BR-28 — which of the two thresholds applies (§1) |

### 3.2 What Rayan writes — and nothing else

| When | Fields |
|---|---|
| On each accepted bid, same transaction as the bid row | `current_price`, `bid_count` |
| At close, once, idempotently | `status → 'ended'`, `final_price`, `winner_id`, `closed_at` |

**No other write from Rayan to this record is permitted without coordinating with Mohammed** (TEAM.md §9.3). Mohammed writes the record once, at creation, and never again.

### 3.3 The rule that keeps `status` safe

> **Bidding eligibility is decided by `ends_at` against the database clock — never by `status`** (LC-03, FR-END-04, ARCH §13 step 4).

From `ends_at` onward a bid is rejected even while the row still says `active`. This is what makes the ≤30 s close window in FR-END-03 harmless, and it is why a slow sweep is a presentation delay and never a correctness bug.

`status` therefore has exactly one job: telling the UI what to render.

---

## 4. Checklist for the agreement session

Both developers tick these, in writing, in the `S0-11` issue.

- [ ] Rayan confirms bid validation can be built against §3.1 as written
- [ ] **Rayan explicitly accepts `bid_count` as a field he writes** (§1) — this is the one addition beyond ARCHITECTURE §10.3
- [ ] Both agree `final_price` and `winner_id` are nullable and that null means *closed with no bids*, not *not yet closed*
- [ ] Both agree `closed_at` is distinct from `ends_at`
- [ ] Mohammed confirms no field is renamed or removed without telling Rayan first
- [ ] The money type matches [`S0-12-money.md`](S0-12-money.md), which is settled: exact decimal, two places, no ceiling, canonical format `1,250.00 SAR` (BR-43)
- [ ] Recorded in the `S0-11` issue thread, not only verbally (GITHUB_PLAN §12.1)

## 5. Open, and deliberately not decided here

**Where the two elevated writes live.** ARCHITECTURE ADR-2 puts bid acceptance in a single serialized database operation, and §11.4 caps the system at exactly two elevated operations. That is Rayan's design to implement — this contract fixes only *which fields* they touch, not *how*.

**Verification spike `V-1`** (row-locking semantics) must be answered before `BID-02` starts. It cannot change any field above, but it can change how they are written.
