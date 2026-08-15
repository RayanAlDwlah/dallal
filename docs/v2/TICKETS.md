# Dalal V2 — the tickets

Read [`SPEC.md`](SPEC.md) first. Every ticket below is sized for **one Claude session**: it
has a single deliverable, a named proof, and it does not require answering a product
question. **A ticket that turns out to need a product decision stops and asks** — that is
the whole point of the "blocked on" column.

**Nothing here is a GitHub issue yet.** The repository is public and thirty issues are hard
to undo. Opening them is a separate, explicit decision.

---

## The board

`A` = Track A, the spine (`supabase/`, `lib/`, `tests/`, `app/api/`).
`B` = Track B, the surface (`app/(routes)`, `components/`, `design-system/`, `styles/`).

| id | tr | ticket | depends on | blocked on |
|---|---|---|---|---|
| **V2-00** | — | Land #155, get `main` green, then merge #167 | — | — |
| **V2-A1** | A | Categories: schema, seed, and the label→slug table | V2-00 | **Q1** |
| **V2-A2** | A | Auction images: storage bucket, ordered list, cover at position 0 | V2-00 | **Q6** |
| **V2-A3** | A | `bid_increment` + INT-08 narrowing + the BR-32 survival test | V2-00 | — |
| **V2-A4** | A | Starting-price suggestion — pure SQL, no model | V2-A1 | — |
| **V2-B1** | B | Design tokens: colours, type scale, money rendering | V2-00 | — |
| **V2-B2** | B | The auction card — one component, everywhere | V2-B1 | — |
| **V2-B3** | B | The top bar | V2-B1 | — |
| **V2-B4** | B | Category picker + filter bar | V2-B1, contract-A1 | — |
| **V2-B5** | B | The bid button | V2-B1, contract-A3 | — |
| **V2-A5** | A | Create-auction server action, four-step shape | V2-A1, V2-A2, V2-A3 | Q1, Q6 |
| **V2-B6** | B | The four-step create wizard | V2-B2, V2-B4, contract-A5 | — |
| **V2-B7** | B | Image uploader — drag-reorder, cover, limits | V2-B6, contract-A2 | **Q3** |
| **V2-A6** | A | `lib/ai/` — the adapter, the schemas, `AI_ENABLED`, and the guard | V2-00 | — |
| **V2-A7** | A | AI task: images → title / description / category | V2-A6, V2-A1 | — |
| **V2-A8** | A | AI task: Arabic search → filters, **plus the amount parser (not AI)** | V2-A6, V2-A1 | — |
| **V2-A9** | A | AI task: answer from the seller's description only | V2-A6 | — |
| **V2-B8** | B | AI surfaces: suggestion card, editable chips, Q&A box | V2-B6, contract-A6 | — |
| **V2-A10** | A | Sessions + lots schema | V2-A1..A3 | **Q2** |
| **V2-A11** | A | Open / close a lot — **including the server-side extension-window refusal** | V2-A10 | **Q2** |
| **V2-A12** | A | Host powers, server side | V2-A11 | Q2 |
| **V2-A13** | A | Deposit as an eligibility gate + *rejected bids never extend* | V2-A10 | **Q5** |
| **V2-B9** | B | Create-session wizard | V2-B6, contract-A10 | — |
| **V2-B10** | B | Session card + the live room | V2-B2, contract-A11 | Q5 |
| **V2-B11** | B | Host control room | V2-B10, contract-A12 | Q2 |

**24 tickets.** Phase 1 (`A1`–`A4`, `B1`–`B5`) is nine tickets with **no cross-track
dependency at all** — that is where two accounts run at full speed.

---

## Phase 0

### V2-00 — unblock
`main` has been red for three days on a real `@/lib` import bug. The fix is waiting in
**#155**, which is `CHANGES_REQUESTED` by `@Dem4t` and by me. **#167** (the CI workflow and
the guard-layer documentation) cannot go green until #155 lands, and I will not merge red,
and I will not edit Mohammed's file to force green.

**Order: #155, then #167.** Nothing below starts before this.

---

## Phase 1 — foundations, fully parallel

### V2-A1 — categories
Thirteen main slugs exactly as [D-02](../decisions/D-02-categories.md) §1 lists them, the
110 sub-sections, and `lib/categories/labels.ts` mapping Arabic label → slug (needed by
V2-A8: the model only classifies correctly when the enum values are the Arabic labels).

**Blocked on Q1** — column-per-field vs `jsonb` vs side table. Do not choose. D-02 §2.1
explains why both obvious answers are bad.

**Proof:** a SQL test that every slug in the seed is reachable from the picker's list, and
that no category-specific field is declared as a money type.

### V2-A2 — images
Ordered 1..10, cover at position 0, JPG/PNG/WebP, 5 MB. Replaces `AUC-04`'s single-image
path; `ADR-6`'s upload-before-create ordering now applies ten times.

**Blocked on Q6** (is one image required). **Also record, do not solve:** there is no delete
in this product (`BR-30`, `BR-31`), so abandoned uploads accumulate — D-06 §5.3.

**Proof:** a storage-path RLS test, and an assertion that a storage path never leaks an
internal user id (`CLAUDE.md` §6).

### V2-A3 — the bid increment
The one ticket that will make a guard go red **on purpose**. D-01 §4 already wrote the
instructions:

- narrow `tests/integration/excluded-features.check.sh` so it still bans `min_raise` /
  `minRaise` — the validation rule — and permits `bid_increment` — the affordance
- **in the same PR**, add to `tests/bidding/acceptance.sql` a test whose name is the rule:
  *the server accepts an amount that is NOT a multiple of the increment*
- `place_bid`'s validation changes by **zero lines**

Deleting the check, adding an ignore, or renaming the column to slip past the pattern are
each a worse outcome than the red build.

### V2-A4 — the starting-price suggestion
`percentile_cont` over **ended** auctions in the same category in the last 90 days. **No
model.** [`local-model.md`](../ai/local-model.md) §1.2 measured the model getting an amount
wrong on ten runs out of ten; SQL is exact, instant, free and auditable.

Returns `::text` like every other money read (`CLAUDE.md` §4.7). **Seller only** — D-04 §2.3.

### V2-B1 — tokens
`design-system/previews/colors.html` and `type-and-money.html` become real CSS custom
properties and a Tailwind theme. **One formatter** — `lib/money.ts` stays the only one, and
the previews must stop being a second source.

### V2-B2 — the auction card
Same card everywhere. `987,654,321.00 SAR` renders whole:

> «أي تصميم يقصّ المبلغ أو يحطّ له حدًّا هو خطأ، مو تبسيط.»

**Proof:** a render test at that amount, and INT-06 at 375 px.

### V2-B3 — the top bar
No «حسابي» button — an avatar circle. Nav: المزادات / الجلسات / أنشئ. Notification «أحد
زايد عليك». **No sixth icon for the AI** (D-04 §1).

### V2-B4 — the category picker and filter bar
Two columns, main on the **right**, sub on the **left**, and the `›` points **left because
that means forward in RTL** — D-02 §3. Anyone who "fixes" the arrow has broken it; put that
sentence in the component's comment.

Filter bar scrolls horizontally from the right, «الكل» pinned first — without it there is no
one-press way to clear the filter.

### V2-B5 — the bid button
`bid-button.html`: no number field anywhere. States: **زايد بـ N** / جارٍ الإرسال / انتهى
المزاد / سجّل الدخول, plus the «متأكد؟» confirmation. The first press bids **the starting
price itself** (D-01 §1a).

---

## Phase 2 — the create flow

### V2-A5 — the create-auction server action
Four steps, one atomic create at the end. Enforces server-side what the wizard shows: title
3–120, description 20–2000, end time **at least 5 minutes out** (D-06 §2 — a new rule,
recorded), category valid, images 1..10.

`SC-43`: every one of those is a server rule, not a form attribute.

### V2-B6 — the wizard
Four steps with a visible position. **Step 4 renders the real V2-B2 card**, not a text
summary — that is a testable claim.

### V2-B7 — the uploader
Drag to reorder, first is the cover, limits shown. **Blocked on Q3**: if image editing is
out of scope this is a plain uploader; if it is in scope it is a second, non-LLM piece of
work with its own cost. Do not assume.

If it is built: the original is never deleted, «رجّع الأصلية» works **after publish**, and
the page says «صور معدّلة». «حدّ أخلاقي مو تقني.»

---

## Phase 3 — the assistant

### V2-A6 — the adapter
`lib/ai/client.ts`, `schemas.ts`, `labels.ts`, route handlers under `app/api/ai/`,
`AI_ENABLED`. Server-only; `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` **never**
`NEXT_PUBLIC_`.

**Ships with its guard**, or it does not ship: a check in `tests/guards/run.sh` that no
module under `lib/ai/` imports the bidding module or names a money identifier, and the
`negative.sh` probe proving that check can fail (`CLAUDE.md` §9).

Every task uses `response_format: {type: "json_schema", strict: true}` with **Arabic enum
labels**. Not an optimisation: free-form took 80 s and returned nothing usable; the
constrained call takes 6–11 s with `reasoning_tokens: 0`.

**Q4 is about deployment, not about this code.** Build it; the three env vars make the
answer a configuration change later.

### V2-A7 — images → listing text
Vision, `json_schema`, ~11 s. Category comes back as an Arabic label and is mapped through
V2-A1's table.

### V2-A8 — search
Two deliverables in one ticket **because splitting them is how the wrong one gets written**:

- `lib/ai/tasks/search.ts` — category, city, keywords. **No price field in the schema. Not
  ignored — absent.**
- `lib/search/parse-amount.ts` — deterministic Arabic-numeral parsing («اقل من 50 الف»),
  under `lib/search/` and not `lib/ai/`, so that nobody later replaces it with a model call

**Proof:** a test that the AI schema contains no money field, and a parser test over Arabic
number words.

### V2-A9 — answering about a lot
From the seller's description only. **«ما أعرف» must be cheap** — a test asserting the model
refuses on a question the description does not answer. D-04 §2.2: inventing a service
history is inventing a claim the seller never made, on the page where somebody is about to
bid.

### V2-B8 — the AI surfaces
Suggestion card with **استخدم المقترح / أكتب بنفسي**, **editable** filter chips, the Q&A
box. Every output lands in a control the human can edit — that editability *is* the
containment (D-04 §4).

Every screen must work with **no suggestion at all**: `local-model.md` §1.5 measured the
same call at 6 s, 18 s, 34 s and 54 s on one afternoon. Nothing blocks on the model.

---

## Phase 4 — sessions (last, by the owner's sequencing)

### V2-A10 — schema
Sessions and lots. **Blocked on Q2**, and on D-03 §4.6 — whether a lot is an `auctions` row
with a nullable `session_id` or a separate entity. That choice touches every existing query,
policy and test.

### V2-A11 — opening and closing a lot
`end_time` is **computed when the lot opens**, not at creation. `LC-03` still holds:
eligibility is `clock_timestamp()` against `end_time`, never the stored status.

**The one correctness rule in the whole phase:** the host's «أغلق وافتح القطعة 3» is
**disabled during an active extension window**, and *disabling a button is not a mechanism*.
The refusal lives in the server-side advance function. A crafted request must get the same
answer as a greyed-out button (`SC-43`).

> A host advance is a way to defeat anti-sniping. D-03 §3.1.

### V2-A12 — host powers
«أوقف مؤقتًا» and «أنهِ الجلسة». **Blocked on Q2** — if a pause freezes a lot's clock, then
`end_time` moves backwards in wall-clock terms, and `CLAUDE.md` §5 says it moves *forward
only, in 30-second quanta, only inside `place_bid`*, with a test asserting it. **Either the
pause does not touch the open lot, or the rule needs an explicit second door.** Do not open
one quietly.

### V2-A13 — the deposit gate
A row, not a payment: this user entered this hall. **No gateway, no card field, no amount
that moves** — D-05 §2, and INT-08 is where that stays true.

It is a **new rejection reason on the bidding path**, so:

> A bid rejected for want of a deposit **must not extend `end_time`** — `CLAUDE.md` §5,
> asserted in `tests/bidding/closing.sql`, **in this PR**.

And it must not become a fourth entry in the list of three checks that must not exist. It
is an eligibility gate, the same category as "the auction has ended" — not a minimum raise,
not a ceiling, not a leading-bidder rejection.

### V2-B9 / B10 / B11 — the session screens
The four-step create wizard, the session card and live room, the host control room («القطعة
2 من 4», attendance, the lot list with الآن / بالانتظار).

**B10 and B11 both wait on Q2 and Q5** — a control room that draws a pause button before
anyone has decided what a pause does to the clock is a screen that will be rebuilt.

---

## The six answers this board is waiting on

Repeated from [`SPEC.md`](SPEC.md) §4 because they are the actual critical path, not the
tickets:

| | | blocks |
|---|---|---|
| **Q1** | How are category-specific fields stored? | A1, A5 — and every later migration |
| **Q2** | Is a pause allowed to freeze a lot's clock? | A10, A11, A12, B11 — **all of phase 4** |
| **Q3** | Is image editing in scope now that it is not an LLM? | B7's size |
| **Q4** | Where does the model run in production? | A6's deployment, not its code |
| **Q5** | What happens to a deposit when the session ends? | A13, B10 |
| **Q6** | Is at least one image required? | A2, B7 |

**Q1 and Q2 are the expensive ones.** Everything else can start.
