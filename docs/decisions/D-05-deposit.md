# D-05 — The deposit (العربون) is simulated, paid once for the hall, and unlocks bidding not watching

| Field | Value |
|---|---|
| Status | **DECIDED in shape**, with the outcome path open — by the product owner, 2026-08-15 |
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

## 4. Still open — do NOT pick an answer

1. **What happens to the deposit when the session ends?** Returned, forfeited, applied to
   the winning amount, or nothing at all because nothing moved? The prototype says the
   money never moves — so the honest answer may be "nothing happens and the screen says
   so", but that is still a decision and it has to be *said*.
2. **What does a losing bidder see?** «العربون محاكاة» has to appear somewhere the user
   actually reads it, or the demo implies a refund that never existed.
3. **بدون — is a deposit-free session the default?** The preset exists; which one is
   pre-selected is not stated.
4. **مبلغ آخر — is it bounded?** `BR-21` / `SEC-R3` forbid a ceiling on a *price*. A deposit
   is not a price. Whether it has a maximum needs to be a decision, not an assumption — the
   same shape as D-01 §5.3.
5. **Is the deposit an `sar_amount`?** It is money-shaped and displayed. If it is stored,
   `CLAUDE.md` §4 applies in full: the `sar_amount` domain, `::text` on every read, one
   formatter, `1,250.00 SAR`. **Do not create a second money type for it.**
6. **Can the host see who paid?** A list of hall entrants is a list of people. §6 — display
   name is the only public identity, email is never exposed, internal ids stay internal.
7. **Does it survive a session that never runs** (D-03 §4.4 — the host never shows up)?
