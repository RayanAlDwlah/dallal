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

- **up to 10 images**
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
- **وقت الانتهاء** — «على الأقل بعد 5 دقائق من الآن.» A **new minimum-duration rule** that
  is not in any existing document. It is small, it is reasonable, and it is exactly the kind
  of thing that gets implemented without being recorded — so it is recorded.
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

## 4. The image-editing feature is **not** decided by this record

[D-04](D-04-ai-product-surface.md) point 2 (يصلّح الصور) is drawn on step 1 of this very
form, and measurement says **no LLM can do it** — it needs image processing or a hosted
image model, and it is a separate cost. D-04 §5.1 asks the owner whether it is in scope at
all. **Until that is answered, step 1 is a plain uploader.**

What is already decided about it, if it is built: the original is never deleted, «رجّع
الأصلية» works after publish, and the page says «صور معدّلة». «حدّ أخلاقي مو تقني.»

## 5. Still open — do NOT pick an answer

1. **Is at least one image required?** «حتى 10 صور» states a maximum. The minimum is not
   stated, and D-04 point 1 cannot run with zero.
2. **Where do the images live?** Supabase Storage bucket, path convention, and the RLS on
   it. `CLAUDE.md` §6 — internal identifiers stay internal, and a storage path is an
   identifier printed in an `<img src>`.
3. **What happens to uploaded images if the seller abandons the form?** There is no delete
   in this product. That is a decision about storage, not about auctions.
4. **Is 5 MB enforced client-side, server-side, or both?** `SC-43` says a rule that only
   exists in the UI is not a rule.
5. **Does reordering after publish exist?** §2 step 4 says the auction cannot be edited.
   Reordering images is arguably not editing the auction. Arguably is not a decision.
6. **The 5-minute minimum duration** (§2 step 3) — is it also enforced by the server, and
   is it the same minimum for a session lot ([D-03](D-03-sessions.md))?
