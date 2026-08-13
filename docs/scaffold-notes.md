<div dir="rtl">

# ملاحظات السكافولد — S0-07

**Dalal — منصة المزادات المباشرة**

| الحقل | القيمة |
|---|---|
| المعرّف | **S0-07** — الهيكل الأساسي للتطبيق |
| الفرع | `feature/mohammed-auctions` |
| الحالة | ✅ **يعمل** — يثبّت ويشتغل ويُبنى بنجاح |
| المرجع | [`design/STACK.md`](../design/STACK.md) · [`ARCHITECTURE.md`](../ARCHITECTURE.md) §18.5 |

> **هذا سكافولد فقط.** لم تُنفَّذ أي ميزة — لا مصادقة، ولا مزادات، ولا مزايدة، ولا مخطط قاعدة بيانات.

---

## 1. الإصدارات المثبّتة

`design/STACK.md` §7 (بند 4) يطلب تسجيل الإصدارات في `S0-07`. هذه هي:

| الحزمة | الإصدار |
|---|---|
| `next` | `16.3.0` |
| `react` · `react-dom` | `19.2.8` |
| `typescript` | `6.0.3` |
| `tailwindcss` · `@tailwindcss/postcss` | `4.3.3` |
| `eslint` | `9.39.5` |
| `eslint-config-next` | `16.3.0` |

**لا حزم زائدة.** `clsx` و`class-variance-authority` و`tailwind-merge` **لم تُثبَّت** — تلزم مكوّنات `S0-09`، لا السكافولد.

---

## 2. الملفات المنشأة

```text
package.json          scripts: dev · build · start · lint · typecheck
tsconfig.json         strict + noUncheckedIndexedAccess (STACK §2)
next.config.ts        فارغ عمدًا — ARCHITECTURE §18.5
postcss.config.mjs    Tailwind v4، لا tailwind.config.js
eslint.config.mjs     next flat config + حارس RTL (STACK §4.3)
next-env.d.ts         يُنشئه Next
app/layout.tsx        <html lang="ar" dir="rtl"> — مرة واحدة (STACK §4.1)
app/fonts.ts          IBM Plex Sans Arabic + IBM Plex Sans (STACK §5)
app/globals.css       منسوخ من design/app/globals.css — راجع §3
app/page.tsx          صفحة مؤقتة، ليست قائمة المزادات
```

---

## 3. ⚠️ التعديل الوحيد للتوافق — `design/` مستثنى من البناء

**لم يُحذف ولم يُعدَّل أي ملف في `design/`.** لكن المجلد **مستثنى** من `tsconfig.json` و`eslint.config.mjs`.

**السبب:** ملفات `design/components/**` تستورد ما لا وجود له في السكافولد:

```text
@/lib/cn                   غير موجود بعد
@/lib/money                غير موجود بعد — عقد S0-12، ملك ريان
@/components/ui/button     غير موجود بعد — S0-09
clsx · cva · tailwind-merge غير مثبّتة — تلزم S0-09
```

بدون الاستثناء يفشل `tsc` و`eslint` على ملفات **مرجعية** لم يحن وقت تفعيلها.

| الخيار | الحكم |
|---|---|
| استثناء `design/` من البناء | ✅ **المختار** — أصغر تغيير، وغير مدمِّر |
| إنشاء `lib/money.ts` لإرضاء المستوردات | ❌ خارج نطاق `S0-07`، و`S0-12` ملك ريان |
| حذف أو نقل ملفات `design/` | ❌ ممنوع — شغل تصميم قائم |

> **قرار لمحمد:** عند تنفيذ `S0-09`، تنتقل المكوّنات من `design/components/` إلى `components/` ويُرفع الاستثناء. **مالك نظام التصميم يقرر** هل يبقى `design/` مرجعًا بصريًا أم يُدمج بالكامل.

### 3.1 `app/globals.css` مكرَّر عن `design/app/globals.css`

`STACK.md` §3 ينص أن مكانه `app/globals.css`. نُسخ **حرفيًا** بلا أي تعديل، وبقي الأصل في `design/` كما هو.

**النسختان الآن متطابقتان، وهذا لا يصلح على المدى الطويل** — طبقة الرموز (tokens) يجب أن يكون لها مصدر واحد.

> **قرار لمحمد:** أي النسختين هي المصدر؟ الأنسب أن تكون `app/globals.css` هي الحيّة وأن يُزال أو يُقلَّص `design/app/globals.css` إلى مرجع. **لم أقرر ذلك — نظام التصميم ملكه.**

---

## 4. ما لم يُنشأ عمدًا

| البند | السبب |
|---|---|
| `components/ui/**` · `components/auction/**` | **`S0-09`**، ملك محمد |
| `components/bidding/**` | **`S0-13`**، ملك ريان — لا يُنشئها أحد غيره |
| `lib/cn.ts` · `lib/money.ts` | `S0-09` و`S0-12` |
| `lib/supabase/**` | ملك عبدالرحمن (`AUTH-01`) |
| أي مسار أو صفحة ميزة | `AUC-*` · `AUTH-*` · `BID-*` |
| Vitest · Playwright | `STACK.md` §1.2 — تُضاف مع أول اختبار فعلي |
| GitHub Actions | `GITHUB_PLAN.md` §11.2 — تكامل Vercel يكفي |

**`S0-13`** (تقسيم صفحة التفاصيل إلى ملفات فارغة مملوكة) **لم يُنفَّذ** — بند منفصل يحتاج تنسيق محمد وريان.

---

## 5. الأمن

| | |
|---|---|
| لا أسرار ولا مفاتيح | ✅ |
| `.env` و`.env.*` مُتجاهلة، و`.env.example` مستثنى | ✅ متحقَّق بـ `git check-ignore` |
| `.env.example` لم يُعدَّل | ✅ |
| `.gitignore` لم يُعدَّل | ✅ |
| `node_modules/` و`.next/` مُتجاهلة | ✅ |
| **`strict` و`noUncheckedIndexedAccess` لم تُضعَّف** | ✅ |
| **حارس RTL لم يُضعَّف** | ✅ |

**ملاحظة:** Next أعاد ضبط `tsconfig.json` تلقائيًا أثناء البناء (`jsx` ← `react-jsx`، وإضافة `.next/dev/types`). سلوك قياسي، **والصرامة سليمة**.

---

## 6. التحقق المنفَّذ

| الأمر | النتيجة |
|---|---|
| `npm install` | ✅ 0 ثغرات |
| `npx tsc --noEmit` | ✅ لا أخطاء |
| `npm run lint` | ✅ نظيف |
| `npm run build` | ✅ نجح — 3 صفحات ثابتة |
| `npm run start` + `curl` | ✅ **HTTP 200** |
| تحقق المخرَج | ✅ `<html lang="ar" dir="rtl">` |

### 6.1 عقبة واجهتها وأُصلحت جذريًا

`eslint-config-next@16` عبر `FlatCompat` يفشل على ESLint 9 بخطأ `Converting circular structure to JSON`.

**لم أُضعِف الفحص ولم أتجاوز الخطأ.** الإصدار 16 يوفّر flat configs أصلية، فاستُخدمت مباشرة وأُزيلت `@eslint/eslintrc` التي كنت أضفتها.

---

## 7. ما يفكّه هذا السكافولد

| المطوّر | كان محجوبًا | الآن |
|---|---|---|
| **عبدالرحمن** | `AUTH-01` → `AUTH-14` — كلها | ✅ **مفكوكة** |
| **محمد** | `S0-08` · `S0-09` · `AUC-01` → `AUC-19` | ✅ **مفكوكة** |
| **ريان** | مكوّنات المزايدة والريلتايم | ✅ **مفكوكة** |

~~**ما زال محجوبًا:** `S0-05` (ربط Vercel) — يحتاج مالك المستودع.~~
**انفكّ 2026-08-13:** المشروع مرتبط، و`main` تنشر إلى الإنتاج، والمعاينات تُفتح
بلا تسجيل دخول، ومتغيّرات البيئة معايَنة. لم يبقَ من `S0-05` شيء.
[`vercel-deployment.md`](vercel-deployment.md) §11.5–§11.6

---

## 8. بنود مفتوحة من `STACK.md` §7

| # | البند | الحالة |
|---|---|---|
| 1 | توقيع الفريق على Next.js | ⬜ `STACK.md` لا يزال `0.1 — proposed` |
| 2 | Vite لـ Vitest فقط | ✅ لم يُثبَّت Vite كمُحزِّم |
| 3 | التحقق من `tnum` في الخط | ⬜ **لم يُتحقَّق** — الخط يُحمَّل، لكن وجود `tnum` في الحزمة المشتقة لم يُختبر بصريًا |
| 4 | تسجيل الإصدارات | ✅ §1 |
| 5 | تسجيل أن الاختيار حُسم | ✅ هذا الملف |

</div>
