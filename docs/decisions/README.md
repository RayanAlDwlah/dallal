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
4. **Status is one of — and it is one of exactly these three:**
   - `DECIDED` — the owner decided it; it is safe to build
   - `OPEN` — raised, not decided; **do not build**
   - `IN PRD` — landed in `PRD.md`; that document is now the source, this one is history

   > **`DECIDED in shape` is not a status.** It was invented by a session to describe a
   > record that is decided *and* still carries unanswered sub-questions. Three records wore
   > it, and it read as *"half-decided, proceed carefully"* when the truth was *"decided —
   > and here are four separate things nobody has decided yet."* Removed 2026-08-15.

5. **Status describes the record. Open items are tracked separately, and each has an id.**
   Those are two different things and merging them is what produced the status above. A
   record can be `DECIDED` and still list open items — that is normal, and rule 2 is why.
   Every open item carries an `O`-id (`O1` … `O24`) so a ticket's *blocked on* column can
   name it. **A gap with no id cannot be cited as a blocker, and a gap that cannot be cited
   gets filled silently.** The full register is
   [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md).

## Precedence

`CLAUDE.md` §2's order is unchanged. This directory sits **below** `PRD.md` and above
nothing: where a record here and the PRD disagree, **the PRD wins and the record is stale**
— fix it or delete it. A record is not a licence to contradict a ratified requirement.

---

## Index

| | Decision | Status | Open items | Touches |
|---|---|---|---|---|
| [D-01](D-01-bid-increment-button.md) | The bid control is a **button carrying a seller-set amount**, not a typed number | `DECIDED` | — | **BR-32**, BR-29, FR-BID-* |
| [D-02](D-02-categories.md) | **Thirteen categories**, sourced not invented — and the category changes which fields the form asks for. Values are **validated `jsonb` over normalized category and field-definition tables** | `DECIDED` | O1, O2, O3 | `auctions` schema, create form, browse |
| [D-03](D-03-sessions.md) | **Sessions** — a room of lots opened one at a time, run live by a host. A kind of auction, **not a kind of account**. **Pause is supported** | `DECIDED` | O4–O10, O23 | new entity, **BR-36**, LC-03, BR-31 |
| [D-04](D-04-ai-product-surface.md) | The **AI is five specific things in five places**, and **all five are in scope** — measurement decided the technology for each | `DECIDED` | O11–O14, O24 | create, browse, detail. **Never** the bidding path |
| [D-05](D-05-deposit.md) | The **deposit is simulated**, paid once for the hall, unlocks **bidding not watching**, and **access expires with the session — no refund transaction** | `DECIDED` | O15–O19 | `CLAUDE.md` §1, D-03, bid eligibility |
| [D-06](D-06-images-and-create-flow.md) | **Images first, 1 to 10, required and server-validated**, first one is the cover — and the four-step create flow | `DECIDED` | O20–O23 | AUC-04, ADR-6, BR-31 |

The five previously listed here as *"raised but not decided"* are now the five records
above. They were decided by the owner approving the prototype in
`design-system/previews/*.html` on **2026-08-15**, and each record quotes the prototype or
the owner directly.

**All six records are `DECIDED`. Twenty-four open items remain**, each with an id, each
named in its record's "Still open" section, and each citable from a ticket's *blocked on*
column. Register: [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md).

**O4** — is a lot an `auctions` row or a separate entity — is now the expensive one. The two
that used to outrank it (how category fields are stored, and what a pause does to the clock)
were both decided by the owner on 2026-08-15.

Sessions remain sequenced last by the owner: *"داخلة، بس آخر شي"*.

### What measurement changed — the technology, not the scope

[`docs/ai/local-model.md`](../ai/local-model.md) measured all five AI features against the
free local model before any of them was built. **All five are approved and all five are
being built.** What measurement determined is what each one is *made of* — and for two of
them the answer was not the text model:

- **«يصلّح الصور» needs a separate image-processing / image-model pipeline.** No text or
  vision-language model outputs an edited image. It had been sitting inside the word "AI",
  and finding that out before building is why it now has its own spike, its own storage
  ticket and its own cost line instead of being discovered halfway through the uploader.
- **«يقترح سعر البداية» is SQL and data analysis, not a model call.** The model produced a
  corrupt or wrong amount on **ten runs out of ten**, stably, at `temperature: 0` — which is
  also why D-04 §4 forbids the AI from touching an amount in either direction. The feature
  ships as approved, seller-only, and it cannot be wrong about arithmetic.

Measurement constrains **how**, never **whether**. A feature is not smaller because the
correct implementation of it contains no language model.

### What to build from

`docs/v2/SPEC.md` and `docs/v2/TICKETS.md` — **39 tickets plus the unblock step**, in three
lanes that **nobody owns** (`CLAUDE.md` §1 — any available contributor may claim any ready
ticket), and the twenty-four open items the board is actually waiting on.
