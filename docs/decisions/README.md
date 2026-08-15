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
   - `IN PRD` — landed in `PRD.md`; that document is now the source, this one is history.
     **Only the owner moves a record here** — see "The ratification gate" below. No record
     is `IN PRD` today

   > **`DECIDED in shape` is not a status.** It was invented by a session to describe a
   > record that is decided *and* still carries unanswered sub-questions. Three records wore
   > it, and it read as *"half-decided, proceed carefully"* when the truth was *"decided —
   > and here are four separate things nobody has decided yet."* Removed 2026-08-15.

5. **Status describes the record. Open items are tracked separately, and each has an id.**
   Those are two different things and merging them is what produced the status above. A
   record can be `DECIDED` and still list open items — that is normal, and rule 2 is why.
   Every open item carries an `O`-id (`O1` … `O34`) so a ticket's *blocked on* column can
   name it. **A gap with no id cannot be cited as a blocker, and a gap that cannot be cited
   gets filled silently.** The full register is
   [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md).

## Precedence

`CLAUDE.md` §2's order is unchanged. This directory sits **below** `PRD.md` and above
nothing: where a record here and the PRD disagree, **the PRD wins and the record is stale**
— fix it or delete it. A record is not a licence to contradict a ratified requirement.

---

## The ratification gate — only the owner moves a decision into `PRD.md`

### The three rules

1. **No session and no contributor PR edits `PRD.md`.** Ratification is the product owner's
   act, performed by the owner. A session that believes a record is ready says so in the
   queue below and **stops there**.
2. **`DECIDED` authorises building. It does not authorise ratifying.** Those are two
   different acts, and this directory exists because of the gap between them (see "Why this
   directory exists"). A record can be safe to build from and still be absent from the PRD.
3. **A session that finds a record contradicting the PRD surfaces it and does not pick a
   side** — `CLAUDE.md` §2 and §8. That is what the `R` register below is.

### Silence and contradiction are not the same thing

The two sections above this one look like they conflict, and they do not — they cover
different cases, and telling them apart is the whole job of this gate:

| the PRD… | what the record is doing | what that means |
|---|---|---|
| **is silent** | filling a gap | exactly what this directory is for. `DECIDED` → **safe to build**, rule 4 |
| **says the opposite** | superseding a ratified requirement | Precedence applies: *"a record is not a licence to contradict a ratified requirement."* **The owner ratifies, or nothing is safe** |

Nobody had checked which case each record was in. The sweep below did — mechanically,
against `PRD.md` at `823d9db`, with line numbers — and it found both kinds.

### The `R` register — what ratification each record is waiting on

**These are not `O` items and must not be merged into that register.** An `O` item is a
question **nobody has answered**, and the ticket must not answer it. An `R` item is a
question the owner **has** answered, where the ratified document does not say so yet.
Opposite shapes, opposite remedies — and `docs/v2/SPEC.md` §4.1 records what it cost the
last time two different ideas shared one label.

| id | record | the PRD today | conflict? | what ratifying it requires |
|---|---|---|---|---|
| **R1** | [D-02](D-02-categories.md) — 13 categories, category-driven fields | `PRD.md:411` lists **"categories, search, and recommendations"** under *out of scope*; `PRD.md:508` **FR-CREATE-03**: *"The MVP must not offer optional auction fields. Every field is required… category and condition are Future"*; also `:1874`, `:2133` | **YES — direct** | FR-CREATE-03 must admit optional fields, or the category fields must be required. §19 and Future Enhancements must un-mark categories, the way `BR-36` un-marked anti-sniping |
| **R2** | [D-06](D-06-images-and-create-flow.md) — 1 to 10 images, required | `PRD.md:527` **FR-CREATE-15**: *"Exactly one image per auction in the MVP. Multiple images are Future."*; `PRD.md:411` out of scope *"multi-image galleries and video"*; also `:1915` | **YES — direct** | FR-CREATE-15 rewritten to 1–10; the cover-image concept is new and has no FR. **BR-31** (`PRD.md:799`) freezes *"image"* after publish — D-06's `O22` (reorder after publish) sits directly on it |
| **R3** | [D-03](D-03-sessions.md) — pause moves `end_time` forward | `PRD.md:784` **BR-16**: *"Nobody may change an auction's end time — not the seller, not an admin, not any edit path… **The single exception** is the automatic anti-sniping extension in BR-36"* | **YES — and it is live on `main` today** | BR-16 must go from *the single exception* to two named doors. See below |
| **R4** | [D-01](D-01-bid-increment-button.md) — the bid button | `PRD.md:651` **FR-BID-09** forbids the **server** requiring a step, which the button does not do (D-01 §2). But a seller-set increment is a **new create field**, and `PRD.md:508` **FR-CREATE-03** says *"must not offer optional auction fields"* | **depends on an open item** | Nothing, **if** the increment is required. D-01 §5 item 1 asks exactly that, and nobody has answered it |
| **R5** | [D-04](D-04-ai-product-surface.md) — five AI features | **silent.** Zero occurrences of "AI", "assistant" or "machine learning" in `PRD.md` | no | a new FR section. Gap-filling, not supersession — safe to build under rule 4 |
| **R6** | [D-05](D-05-deposit.md) — the simulated deposit | **silent.** Zero occurrences of "deposit" | no | a new rejection reason alongside `BR-23`. Gap-filling |

### Where an `R` stops being paperwork and starts blocking work

This register says what each record is **waiting on**. It does not say what is **waiting on
it** — and until 2026-08-15 nothing did, which meant four ids could say *not safe to build*
with nowhere on the board to cite them.

That place is now the **`ratification`** column in
[`docs/v2/TICKETS.md`](../v2/TICKETS.md). It carries an `R` on the ticket whose **own
deliverable** would put that record in front of users ahead of `PRD.md` — not on everything
downstream of it, which the dependency closure already propagates for free.

**Four of the six gate at least one ticket: `R1`, `R2`, `R3`, `R4`.** `R5` and `R6` gate
nothing, and that is this register working rather than failing — `PRD.md` is silent about the
AI surface and about the deposit, silence is gap-filling, **rule 4** above makes gap-filling
safe to build, and a ratification gate on either would be a gate nobody asked for.

That split is re-derived from the board and from the `conflict?` column above by
[`tests/v2/graph.check.mjs`](../../tests/v2/graph.check.mjs), which fails if a record ever
gates a ticket while claiming to contradict nothing, or contradicts the PRD while gating no
work. **The per-record reach figures live on the board and are deliberately not restated
here** — a number copied into a second document is a number that can drift in one of them.

### R3 is not hypothetical — the drift already happened

`CLAUDE.md` §5 carries the pause amendment today, in the file that governs `end_time`:

> *"the sentence 'only inside `place_bid`' is now 'inside `place_bid`, **or** inside the
> pause/resume operation'. Those are the only two doors."*

`PRD.md:784` still reads *"The single exception is the automatic anti-sniping extension in
BR-36."* Both are on `main`. The engineering constitution and the product requirement now
disagree about how many doors `end_time` has, and **the PRD is the one that wins** by
`CLAUDE.md` §2 — which makes the amendment `CLAUDE.md` §5 mandates a violation of the PRD.
Nobody intended that. It is what an unratified decision looks like a week later.

### What ratification actually looks like — `BR-36` is the worked example

The anti-sniping reversal is the one V1 decision that went all the way through, and it is
the shape to copy. It did not just rewrite `BR-36`. `PRD.md:2195` is an **amendment
ledger**, naming every place that had to move with it:

> BR-36 rewritten; §19.2 and §22.1 un-marked; SC-74 rewritten and SC-74a/74b/74c added;
> A-B6 re-decided; BR-P5, §5.3, §7.3 and the §23 checklist updated

Nine locations for one rule. That count is the honest cost of ratification, and it is why
`R1` and `R2` above each list more than one line. It is also why the ledger matters more
than the rule itself: without one, the next sweep finds §19 still saying categories are
Future.

### The mechanism

Prose is not a gate (`CLAUDE.md` §9). Two checks in `tests/guards/run.sh` hold this one:

- **every record declares a status from the three in rule 4** — the check that would have
  caught `DECIDED in shape`, which three records actually wore
- **every record that is not `IN PRD` appears in the `R` register above** — so a seventh
  decision record cannot be added without saying what the PRD does or does not already say

Neither check ratifies anything, and neither can. They only make the queue impossible to
forget.

---

## Index

| | Decision | Status | Open items | Touches |
|---|---|---|---|---|
| [D-01](D-01-bid-increment-button.md) | The bid control is a **button carrying a seller-set amount**, not a typed number | `DECIDED` | **O25–O30** | **BR-32**, BR-29, FR-BID-* |
| [D-02](D-02-categories.md) | **Thirteen categories**, sourced not invented — and the category changes which fields the form asks for. Values are **validated `jsonb` over normalized category and field-definition tables** | `DECIDED` | O1, O2, O3 | `auctions` schema, create form, browse |
| [D-03](D-03-sessions.md) | **Sessions** — a room of lots opened one at a time, run live by a host. A kind of auction, **not a kind of account**. **Pause is supported** | `DECIDED` | O4–O10, O23, **O31–O33** | new entity, **BR-36**, LC-03, BR-31 |
| [D-04](D-04-ai-product-surface.md) | The **AI is five specific things in five places**, and **all five are in scope** — measurement decided the technology for each | `DECIDED` | O11–O14, O24, **O34** | create, browse, detail. **Never** the bidding path |
| [D-05](D-05-deposit.md) | The **deposit is simulated**, paid once for the hall, unlocks **bidding not watching**, and **access expires with the session — no refund transaction** | `DECIDED` | O15–O19 | `CLAUDE.md` §1, D-03, bid eligibility |
| [D-06](D-06-images-and-create-flow.md) | **Images first, 1 to 10, required and server-validated**, first one is the cover — and the four-step create flow | `DECIDED` | O20–O23 | AUC-04, ADR-6, BR-31 |

The five previously listed here as *"raised but not decided"* are now the five records
above. They were decided by the owner approving the prototype in
`design-system/previews/*.html` on **2026-08-15**, and each record quotes the prototype or
the owner directly.

**All six records are `DECIDED`. Thirty-four open items remain**, each with an id, each
named in its record's "Still open" section, and each citable from a ticket's *blocked on*
column. Register: [`docs/v2/SPEC.md` §4.3](../v2/SPEC.md).

> **D-01's `Open items` cell read `—` until 2026-08-15, and the dash was false.** Six
> questions were sitting in [D-01 §5](D-01-bid-increment-button.md) the whole time, under a
> heading saying not to answer them. They had no ids, so no ticket could cite them, so three
> tickets carried `blocked on: —` and the board counted them **startable**. Rule 5 above is
> not a filing convention. It is the mechanism, and this is what its absence looks like: not
> a wrong answer anywhere, just a hole in the numbering that renders as good news. The six
> are now `O25`–`O30`; the unblocked set went **7 → 4**; D-01 §5a has the measurement.
>
> **`O31`–`O33` are the same failure in a record that looked complete.** D-03 §3.0 marks
> pause `DECIDED` and lists four conditions, so the section reads finished — and all four
> are about the **lot being paused**, in a product where a session is a room of many lots.
> Nothing said whether a pause may last forever, what it does to the lots queued behind it,
> or — reading two owner sentences from the same day — whether the operation takes a lot or
> the session. `V2-A19` carried `blocked on: —`. **A record can be `DECIDED` and still have
> gaps; `DECIDED` is a status on the record, never a claim about its coverage.** D-03 §4a.
>
> **The ratio is the finding.** Three passes over these records added **nine** ids to a
> register of twenty-four — none of them a new question, all of them written down already,
> in prose, under headings that read as settled.

**None of the six is `IN PRD`. Three contradict it directly** — `R1`, `R2`, `R3` — **and one
contradicts it conditionally**: `R4`, which needs nothing ratified *if* the seller-set
increment is required, and needs `FR-CREATE-03` reopened if it is optional. Nobody has
answered that (`O25`), so `R4` is carried as a gate, not waved through.

All four are in the ratification gate above. That is an owner action, not a contributor
judgement, and it is tracked apart from the `O` register on purpose: an `O` item is
unanswered, an `R` item is answered and unratified.

> **This sentence said "three of them contradict it" while the table above it listed four
> rows that are not `no`.** Both readings were defensible — `R4`'s cell says *depends on an
> open item*, so "three contradict" is true of the direct ones — and that is exactly why it
> went unnoticed: nothing was wrong, one number was just answering a narrower question than
> the sentence around it asked. `docs/v2/TICKETS.md` then gated three tickets on `R4`, and
> the two documents disagreed about how many decisions were holding work.
>
> Prose is not a gate (`CLAUDE.md` §9), so the count is no longer written by hand. Two
> assertions in `tests/v2/graph.check.mjs` re-derive both lists from the `conflict?` column
> and fail if either drifts.

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

`docs/v2/SPEC.md` and `docs/v2/TICKETS.md` — **40 tickets plus the unblock step**, in three
lanes that **nobody owns** (`CLAUDE.md` §1 — any available contributor may claim any ready
ticket), and the thirty open items the board is actually waiting on.
