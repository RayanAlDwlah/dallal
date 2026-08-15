# D-05 — The deposit (العربون) is simulated, paid once for the hall, and unlocks bidding not watching

| Field | Value |
|---|---|
| Status | **DECIDED** — by the product owner, 2026-08-15, including the outcome path (§4). Open items are listed in §5 and carry `O` ids. *(Previously `DECIDED in shape`, a status `README.md` does not define)* |
| Decided by | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah), product owner |
| Evidence | `design-system/previews/create-session.html` step 3, approved |
| Touches | `CLAUDE.md` §1 (no money changes hands), [D-03](D-03-sessions.md), bidding eligibility |
| Not yet in | `PRD.md` |

---

## 1. The decision

**Presets:** بدون · 25 · 50 · 100 · 500 · مبلغ آخر.

> «يُدفع مرة وحدة للدخول للقاعة، ويخوّل المزايدة على كل القطع.»

One payment, per session, for the whole room. Not per lot.

> «المشاهدة مفتوحة للجميع بأي حال — العربون يفتح **المزايدة** مو الفرجة.»

Anyone can watch. The deposit gates **bidding**.

## 2. The sentence that governs everything else

> «هذا عرض توضيحي: العربون **محاكاة**. ما فيه بوابة دفع، ولا حقل بطاقة، ولا مبلغ ينتقل
> فعليًا — **في أي مكان في المنتج**.»

This restates `CLAUDE.md` §1 — Dalal is a demonstration and no money changes hands — and it
closes the door that a deposit feature would otherwise open. **No payment gateway. No card
field. No amount that actually moves. Anywhere.**

The failure mode is specific and predictable, so name it now: a session six weeks from now
reads "deposit", sees no payment integration, concludes the feature is half-built, and
reaches for Stripe. The diff will look like completing the work. **It is out of scope by
decision, not by omission**, and `tests/integration/excluded-features.check.sh` (INT-08) is
where that gets enforced — the same mechanism that already audits the excluded features.

## 3. What "paying" a simulated deposit actually is

It is a **row**: this user has entered this session's hall. It is a state transition with
no financial component — the amount is a label on a button, the same way SAR amounts
everywhere in Dalal are simulated.

Which means the deposit **is an eligibility rule**, and eligibility rules on this project
live on the server:

> A crafted `place_bid` request from a user who never entered the hall must be rejected by
> the **server**, not by a hidden button. `SC-43` — rules hold when the UI is bypassed.

This is a **new rejection reason on the bidding path**, and that is the one line in this
document with real weight. `CLAUDE.md` §5: *a **rejected** bid never extends*. A bid
rejected for want of a deposit must therefore not extend `end_time`, and
`tests/bidding/closing.sql` is where that gets asserted — in the same PR, not after.

Note also what it must **not** become: a *fourth* check in the list of three that must not
exist. It is not a minimum raise, not a ceiling, not a leading-bidder rejection. It is an
eligibility gate, the same category as "the auction has not ended".

## 4. What happens when the session ends — DECIDED

**Owner decision, 2026-08-15:**

> **The simulated deposit's access expires when the session ends. There is no refund
> transaction.**

Read that as an engineer and it is smaller than it looks, which is the point. The deposit
was never a transfer, so there is nothing to reverse. What existed was an **entitlement** —
this user may bid in this hall — and an entitlement scoped to a session simply stops
applying when the session ends.

**What this forbids, explicitly**, because each is the diff a future session would write
while believing it was finishing the feature:

- ❌ a refund path, a reversal row, or a "returned" state
- ❌ an amount moving in either direction, at any point, anywhere
- ❌ applying the deposit to the winning amount
- ❌ a balance, a wallet, or a ledger

`tests/integration/excluded-features.check.sh` (INT-08) is where that stays true.

**What it still requires:** the screen has to *say* so. A demo that shows «عربون 100» and
then goes quiet implies a refund that never existed — `O15`.

## 5. Still open — do NOT pick an answer

Each carries the id it is cited by in [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md). Answered
items are struck rather than deleted so the numbering holds.

1. ~~**What happens to the deposit when the session ends?**~~ **ANSWERED — owner,
   2026-08-15: access expires with the session; there is no refund transaction.** §4.
2. **`O15` — What does a losing bidder see?** «العربون محاكاة» and the expiry both have to
   appear somewhere the user actually reads them, or the demo implies a refund that never
   existed. *Blocks V2-B10.*
3. **`O16` — بدون: is a deposit-free session the default?** The preset exists; which one is
   pre-selected is not stated. *Blocks V2-B9.*
4. **`O17` — مبلغ آخر: is it bounded?** `BR-21` / `SEC-R3` forbid a ceiling on a *price*. A
   deposit is not a price. Whether it has a maximum needs to be a decision, not an
   assumption — the same shape as D-01 §5.3. *Blocks V2-A13.*
5. **`O18` — Is the deposit an `sar_amount`?** It is money-shaped and displayed. If it is
   stored, `CLAUDE.md` §4 applies in full: the `sar_amount` domain, `::text` on every read,
   one formatter, `1,250.00 SAR`. **Do not create a second money type for it.**
   *Blocks V2-A13.*
6. **`O19` — Can the host see who paid?** A list of hall entrants is a list of people. §6 —
   display name is the only public identity, email is never exposed, internal ids stay
   internal. *Blocks V2-B11.*
7. **Does it survive a session that never runs** (D-03 §4 item 4 — the host never shows
   up)? *Folded into `O7`: whatever answers "what if the host never shows up" answers this
   too, and answering them separately is how they end up contradicting each other.*
