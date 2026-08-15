# D-04 — The AI is five specific things in five specific places, and it is not a chat button

| Field | Value |
|---|---|
| Status | **DECIDED in shape** — by the product owner, 2026-08-15. Two of the five are **not buildable as drawn**; see §3 |
| Decided by | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah), product owner |
| Evidence | `design-system/previews/ai.html`, approved. Feasibility measured in [`docs/ai/local-model.md`](../ai/local-model.md) |
| Touches | create-auction, browse/search, auction detail; **never** the bidding path |
| Not yet in | `PRD.md` |

---

## 1. The decision

The prototype opens by saying what the AI is **not**: a chat button in the corner. It is
five features, each attached to a screen where the user already has a problem.

| # | what | where |
|---|---|---|
| 1 | **يكتب الإعلان** — reads the uploaded images, proposes title, description, category | create-auction, **step 2** |
| 2 | **يصلّح الصور** — background, lighting, crop, reflection | create-auction, **step 1** |
| 3 | **يفهم البحث** — an Arabic sentence becomes **visible, editable filter chips** | browse |
| 4 | **يجاوب عن القطعة** — answers from **the seller's description only** | auction detail |
| 5 | **يقترح سعر البداية** — from similar **ended** auctions in the last 90 days | create-auction, **seller only** |

**No sixth icon in the top bar.** That is part of the decision, not a summary of it.

## 2. The three constraints the prototype states, which are product rules

**2.1 The original image is never deleted.**

> «رجّع الأصلية» works after publish, and the page labels the result «صور معدّلة».

The prototype calls this **«حدّ أخلاقي مو تقني»** — an ethical limit, not a technical one.
An auction platform that silently beautifies the goods is lying to the bidder. So: the
original is retained, the reversal works *after publish*, and the page says the images were
edited. All three, or none.

**2.2 «ما أعرف» must be an easy answer.**

Point 4 answers *only* from the seller's description. A model that invents a service
history for a car has invented a claim the seller never made, on a page where somebody is
about to bid money on it. Refusing is the correct behaviour and the prompt must make
refusing cheap.

**2.3 Point 5 is seller-only.** A bidder must never see a machine's opinion of what an item
is worth. That is not a permission detail — showing it to a bidder would make the platform
a price authority.

## 3. What measurement changed — read this before building anything above

[`docs/ai/local-model.md`](../ai/local-model.md) measured all five against
`google/gemma-4-e4b` on the owner's machine. **Two of the five do not survive.**

| # | verdict | why |
|---|---|---|
| 1 | ✅ **build** | vision + `json_schema`, ~11 s, correct, `reasoning_tokens: 0` |
| 2 | ❌ **not an LLM at all** | no text or vision-language model outputs an edited image. This needs `rembg` / `sharp` / a hosted image model. It has been sitting inside the word "AI" and it is a **separate piece of work with a separate cost** |
| 3 | ⚠️ **build, minus the price** | category / city / keywords measured correct — but **only with Arabic enum labels**, never English slugs. The **price band must come from a deterministic parser**, never the model |
| 4 | ✅ **build** | short text, grounded in one document, easy refusal — the shape a small model is good at |
| 5 | ❌ **not the LLM's job — it is SQL** | `percentile_cont` over ended auctions in the same category. Exact, instant, free, auditable, and it **cannot hallucinate an amount** |

### 3.1 The measurement behind killing the price fields

Asked to extract filters from `ابي ساعة رولكس اقل من 50 الف بالرياض`, the model got the
category, the city and the keywords right on every run — and got the **price wrong on
every run**, in a different way per schema shape:

- `"?: 50,000"` — not a number and not parseable
- `"50 ألف"` — the word, not the value
- `under_1k` / `«أقل من ألف»` — the **wrong bucket**, stated confidently, **stably**, at
  `temperature: 0`

Ten runs, ten failures. It is not sampling noise.

> **The AI never produces, receives, classifies or validates an amount.** `CLAUDE.md` §4
> rule 1 has no exception for "the model said so", and D-04 does not create one.

Point 5 is the sharpest illustration in the whole product: it is filed under AI, it sounds
like AI, and the correct implementation contains no model.

## 4. The boundary — the answer to the `README.md` question

`docs/decisions/README.md` listed AI as open with the note *"'search and describe only' is a
guess until it is decided."* It is now decided:

**Allowed:** propose a title, a description, a category, filter chips, and an answer
grounded in the seller's own text — each landing in a control the human can edit before
anything is submitted.

**Forbidden, structurally:** `place_bid`, `current_price`, `bids`, the winner, `end_time`,
`extension_count`, any `sar_amount` value in either direction, any email address, any
internal user id.

**It never decides. It proposes into an editable field and the human presses the button.**
Every AI output in the prototype is editable — the chips are editable, the title is
editable, «رجّع الأصلية» works. That is the containment mechanism, not decoration.

The guard: `tests/guards/run.sh` gains a check that no module under `lib/ai/` imports the
bidding module or names a money identifier, and `negative.sh` gains the probe proving it
can fail (`CLAUDE.md` §9).

## 5. Still open — do NOT pick an answer

1. **Is point 2 in scope at all now that it is known not to be an LLM?** It is a real
   feature with a real cost and it was approved on the assumption it came free with the
   others. **This needs a yes or a no from the owner.**
2. **Where does the model actually run in production?** `docs/ai/local-model.md` §4 —
   dev-only, tunnel, or a hosted OpenAI-compatible endpoint. The adapter makes it three env
   vars, but somebody has to choose.
3. **Is the AI on or off by default?** `AI_ENABLED` exists in the design; its default does
   not.
4. **Does an AI-proposed title get marked as AI-proposed once the seller accepts it?** §2.1
   says edited *images* are labelled. Text is not mentioned, and the same argument applies.
5. **What happens on the ~10 % of calls that take 30–50 s** (`local-model.md` §1.5)? A
   spinner is not an answer; the screen must work with no suggestion at all.
6. **Point 5's SQL — what is "similar"?** Same category is obvious. Same sub-category? Same
   city? A minimum sample size below which no suggestion is shown? Each changes the number.
