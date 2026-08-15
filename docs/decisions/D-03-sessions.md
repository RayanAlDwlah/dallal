# D-03 — Sessions (الجلسات): a room of lots opened one at a time, run live by a host

| Field | Value |
|---|---|
| Status | **DECIDED in shape**, with named gaps — by the product owner, 2026-08-15 |
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

1. **What does «أوقف مؤقتًا» do to the open lot's clock?** If a pause freezes `end_time`,
   then `end_time` moves **backwards in wall-clock terms** — and `CLAUDE.md` §5 says
   `end_time` moves *forward only, in 30-second quanta, only inside `place_bid`*. **A pause
   as currently drawn contradicts a rule with a test asserting it.** Either pause does not
   touch the open lot, or the rule needs an explicit second door. **This is the most
   important open question in this document.**
2. **What happens to bids placed on a lot that the host closes early?** They are already
   accepted and recorded. Presumably the highest wins immediately — but "presumably" is
   how a product decision gets invented in code.
3. **«أنهِ الجلسة» with lots still waiting** — do they end unsold, roll to another session,
   or become standalone auctions?
4. **What if the host never shows up?** A session with a start time and no host either
   auto-runs or hangs forever. Both are decisions.
5. **«بدعوة فقط» — invited how?** There is no messaging in this product (`CLAUDE.md` §1)
   and email is never exposed (§6). A link? A code? This one is blocked on §6 and needs an
   answer before it can be built at all.
6. **Is a lot also a standalone auction row, or a separate entity?** «كل قطعة مزاد كامل»
   suggests one table with a nullable `session_id`. That is an `ARCHITECTURE.md` decision
   with a large blast radius on every existing query, `RLS` policy and test.
7. **Does the attendance count («38 حاضر») expose anything?** A count is safe; a list is
   not. §6 — display name is the only public identity.
8. **Can a session be cancelled?** `CLAUDE.md` §5: there is no auction cancel, no edit, no
   draft. A session that can be deleted before it starts is a **new lifecycle state**, and
   `status` having exactly two values is a stated invariant.

## 5. Sequencing

The owner placed this last: *«داخلة، بس آخر شي»*. It is the largest piece of work in the
product and it depends on D-01 (increment), D-02 (categories) and D-05 (deposit) being
settled first. Nothing in §4 should be answered by whoever happens to pick up the ticket.
