# D-04 — The AI is five specific things in five specific places, and it is not a chat button

| Field | Value |
|---|---|
| Status | **DECIDED** — by the product owner, 2026-08-15, and re-confirmed the same day. **All five features are approved and in scope.** Open items are listed in §5 and carry `O` ids |
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
| 4 | **يجاوب عن القطعة** — answers from **the seller's description and specifications only** | auction detail |
| 5 | **يقترح سعر البداية** — from similar **ended** auctions | create-auction, **seller only** |

**No sixth icon in the top bar.** That is part of the decision, not a summary of it.

## 2. The three constraints the prototype states, which are product rules

**2.1 The original image is never deleted.**

> «رجّع الأصلية» works after publish, and the page labels the result «صور معدّلة».

The prototype calls this **«حدّ أخلاقي مو تقني»** — an ethical limit, not a technical one.
An auction platform that silently beautifies the goods is lying to the bidder. So: the
original is retained, the reversal works *after publish*, and the page says the images were
edited. All three, or none.

**2.2 «ما أعرف» must be an easy answer.**

Point 4 answers *only* from the seller's description and the category specifications. A
model that invents a service history for a car has invented a claim the seller never made,
on a page where somebody is about to bid money on it. Refusing is the correct behaviour and
the prompt must make refusing cheap.

**2.3 Point 5 is seller-only.** A bidder must never see a machine's opinion of what an item
is worth. That is not a permission detail — showing it to a bidder would make the platform
a price authority.

## 3. What measurement determined — the technology, not the scope

[`docs/ai/local-model.md`](../ai/local-model.md) measured all five against
`google/gemma-4-e4b` on the owner's machine, before any of them was built. That was the
point of measuring: **to find out what each feature is actually made of.**

**It did not remove anything from the product.** All five are approved and all five are in
scope. What measurement changed is *which technology implements each one* — and in two
cases the answer was not the text model.

| # | built with | what the measurement said |
|---|---|---|
| 1 | **a VLM** | vision + `json_schema`, ~11 s, correct, `reasoning_tokens: 0` |
| 2 | **a separate image-processing / image-model pipeline** | no text or vision-language model outputs an *edited image*. This is its own provider, its own cost and its own ticket — V2-A14 (spike) → V2-A16 (pipeline). **In scope, by owner decision** |
| 3 | **the model plus deterministic parsers** | category and city measured correct — but **only with Arabic enum labels**, never English slugs. Brand, minimum year, price band and «تنتهي خلال ٢٤ ساعة» come from **parsers**, never the model |
| 4 | **the model, grounded** | short text, grounded in one document, easy refusal — the shape a small model is good at |
| 5 | **SQL / data analysis** | `percentile_cont` over comparable ended auctions. Exact, instant, free, auditable, and it **cannot hallucinate an amount** |

### 3.1 The measurement behind keeping amounts away from the model

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
like AI, and the correct implementation contains no model. **That makes it more reliable,
not less of a feature** — a seller-facing price suggestion that cannot be wrong about
arithmetic is a better version of the thing that was approved, delivered by the tool that
can actually deliver it.

### 3.2 Point 5, specified

Approved as the seller-only starting-price suggestion, and it ships with four things:

1. **a range**, not a single number — a point value reads as a valuation. **Which two
   percentiles bound it is `O34`**, and it is not answered here
2. **the comparable count, on screen** — «مبني على 27 مزادًا مشابهًا»
3. **a stated definition of "similar"**, in the contract and in the query
4. **a minimum sample threshold**, below which **nothing is shown** — not a wider range,
   not a caveat

Items 3 and 4 need §5's `O14` answered before they can be built, and item 1 needs `O34`.

> **Item 2 is the only one of the four that is buildable today, and this section said
> otherwise until 2026-08-15.** `V2-A4` described items 1 and 2 as *"shapes"* that are safe
> to start. A count on a screen is a shape. `percentile_cont` is not — it takes the two
> bounds as arguments, and picking them is picking what the seller is told their item is
> worth. The unnumbered gap here was smaller than D-01's six and had the same structure:
> a decision with nowhere to be cited from reads as an absence of one.

## 4. The boundary

**Allowed:** propose a title, a description, a category, filter chips, an enhanced *derived*
image, and an answer grounded in the seller's own text — each landing in a control the human
can edit, revert or ignore before anything is submitted.

**Forbidden, structurally:** `place_bid`, `current_price`, `bids`, the winner, `end_time`,
`extension_count`, any `sar_amount` value in either direction, any email address, any
internal user id.

**It never decides. It proposes into an editable field and the human presses the button.**
Every AI output in the prototype is editable — the chips are editable, the title is
editable, «رجّع الأصلية» works. That is the containment mechanism, not decoration.

The guard: `tests/guards/run.sh` gains a check that no module under `lib/ai/` imports the
bidding module or names a money identifier, and that every module under `lib/ai/` carries
**`import "server-only"`**; `negative.sh` gains the probes proving each can fail
(`CLAUDE.md` §9).

### 4.1 Where the model runs — decided

**Owner decision, 2026-08-15:**

> **LM Studio is for local development. Production uses a hosted OpenAI-compatible provider,
> selected through a capability check.**

The adapter reads `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — **never `NEXT_PUBLIC_`**. That
is how an endpoint is *configured*.

> **Configuration is not qualification.** An earlier draft of the V2 spec claimed that
> swapping providers "changes only those three values". **That claim is withdrawn.** Three
> variables point the client somewhere; they say nothing about whether what is there accepts
> an image, honours `response_format: {type: "json_schema", strict: true}`, returns the
> schema it was given, or preserves an Arabic enum. A provider failing any of those breaks
> features 1, 3 and 4 at runtime, in production, behind a green build.

So a candidate is qualified by a **capability contract test** — ticket **V2-A18** — which
asserts vision input, strict structured output, schema validity, Arabic enum preservation,
and records (does not assert) latency. **Which** provider is `O11`; **running the test
against it and committing what came back** is `V2-A20`.

## 5. Still open — do NOT pick an answer

Each carries the id it is cited by in [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md) and in the
tickets it blocks.

| id | question | blocks |
|---|---|---|
| ~~1~~ | ~~**Is point 2 in scope now that it is known not to be an LLM?**~~ **ANSWERED — owner, 2026-08-15: yes, in scope**, as a separate image-processing pipeline. Struck, not deleted, so the numbering does not shift | — |
| ~~2~~ | ~~**Where does the model run in production?**~~ **ANSWERED — LM Studio for local dev; hosted compatible provider in production, selected through a capability check** (§4.1) | — |
| **O11** | **Which** hosted provider, concretely? V2-A18 says whether a candidate qualifies; it does not choose one | **V2-A20** — run V2-A18 against the chosen endpoint, commit the recorded result, and check that the record is complete. This cell read *"no ticket"* until 2026-08-15, on the argument that a deployment is not a row on the board; §4.1's *"a candidate is qualified by a capability contract test"* is a requirement, not a deployment, and it had nowhere to land — [`SPEC.md` §4.3](../v2/SPEC.md) |
| **O12** | **Is the AI on or off by default?** `AI_ENABLED` exists in the design; its default does not | V2-A6 |
| **O13** | **Does an AI-proposed title get marked as AI-proposed once the seller accepts it?** §2.1 labels edited *images*. Text is not mentioned and the same argument applies | V2-B8 |
| **O24** | **Which image-processing provider or library** implements point 2, at what cost and latency? **V2-A14 is a timeboxed spike that produces the options — the owner picks from them** | V2-A16, V2-B12, V2-C7 |
| **O14** | **Point 5's SQL — what is "similar", and what is the minimum sample?** Same category is obvious. Same sub-category? Same city? What window? Below what count is nothing shown? Each changes the number on the screen | V2-A4 |
| **O34** | **Point 5's range — which two percentiles are the bounds?** §3.2 item 1 and V2-A4 both say `percentile_cont` *"at two bounds"* and neither names them. `p25`/`p75` and `p10`/`p90` are different suggestions over identical data, and the two ways of getting it wrong point opposite ways: a wide band is honest and useless, a narrow one **is** the valuation a range was chosen to avoid printing. Same test as `O14` — *it changes the number on the screen* | V2-A4 |

**Not open, and already answered by the design:** what happens on the ~10 % of calls that
take 30–50 s (`local-model.md` §1.5). A spinner is not an answer — **every screen must work
with no suggestion at all**, and that is a build requirement on V2-B8, not a question.
