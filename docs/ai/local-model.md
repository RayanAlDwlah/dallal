# The local model — how Dalal talks to a free LLM, and what it is allowed to say

| Field | Value |
|---|---|
| Status | **measured**, not proposed. Every number below came off this machine. |
| Machine | Apple M3, 16 GB unified memory, LM Studio 0.3.x |
| Text model | `google/gemma-4-e4b` — 4B params, gemma4 arch, 6.86 GB on disk |
| Embedding model | `text-embedding-nomic-embed-text-v1.5` — 84.11 MB, 768-dim |
| Endpoint | `http://127.0.0.1:1234/v1` — OpenAI-compatible |
| Date | 2026-08-15 |

---

## 0. The one-line answer to "كيف نربطه"

**LM Studio already speaks the OpenAI API.** There is no adapter to write and no SDK to
pick. `POST http://127.0.0.1:1234/v1/chat/completions` with an OpenAI request body returns
an OpenAI response body. Three environment variables carry the whole configuration:

```
AI_BASE_URL=http://127.0.0.1:1234/v1     # local:  LM Studio
AI_API_KEY=lm-studio                     # local:  any non-empty string; LM Studio ignores it
AI_MODEL=google/gemma-4-e4b
```

None of these is ever `NEXT_PUBLIC_`. See §6 — that is not a style preference, it is the
same rule as `SUPABASE_SERVICE_ROLE_KEY` (`CLAUDE.md` §6) and it has the same consequence.

### Configuration is not compatibility — a claim withdrawn

An earlier version of this section said that swapping the local model for a hosted one
means **"only those three values change."** **That is withdrawn**, because it is not true
and it is the kind of untrue that surfaces in production behind a green build.

Three variables **point the client at an endpoint**. They say nothing about whether what is
at that endpoint:

- accepts an **image** in the message content (feature 1 dies without it)
- honours `response_format: {type: "json_schema", strict: true}` rather than a looser
  "JSON mode" (§1.1 measured what free-form costs: 80 s and nothing usable)
- returns an object that actually **validates against the schema it was sent**
- preserves **Arabic enum values** (§1.2 Finding A — English slugs measured *wrong*)

A provider can fail any one of those while every environment variable is set correctly and
`npm run build` is green. So the rule is:

> **Configuration selects a provider. A capability contract test qualifies it.** Ticket
> **V2-A18** — vision input, strict structured output, schema validity, Arabic enum
> preservation, and a *recorded* (not asserted — see §1.5) latency. A provider that has not
> passed it is not a supported provider.

The hard part was never the connection. It is **what we are allowed to ask it** (§2) and
**what the thing on the other end can actually do** (§4).

---

## 1. What was measured

### 1.1 Free-form generation is unusable

| | prompt | result |
|---|---|---|
| `max_tokens: 300` | extract search filters from an Arabic sentence | **empty `content`**, `reasoning_tokens: 297`, **67 s** |
| `max_tokens: 1200` | same | **80 s**, 919 tokens of which 859 reasoning, and the answer was still **missing `category` and `brand`** |

`reasoning_effort: "low"` was sent and **ignored**. The model spends its entire budget
thinking and then has nothing left to answer with. A user is not waiting 80 seconds for a
filter chip.

### 1.2 Structured output is not an optimisation — it is the difference between viable and not

Send `response_format: {type: "json_schema", strict: true}` and `reasoning_tokens` drops
to **0**, because constrained decoding leaves no room to ramble.

| schema shape | latency (warm) | `category` | `city` | the price field |
|---|---|---|---|---|
| free-form JSON in prose | 80 s | ❌ missing | ✅ | — |
| `{"type":"string"}` per field | **18–20 s** | ✅ `"ساعة"` | ✅ | ❌ `"?: 50,000"` cold, `"50 ألف"` warm |
| closed `enum`, **English** slugs | **6–9 s** | ❌ `"unknown"` | ✅ `riyadh` | ❌ `under_1k` |
| closed `enum`, **Arabic** labels | **6–9 s** | ✅ `"ساعات ومجوهرات"` | ✅ `"الرياض"` | ❌ `"أقل من ألف"` |

Input, every time: `ابي ساعة رولكس اقل من 50 الف بالرياض`.

Two findings, and the second one is the important one.

**Finding A — the enum values must be Arabic.** With English slugs the model answered
`category: "unknown"` on a sentence that plainly says ساعة. With the Arabic display label
as the enum value it answered correctly, three runs out of three. Map label → slug in
TypeScript, where the mapping is a table anyone can read, not a thing the model has to
guess.

**Finding B — the model cannot handle a number.** Across four schema shapes and ten runs,
the price field was wrong **every single time**, in a different way each time:

- `"?: 50,000"` — not a number, not even a string that parses
- `"50 ألف"` — the word, not the value
- `under_1k` and `أقل من ألف` — the wrong bucket, stated with total confidence, stably,
  at `temperature: 0`

It is not noise. It is repeatable. `اقل من 50 الف` becomes "أقل من ألف" on every run.

### 1.3 Vision works

A generated PNG was described correctly, in Arabic, in **11 s**, `reasoning_tokens: 0`,
under the same `json_schema` constraint. This is the one that makes AI point 1 (يكتب
الإعلان) real.

### 1.4 Embeddings are the only interactive path

**30–54 ms warm**, 768 dimensions. That is three orders of magnitude faster than the chat
endpoint and it is the number that should shape any feature meant to feel instant.

### 1.5 Latency is not reproducible, and the architecture has to assume that

The *same call* took 6 s, 18 s, 20 s, 34 s and 54 s on the same machine on the same
afternoon. 6.86 GB of model plus the embedding model plus the OS on 16 GB is permanent
memory pressure, and the first call after an eviction pays to reload from disk.

> **Nothing in Dalal may block on the AI.** Not a form submit, not a page render, not a
> navigation. Every call is either optimistic-with-a-fallback or fired from a screen the
> user can walk away from.

---

## 2. What each of the five features is actually made of

`design-system/previews/ai.html` lists five things the AI does. **All five are approved and
all five are being built** ([D-04](../decisions/D-04-ai-product-surface.md), owner,
2026-08-15). What the measurements above determine is **which technology delivers each
one** — and for two of them, it is not the text model.

That distinction is the whole value of having measured before building. A feature is not
smaller because the correct implementation of it contains no language model; feature 5 is
*more* reliable for being SQL, and finding that out here cost an afternoon instead of a
sprint.

| # | the prototype's point | what builds it |
|---|---|---|
| 1 | **يكتب الإعلان** — reads the images, proposes title / description / category | **the VLM.** Vision + `json_schema`, Arabic enum for the category, ~11 s, on a step where the user is already waiting for an upload |
| 2 | **يصلّح الصور** — background, lighting, crop, reflection | **a separate image-processing / image-model pipeline** — `rembg`, `sharp`, or a hosted image model. No text or vision-language model outputs an *edited image*, so this gets its own provider, its own cost and its own tickets: **V2-A14** (spike) → **V2-A15** (original + derived storage) → **V2-A16** (pipeline) → **V2-B12** (surface) |
| 3 | **يفهم البحث** — Arabic sentence → editable filter chips | **the model plus deterministic parsers.** Category / city / keywords from the model — measured correct. **Brand, minimum year, price band and «تنتهي خلال ٢٤ ساعة» from parsers** in `lib/search/`, never from the model (§1.2 Finding B) |
| 4 | **يجاوب عن القطعة** — answers from the seller's description and specifications | **the model, grounded.** Short text over one document, and «ما أعرف» is an easy answer — exactly the shape a small model is good at |
| 5 | **يقترح سعر البداية** — from comparable ended auctions | **SQL and data analysis.** `percentile_cont` over comparable ended auctions, returning a **range** with the **comparable count** beside it. Exact, free, instant, auditable, and it cannot hallucinate an amount. Still the approved **seller-only** feature. **Which two percentiles bound that range is `O34` and is not answered** — see below |

Point 5 is the clearest illustration in the product: it *sounds* like AI, the prototype puts
it under the AI heading, and the correct implementation contains no model at all — which
makes it the most trustworthy of the five, not the least.

> **Trustworthy about arithmetic is not the same as decided.** `percentile_cont` takes its
> two bounds as arguments, and no measurement on this page supplies them: `p25`/`p75` and
> `p10`/`p90` are different suggestions over identical data. This row stated the range as a
> settled property of the feature until 2026-08-15, when it was raised as **`O34`**
> ([D-04 §5](../decisions/D-04-ai-product-surface.md), [`SPEC.md` §4.3](../v2/SPEC.md)). It
> blocks **V2-A4**. The measurement removed the model from this feature; it did not remove
> the product decision inside it.

---

## 3. The forbidden zone — non-negotiable

The AI module may **never** read from, write to, import, or be imported by:

| forbidden | why |
|---|---|
| `place_bid` | the atomic operation. A non-deterministic thing has no business inside a row lock |
| `current_price`, `bids`, the winner | correctness under contention is proved by `tests/bidding/`. A model near it invalidates the proof |
| `end_time`, `extension_count` | the anti-sniping cap is a `CHECK` constraint (`CLAUDE.md` §5). Nothing suggests a value here |
| **any `sar_amount` value, in either direction** | §1.2 Finding B, and `CLAUDE.md` §4. The model produced a corrupt money string on ten runs out of ten |
| the user's email, the internal user id | `CLAUDE.md` §6. Prompts leave the machine the moment `AI_BASE_URL` stops being localhost |

**It never decides. It proposes, into a field the human can edit, and the human presses
the button.** Every AI output in the prototype lands in an editable control — the filter
chips are editable, the generated title is editable, «رجّع الأصلية» works after publish.
That is not a UI nicety, it is the containment.

### The guard that enforces it

`tests/guards/run.sh` gains one check, in the same spirit as the fifteen already there:

```
no module under lib/ai/ imports lib/bidding/, place_bid, current_price, or sar_amount
```

and `tests/guards/negative.sh` gains the probe that proves it can fail. A written rule
stops nothing on its own — `CLAUDE.md` §9.

---

## 4. The deployment problem, said plainly

**Vercel cannot reach `127.0.0.1:1234`.** The serverless function runs in Vercel's
infrastructure; `localhost` there is the function's own container. This is not a
configuration issue and there is no header that fixes it.

Three options were on the table. **The owner decided, 2026-08-15:**

> **LM Studio is for local development. Production uses a hosted OpenAI-compatible
> provider, selected through a capability check.**

That is **option C**, and it closes A and B:

| | what it is | status |
|---|---|---|
| **A. dev-only** | AI features work on `npm run dev`, hidden in production behind `AI_ENABLED` | **not the production answer.** Still what runs locally — that is the decision's first half |
| **B. tunnel** | `cloudflared` / `ngrok` exposes the Mac's :1234; `AI_BASE_URL` points at it | **rejected.** The laptop would have to be awake, online and running LM Studio or the feature is down — and it puts an unauthenticated inference endpoint on the public internet, since LM Studio does not verify `AI_API_KEY` |
| **C. hosted OpenAI-compatible** | Groq, Together, OpenRouter, DeepInfra, … | **chosen for production.** Latency improves by roughly 10× |

**Which** hosted provider is still open — `O11` in
[`docs/v2/SPEC.md` §4.3](../v2/SPEC.md). And the step that is *not* optional once one is
picked:

> A candidate provider is qualified by the **capability contract test (V2-A18)** — vision,
> `json_schema` + `strict`, schema validity, Arabic enum preservation, recorded latency —
> **run against that provider's endpoint.** Being listed in the table above is not
> qualification. Being configured is not qualification. Passing is.

So: **build against A locally, run V2-A18 against each C candidate, and let the test decide
which ones are usable.** What does *not* follow is that the switch is free — see §0.

> **That sentence is a requirement, and until 2026-08-15 it was a requirement with no
> ticket.** V2-A18 *builds* a test that is runnable against any endpoint. Nothing made
> anyone **run** it against the endpoint production would use, or leave the answer where a
> reader could find it — and `SPEC.md` §4.3 had reasoned `O11` out of every *blocked on*
> cell on the grounds that a deployment is not a ticket, which disposed of the qualification
> along with the deployment. **V2-A20** is the qualification, as a deliverable: the recorded
> run — date, endpoint host, model id, the five capabilities, the measured latencies — and a
> check that goes red on an incomplete record. It is blocked on `O11`, so it lands after the
> owner picks. It does not pick.

---

## 5. The shape of the code

```
lib/ai/
  client.ts      the only place fetch() is called. Reads AI_BASE_URL/AI_API_KEY/AI_MODEL.
                 Starts with  import "server-only"  — see the note below.
  schemas.ts     one json_schema per task. Arabic enum labels (§1.2 Finding A).
  labels.ts      Arabic label → category slug. A plain table, not a model call.
  capability.ts  the V2-A18 probe: vision, strict json_schema, Arabic enum, latency.
  tasks/
    describe.ts  images  → {title, description, category}      (point 1)
    search.ts    Arabic  → {category, city, keywords}          (point 3, no price)
    answer.ts    q + description + specs → short answer or «ما أعرف»   (point 4)
```

> **`import "server-only"`, not `"use server"`.** An earlier version of this document said
> *"a `"use server"` module"*. **That was wrong, and the two are not interchangeable:**
>
> - **`import "server-only"`** is a build-time poison pill. If any client component pulls
>   the module into its graph, the build fails. That is exactly what is wanted here.
> - **`"use server"`** marks a module's exports as **Server Actions** — callable from the
>   client over an RPC endpoint the framework generates. Putting it on `client.ts` would
>   *publish* every AI function as an endpoint, which is the opposite of the intent.
>
> **`"use server"` is reserved for Server Actions.** The guard in §6 asserts the correct
> one is present, so this cannot regress quietly.

Everything reaches it through a **Route Handler** under `app/api/ai/*`, so the browser
never learns the base URL, never holds the key, and the server can refuse a request that
is not from a signed-in user. The price parser lives in `lib/search/parse-amount.ts` —
under `lib/search/`, not `lib/ai/`, because it is not AI and putting it there is how it
would eventually get replaced by a model call.

`AI_ENABLED` is checked in one place. When it is off, every task returns "no suggestion"
and every screen is expected to work — because §1.5 says the model will be unavailable
sometimes anyway, and a screen that only works when the model answers is broken either
way.

---

## 6. The four rules that must not be relaxed

1. **`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` are server-only.** No `NEXT_PUBLIC_` prefix,
   ever. A `NEXT_PUBLIC_AI_API_KEY` is in the JavaScript bundle, and the bundle is public.
   The guard for this already exists in shape — `tests/guards/run.sh` bans
   `NEXT_PUBLIC_*SERVICE_ROLE*`; the AI variables get the same treatment, **and every module
   under `lib/ai/` must carry `import "server-only"`** (§5).
2. **No prompt ever contains an email address or an internal user id** (`CLAUDE.md` §6).
   Display name is the only public identity, and a prompt is not a private place — the
   production provider is a third party, so every prompt leaves the machine.
3. **No amount is ever produced by, passed to, or validated by the model.** §1.2 Finding B
   measured this failing ten times out of ten, and `CLAUDE.md` §4 rule 1 does not have an
   exception for "the model said so".
4. **A provider is used only after it passes the capability contract test** (§0, §4,
   ticket V2-A18). Setting three environment variables is configuration; passing the test
   is qualification. The failure this prevents is silent: correct config, green build,
   feature broken in production because the endpoint quietly ignored `strict` or refused an
   image.

---

## 7. Reproducing the measurements

```sh
lms server start                                   # LM Studio, port 1234
curl -s http://127.0.0.1:1234/v1/models            # confirms which models are loaded
```

The four request bodies in §1.2 differ only in `response_format`. The fastest and most
accurate of them — Arabic enum labels, `strict: true` — is the shape `lib/ai/schemas.ts`
should follow, with the price field **absent**, not merely ignored.

`lms server stop` when finished; the model stays resident and the memory pressure in §1.5
is real.
