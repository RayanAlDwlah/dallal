# D-06 — Images come first, ten of them, and the first one is the cover

| Field | Value |
|---|---|
| Status | **DECIDED** — by the product owner, 2026-08-15 |
| Decided by | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah), product owner |
| Evidence | `design-system/previews/create-auction.html`, approved |
| Touches | `AUC-04` (single-image path), `ADR-6` (upload-before-create ordering), `BR-31`, [D-04](D-04-ai-product-surface.md) |
| Not yet in | `PRD.md` |

---

## 1. Before step 1 — the fork

The create flow opens by asking **what you are creating**, not by asking for a field:

- **مزاد مفرد** — «قطعة وحدة، وقت انتهاء محدّد، وأعلى مزايد يفوز. أي أحد يقدر ينشئه — فرد
  أو شركة.» Marked **الأكثر استخدامًا**.
- **جلسة مزاد** — «عدّة قطع بالتتابع في موعد واحد، مع عربون دخول تحدّده أنت.»

And the correction the owner asked for, in the prototype's own words:

> «هذا هو التصحيح اللي طلبته: **الجلسة نوع مزاد، مو نوع حساب**. ما فيه «حساب شركة» ولا
> توثيق ولا اشتراك — فهد العتيبي يقدر يفتح جلسة زي ما معرض المجد يقدر.»

This is the same decision as [D-03](D-03-sessions.md) §1, recorded here because this is the
screen where it becomes visible: **the fork is between two kinds of listing, never between
two kinds of account.**

## 2. The four steps

**الصور · التفاصيل · المزايدة · المراجعة**

> «البائع ما يشوف نموذجًا طويلاً مرة وحدة — يشوف خطوة، ويعرف كم باقي، ويقدر يرجع. آخر خطوة
> تريه **نفس البطاقة** اللي بيشوفها المشترين، مو ملخّصًا نصيًا.»

The review step renders the **actual card component**, not a text summary. That is a
testable statement: the same component, not a lookalike.

### Step 1 — images, and why they are first

**Owner decision, 2026-08-15:** **every auction requires 1 to 10 images, validated
server-side.** The prototype states the maximum; the minimum is now stated too. One is the
floor because [D-04](D-04-ai-product-surface.md) point 1 cannot run with zero — and because
an auction listing with no picture of the thing is not a listing. `SC-43`: both bounds are
enforced by the database, not by the uploader.

- **1 to 10 images — required**
- **JPG, PNG or WebP**
- **5 MB per image**
- **drag to reorder. The first is the cover** — «هي اللي تطلع في البطاقة وفي الإشعارات»

> «الصور أول خطوة مو آخرها، لسببين: البائع عنده الصور جاهزة في جواله قبل ما يفكّر في
> الوصف، **والمساعد ما يقدر يساعد قبل يشوف الشيء**.»

The second reason is structural: [D-04](D-04-ai-product-surface.md) point 1 reads the images
to propose the title, description and category. **The ordering of the form is a dependency
of the AI feature**, not a preference. Anyone who moves images to the last step has broken
step 2.

### Step 2 — details, with the assistant beside them

The AI proposes; two buttons follow: **استخدم المقترح** and **أكتب بنفسي**.

- **اسم المنتج** — 3 to 120 characters
- **الوصف** — 20 to 2000 characters
- **التصنيف** — the D-02 picker
- **مواصفات — اختيارية**: «الحقول تتغيّر حسب التصنيف. **كلها اختيارية — ما تمنع النشر**.»

That last line **answers [D-02](D-02-categories.md) §4.2**: the category-specific fields are
optional and never block publishing. It does not answer §4.1 — how they are stored is still
open.

### Step 3 — bidding

- **سعر البداية** — «أول مزايدة بهذا المبلغ بالضبط مقبولة.» That is `BR-29` / `SC-55` and
  it matches [D-01](D-01-bid-increment-button.md) §1a: the first press bids the starting
  price itself.
- «**ما فيه حد أعلى للسعر ولا سعر احتياطي**» — `BR-21`, `BR-35`, printed on the screen the
  seller uses.
- **مقدار الزيادة** — «المبلغ لازم يكون من مضاعفات العشرة. المزايد ما يكتب رقمًا — يضغط
  زرًا.» D-01.
- **وقت الانتهاء** — «على الأقل بعد 5 دقائق من الآن.»

  > **Correction, 2026-08-15.** This record originally called that *"a new minimum-duration
  > rule … not in any existing document"*. **That was wrong.** It is **`BR-38`**
  > (`PRD.md:806`), with `FR-CREATE-09`, `FR-CREATE-10`, `FR-CREATE-10a` and `SC-68`: the
  > permitted duration is **5 minutes to 7 days, inclusive, by server time**. It is already
  > a `CHECK` constraint
  > (`supabase/migrations/20260812120000_bid02_bid_acceptance.sql:500-501`) with a four-case
  > boundary test.
  >
  > What the prototype shows is the **existing** floor, and the screen omits the **existing
  > ceiling**. V2 enforces the range at **both** ends (ticket V2-A5) rather than inventing a
  > floor that was already there. Whether the same bound applies to a *session lot's
  > duration* is a genuinely separate question — §5 item 6.
- Anti-sniping stated to the seller: «أي مزايدة في آخر 15 ثانية تمدّد الوقت 30 ثانية، حتى
  20 مرة.» `BR-36`, unchanged.

**And the note the prototype insists on carrying:**

> «ملاحظة تقنية لازم تنكتب هنا عشان ما تنقلب بعدين: الزر يعرض مقدارًا واحدًا — هذا قرار
> واجهة. **الخادم ما زال يقبل أي مبلغ أعلى من السعر الحالي**؛ ما أضفنا حدًّا أدنى للزيادة
> ولا سعرًا احتياطيًا. اللي تغيّر هو ما تعرضه الشاشة، مو ما تقبله القاعدة.»

That is D-01 §2 — *BR-32 governs what the server accepts; D-01 governs what the screen
offers* — written into the product surface itself, by the owner, unprompted.

### Step 4 — review

> «بعد النشر ما تقدر تعدّل المزاد ولا تلغيه، ويستمر لين وقت انتهائه. هذه آخر فرصة تصلّح
> فيها شي.»

`BR-31` and `CLAUDE.md` §5 — no cancel, no edit, no draft — stated to the seller in advance
rather than discovered afterwards.

## 3. What this breaks, named

| existing thing | what changes |
|---|---|
| **`AUC-04`** — the single-image path | becomes a 1-to-10 ordered list. The cover is position 0, not a separate column |
| **`ADR-6`** — upload before create | ten uploads before create. What happens to nine orphaned uploads when the eleventh step fails is a real question, and the product has **no delete** (`BR-30`, `BR-31`) |
| the card | already renders a cover; it now renders **position 0 of an ordered set** |
| notifications | «الغلاف هو اللي يطلع في الإشعارات» — the cover has a second consumer |

## 4. The image-editing feature — in scope, and it is not the text model

**Owner decision, 2026-08-15: [D-04](D-04-ai-product-surface.md) point 2 (يصلّح الصور)
remains in scope.**

Measurement established what it is *made of*, not whether it ships: **no text or
vision-language model outputs an edited image.** It needs a **separate image-processing /
image-model pipeline**, with its own provider, its own cost and its own latency. So it is
three tickets rather than a free rider on the assistant: **V2-A14** (a timeboxed provider
spike that produces options and no product code), **V2-A16** (the pipeline), **V2-B12** (the
surface), over **V2-A15** (original and derived storage) and contract **V2-C7**.

Step 1 is a plain uploader **until V2-A15 and V2-A16 land** — that is a sequencing fact
now, not an open question.

The three constraints ship together or not at all: the original is never deleted, «رجّع
الأصلية» works **after publish**, and the page says «صور معدّلة». «حدّ أخلاقي مو تقني.»
Which provider does the work is `O24` — and **V2-A14 exists to produce the options the
owner picks from**, not to pick for them.

## 5. Still open — do NOT pick an answer

Each carries the id it is cited by in [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md). Answered
items are struck rather than deleted so the numbering holds.

1. ~~**Is at least one image required?**~~ **ANSWERED — owner, 2026-08-15: 1 to 10 images,
   required, validated server-side.** §2 step 1.
2. **`O20` — Where do the images live?** Supabase Storage bucket, path convention, and the
   RLS on it. `CLAUDE.md` §6 — internal identifiers stay internal, and a storage path is an
   identifier printed in an `<img src>`. *Blocks V2-C2, V2-A2, V2-A15.*
3. **`O21` — What happens to uploaded images if the seller abandons the form?** There is no
   delete in this product (`BR-30`, `BR-31`). That is a decision about storage, not about
   auctions — and it gets **larger** now that enhancement produces derived images too.
   *Blocks V2-A2, V2-A15.*
4. ~~**Is 5 MB enforced client-side, server-side, or both?**~~ **ANSWERED by `SC-43` and by
   the 1–10 decision, and recorded here so nobody re-opens it:** server-side, and
   additionally in the UI as a courtesy. A limit that exists only in the browser is not a
   limit. This was never a product question; it was a restatement of an existing rule.
5. **`O22` — Does reordering after publish exist?** §2 step 4 says the auction cannot be
   edited. Reordering images is arguably not editing the auction. Arguably is not a
   decision. *Blocks V2-B7.*
6. **`O23` — Does a session lot use the same duration bound?** The standalone-auction
   answer is settled and was never open: `BR-38`, 5 minutes to 7 days, already a `CHECK`
   (§2 step 3). What is open is whether a **lot's duration** ([D-03](D-03-sessions.md) §2
   step 1 — a duration, not an absolute end time) carries the same bound.
   *Blocks V2-A10, V2-C6.*
