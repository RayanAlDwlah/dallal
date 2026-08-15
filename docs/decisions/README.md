# Product decisions — the record

**One file per decision the product owner made that is not yet in `PRD.md`.**

Written in English, like every other document in this repository (`design/DESIGN_SYSTEM.md` §2).

---

## Why this directory exists

`CLAUDE.md` §2 says product decisions live in `PRD.md` and nowhere else, and `TEAM.md`
rule 16 says never invent one in code. Both are right and neither covers the case this
directory is for: a decision the owner has **made**, out loud, that nobody has written
into the PRD yet.

Until it is written down, that decision exists in one place — a chat log that the next AI
session cannot see. Three developers work here in sessions that cannot see each other's
context. A decision that is not in a file did not happen.

So this is the **holding area between a decision being made and the PRD being updated**.
It is not a second PRD, it does not compete with `PRD.md`, and when a decision here lands
in the PRD this file says so and stops being the source.

## The rules

1. **A record states what was decided and quotes the owner.** The quote is the evidence.
   A record without one is somebody's summary, and summaries drift.
2. **What was NOT decided is listed, explicitly, under "Still open".** This is the whole
   point. `CLAUDE.md` §8: the failure mode here is *a confident session filling a gap with
   something reasonable*. A gap that is named cannot be filled silently.
3. **A decision that touches an existing rule must say which rule and how they coexist.**
   If it cannot say that, it is not ready to implement.
4. **Status is one of:**
   - `DECIDED` — the owner decided it; it is safe to build
   - `OPEN` — raised, not decided; **do not build**
   - `IN PRD` — landed in `PRD.md`; that document is now the source, this one is history

## Precedence

`CLAUDE.md` §2's order is unchanged. This directory sits **below** `PRD.md` and above
nothing: where a record here and the PRD disagree, **the PRD wins and the record is stale**
— fix it or delete it. A record is not a licence to contradict a ratified requirement.

---

## Index

| | Decision | Status | Touches |
|---|---|---|---|
| [D-01](D-01-bid-increment-button.md) | The bid control is a **button carrying a seller-set amount**, not a typed number | `DECIDED` | **BR-32**, BR-29, FR-BID-* |
| [D-02](D-02-categories.md) | **Thirteen categories**, sourced not invented — and the category changes which fields the form asks for | `DECIDED` | `auctions` schema, create form, browse |
| [D-03](D-03-sessions.md) | **Sessions** — a room of lots opened one at a time, run live by a host. A kind of auction, **not a kind of account** | `DECIDED in shape` | new entity, **BR-36**, LC-03, BR-31 |
| [D-04](D-04-ai-product-surface.md) | The **AI is five specific things in five places** — and measurement kills two of them | `DECIDED in shape` | create, browse, detail. **Never** the bidding path |
| [D-05](D-05-deposit.md) | The **deposit is simulated**, paid once for the hall, and unlocks **bidding not watching** | `DECIDED in shape` | `CLAUDE.md` §1, D-03, bid eligibility |
| [D-06](D-06-images-and-create-flow.md) | **Images first**, up to ten, first one is the cover — and the four-step create flow | `DECIDED` | AUC-04, ADR-6, BR-31 |

The five previously listed here as *"raised but not decided"* are now the five records
above. They were decided by the owner approving the prototype in
`design-system/previews/*.html` on **2026-08-15**, and each record quotes the prototype or
the owner directly.

**`DECIDED in shape` means: the feature is real and buildable, and the record's own "Still
open" section still contains questions that must NOT be answered by a session.** D-03 §4.1
and D-02 §4.1 are the two expensive ones — see `docs/v2/SPEC.md` §4.

Sessions remain sequenced last by the owner: *"داخلة، بس آخر شي"*.

### Two things measurement changed, which no document predicted

[`docs/ai/local-model.md`](../ai/local-model.md) measured all five AI features against the
free local model before any of them was built. Two did not survive:

- **«يصلّح الصور» is not an LLM task at all.** No text or vision-language model outputs an
  edited image. It had been sitting inside the word "AI" and nobody had noticed.
- **«يقترح سعر البداية» is a SQL query, not a model call.** The model produced a corrupt or
  wrong amount on **ten runs out of ten**, stably, at `temperature: 0` — which is also why
  D-04 §4 forbids the AI from touching an amount in either direction.

### What to build from

`docs/v2/SPEC.md` and `docs/v2/TICKETS.md` — 24 tickets across two parallel tracks, and the
six questions the board is actually waiting on.
