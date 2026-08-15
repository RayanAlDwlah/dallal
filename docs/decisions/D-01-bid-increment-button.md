# D-01 — The bid control is a button carrying a seller-set amount

| Field | Value |
|---|---|
| Status | **DECIDED** — by the product owner, 2026-08-15 |
| Decided by | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah), product owner |
| Touches | **BR-32** (no bid increment), BR-29 / SC-55 (first bid), BR-03, FR-BID-* |
| Blocks | the bid panel's input, `place_bid`'s signature, the auction record |
| Open items | **`O25`–`O30`** (§5) — they block `V2-C3`, `V2-A3`, `V2-B5` |
| Not yet in | `PRD.md` |

---

## 1. The decision, in the owner's words

> «حتى زر اللي هو اقلك نحط زر ومكتوب جواه الرقم اللي حطه المالك هذا ننفذه غصب عنك مو على
> كيفك — نبي الزياده ب مبلغ مضاعفات العشره اللي حدده لنا المالك ويكون في زر مو شي ينكتب،
> لان جربنا كتابه اعداد كبيره مره راح كذا طويل الرقم وجاي على طول الصفحه ووسعها ف ذا بق
> ومانبي نصلحه»

Four things are decided by that sentence and nothing else is:

1. The bidder **presses a button**. There is no free-text amount field.
2. The button **displays the amount it will bid**.
3. That amount comes from an increment the **seller sets when creating the auction**, in
   multiples of ten.
4. The reason is a measured layout failure: a long typed number widened the page.
   The owner's instruction is that this is not to be solved by fixing the layout.

### 1a. A fifth thing, decided separately on 2026-08-15

The question below was raised as **open** — *what does the FIRST press bid?* — precisely
because the prototype had answered it without being told to. Put to the owner directly, he
answered:

> «جاوب سوالك اللي تقول اهمها — اختياري هو سعر البدايه»

5. **The first press bids the starting price itself**, not the starting price plus the
   increment. This is `BR-29` / `SC-55` — the first bid may **equal** the starting price —
   and the button now matches the rule rather than sitting one increment above it.

The increment therefore applies **from the second press onwards**: `current price +
increment`. The prototype was already doing this; the difference is that it is now a
decision rather than an inherited accident, which is the entire reason this section exists.

Note what this does **not** settle: it does not answer §5.6 (what the button offers when
the current price is not a multiple of the increment, which happens the moment a crafted
request bids `+0.01` — and §2 says that bid must be accepted). Deciding where the first
press lands does not decide where every later press lands.

## 2. Why this document exists at all — it looks like it contradicts BR-32

`CLAUDE.md` §5 lists three checks that **must not exist**, and the first is:

> ❌ **no bid increment / minimum raise** — `+0.01` is as valid as `+1000` (`BR-32`)
>
> Adding any of these is **a bug**, not an improvement. They were deliberately removed and
> their **absence is the requirement**.

A column called `bid_increment` walking into that repository is going to look like the
violation §5 is about. It is not, and the difference is one sentence:

> **BR-32 governs what the SERVER ACCEPTS. D-01 governs what the SCREEN OFFERS.**

They coexist if and only if the increment is a **presentation affordance** — a convenient
default on a button — and never a **validation rule**. The server's answer to "is this bid
valid?" must be exactly what it is today: strictly greater than the current price
(`BR-03`), or equal to the starting price if it is the first (`BR-29`). Nothing else.

Concretely, after D-01 ships, **all of these must still be accepted by `place_bid`**:

| bid | why it must be accepted |
|---|---|
| current price + `0.01` | `BR-32` — the smallest raise is still a raise |
| current price + `7.13` | not a multiple of the increment, and that is not a reason |
| an amount from a crafted request that never saw the button | `SC-43` — rules hold when the UI is bypassed |
| an amount far larger than the increment | `BR-21`, `SEC-R3` — there is no ceiling |

## 3. The regression this will cause, named in advance

This is the reason the record is this long. The failure is predictable, and it is
predictable because it is *reasonable*:

> A session six weeks from now reads `BR-32` in `CLAUDE.md`. It then reads a
> `bid_increment` column in the schema. It concludes — correctly, from what it can see —
> that the schema is missing a constraint, and adds:
>
> ```sql
> check (amount = current_price + bid_increment)      -- or: amount % bid_increment = 0
> ```
>
> It type-checks. Every existing test passes, because every existing test bids in round
> numbers. The diff reads as tightening. It gets approved. **`BR-32` is now dead** and the
> product silently rejects a valid bid.

Nothing in this repository currently stops that. Documents do not stop it — the session
that does this will have *read* BR-32 and still done it, because a column that exists and
is unconstrained looks like an oversight.

### What stops it

**A test whose name is the rule**, in `tests/bidding/acceptance.sql`:

> `the server accepts an amount that is NOT a multiple of the increment`

That assertion fails the moment somebody adds the constraint above. It is not a test of
the increment feature; it is a test of `BR-32` *surviving* the increment feature, and it
has to be written **in the same PR that adds the column** — not after, not as a follow-up
issue. A follow-up issue is a promise, and this document exists because promises are not
mechanisms.

Same reasoning as the 20-extension cap being a `CHECK` and not an `if` (`CLAUDE.md` §5):
the rule has to live somewhere a future session cannot delete without the deletion being
the visible subject of the diff.

## 4. An existing guard WILL go red, and that is correct

Measured on `main` at `7155319`, not predicted:

`tests/integration/excluded-features.check.sh` asserts, and expects zero:

```sh
chk "no bid increment / minimum raise" \
    "$(( $(count_ts '\b(bid_?increment|bidIncrement|min_?raise|minRaise|increment_?step)\b') \
       + $(count_sql '\b(bid_?increment|min_?raise)\b') ))" 0
```

The day a `bid_increment` column lands, **INT-08 fails**. That is the guard doing its job,
and there is exactly one acceptable response:

- ✅ **Narrow the check, in the same PR, so it bans `min_raise` / `minRaise` — the
  validation rule — and permits `bid_increment` — the affordance.** The PR then has to
  state, in its body, that BR-32 is unchanged, and the new acceptance-test above has to be
  in the same diff.
- ❌ **Deleting the check.** ❌ **Adding an ignore.** ❌ **Renaming the column to slip past
  the pattern.** All three make the tree green while removing the only thing watching
  BR-32.

## 5. Still open — do NOT pick an answer for any of these

Everything in §1 is decided. Everything below is not, and each one is a place where
`CLAUDE.md` §8's failure mode is waiting:

> **Each open item now carries an `O`-id**, added 2026-08-15. `README.md` rule 5: *"a gap
> with no id cannot be cited as a blocker, and a gap that cannot be cited gets filled
> silently."* This record was the last one whose gaps had no ids, and the cost of that was
> measured, not theorised — see §5a.

1. **`O25` — is the increment required at creation, or optional with a default?** If
   optional, what is the default, and does "no increment" mean the button is hidden or that
   it carries some fallback?
2. **`O26` — "مضاعفات العشره" — multiples of ten of what?** Ten SAR (10, 20, 30…), or any
   value that is itself a multiple of ten (so 10 and 500 are legal, 15 is not)? These are
   different rules and both fit the sentence.
3. **`O27` — is there an upper bound on the increment?** Note that `BR-21` / `SEC-R3` forbid
   a ceiling on a *price*. An increment is not a price — but deciding it has a maximum
   needs to be a decision, not an assumption.
4. **`O28` — one button or several?** The prototype shows a single button. ×1 / ×2 / ×5 is
   an obvious extension and has not been asked for.
5. ~~**What does the FIRST press bid?**~~ **ANSWERED 2026-08-15 — see §1a.** The first
   press bids **the starting price itself** (`BR-29` / `SC-55`). Left in place, struck
   through rather than deleted, because the point of this list is that a gap was named
   before it was filled — and this is the one entry that proves the mechanism worked: the
   prototype had already picked an answer, the pick was flagged as an implementation
   choice rather than a decision, and the owner then made it a decision. Numbering is
   unchanged so that §1a's reference to §5.6 does not silently point at the wrong item.
6. **`O29` — what if the current price is not a multiple of the increment** — because a
   crafted request bid `+0.01`, which §2 says must be accepted? Does the button then offer
   `current + increment` (leaving the price off-grid forever), or round up to the next
   multiple? "Round up" is the reasonable-looking answer and it is a **product decision**,
   because it changes what a bidder is charged.
7. **`O30` — can the seller change the increment after publishing?** `BR-31` says an auction
   is immutable after creation. If the increment lives on the auction row, the answer is no
   by construction — but that should be intentional, not incidental.

### 5a. What having no ids cost, measured

The six items above were written down, in this file, under a heading that says *"do NOT pick
an answer for any of these"* — and the board still called their tickets startable. Measured
on `docs/v2/TICKETS.md` before this edit:

| ticket | *blocked on* said | actually blocked by |
|---|---|---|
| **V2-C3** — contract: the bid button | `—` | `O25`, `O26`, `O27`, `O28`, `O29`, `O30` — **all six** |
| **V2-A3** — the `bid_increment` column | `—` | `O25` (nullable?), `O26` (the CHECK), `O27` (an upper bound), `O30` (immutable?) |
| **V2-B5** — the bid button | `—` | `O25` (hidden or fallback), `O28` (one button or three), `O29` (what it offers off-grid) |

All three sat in the board's *"Seven tickets startable today"* set. They were startable in
the only sense the board could compute — **nothing they cited was open, because they could
not cite anything.** A gap with no id does not read as a blocker; it reads as an absence of
blockers, which is the same shape as being ready.

The corrected **unblocked** set is **four**: `V2-A14`, `V2-B1`, `V2-B2`, `V2-B3` — of which
**two** can actually be started, the other two sitting behind `V2-B1`. Recomputed by
[`tests/v2/graph.check.mjs`](../../tests/v2/graph.check.mjs), not by hand.

## 6. What must be true before any of this is implemented

- [ ] §5 answered by the owner — **1 of 7 done** (§5.5, in §1a); `O25`–`O30` open
- [ ] `PRD.md` carries the decision, and `BR-32` gains a sentence distinguishing the
      server rule from the screen affordance
- [ ] an `ADR` in `ARCHITECTURE.md` §20 recording that the increment is presentation
- [ ] `tests/bidding/acceptance.sql` carries the non-multiple assertion from §3
- [ ] `tests/integration/excluded-features.check.sh` narrowed per §4, in the same PR
- [ ] `place_bid`'s validation is **unchanged** — the diff should touch the schema, the
      UI, and the tests, and not one line of the acceptance logic
