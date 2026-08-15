# D-03 — Sessions (الجلسات): a room of lots opened one at a time, run live by a host

| Field | Value |
|---|---|
| Status | **DECIDED** — by the product owner, 2026-08-15. Open items are listed in §4 and carry `O` ids. *(This record previously read `DECIDED in shape`, a status `README.md` does not define — see its §"The rules" item 4)* |
| Decided by | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah), product owner |
| Evidence | `design-system/previews/create-session.html`, `session-card.html`, approved |
| Touches | a **new entity**, `BR-36` (extension), `LC-03`, `BR-31`, the closing path |
| Not yet in | `PRD.md` |

---

## 1. What a session is

> «الجلسة عرض متتابع: قطعة تفتح، تنتهي، تفتح اللي بعدها — والحاضرين في نفس الغرفة طول
> الوقت. صاحبها يبنيها قبل الموعد، ويقودها لحظتها من غرفة تحكّم.»

And the sentence that settles the question that was actually asked:

> «الجلسة نوع مزاد، مو نوع حساب.»

A session is **a kind of auction, not a kind of account.** The owner said this directly in
chat when the question was whether sessions belong to dealerships:

> «بس برضه المزاد يقدر يرفع فيه الافراد و الشركات مو بس شركات عندهم معرض مزاد»

**Any individual or company can create a session.** There is no dealer tier, no
verification gate, no separate account type. Whatever gates a session, it is not who you
are.

## 2. The four creation steps

**المعلومات · القطع · الدخول · المراجعة**

### Step 1 — session information
Name, description, cover image, **start date and time**, city.

> «الجلسة تبدأ في وقتها. مدة كل قطعة تنحدّد في الخطوة الجاية، مو وقت انتهاء مطلق لكل وحدة.»

This is the structural difference from a standalone auction and it is worth stating twice:
**a lot carries a duration, not an absolute `end_time`.** A lot's end time does not exist
until the lot opens. `LC-03` — eligibility is the server clock against `end_time`, never
the stored status — still holds; it just means `end_time` is *computed at open* rather than
at creation.

### Step 2 — the lots, in order

> «كل قطعة مزاد كامل بحد ذاته — لها تصنيف وسعر بداية ومقدار زيادة ومدة. اللي يجمعها هو
> الترتيب والغرفة.»

Each lot is a **complete auction**: category (D-02), starting price, increment (D-01),
duration. What a session adds is *ordering* and *a shared room* — nothing else.

**Extension inside a session:**

> «التمديد يشتغل على القطعة المفتوحة: مزايدة مقبولة في آخر 15 ثانية تضيف 30 ثانية لهذي
> القطعة، حتى 20 مرة — وما تأخّر الجلسة كلها إلا بقدرها.»

`BR-36` is **unchanged**: 15 s → +30 s, hard cap 20, cap is a `CHECK` constraint
(`CLAUDE.md` §5). It applies to the **open lot**, and the session's own schedule slides by
exactly the accumulated extension and by nothing else. There is no session-level cap and
no session-level extension.

### Step 3 — entry and the deposit
See **[D-05](D-05-deposit.md)**. In one line: presets بدون / 25 / 50 / 100 / 500 / مبلغ
آخر, paid once for hall entry, entitles bidding on **every** lot — and it is simulated.

> «المشاهدة مفتوحة للجميع بأي حال — العربون يفتح المزايدة مو الفرجة.»

Access is either **أي أحد بعد دفع العربون** or **بدعوة فقط**.

### Step 4 — review and publish

> «بعد النشر تقدر تضيف قطعة أو تعيد الترتيب قبل بداية الجلسة فقط. بعد ما تبدأ، القطع
> تُفتح بالترتيب وما تتغيّر.»

This is a **deliberate narrowing of `BR-31`**, not a violation of it, and the difference
has to be written into the PRD before anyone implements it. `BR-31` makes an auction
immutable after creation. A session's lot list is mutable between publish and start, and
frozen from start onwards. **Each individual lot stays `BR-31`-immutable throughout** —
what moves is the order and the membership of the list, never the contents of a lot.

## 3. The host's control room

Live, during the session. What the prototype shows:

- **«القطعة 2 من 4»**, a live attendance count («38 حاضر · 14 مزايد»)
- the lot list with states: past / **الآن** / بالانتظار
- three controls: **أغلق وافتح القطعة 3** · **أوقف مؤقتًا** · **أنهِ الجلسة**

### 3.0 «أوقف مؤقتًا» — DECIDED, and it moves an invariant

**Owner decision, 2026-08-15:**

> **Pause is supported.** A **host-only atomic database operation** pauses and resumes a
> lot, and **moves `end_time` forward by the paused duration.** The existing invariant and
> its tests are updated explicitly.

This is the one V2 decision that amends a rule with a test asserting it, so it is written
into **`CLAUDE.md` §5** in full — that section governs, and this is a pointer to it, not a
second copy.

**Unchanged and still absolute:** `end_time` moves **forward only**; `place_bid` remains
the only caller that moves it in **30-second quanta**; **pause never increments
`extension_count`**; the extension cap stays a `CHECK` constraint, not an `if`.

**What changed:** the sentence *"only inside `place_bid`"* becomes *"inside `place_bid`,
**or** inside the pause/resume operation"*. **One** additional door, named — not a general
licence to move the clock.

**Four conditions, all of them:**

1. **Host-only**, from the verified server session — never a client-supplied id
   (`CLAUDE.md` §6; this is a `SECURITY DEFINER` surface)
2. **Atomic**, taking the same row lock as `place_bid`
3. **Forward by the paused duration and by nothing else** — not a quantum, not a rounding,
   not a minimum
4. **A paused lot accepts no bids**

`CLAUDE.md` §5 also names, assertion by assertion, what changes in
`tests/bidding/closing.sql` — including that the guard **must still refuse an unflagged
update**. A pause implemented by turning the guard off is a pause that removed the
invariant. Ticket: **V2-A19**.

> **Do not read this section as a complete specification of pause.** All four conditions
> above are about the **paused lot**. What a pause does to the rest of the session — a bound
> on how long it may last, the lots queued behind it, and whether the operation even takes a
> lot or a session — is **`O31`, `O32` and `O33` in §4a**, and V2-A19 is blocked on all three.

### 3.1 The one rule in here that is a correctness rule, not a UX rule

> «أغلق وافتح القطعة 3» تنغلق تلقائيًا لمّا يخلص وقت القطعة — الزر للمضيف اللي يبي يسرّع،
> مو الطريقة الوحيدة. وهي **معطّلة** في آخر 15 ثانية من قطعة فيها تمديد نشط: مضيف يقفل
> قطعة وأحدهم زايد عليها قبل نصف ثانية هو بالضبط الشيء اللي التمديد موجود عشانه.

Read that again as an engineer. **A host advance is a way to defeat anti-sniping**, and
disabling a button does not stop it — `SC-43`, rules hold when the UI is bypassed. So:

> The refusal to advance during an active extension window belongs in the **server-side
> advance function**, not in the button's `disabled` attribute. A crafted request must get
> the same answer as a greyed-out button.

That is the same reasoning as the extension cap being a `CHECK` and not an `if`
(`CLAUDE.md` §5), applied to a new surface, and it is the single most likely thing for a
future session to implement as UI-only.

### 3.2 The prototype says these are new

> «هذي قرارات جديدة، مو قواعد قائمة. ترتيب القطع، المدة لكل قطعة، إيقاف الجلسة مؤقتًا،
> وصلاحيات المضيف — كلها تُقرّر هنا لأول مرة. مكتوبة في الصفحة عمدًا عشان تنراجع وتنسجّل،
> مو عشان تنسلّ في الكود.»

The prototype itself is asking for this record to exist. That is why §4 is as long as it is.

## 4. Still open — do NOT pick an answer for any of these

Each carries the id it is cited by in [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md) and in the
tickets it blocks. Answered items are struck rather than deleted so the numbering holds.

1. ~~**What does «أوقف مؤقتًا» do to the open lot's clock?**~~ **ANSWERED — owner,
   2026-08-15: pause is supported.** A host-only atomic operation moves `end_time` **forward
   by the paused duration**. §3.0, and `CLAUDE.md` §5 carries the amended invariant and the
   named test changes. Ticket **V2-A19**.
2. **`O5` — What happens to bids placed on a lot that the host closes early?** They are
   already accepted and recorded. Presumably the highest wins immediately — but "presumably"
   is how a product decision gets invented in code. *Blocks V2-A11.*
3. **`O6` — «أنهِ الجلسة» with lots still waiting** — do they end unsold, roll to another
   session, or become standalone auctions? *Blocks V2-A12.*
4. **`O7` — What if the host never shows up?** A session with a start time and no host
   either auto-runs or hangs forever. Both are decisions. *Blocks V2-A12.*
5. **`O8` — «بدعوة فقط»: invited how?** There is no messaging in this product
   (`CLAUDE.md` §1) and email is never exposed (§6). A link? A code? This one is constrained
   by §6 and needs an answer before it can be built at all. *Blocks V2-A10, V2-B9.*
6. **`O4` — Is a lot also a standalone auction row, or a separate entity?** «كل قطعة مزاد
   كامل» suggests one table with a nullable `session_id`. That is an `ARCHITECTURE.md`
   decision with a large blast radius on every existing query, `RLS` policy and test.
   **This is now the most expensive open question on the board** — the two that used to
   outrank it are decided. *Blocks V2-C6, V2-A10, and through them all of phase 4.*
7. **`O9` — Does the attendance count («38 حاضر») expose anything?** A count is safe; a list
   is not. §6 — display name is the only public identity. *Blocks V2-B11.*
8. **`O10` — Can a session be cancelled?** `CLAUDE.md` §5: there is no auction cancel, no
   edit, no draft. A session that can be deleted before it starts is a **new lifecycle
   state**, and `status` having exactly two values is a stated invariant. *Blocks V2-A10.*
9. **`O23` — Does a lot's duration use the same `BR-38` bound** — 5 minutes to 7 days
   inclusive — as a standalone auction? A lot carries a duration rather than an absolute end
   time (§2 step 1), so the bound applies to a different quantity and may not transfer.
   *Blocks V2-A10, V2-C6.* Raised in [D-06](D-06-images-and-create-flow.md) §5 item 6.

### 4a. What pause left open — three questions the decision did not reach

Item 1 above is answered: pause exists, it is host-only and atomic, and it moves `end_time`
forward by the paused duration. §3.0 states four conditions and **all four are about the lot
being paused**. A session is not one lot — it is *«قطعة تفتح، تنتهي، تفتح اللي بعدها»* — and
none of the four says what a pause does to the rest of the room.

> **These are raised, not decided** (`CLAUDE.md` §8, `TEAM.md` rule 16). In each one the
> *reasonable* answer is already visible, which is exactly the condition §8 warns about.

10. **`O31` — Is total paused time bounded, and what happens if the host pauses and never
    resumes?** `CLAUDE.md` §5 is unambiguous about why the 20-extension cap is a `CHECK` and
    not an `if`: *"without it a contested auction never ends, never finalizes, and never has
    a winner."* Pause is the second door onto `end_time` and it currently has **no cap of
    any kind** — one host, one un-resumed pause, and the lot hangs exactly as an uncapped
    extension chain would. Whether the answer is a maximum total, a maximum per pause, an
    auto-resume, or a deliberate *"no bound, the host is trusted"*, it has to be **decided** —
    and if it is a bound, it belongs where the extension cap lives, not in an `if`. One
    quantity this does *not* settle either way: `BR-38` bounds the duration chosen at
    **creation**, and a realised `end_time` already runs past it (20 × 30 s). *Blocks
    V2-A19.*
11. **`O32` — Does pausing lot 3 move lots 4…N, and is a waiting lot's time a promise?**
    Lots chain — one ends, the next opens — so a ten-minute pause on lot 3 delays everything
    behind it by ten minutes, mechanically. What is undecided is whether that is *correct*,
    and what a bidder was promised: someone who came for lot 9 read a time in the live room,
    and this product has no messaging (`CLAUDE.md` §1) to tell them it moved. The answer
    decides whether a waiting lot shows a **time**, an **order**, or nothing.
    *Blocks V2-A19, V2-B10, V2-B11.*
12. **`O33` — Is pause an operation on a LOT or on the SESSION? Two owner sentences from the
    same day disagree.** §3.0 records *"pauses and resumes a **lot**"*; §3.2 records the
    owner listing what is newly decided as *«ترتيب القطع، المدة لكل قطعة، **إيقاف الجلسة
    مؤقتًا**، وصلاحيات المضيف»* — pausing **the session**. Those are different operations:
    one takes a lot id and one takes a session id; one is impossible between lots and the
    other is the ordinary case for a host who needs five minutes. The control room draws a
    single «أوقف مؤقتًا» button and the button does not disclose which it is.
    **Surfaced, not resolved** — `CLAUDE.md` §2: *"If you find a contradiction between
    documents, surface it. Do not silently pick a side."* A session picking the reading that
    suits the code it is about to write is how the other reading gets deleted.
    *Blocks V2-A19, V2-B11.*

## 5. Sequencing

The owner placed this last: *«داخلة، بس آخر شي»*. It is the largest piece of work in the
product and it depends on D-01 (increment), D-02 (categories) and D-05 (deposit) being
settled first. Nothing in §4 should be answered by whoever happens to pick up the ticket.
