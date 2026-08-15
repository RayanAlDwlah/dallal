# D-02 — Thirteen categories, sourced not invented, and the category changes the form

| Field | Value |
|---|---|
| Status | **DECIDED** — by the product owner, 2026-08-15 |
| Decided by | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah), product owner |
| Evidence | `design-system/previews/categories.html`, approved |
| Touches | `auctions` schema (new column), create-auction form, browse/filter, search |
| Not yet in | `PRD.md` |

---

## 1. The decision

Thirteen main categories and 110 sub-categories. The record's own words:

> «ثلاثة عشر قسمًا ومئة وعشر أقسام فرعية. ما اخترعناها — مأخوذة من أقسام حراج الحقيقية
> ومن سبع منصات مزادات خليجية، وشِلنا منها كل اللي ما ينباع بالمزاد.»

**The list, and the slug each one carries:**

| # | Arabic label | slug |
|---|---|---|
| 1 | سيارات ومركبات | `vehicles` |
| 2 | لوحات وأرقام مميزة | `plates-numbers` |
| 3 | عقارات | `real-estate` |
| 4 | ساعات ومجوهرات | `watches-jewelry` |
| 5 | أجهزة وإلكترونيات | `electronics` |
| 6 | أثاث ومفروشات | `furniture` |
| 7 | نوادر ومقتنيات | `collectibles` |
| 8 | مواشي وحيوانات | `livestock` |
| 9 | معدات وآلات ثقيلة | `heavy-equipment` |
| 10 | فنون وتحف | `art` |
| 11 | أزياء وحقائب | `fashion` |
| 12 | رياضة وصيد ورحلات | `outdoors` |
| 13 | منقولات متنوعة | `misc` |

### 1.1 Where the list came from — this is the part that matters

- **حراج** (`haraj.com.sa/all-sections/`) — 19 main sections with their branches, **read
  from the page, not from memory**.
- **Read directly for comparison:** Emirates Auction, Infath (إنفاذ), Soum, Mazadak.
- **Returned 403 / SSL errors**, so only what appeared in search results was used: المزاد
  الحر, مزاد عُمان, السوق المفتوح.

**Deliberately excluded**, each because it is a classified ad and not an auction — there
is nothing that can be knocked down to a highest bidder:

> وظائف · خدمات · تعليم وتدريب · برمجة وتصاميم · أطعمة ومشروبات · حفلات ومناسبات · سفر
> وسياحة · مطلوب · مفقودات

### 1.2 `misc` is a decision, not laziness

> «كل ما لا يندرج تحت قسم» — «منقولات متنوعة» موجود في إنفاذ و Emirates Auction بنفس
> المعنى. ما هو كسل — هو الاعتراف بأن أي تصنيف مقفل يصد بائعًا شرعيًا.

A closed taxonomy turns a legitimate seller away. Two of the four platforms read directly
carry the same escape hatch under the same name.

## 2. The category changes the form — the structural half

This is the part with real schema consequences, and it is easy to miss because it looks
like a UI detail. **Each category asks for different extra fields:**

| category | the fields it asks for |
|---|---|
| `vehicles` | الماركة · الموديل · سنة الصنع · الممشى · ناقل الحركة · حالة الفحص |
| `plates-numbers` | نص اللوحة أو الرقم · عدد الخانات · نوع اللوحة · المشغّل |
| `real-estate` | المدينة والحي · المساحة (م²) · الواجهة · عرض الشارع · رقم الصك |
| `watches-jewelry` | الماركة · الموديل/المرجع · سنة الصنع · العلبة والأوراق · الحالة |
| `electronics` | الماركة · الموديل · السعة · الحالة · الضمان |
| `furniture` | عدد القطع · الخامة · المقاس · الحالة |
| `collectibles` | السنة · بلد المنشأ · شهادة توثيق · الحالة |
| `livestock` | النوع/السلالة · العدد · العمر · الوزن التقريبي · الموقع |
| `heavy-equipment` | الماركة · الموديل · سنة الصنع · ساعات التشغيل · حالة التشغيل |
| `art` | الفنان · السنة · المقاس · الخامة · شهادة أصالة |
| `fashion` | (per the prototype's table) |

### 2.1 The trap this sets, named in advance

The obvious implementation is a column per field. Thirteen categories × five fields is
**sixty-odd mostly-null columns on `auctions`**, and `BR-31` says an auction is immutable
after creation, so every one of them is dead weight forever.

The other obvious implementation is one `jsonb attributes` column, which is unqueryable
in practice and lets any session write any key.

**Neither is decided here.** §4 lists it as open. What *is* decided is that the category
determines the field set — how that is stored is an architecture decision that needs
`ARCHITECTURE.md`, not a guess in a migration.

**One thing is not negotiable regardless of the storage choice:** none of these fields is
an amount. `المساحة`, `الممشى`, `عدد الخانات`, `الوزن` are quantities, not money. The
`sar_amount` domain and `CLAUDE.md` §4 apply to `starting_price` and to bids, and adding a
second money-shaped field here without saying so would be exactly the silent change §9
exists to stop.

## 3. The two surfaces the list appears on

**The filter bar** — top of browse, horizontal scroll, **starts from the right**, first
item «الكل» and it stays pinned:

> «بدونه ما فيه طريقة تلغي التصفية بضغطة وحدة.»

It shows a **subset** — الكل · سيارات ومركبات · عقارات · ساعات ومجوهرات · لوحات وأرقام ·
مواشي · إلكترونيات · معدات — not all thirteen. Which subset, and whether it is fixed or
driven by volume, is open (§4).

**The picker** — inside the create-auction form. Two columns, main on the **right**, sub
on the **left**:

> «لأن العين العربية تبدأ من اليمين. السهم يشاور يسار لأنه يشاور للعمود الجاي، مو لأنه
> «رجوع».»

That sentence is a `CLAUDE.md` §3 statement and it belongs in the design system: in RTL a
`›` pointing left means *forward*, and anyone who "fixes" it to point right has broken it.

## 4. Still open — do NOT pick an answer

1. **How are the category-specific fields stored?** Columns, `jsonb`, or a side table.
   This is an `ARCHITECTURE.md` decision (§2.1).
2. ~~**Are the extra fields required or optional?**~~ **ANSWERED** — `create-auction.html`
   step 2 says «مواصفات — اختيارية … الحقول تتغيّر حسب التصنيف. كلها اختيارية — **ما تمنع
   النشر**». Optional, and never a publish blocker. See [D-06](D-06-images-and-create-flow.md)
   §2. Struck rather than deleted so the numbering below does not shift.
3. **Is a category required on every auction?** `misc` exists, which suggests yes — but
   "there is always a valid answer" is not the same as "the field is `not null`".
4. **Fixed or extensible?** If the thirteen are fixed, they can be a Postgres `enum` or a
   `check`. If a category can be added later, they need a table. These are different
   migrations and the wrong one is expensive to undo.
5. **Sub-category — stored, or presentation only?** 110 of them appear in the picker. The
   prototype never shows one on a card or in a filter.
6. **Which seven categories are on the filter bar, and why those?** (§3)
7. **Does the AI pick the category?** `docs/ai/local-model.md` §1.2 measured that it can —
   but only with the **Arabic label** as the enum value, never the English slug. If the AI
   proposes a category, the mapping label → slug lives in `lib/ai/labels.ts` and the
   proposal lands in an editable control.
