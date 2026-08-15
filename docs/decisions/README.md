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

### Raised but NOT decided — do not build

These came out of the interactive prototype (`design-system/build/index.html`). The owner
has seen them and liked the design. **Liking a prototype is not ratifying a rule**, and
none of the questions below has an answer yet:

| | Area | The unanswered part |
|---|---|---|
| — | **Categories** | The prototype shows 13 categories sourced from حراج. Is that the list? Are they fixed or extensible? Is one required per auction? |
| — | **Multiple images** | How many? Which is the card image? What happens to `AUC-04`'s single-image path and `ADR-6`'s upload-before-create ordering? |
| — | **AI** | Where exactly is its boundary? It must never touch the money path or the outcome path, and its key must never be `NEXT_PUBLIC_` — but "search and describe only" is a guess until it is decided. |
| — | **Deposit (العربون)** | Everything. Amount, who holds it, what happens on a win or a loss. **It must be recorded as simulated** — `CLAUDE.md` §1: no money changes hands. |
| — | **Sessions (الجلسات)** | The largest by far, and deliberately last. A new entity, lot ordering, per-lot duration, pausing, host powers. |

Sequenced last by the owner: *"داخلة، بس آخر شي"*.
