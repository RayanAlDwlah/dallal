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
an OpenAI response body. Three environment variables — `AI_BASE_URL`, `AI_API_KEY`,
`AI_MODEL` — are the entire integration, and the day we swap the free local model for a
hosted one, **only those three values change.**

```
AI_BASE_URL=http://127.0.0.1:1234/v1     # local:  LM Studio
AI_API_KEY=lm-studio                     # local:  any non-empty string; LM Studio ignores it
AI_MODEL=google/gemma-4-e4b
```

None of these is ever `NEXT_PUBLIC_`. See §6 — that is not a style preference, it is the
same rule as `SUPABASE_SERVICE_ROLE_KEY` (`CLAUDE.md` §6) and it has the same consequence.

The hard part is not the connection. The hard part is **what we are allowed to ask it**,
and §2 is the answer measurement gave, which is not the answer the prototype assumed.

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

## 2. What the AI is therefore allowed to do — and the two prototype points that die here

`design-system/previews/ai.html` lists five things the AI does. Measurement kills two of
them and changes a third. Better to know now than to build them.

| # | the prototype's point | verdict |
|---|---|---|
| 1 | **يكتب الإعلان** — reads the images, proposes title / description / category | ✅ **build it.** Vision + `json_schema`, Arabic enum for the category, ~11 s, on a step where the user is already waiting for an upload |
| 2 | **يصلّح الصور** — background, lighting, crop, reflection | ❌ **not an LLM task at all.** No text or vision-language model can output an edited image. This needs image processing (`rembg`, `sharp`) or a hosted image model. It is a *different* piece of work that has been sitting inside the word "AI" and nobody noticed |
| 3 | **يفهم البحث** — Arabic sentence → editable filter chips | ⚠️ **build it, minus the price.** Category / city / keywords: measured correct. The price band comes from a **deterministic Arabic-numeral parser in TypeScript**, never from the model (§1.2 Finding B) |
| 4 | **يجاوب عن القطعة** — answers from the seller's description only | ✅ **build it.** Pure text, short answer, and «ما أعرف» is an easy answer — which is exactly the shape a small model is good at |
| 5 | **يقترح سعر البداية** — from similar ended auctions in the last 90 days | ❌ **not the LLM's job — it is a SQL query.** `percentile_cont` over ended auctions in the same category. Exact, free, instant, auditable, and it cannot hallucinate an amount. The model would be strictly worse at the one thing §1.2 proves it cannot do |

Point 5 is the clearest example of the trap: it *sounds* like AI, the prototype puts it
under the AI heading, and the correct implementation contains no model at all.

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

Three options. **This is a decision for the owner, not for a session:**

| | what it is | cost | what breaks |
|---|---|---|---|
| **A. dev-only** | the AI features work on `npm run dev` and are hidden in production behind `AI_ENABLED` | free | the deployed demo has no AI. If the AI is part of what is being demonstrated, this is not an option |
| **B. tunnel** | `cloudflared` / `ngrok` exposes the Mac's :1234 to a public URL; `AI_BASE_URL` points at it | free tier exists | **the laptop must be awake, online, and running LM Studio, or the feature is down.** Also puts an unauthenticated inference endpoint on the public internet unless a shared secret is checked — and `AI_API_KEY` must then actually be verified, which LM Studio does not do |
| **C. hosted OpenAI-compatible** | Groq, Together, OpenRouter, DeepInfra — all speak the same three variables | free tiers, then pennies | nothing structural. Latency *improves* by ~10×. This is what the adapter in §0 exists for |

The adapter makes A → B → C a change of three environment variables and no code. **Build
against A, keep C one env-var away, and decide later** — the point of §0 is that this
decision does not have to be made now to start building.

---

## 5. The shape of the code

```
lib/ai/
  client.ts      the only place fetch() is called. Reads AI_BASE_URL/AI_API_KEY/AI_MODEL.
                 Server-only — a "use server" module, never imported by a client component.
  schemas.ts     one json_schema per task. Arabic enum labels (§1.2 Finding A).
  labels.ts      Arabic label → category slug. A plain table, not a model call.
  tasks/
    describe.ts  images  → {title, description, category}      (point 1)
    search.ts    Arabic  → {category, city, keywords}          (point 3, no price)
    answer.ts    q + description → short answer or «ما أعرف»   (point 4)
```

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

## 6. The three rules that must not be relaxed

1. **`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` are server-only.** No `NEXT_PUBLIC_` prefix,
   ever. A `NEXT_PUBLIC_AI_API_KEY` is in the JavaScript bundle, and the bundle is public.
   The guard for this already exists in shape — `tests/guards/run.sh` bans
   `NEXT_PUBLIC_*SERVICE_ROLE*`; the AI variables get the same treatment.
2. **No prompt ever contains an email address or an internal user id** (`CLAUDE.md` §6).
   Display name is the only public identity, and a prompt is not a private place — under
   option B or C it leaves the machine entirely.
3. **No amount is ever produced by, passed to, or validated by the model.** §1.2 Finding B
   measured this failing ten times out of ten, and `CLAUDE.md` §4 rule 1 does not have an
   exception for "the model said so".

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
