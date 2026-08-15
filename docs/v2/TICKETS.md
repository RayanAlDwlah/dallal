# Dalal V2 — the tickets

Read [`SPEC.md`](SPEC.md) first. Every ticket below is sized for **one Claude session**: it
has a single deliverable, a named proof, and it does not require answering a product
question. **A ticket that turns out to need a product decision stops and asks** — that is
the whole point of the "blocked on" column, and every id in that column resolves to a real
entry in [`SPEC.md` §4.3](SPEC.md#43-the-open-register--twenty-four-real-blockers).

**Nothing here is a GitHub issue yet.** The repository is public and forty issues are hard
to undo. Opening them is a separate, explicit decision, and it happens **only after the
owner approves this revision** — not before.

---

## How a ticket is claimed

**Nobody owns a lane.** `CLAUDE.md` §1 governs: no developer, no account and no Claude
session permanently owns a file or a feature, and **any available contributor may claim any
ready ticket.** A steward is someone to request review from; **a steward's absence must not
block a ready, well-specified ticket.**

The lane letter is a **prediction about which files the ticket will touch**, published so
two in-flight tickets get sequenced instead of colliding — `CLAUDE.md` §7: *whoever resolves
a conflict is making a decision*. It is **not** a permission boundary and it is not a job
title.

| lane | expected change surface | proves with |
|---|---|---|
| **C** | `docs/contracts/` only | two consumers signing the header |
| **A** | `supabase/migrations/`, `lib/`, `tests/`, `app/api/` | a SQL suite or a `.check.mjs` |
| **B** | `app/(routes)`, `components/`, `design-system/`, `styles/` | a preview matching the prototype, INT-06 at 375 px |

**The seven steps** (`SPEC.md` §5.1, `CLAUDE.md` §1): check dependencies and confirm
`ready` → claim it → branch `feature/<ticket-id>-<short-name>` → the declared surface is an
expectation, not a fence → shared file ⇒ **merge the contract first** → the PR carries
changed files, verification evidence, remaining risks and handoff notes → after merge,
anyone claims the next ready ticket.

**`ready` means:** every id in *depends on* is merged, **and** no id in *blocked on* is
still open.

---

## The board

**39 tickets, plus `V2-00`.** 67 dependency edges between tickets; 33 blocking edges onto
**23** of the 24 open owner questions.

The twenty-fourth is `O11` — *which* hosted provider — and it deliberately appears in no
*blocked on* cell, because it blocks no ticket. `V2-A6` and `V2-A18` are both written and
run against LM Studio locally; what `O11` gates is the **production deployment**, and a
deployment is not a ticket on this board. Counting it as one would have made the board look
more blocked than it is. Its register entry (§4.3, `SPEC.md`) says so in the same words.

| id | lane | ticket | depends on | blocked on |
|---|---|---|---|---|
| **V2-00** | — | Land #155, get `main` green, then merge #167 | — | — |
| **V2-C1** | C | Contract: category + category-specific fields → `docs/contracts/V2-C1-category-fields.md` | V2-00 | **O1, O2** |
| **V2-C2** | C | Contract: auction images → `docs/contracts/V2-C2-auction-images.md` | V2-00 | **O20** |
| **V2-C3** | C | Contract: the bid button → `docs/contracts/V2-C3-bid-button.md` | V2-00 | — |
| **V2-C4** | C | Contract: create-auction payload → `docs/contracts/V2-C4-create-auction.md` | V2-C1, V2-C2 | — |
| **V2-C5** | C | Contract: AI task I/O → `docs/contracts/V2-C5-ai-tasks.md` | V2-C1 | — |
| **V2-C6** | C | Contract: session + lot → `docs/contracts/V2-C6-session-lot.md` | V2-C4 | **O4, O23** |
| **V2-C7** | C | Contract: image enhancement → `docs/contracts/V2-C7-image-enhancement.md` | V2-C2 | **O24** |
| **V2-C8** | C | Contract: search filters → `docs/contracts/V2-C8-search-filters.md` | V2-C1 | — |
| **V2-A1** | A | Categories: normalized tables, field definitions, validated `jsonb`, label→slug | V2-00, V2-C1 | **O1, O2** |
| **V2-A2** | A | Auction images: bucket, ordered 1–10, cover at position 0, server-side count | V2-00, V2-C2 | **O20, O21** |
| **V2-A3** | A | `bid_increment` + INT-08 narrowing + the BR-32 survival test | V2-00, V2-C3 | — |
| **V2-A4** | A | Starting-price suggestion — SQL, a **range**, a comparable count | V2-A1 | **O14** |
| **V2-A5** | A | Create-auction server action — incl. **BR-38's 5 min–7 days** | V2-A1, V2-A2, V2-A3, V2-C4 | — |
| **V2-A6** | A | `lib/ai/` — adapter, schemas, `AI_ENABLED`, `server-only`, the guard | V2-00, V2-C5 | **O12** |
| **V2-A7** | A | **VLM** task: images → title / description / category | V2-A6, V2-A1 | — |
| **V2-A8** | A | Model task: Arabic sentence → category, city, keywords. **No amount, no filter values** | V2-A6, V2-A1, V2-C8 | — |
| **V2-A9** | A | Grounded Q&A — seller's **description and specifications only** | V2-A6, V2-A5 | — |
| **V2-A10** | A | Sessions + lots schema | V2-A1, V2-A2, V2-A3, V2-C6 | **O4, O8, O10, O23** |
| **V2-A11** | A | Open / close a lot — **incl. the server-side extension-window refusal** | V2-A10 | **O5** |
| **V2-A12** | A | Host powers: advance, end session | V2-A11 | **O6, O7** |
| **V2-A13** | A | Deposit as an eligibility gate + *rejected bids never extend* | V2-A10 | **O17, O18** |
| **V2-A14** | A | **Image-processing provider spike** — timeboxed, produces options, ships no product code | V2-00 | — |
| **V2-A15** | A | **Original and derived image storage** — the original is never overwritten | V2-A2, V2-C7 | **O20, O21** |
| **V2-A16** | A | **The enhancement pipeline** + «رجّع الأصلية» server side | V2-A14, V2-A15 | **O24** |
| **V2-A17** | A | **Deterministic filters**: brand, minimum year, price band, ending ≤ 24 h | V2-A1, V2-C8 | — |
| **V2-A18** | A | **Provider capability contract test** — vision + structured output | V2-A6 | — |
| **V2-A19** | A | **Pause / resume** — atomic, host-only, `end_time` forward by the paused duration | V2-A10, V2-A11 | — |
| **V2-B1** | B | Design tokens: colours, type scale, money rendering | V2-00 | — |
| **V2-B2** | B | The auction card — one component, everywhere | V2-B1 | — |
| **V2-B3** | B | The top bar | V2-B1 | — |
| **V2-B4** | B | Category picker + filter bar | V2-B1, V2-C1 | **O3** |
| **V2-B5** | B | The bid button | V2-B1, V2-C3 | — |
| **V2-B6** | B | The four-step create wizard | V2-B2, V2-B4, V2-C4 | — |
| **V2-B7** | B | Image uploader — drag-reorder, cover, 1–10, limits | V2-B6, V2-C2 | **O22** |
| **V2-B8** | B | AI surfaces: suggestion card, editable chips, Q&A box | V2-B6, V2-C5 | **O13** |
| **V2-B9** | B | Create-session wizard | V2-B6, V2-C6 | **O8, O16** |
| **V2-B10** | B | Session card + the live room | V2-B2, V2-C6 | **O15** |
| **V2-B11** | B | Host control room | V2-B10 | **O9, O19** |
| **V2-B12** | B | **Enhancement surface**: «حسّن الصور» · «رجّع الأصلية» · «صور معدّلة» | V2-B7, V2-C7 | **O24** |

### What is actually startable today

**Seven tickets**, once `V2-00` lands: **V2-C3, V2-A3, V2-A14, V2-B1, V2-B2, V2-B3,
V2-B5.** Those are the only ones with no open question anywhere in their dependency chain.

A previous draft of this board claimed phase 1 had *"no cross-track dependency at all"* and
that nine tickets could run in parallel. **Both were wrong**: `V2-B4` needs the category
contract and `V2-B5` needs the bid contract, and `V2-C1` is itself blocked on `O1`/`O2`.

**And that is the finding worth reading twice.** `O1` (*is a category required?*) and `O2`
(*is a sub-category stored?*) look like schema trivia. They gate `V2-C1`, which gates
`V2-A1` and `V2-C4` and `V2-C5` and `V2-C8` — which is **the entire create flow, the entire
assistant, and all of phase 4**. Two sentences from the owner sit upstream of **27 of the 39
tickets**.

> **But do not read that as "27 tickets become startable."** They do not, and the difference
> is worth stating because it is the mistake this board is designed to prevent. Answering
> `O1` and `O2` moves the startable set from **7 to 12** — measured by re-running the same
> closure with those two removed, not estimated. The other fifteen carry a *second* blocker
> further up their chain: `V2-A2` still waits on `O20`, everything in phase 4 still waits on
> `O4`.
>
> **Reach counts what an item sits upstream of. Startability needs every blocker on the
> chain cleared, not the biggest one.** Add `O20` and the set goes 12 → 14. The board opens
> up by *clearing chains*, not by answering the highest-reach question first.

---

## Phase 0

### V2-00 — unblock
`main` has been red on a real `@/lib` import bug. The fix is waiting in **#155**, which is
`CHANGES_REQUESTED`. **#167** (the CI workflow and the guard-layer documentation) cannot go
green until #155 lands, and nobody merges red.

**Order: #155, then #167.** Nothing below starts before this.

---

## Lane C — the contracts, and why they are tickets now

A previous draft of this board wrote dependencies as `contract-A1`, `contract-A5`,
`contract-A12`. **Those names pointed at nothing** — no file, no ticket, no id, no author.
A dependency you cannot open is not a dependency; it is a hope. Each is now a real ticket
with a real path.

`docs/contracts/` already exists and already has a house style: a header naming both
consumers, the shape, and what a change may not do. Follow `docs/contracts/S0-12-money.md`.

**A contract ticket ships when two consumers sign it** — the ticket that produces the shape
and the ticket that reads it. One signature is a draft.

### V2-C1 — category and category-specific fields
The **normalized category table**, the **field-definition table** (which keys exist per
category, and each key's type and constraints), and the **validated `jsonb`** that carries
the values. Owner decision, recorded in [D-02](../decisions/D-02-categories.md).

Must state: the label→slug mapping (`lib/categories/labels.ts`, needed by V2-A7 — the model
only classifies correctly when the enum values are the **Arabic labels**), and that **no
category-specific field is a money type.** `المساحة`, `الممشى`, `عدد الخانات`, `الوزن` are
quantities. A second money-shaped field arriving here without a decision is exactly the
silent change `CLAUDE.md` §9 exists to stop.

**Blocked on O1** (is a category required) and **O2** (is a sub-category stored) — both
change the shape this contract publishes.

### V2-C2 — auction images
Ordered 1–10, cover at position 0, JPG/PNG/WebP, 5 MB. The path convention, and what a
consumer may assume about it. **Blocked on O20** — a storage path is an identifier printed
in an `<img src>`, and `CLAUDE.md` §6 says internal identifiers stay internal.

### V2-C3 — the bid button
What the button receives and what it sends. The one sentence that must be in it, because it
is the thing most likely to be "simplified" later:

> The button displays **one** amount. **The server still accepts any amount strictly above
> the current price** (`BR-32`), and the first bid may **equal** the starting price
> (`BR-29`/`SC-55`). D-01 governs what the screen offers; BR-32 governs what the database
> accepts. They are different questions with different answers.

### V2-C4 — the create-auction payload
The four steps collapsed into one atomic create. Names every server-side rule so V2-B6 does
not reimplement them as form attributes: title 3–120, description 20–2000, **duration 5
minutes to 7 days inclusive (`BR-38`)**, valid category, **1–10 images**.

### V2-C5 — AI task I/O
Three schemas — listing text, search intent, grounded answer — with **Arabic enum values**,
and the failure shape. **Every screen must render with no suggestion at all**
([`local-model.md`](../ai/local-model.md) measured the same call at 6 s, 18 s, 34 s and
54 s on one afternoon). The contract's job is to make "no answer" a first-class value, not
an error state.

### V2-C6 — session and lot
The largest contract, and the one **blocked on O4** — whether a lot is an `auctions` row
with a nullable `session_id` or a separate entity. **O23**: whether a lot's duration uses
the same `BR-38` bound.

### V2-C7 — image enhancement
Original and derived, which one every consumer reads by default, how «رجّع الأصلية» is
expressed, and where «صور معدّلة» comes from. **Blocked on O24** — the provider decides what
a derived image even is.

### V2-C8 — search filters
The filter set — category, city, **brand, minimum year, price band, ending within 24
hours** — and, for each one, **whether it comes from the model or from a parser**. That
column is the contract's entire reason for existing.

---

## Phase 1 — foundations

### V2-A1 — categories
Thirteen main slugs exactly as [D-02](../decisions/D-02-categories.md) §1 lists them, the
110 sub-sections, the field-definition rows, and `lib/categories/labels.ts`.

**Storage is decided** (owner, 2026-08-15): **validated `jsonb`, backed by normalized
category and field-definition tables.** Not sixty mostly-null columns; not an unvalidated
`jsonb` any session can write any key into. Validation is server-side against the
definitions — a key that no definition allows is rejected, not stored.

**Still blocked on O1 and O2** — whether the category column is `not null`, and whether
sub-category is persisted at all. Do not choose either.

**Proof:** a SQL test that every slug in the seed is reachable from the picker's list; that
an undefined key is rejected; and that **no category-specific field is declared as a money
type**.

### V2-A2 — images
Ordered 1..10, cover at position 0, JPG/PNG/WebP, 5 MB. Replaces `AUC-04`'s single-image
path; `ADR-6`'s upload-before-create ordering now applies ten times.

**The count is decided** (owner, 2026-08-15): **1 to 10, required, validated server-side.**
`SC-43` — a rule that exists only in the form is not a rule. Zero images is rejected by the
database, not by the uploader.

**Blocked on O20** (where they live) and **O21** (abandoned uploads, in a product with no
delete — `BR-30`, `BR-31`).

**Proof:** a storage-path RLS test, a rejection test at 0 images and at 11, and an
assertion that a storage path never leaks an internal user id (`CLAUDE.md` §6).

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
**SQL and data analysis over comparable ended auctions.** Feature 5 of the five approved AI
features, presented to the seller exactly as approved — and **seller only** (D-04 §2.3): a
bidder must never see a machine's opinion of what an item is worth.

It contains no model call, and that is a property, not a downgrade.
[`local-model.md`](../ai/local-model.md) §1.2 measured the model returning a corrupt or
wrong amount on **ten runs out of ten** at `temperature: 0`. SQL is exact, instant, free,
auditable, and it cannot hallucinate an amount.

**Four deliverables, not one** — this is the part the earlier draft was missing:

1. **A range, not a point.** `percentile_cont` at two bounds. A single number reads as a
   valuation; a range reads as what it is.
2. **The comparable count, shown.** «مبني على 27 مزادًا مشابهًا» — a suggestion whose sample
   size is invisible is a suggestion the seller cannot weigh.
3. **A stated similarity definition**, in the contract and in the query, not implied by
   whatever the `WHERE` clause happens to say.
4. **A minimum sample threshold**, below which **no suggestion is shown at all** — not a
   wider range, not a caveat. Nothing.

**Blocked on O14** — *what counts as "similar"* (same category? sub-category? city? window?)
and *what the minimum sample is*. Both change the number on the screen, so neither is a
session's to pick. Deliverables 1 and 2 are shapes and are safe to build; 3 and 4 need the
answer.

Returns `::text` like every other money read (`CLAUDE.md` §4.7).

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
one-press way to clear the filter. **Blocked on O3** — which categories appear on it.

### V2-B5 — the bid button
`bid-button.html`: no number field anywhere. States: **زايد بـ N** / جارٍ الإرسال / انتهى
المزاد / سجّل الدخول, plus the «متأكد؟» confirmation. The first press bids **the starting
price itself** (D-01 §1a).

---

## Phase 2 — the create flow

### V2-A5 — the create-auction server action
Four steps, one atomic create at the end. Enforces server-side what the wizard shows: title
3–120, description 20–2000, category valid, **images 1–10** (owner decision), and:

> **Duration: 5 minutes to 7 days, inclusive, by server time.** This is **`BR-38` /
> `FR-CREATE-09` / `FR-CREATE-10` / `FR-CREATE-10a` / `SC-68`** — an existing, ratified rule
> with an existing `CHECK` constraint and an existing four-case boundary test. D-06 §2
> step 3 recorded the 5-minute floor as *"a new minimum-duration rule … not in any existing
> document"*. **That is wrong and this ticket corrects it**: the rule predates V2, it has
> both bounds, and V2 enforces the range rather than inventing a floor.

`SC-43`: every one of those is a server rule, not a form attribute.

**Proof:** the four `SC-68` boundary cases (under 5 min, exactly 5 min, exactly 7 days, over
7 days) still pass against the V2 path, plus 0-image and 11-image rejection.

### V2-B6 — the wizard
Four steps with a visible position. **Step 4 renders the real V2-B2 card**, not a text
summary — that is a testable claim.

### V2-B7 — the uploader
Drag to reorder, first is the cover, **1–10 enforced in the UI and again on the server**,
limits shown. **Blocked on O22** — whether reordering after publish exists.

The enhancement controls are **not** here; they are V2-B12, behind V2-C7.

---

## Phase 3 — the assistant

### V2-A6 — the adapter
`lib/ai/client.ts`, `schemas.ts`, `labels.ts`, route handlers under `app/api/ai/`,
`AI_ENABLED`. `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` **never** `NEXT_PUBLIC_`.

**Server-only, and the mechanism is specific:**

> The client module starts with **`import "server-only"`**. That is the import whose job is
> to fail the build if a client component pulls the module in. **`"use server"` is not that
> — it marks a module's exports as Server Actions**, which is a different thing with
> different semantics, and using it here would export the AI functions as callable
> endpoints. An earlier draft said `"use server"`. It was wrong. `"use server"` is reserved
> for Server Actions.

**Ships with its guard**, or it does not ship: a check in `tests/guards/run.sh` that no
module under `lib/ai/` imports the bidding module or names a money identifier, that every
module under `lib/ai/` carries `import "server-only"`, and that no `NEXT_PUBLIC_AI_*` exists
— plus the `negative.sh` probe proving each can fail (`CLAUDE.md` §9).

Every task uses `response_format: {type: "json_schema", strict: true}` with **Arabic enum
labels**. Not an optimisation: free-form took 80 s and returned nothing usable; the
constrained call takes 6–11 s with `reasoning_tokens: 0`.

**Blocked on O12** — whether `AI_ENABLED` defaults on or off.

### V2-A18 — the provider capability contract test
**The ticket that replaces a claim that was withdrawn.** An earlier draft said swapping the
local model for a hosted one "changes only those three values". Three environment variables
point the client at an endpoint. **They guarantee nothing about what is there.**

A test — runnable against any candidate endpoint, in CI against the dev one — that asserts:

| capability | why it is not optional |
|---|---|
| **Vision input accepted** | feature 1 reads images. A text-only endpoint fails it at runtime, in production |
| **`json_schema` + `strict: true` honoured** | free-form was measured at 80 s and unusable |
| **The returned object validates against the schema sent** | "supports JSON mode" and "returns your schema" are different claims |
| **Arabic enum values preserved** | measured: the model classifies correctly **only** with Arabic labels, never English slugs |
| **Latency recorded, not asserted** | 6 s and 54 s were the same call on the same afternoon. A threshold here would be flaky; a recorded number is evidence |

**A provider is qualified by this test passing, not by being configured.** `O11` picks the
candidate; this ticket decides whether the candidate is usable.

### V2-A7 — images → listing text (the VLM)
Vision, `json_schema`, ~11 s measured. Category comes back as an Arabic label and is mapped
through V2-A1's table.

### V2-A8 — search intent
`lib/ai/tasks/search.ts` — category, city, keywords, **and nothing else**.

> **No amount field in the schema. Not ignored — absent.** And no brand, year or
> ending-window field either: those are V2-A17's, deterministically. A field the model
> cannot fill reliably must not exist in the schema it is handed.

**Proof:** a test asserting the schema contains no money field and none of V2-A17's four
filter keys.

### V2-A17 — the deterministic filters
The four filters the model does not touch, under `lib/search/` and **not** `lib/ai/`, so
nobody later replaces one with a model call:

| filter | how |
|---|---|
| **الماركة** (brand) | matched against the category's own brand field-definition (V2-C1) — a closed list per category, not free text |
| **سنة الصنع من** (minimum year) | Arabic and Western numeral parsing, bounded to plausible years |
| **السعر** (price band) | `lib/search/parse-amount.ts` — «اقل من 50 الف», «بين ١٠٠ و ٥٠٠». **Strings throughout; `CLAUDE.md` §4 rule 1 has no exception for a search box** |
| **تنتهي خلال ٢٤ ساعة** | `end_time` against the **server** clock. `LC-03`: never the stored `status` |

**Proof:** a parser test over Arabic number words, a test that the ending-window filter uses
`clock_timestamp()`, and a test that the price band never becomes a JS `Number`.

### V2-A9 — answering about a lot
From **the seller's description and specifications only** — the D-02 category fields are in
scope for grounding; nothing else is. **«ما أعرف» must be cheap** — a test asserting the
model refuses on a question the description and specifications do not answer. D-04 §2.2:
inventing a service history is inventing a claim the seller never made, on the page where
somebody is about to bid.

### V2-A14 — the image-processing provider spike
**Timeboxed. Ships no product code.** Feature 2 is in scope by owner decision, and it is not
a language-model task — it needs image processing or a hosted image model.

Produces, in `docs/decisions/` or `docs/ai/`: candidate options (local library vs hosted
image model), a working sample on one real listing image per candidate, measured latency and
cost per image, and what each does to `O20`'s storage shape.

**It produces options. The owner picks — that is `O24`.** A spike that returns with a
choice already made has answered a product question, which is the failure mode in
`CLAUDE.md` §8.

### V2-A15 — original and derived image storage
**The original is never overwritten and never deleted.** Derived images are additional rows
or paths, never a replacement. D-04 §2.1: «حدّ أخلاقي مو تقني».

The three properties are one decision and ship together, or none of them ships:

1. the original is retained
2. **«رجّع الأصلية» works *after* publish** — which means the original must still be
   addressable on a `BR-31`-immutable auction, and that is a storage requirement, not a UI one
3. the page says **«صور معدّلة»** whenever a derived image is what is being shown

**Blocked on O20, O21.**

**Proof:** a test that a derived write cannot overwrite an original path, and that restoring
after publish resolves to the original bytes.

### V2-A16 — the enhancement pipeline
Server-side, using whatever `O24` selects. Applies to **derived** images only. Never runs on
the bidding path, never touches an amount, and lives under the same `lib/ai/` guard as
everything else in phase 3.

**Blocked on O24.**

### V2-B8 — the AI surfaces
Suggestion card with **استخدم المقترح / أكتب بنفسي**, **editable** filter chips, the Q&A
box. Every output lands in a control the human can edit — that editability *is* the
containment (D-04 §4).

Chips must render all six filters — category and city from V2-A8, brand / year / price /
ending-window from V2-A17 — and the user must not be able to tell which came from where,
except that all six are equally editable.

Every screen must work with **no suggestion at all**: `local-model.md` §1.5 measured the
same call at 6 s, 18 s, 34 s and 54 s on one afternoon. Nothing blocks on the model.

**Blocked on O13** — whether accepted AI text is labelled the way an edited image is.

### V2-B12 — the enhancement surface
«حسّن الصور» on step 1, «رجّع الأصلية» available **after publish**, and «صور معدّلة» on any
page showing a derived image. The three are one decision (D-04 §2.1) and no PR ships a
subset.

**Blocked on O24.**

---

## Phase 4 — sessions (last, by the owner's sequencing)

### V2-A10 — schema
Sessions and lots. **Blocked on O4** — whether a lot is an `auctions` row with a nullable
`session_id` or a separate entity. That choice touches every existing query, policy and
test. Also **O8** (invitation mechanism), **O10** (cancellation — `status` has exactly two
values), **O23** (whether `BR-38`'s 5 min–7 day bound applies to a lot's duration).

### V2-A11 — opening and closing a lot
`end_time` is **computed when the lot opens**, not at creation. `LC-03` still holds:
eligibility is `clock_timestamp()` against `end_time`, never the stored status.

**The one correctness rule in the whole phase:** the host's «أغلق وافتح القطعة 3» is
**refused during an active extension window**, and *disabling a button is not a mechanism*.
The refusal lives in the server-side advance function. A crafted request must get the same
answer as a greyed-out button (`SC-43`).

> A host advance is a way to defeat anti-sniping. D-03 §3.1.

**Blocked on O5** — what happens to bids on a lot closed early.

### V2-A19 — pause and resume
**Q2 is decided.** The owner's decision, and the shape it must take:

> A **host-only atomic database operation** pauses and resumes a lot, and **moves `end_time`
> forward by the paused duration**.

`CLAUDE.md` §5 carries the amendment in full; this ticket implements it. What that section
requires, and what this PR must therefore contain:

**Unchanged and still absolute** — `end_time` moves **forward only**; `place_bid` remains
the only caller that moves it in 30-second quanta; **pause never increments
`extension_count`**; the cap stays a `CHECK`.

**What changed** — *"only inside `place_bid`"* becomes *"inside `place_bid`, **or** inside
the pause/resume operation"*. **One** additional door, named.

**Four conditions, all of them:**

1. **Host-only**, from the verified server session — never a client-supplied id
   (`CLAUDE.md` §6, and this is a `SECURITY DEFINER` surface)
2. **Atomic**, taking the same row lock as `place_bid`
3. **Forward by the paused duration, and by nothing else** — not a quantum, not a rounding,
   not a minimum
4. **A paused lot accepts no bids**

**The test changes are specified, not left to the implementer** (`tests/bidding/closing.sql`
section K):

- the assertion currently named **`'end_time cannot be moved outside place_bid'`** is now
  wrong as named and as worded. **Rename it and re-word the raised message to name both
  doors. Do not delete it.**
- the other four refusal assertions — backwards, wrong amount, without the counter, counter
  without `end_time` — **stay exactly as they are**
- **new assertions required:** a non-host is refused · the move equals the paused duration ·
  `extension_count` is untouched · a paused lot refuses a bid · nothing moves backwards
  through the pause path
- **the guard must still refuse an unflagged update.** A pause implemented by turning the
  guard off is a pause that removed the invariant.

### V2-A12 — host powers
«أنهِ الجلسة» and the advance control. Pause is V2-A19. **Blocked on O6** (lots still
waiting when the session ends) and **O7** (the host never shows up).

### V2-A13 — the deposit gate
A row, not a payment: this user entered this hall. **No gateway, no card field, no amount
that moves** — D-05 §2, and INT-08 is where that stays true.

**Owner decision, 2026-08-15: access expires when the session ends. There is no refund
transaction.** Nothing is returned because nothing moved. There is no reversal path to
build — the entitlement simply stops applying when the session ends.

It is a **new rejection reason on the bidding path**, so:

> A bid rejected for want of a deposit **must not extend `end_time`** — `CLAUDE.md` §5,
> asserted in `tests/bidding/closing.sql`, **in this PR**.

And it must not become a fourth entry in the list of three checks that must not exist. It
is an eligibility gate, the same category as "the auction has ended" — not a minimum raise,
not a ceiling, not a leading-bidder rejection.

**Blocked on O17** (is «مبلغ آخر» bounded) and **O18** (is it an `sar_amount`).

### V2-B9 / B10 / B11 — the session screens
The four-step create wizard, the session card and live room, the host control room («القطعة
2 من 4», attendance, the lot list with الآن / بالانتظار).

The control room now **draws a pause button that does something defined** — V2-A19. What is
still undecided is who can see the entrant list (**O19**), what the attendance count exposes
(**O9**), what a losing bidder is told about the expired deposit (**O15**), and how
«بدعوة فقط» invitations reach anyone at all (**O8**).

---

## The register this board is waiting on

Twenty-four open items, listed in full with their sources in
[`SPEC.md` §4.3](SPEC.md#43-the-open-register--twenty-four-real-blockers). The two that
unblock the most work are not the ones that look important.

The **reach** column is the count of tickets that cannot start until the item is answered —
computed over the *transitive* closure of the *depends on* column above, not counted by eye
from the *blocked on* cells. A ticket is reached if the item blocks it **or** blocks
anything it waits on:

| | | reach |
|---|---|---|
| **O1** | Is a category required on every auction? | **27 of 39** — V2-C1 → A1, C4, C5, C8 → the create flow, the assistant, and phase 4 |
| **O2** | Is a sub-category stored, or presentation only? | **27 of 39** — the same chain |
| **O20** | Where do images live? | **21 of 39** — V2-C2 → A2, A15, B7, B12, and the create wizard behind them |
| **O21** | What happens to abandoned uploads? | **10 of 39** |
| **O4** | Is a lot an `auctions` row, or a separate entity? | **9 of 39** — and it is by far the expensive one to *reverse*, which reach does not measure |
| **O23** | Does a lot use the same `BR-38` bound? | **9 of 39** |
| **O24** | Which image-processing provider? | **4 of 39** — and V2-A14 exists to produce the options |

**Reach is not importance, and the table above is the proof.** `O4` reaches nine tickets
and `O21` reaches ten, yet `O4` is the one that rewrites every existing query, RLS policy
and test if it is answered late — `O21` is a storage-cleanup rule. Sort by reach to decide
*what unblocks the most work today*; sort by blast radius to decide *what costs the most to
get wrong*. They are different questions and this board answers only the first.

The remaining seventeen items reach six tickets or fewer: `O3` and `O8` reach six, `O10`
and `O12` reach five, and **nine of them reach exactly one ticket**. `O11` reaches none,
for the reason given at the top of the board. Every number here is reproducible from the
*depends on* / *blocked on* columns — that is the point of writing the graph down instead
of asserting it.
