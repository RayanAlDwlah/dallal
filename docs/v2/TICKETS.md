# Dalal V2 — the tickets

Read [`SPEC.md`](SPEC.md) first. Every ticket below is sized for **one Claude session**: it
has a single deliverable, a named proof, and it does not require answering a product
question. **A ticket that turns out to need a product decision stops and asks** — that is
the whole point of the "blocked on" column, and every id in that column resolves to a real
entry in [`SPEC.md` §4.3](SPEC.md#43-the-open-register--thirty-four-real-blockers).

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

**40 tickets, plus `V2-00`.** 69 dependency edges between tickets; 54 blocking edges onto
**34** of the 34 open owner questions.

Every number in this document — including that one — is recomputed from these two tables by
[`tests/v2/graph.check.mjs`](../../tests/v2/graph.check.mjs). Run it before you believe a
count here, and run it again after you edit a cell. A board that states its own totals in
prose is a board that will state them wrongly.

**Every one of the thirty-four now blocks a ticket. Until 2026-08-15 `O11` did not, and
that was not a property of `O11` — it was a hole in this board.** The paragraph that used to
sit here
argued that *which* hosted provider gates only the **production deployment**, and that a
deployment is not a row on a ticket board. The first half is right. The second half quietly
disposed of the work: [`docs/ai/local-model.md` §4](../ai/local-model.md) states as a
requirement that a candidate is qualified by **running V2-A18 against its endpoint**, and no
ticket anywhere carried that run or its evidence. A requirement that appears in prose in two
documents and in no plan is the shape `D-01 §3` already named — *a follow-up is a promise,
and promises are not mechanisms*. **V2-A20** is that requirement as a deliverable. It still
does not deploy anything and it still does not pick a provider; it makes deploying without
qualification visible.

**`V2-A19` — pause — read `blocked on: —` on the same day, and for the same reason.**
[D-03 §3.0](../decisions/D-03-sessions.md) records pause as `DECIDED` and lists four
conditions; **all four are about the lot being paused.** A session is a room of lots. Nobody
had written down what a pause does to the lots queued behind it (`O32`), whether it may last
forever (`O31`), or — comparing two owner sentences from the same day — whether the operation
takes a lot or the whole session (`O33`). `O31` is the one to read first: pause is the
**second door onto `end_time`** and it has no cap, and `CLAUDE.md` §5 already says in plain
words what an uncapped door does — *"without it a contested auction never ends, never
finalizes, and never has a winner."* That is why the extension cap is a `CHECK` constraint
and not an `if`, and it is reachable through pause today.

| id | lane | ticket | depends on | blocked on | ratification |
|---|---|---|---|---|---|
| **V2-00** | — | Land #155, get `main` green, then merge #167 | — | — | — |
| **V2-C1** | C | Contract: category + category-specific fields → `docs/contracts/V2-C1-category-fields.md` | V2-00 | **O1, O2** | **R1** |
| **V2-C2** | C | Contract: auction images → `docs/contracts/V2-C2-auction-images.md` | V2-00 | **O20** | **R2** |
| **V2-C3** | C | Contract: the bid button → `docs/contracts/V2-C3-bid-button.md` | V2-00 | **O25, O26, O27, O28, O29, O30** | **R4** |
| **V2-C4** | C | Contract: create-auction payload → `docs/contracts/V2-C4-create-auction.md` | V2-C1, V2-C2, V2-C3 | — | — |
| **V2-C5** | C | Contract: AI task I/O → `docs/contracts/V2-C5-ai-tasks.md` | V2-C1 | — | — |
| **V2-C6** | C | Contract: session + lot → `docs/contracts/V2-C6-session-lot.md` | V2-C4 | **O4, O23** | — |
| **V2-C7** | C | Contract: image enhancement → `docs/contracts/V2-C7-image-enhancement.md` | V2-C2 | **O24** | — |
| **V2-C8** | C | Contract: search filters → `docs/contracts/V2-C8-search-filters.md` | V2-C1 | — | — |
| **V2-A1** | A | Categories: normalized tables, field definitions, validated `jsonb`, label→slug | V2-00, V2-C1 | **O1, O2** | **R1** |
| **V2-A2** | A | Auction images: bucket, ordered 1–10, cover at position 0, server-side count | V2-00, V2-C2 | **O20, O21** | **R2** |
| **V2-A3** | A | `bid_increment` + INT-08 narrowing + the BR-32 survival test | V2-00, V2-C3 | **O25, O26, O27, O30** | **R4** |
| **V2-A4** | A | Starting-price suggestion — SQL, a **range**, a comparable count | V2-A1 | **O14, O34** | — |
| **V2-A5** | A | Create-auction server action — incl. **BR-38's 5 min–7 days** | V2-A1, V2-A2, V2-A3, V2-C4 | — | — |
| **V2-A6** | A | `lib/ai/` — adapter, schemas, `AI_ENABLED`, `server-only`, the guard | V2-00, V2-C5 | **O12** | — |
| **V2-A7** | A | **VLM** task: images → title / description / category | V2-A6, V2-A1 | — | — |
| **V2-A8** | A | Model task: Arabic sentence → category, city, keywords. **No amount, no filter values** | V2-A6, V2-A1, V2-C8 | — | — |
| **V2-A9** | A | Grounded Q&A — seller's **description and specifications only** | V2-A6, V2-A5 | — | — |
| **V2-A10** | A | Sessions + lots schema | V2-A1, V2-A2, V2-A3, V2-C6 | **O4, O8, O10, O23** | — |
| **V2-A11** | A | Open / close a lot — **incl. the server-side extension-window refusal** | V2-A10 | **O5** | — |
| **V2-A12** | A | Host powers: advance, end session | V2-A11 | **O6, O7** | — |
| **V2-A13** | A | Deposit as an eligibility gate + *rejected bids never extend* | V2-A10 | **O17, O18** | — |
| **V2-A14** | A | **Image-processing provider spike** — timeboxed, produces options, ships no product code | V2-00 | — | — |
| **V2-A15** | A | **Original and derived image storage** — the original is never overwritten | V2-A2, V2-C7 | **O20, O21** | — |
| **V2-A16** | A | **The enhancement pipeline** + «رجّع الأصلية» server side | V2-A14, V2-A15 | **O24** | — |
| **V2-A17** | A | **Deterministic filters**: brand, minimum year, price band, ending ≤ 24 h | V2-A1, V2-C8 | — | — |
| **V2-A18** | A | **Provider capability contract test** — vision + structured output | V2-A6 | — | — |
| **V2-A19** | A | **Pause / resume** — atomic, host-only, `end_time` forward by the paused duration | V2-A10, V2-A11 | **O31, O32, O33** | **R3** |
| **V2-A20** | A | **Qualify the production provider** — run V2-A18 against it, record the evidence, and check the record | V2-A18 | **O11** | — |
| **V2-B1** | B | Design tokens: colours, type scale, money rendering | V2-00 | — | — |
| **V2-B2** | B | The auction card — one component, everywhere | V2-B1 | — | — |
| **V2-B3** | B | The top bar | V2-B1 | — | — |
| **V2-B4** | B | Category picker + filter bar | V2-B1, V2-C1 | **O3** | **R1** |
| **V2-B5** | B | The bid button | V2-B1, V2-C3 | **O25, O28, O29** | **R4** |
| **V2-B6** | B | The four-step create wizard | V2-B2, V2-B4, V2-C4 | — | — |
| **V2-B7** | B | Image uploader — drag-reorder, cover, 1–10, limits | V2-B6, V2-C2 | **O22** | **R2** |
| **V2-B8** | B | AI surfaces: suggestion card, editable chips, Q&A box | V2-B6, V2-C5 | **O13** | — |
| **V2-B9** | B | Create-session wizard | V2-B6, V2-C6 | **O8, O16** | — |
| **V2-B10** | B | Session card + the live room | V2-B2, V2-C6 | **O15, O32** | — |
| **V2-B11** | B | Host control room | V2-B10 | **O9, O19, O32, O33** | — |
| **V2-B12** | B | **Enhancement surface**: «حسّن الصور» · «رجّع الأصلية» · «صور معدّلة» | V2-B7, V2-C7 | **O24** | — |

### Unblocked, startable, and how many people can actually work

Three words were doing one word's job. `ready` is defined at the top of this file — *every
id in **depends on** is merged, **and** no id in **blocked on** is still open* — and the
list that used to sit here checked only the second half of that sentence while being
labelled with the first.

| term | means | property of |
|---|---|---|
| **unblocked** | no open owner question anywhere in its dependency chain | the question graph |
| **cleared** | no unratified contradiction of `PRD.md` anywhere in that chain | the ratification gate |
| **startable** (= `ready`) | unblocked **and** cleared **and** every dependency already merged | a moment in time |
| **wave** | how many merges deep it sits behind `V2-00` | the schedule |

**Four tickets are unblocked: V2-A14, V2-B1, V2-B2, V2-B3.** That is the honest answer to
*"what has no open question in it."*

**All four are also cleared**, so *unblocked* and *cleared* pick out the same set today and
the distinction costs nothing to ignore. It stops being free the moment `O1` and `O2` are
answered — the section after next is that measurement.

**Two of them can be started: V2-A14, V2-B1.** `V2-B2` and `V2-B3` both depend on `V2-B1`,
which is not merged, so they are unblocked and **not yet startable**.

| wave | tickets | starts when |
|---|---|---|
| **1** | V2-A14, V2-B1 | `V2-00` merges |
| **2** | V2-B2, V2-B3 | `V2-B1` merges |

**The distinction is how many people can claim work at once, which is the only reason anyone
reads this section.** *"Seven tickets startable today"* was read as seven parallel claims.
Under that same board the wave-1 count was **three** — `V2-C3`, `V2-A14`, `V2-B1` — because
`V2-A3` and `V2-B5` sat behind `V2-C3` and `V2-B2`/`V2-B3` behind `V2-B1`. The figure
overstated available parallelism by **2.3×**, and it did so while every number on the board
was arithmetically correct. It was the wrong quantity, not a wrong sum.

Both tables above are asserted by [`tests/v2/graph.check.mjs`](../../tests/v2/graph.check.mjs).

> **It said seven until 2026-08-15, and the three it lost are the interesting part.**
> `V2-C3`, `V2-A3` and `V2-B5` — the bid-button contract, the `bid_increment` column and
> the button itself — were all listed as startable while every one of them was waiting on
> [D-01 §5](../decisions/D-01-bid-increment-button.md), whose heading is *"do NOT pick an
> answer for any of these."* Those six questions were written down. They had no ids. A
> *blocked on* cell can only name an id, so all three cells read `—`, and `—` is
> indistinguishable from ready.
>
> **This is the board's own failure mode, caught on the board.** Not a stale document and
> not an oversight in a cell — the numbering scheme had a hole in it, and the hole was
> shaped exactly like good news. The six are now `O25`–`O30` (`SPEC.md` §4.3), and D-01 §5a
> records the measurement.

### The second gate — `ready` has two halves and the board could only write one

[`docs/decisions/README.md`](../decisions/README.md) carries an **`R` register**: per decision
record, what `PRD.md` still says instead. **Four of the six conflict with the ratified document
today** — categories (`R1`), 1–10 images (`R2`), pause moving `end_time` (`R3`), and the
seller-set increment (`R4`, itself conditional on `O25`). That register's precedence table is
not ambiguous about what a conflict means:

> **says the opposite** → superseding a ratified requirement → **The owner ratifies, or nothing
> is safe.**

**An `R` is not an `O`, and the two registers must not be merged** — `README.md` says so in
bold and it is right. An `O` is a question **nobody has answered**, and the ticket must not
answer it. An `R` is a question the owner **has** answered, where the ratified document does
not say so yet. Opposite shapes, opposite remedies.

So the ids existed, four of them said *not safe to build*, and **there was nowhere on this
board to cite them.** That is the D-01 failure reproduced one register over, in the same week
this board wrote D-01's up. There the questions had no ids; here the ids had no column. Both
render identically — a cell that says nothing, and nothing is indistinguishable from ready.

The **`ratification`** column is that citation. It names the `R` items a ticket's **own
deliverable** would put in front of users ahead of the PRD — not what it inherits, which the
dependency closure already propagates for free. **Ten tickets carry one directly:** `V2-C1`,
`V2-A1`, `V2-B4` (`R1`); `V2-C2`, `V2-A2`, `V2-B7` (`R2`); `V2-A19` (`R3`); `V2-C3`, `V2-A3`,
`V2-B5` (`R4`).

**No number this board stated was wrong.** Two were true only under a precondition nobody had
written down, and both are further down this page:

| the board says | still exactly right | what it was silently assuming |
|---|---|---|
| answering `O1`+`O2` moves the unblocked set **4 → 9** | yes — *unblocked* is the question graph | that `R1` is ratified |
| adding `O20` moves it **9 → 10** | yes | that `R1` **and** `R2` are ratified |

That is the whole defect, and it is worth being precise about how small it looks: nobody
miscounted, nothing drifted, and no cell was stale. A true sentence was simply load-bearing
for a claim it did not make.

**Today zero unblocked tickets are held by ratification alone.** Answer `O1` and `O2` and that
becomes **five** — `V2-C1`, `V2-C5`, `V2-C8`, `V2-A1`, `V2-A17` — every one of them unblocked,
**none of them ready**, all four waiting on one signature. Before this column, all five would
have read as startable.

| item | record | the PRD today | reach |
|---|---|---|---|
| **R1** | D-02 — categories | out of scope; `FR-CREATE-03` forbids optional fields | **28 of 40** |
| **R2** | D-06 — 1 to 10 images | `FR-CREATE-15`: exactly one image | **21 of 40** |
| **R4** | D-01 — the seller-set increment | `FR-CREATE-03`, **if** `O25` says the field is optional | **19 of 40** |
| **R3** | D-03 — pause moves `end_time` | `BR-16`: anti-sniping is *the single exception* | **1 of 40** |

**`R5` and `R6` carry no ticket at all**, and that is the register working rather than
failing. `PRD.md` is silent about the AI surface (D-04) and about the deposit (D-05) — silence
is gap-filling, `README.md` rule 4 makes gap-filling safe to build, and a ratification gate on
either would be a gate nobody asked for. **The absence of a cell is a claim here too**, so it
is asserted: the records that gate no ticket must be exactly the records that contradict
nothing.

**36 of the 40 tickets sit downstream of at least one unratified decision.** The four that do
not are `V2-A14`, `V2-B1`, `V2-B2`, `V2-B3` — **the same four that are unblocked.** That is not
a coincidence: every other ticket on this board reaches a user through the category contract,
the image contract or the bid contract.

`R3` is the one to read twice, because its reach of **1** is the same shape as `O31`'s. It is
the lowest number in the table and it is the only row that is **already live on `main`** —
`CLAUDE.md` §5 carries the pause amendment today and `PRD.md:784` still says anti-sniping is
the single exception. Low reach is not low stakes; it never was.

Every figure in this section is recomputed from the board by
[`tests/v2/graph.check.mjs`](../../tests/v2/graph.check.mjs), which also asserts that no `R`
appears in a *blocked on* cell, that no `O` appears in a *ratification* cell, and that every
conflicting record is carried by at least one ticket.

> **Eight things here are the owner's to answer, and this board must not answer any of them.**
>
> **Read `PRD.md` §21 before any of them.** It is the **Product Decision Register**, it opens
> with *"There are ZERO unresolved product questions"*, and `PRD.md:2025` says: **"No decision
> here may be reopened, reinterpreted, defaulted, or worked around during implementation."*
> `PRD.md:2067` says how one *is* reopened — *"The resolution is recorded here first, then
> built."* **Here** means `PRD.md`. A `docs/decisions/D-0x` record is not the place §21 points
> at, which is exactly why this column exists and why the owner ratifies by hand.
>
> **No document on this board cites a single line of §21.** Not `SPEC.md`, not this file, not
> any of the six decision records — checked mechanically, zero matches anywhere in §21's line
> range. That is the outward-read defect again, on the most authoritative section in the
> product document, and it is why item 8 below went unnoticed through three prior sweeps.
>
> **1. `PRD.md:411` puts *search* out of scope and no `R` item covers it.** `R1` quotes that
> line for categories — but the sentence reads *"categories, search, **and recommendations**"*,
> and `V2-C8`, `V2-A17` and `V2-A8` build search. They carry no `R` of their own; they inherit
> `R1` through `V2-C1`, which is a weaker and different claim. Either ratifying D-02 covers
> search, or search needs its own record and its own `R`. **Opening a seventh row here would
> be inventing a product decision** (`TEAM.md` rule 16, `CLAUDE.md` §8), so it is not opened.
>
> `:411` is not the only line, and the other two are more specific than it is. `PRD.md:1875`
> — §19.5 — excludes **Advanced search / faceted filtering**, with the reason *"Basic sorting
> and filtering is Should Have (S6); anything beyond is Future"*, and `PRD.md:2134` files
> **Search and faceted filtering** as **Phase 5**. `V2-A17`'s own title is *brand, minimum
> year, price band, ending ≤ 24 h* — four facets. Whether that is still "basic" is the
> owner's call and nobody else's; what the board can say is that the row naming the feature
> was not on the table when the reach of `R1` was decided.
>
> *(That id is deliberately not spelled out above. Two independent checks in
> `graph.check.mjs` — "every cited `R` exists" and the pin rule — both went red on the draft
> that did spell it, and they were right to: a citation of an id that does not exist is
> indistinguishable from a renumber nobody finished. The same thing happened one file over,
> where a `run.sh` comment demonstrating a backslash-tab flagged its own file.)*
>
> **2. Does `R3` reach past `V2-A19`? The reason this board said no has turned out to be
> false.** The original argument was that `V2-A11` (open/close a lot) and `V2-A12` (host
> powers) are host operations *the PRD does not describe*, and that **silence** is `R5`/`R6`-
> shaped — gap-filling, safe to build under rule 4 — rather than `R3`-shaped. On that reading
> `R3` sits on `V2-A19` alone, and putting it on the two host-operation cells instead would
> move **`R3`'s reach goes 1 → 3** (`V2-A11`, `V2-A12`).
>
> **The PRD is not silent.** `PRD.md` §19.2 — *Advanced auction mechanics*, the same excluded
> table whose anti-sniping row `BR-36` had to un-mark — carries two rows nothing on this board
> had read:
>
> | | `PRD.md` | says |
> |---|---|---|
> | scheduled starts | `:1846` | **Scheduled future start times** — *"Adds a third lifecycle state with no MVP demand"* |
> | lots | `:1847` | **Multiple quantity / lots** — *"A fundamentally different auction model"* |
> | …and its assumption | `:1949` | **A-A5** — *"Auctions become live immediately on creation; **nobody needs to schedule a future start**"* |
> | …and its assumption | `:1945` | **A-A1** — *"An auction sells exactly **one item, in one quantity**"* |
> | …and its register entry | `:2035` | **Q5** — *"**5 minutes to 7 days**, inclusive, **measured from creation using server time**"* |
>
> **`:2035` is the §21 row underneath this item, and it bites differently from the exclusions
> above it.** Q5 does not merely bound a duration — it fixes the instant the clock starts, *at
> creation*. A session scheduled for next Tuesday creates its lots now, so either "creation"
> comes to mean something `PRD.md` does not define, or a five-minute lot has a from-creation
> duration of a week and Q5's upper bound is crossed by scheduling alone. That is a **measured
> bound changing**, not a row being un-marked, and it is the shape item 8 names as the fourth
> act of the `BR-36` precedent.
>
> The two assumption rows were added by the §20 sweep and they matter differently from the
> two exclusions above them. An exclusion says *we chose not to build this*; an assumption
> says *we believe nobody wants it*. A-A5 is the belief `:1846` rests on, stated as a claim
> about users rather than about scope — so ratifying D-03 has to retire the belief as well as
> un-mark the row, the way `A-U9` and `A-B6` were retired in place when their decisions moved.
> A-A1 is the weaker of the two: a session holds many lots but each lot is still one item in
> one quantity, so it may survive intact. That is a reading, and it is the owner's.
>
> D-03 §1 gives a session a **start date and time** and D-03 §Step 2 is titled *the lots, in
> order*. Those are not gaps being filled; they are two named exclusions being crossed, which
> is `R3`'s own shape. Carried the way the pause contradiction is — on the tickets whose own
> deliverable is the session and the lot — **`R3`'s reach goes 1 → 9** (`V2-C6`, `V2-A10`,
> `V2-A11`, `V2-A12`, `V2-B9`, `V2-B10`). Those six carriers plus `V2-A19`, which carries it
> already, are seven; `V2-A13` and `V2-B11` make nine by depending on `V2-A10` and `V2-B10`.
> Measured on an in-memory copy of this board, which was then discarded; nothing was written.
>
> That would make `R3` the **third-largest** gate here rather than the smallest. **This board
> has not made that change**, because *which* tickets carry it is a scope judgement and
> ratifying D-03 may well be intended to cover the whole session surface at once.
> **Two wider readings are measured above** — each against a throwaway copy of this board,
> each re-measured on every run — so the choice can be made against evidence, not impression.
>
> **3. Does §19.2's increment row bind D-01's button?** `R4`'s cell cites `FR-BID-09` and
> `FR-CREATE-03`, and D-01 §2 answers `FR-BID-09` with a clean distinction: *"BR-32 governs
> what the SERVER ACCEPTS. D-01 governs what the SCREEN OFFERS."* That reading is consistent
> with `BR-32` itself (`PRD.md:800`), which forbids a step being **imposed**.
>
> It is much harder to square with `PRD.md:1848`, which no record cites: **Bid increments of
> any kind, per-auction or platform-wide** — *"Decided against **entirely** (BR-32)"* — or with
> `PRD.md:403`, which withdrew `S4` saying *"**No increment exists in Dalal, now or as a Should
> Have.**"* A seller-set increment is per-auction by construction.
>
> **And §21 names the button's exact shape.** `PRD.md:2034` is **Q4** in the decision register:
> *"**No fixed increment.** Any amount meeting the minimum acceptable bid is valid — `+0.01 SAR`
> is as valid as `+1,000 SAR`. **Never `+5 / +10 / +50`.**"* The owner's instruction for D-01 is
> a button carrying the seller's increment **in multiples of ten**. `+10 / +50` is the example
> Q4 chose to forbid by name. `PRD.md:2055` adds the accepted consequence — penny bid wars are
> possible, and *"**Implementers must not add one** (SD-05)"*.
>
> This does **not** decide item 3, because D-01 §2's distinction may still hold: Q4 answers the
> question *"is there a minimum bid increment?"*, and a button that offers `+10` while the
> server accepts `+0.01` imposes no minimum. But `:2034` is a decision-register entry, and
> `:2025` says a register entry may not be *reinterpreted* during implementation. Whether
> D-01 §2 is a distinction or a reinterpretation is the owner's call and nobody else's.
>
> The consequence is not rhetorical: `R4` is classified **conditional**, contingent on `O25`
> deciding whether the field is required or optional. `:1848` excludes per-auction increments
> **either way**, so if it binds, `R4` is a **direct** conflict and the split one document over
> becomes four direct and none conditional. Only the owner can say which reading governs.
>
> **4. §19.9 excludes image *editing*, and `R2` cites the row above it.** `R2`'s cell quotes
> `PRD.md:1915` — **Multiple images per auction** — and that is the row D-06 reverses. Two
> rows down, `PRD.md:1917` excludes **Image editing / cropping**, with the reason *"Users can
> prepare images themselves"*. D-04 feature 2 is *«يصلّح الصور» — background, lighting, **crop**,
> reflection*, and five tickets build it: `V2-C7`, `V2-A14`, `V2-A15`, `V2-A16`, `V2-B12`.
> **None of them carries any `R`.** `SPEC.md:203` records the scope call — *"Is image editing
> in scope now that it is known not to be an LLM? **DECIDED — in scope**"* — and it does not
> cite `:1917`, so the row was not in front of whoever answered.
>
> This one has a second edge the others do not: `:1917` has **no §22 row at all.** Multiple
> images has one (`PRD.md:2104`, Phase 2); editing is excluded and not even filed as a future
> enhancement. Whether that makes it a firmer exclusion or merely an unlisted one is a
> reading, and it is the owner's.
>
> **And §20 states it more plainly than §19 does.** `PRD.md:1978` — **A-I4** — reads *"Users
> will resize or compress large images themselves if rejected; **no in-product editing is
> needed**"*. That is not a scope boundary being drawn, it is a belief about what users want,
> and it is the belief `:1917` rests on. `PRD.md:1975` — **A-I1**, *"One image per auction is
> sufficient"* — is the same for `:1915`, and D-06 already reverses that one. Both have to be
> retired for the image work to be consistent with the document it is built against.
>
> **5. Two lines say the target user is not a professional seller, and phase 4 builds a
> seller console.** `PRD.md:1886` — §19.6 — excludes **Bulk listing / seller tools**, with
> the reason *"Professional sellers are not a target user (§4.2)"*, and `PRD.md:1930`
> records assumption **A-U1**: *"Users are individuals, not businesses"*. D-03 gives a host a
> room of lots, an ordered queue, advance/end powers and a control room — `V2-A10`, `V2-A11`,
> `V2-A12`, `V2-B9`, `V2-B10`, `V2-B11`. That is a seller tool by any reading, and the owner
> has separately said the hosts are **individuals *and* companies**, which is the exact
> proposition A-U1 denies. `R3` sits on `V2-A19` alone; none of the six carries anything for
> either line. This is item 2's question again with a different pair of citations, and it may
> well have the same answer — but A-U1 is an *assumption* row rather than an exclusion, so
> ratifying it is a different act, and the board should not assume one covers the other.
>
> One neighbouring row was checked and **does not** appear to break: `PRD.md:1936` — **A-U7**,
> *"the same person may be both a seller and a bidder; no separate account types are needed"*.
> Nothing in D-03 creates an account type; a host is a role held over a session, not a kind of
> user. It is named here because a company hosting a room is the case that would break it, and
> a later session should not have to rediscover that the question was asked.
>
> **6. The deposit is classified as gap-filling because the PRD never says "deposit".**
> `R6`'s cell reads *"**silent.** Zero occurrences of 'deposit'"*, and that is true of the
> word. It is not true of the thing: `PRD.md:1806` excludes **Wallets or stored balances**
> from a table headed *"Explicitly excluded, without exception"*, `PRD.md:1825` excludes
> **Escrow / settlement**, and `PRD.md:1813` states **SC-67** — *"no screen anywhere in the
> product offers or **implies** any of the above"*. `V2-A13` and `V2-B10` put a
> بدون · 25 · 50 · 100 · 500 chooser in front of a bidder to enter a hall.
>
> D-05 §2 anticipates exactly this and answers it — *"العربون **محاكاة**… ما فيه بوابة دفع،
> ولا حقل بطاقة، ولا مبلغ ينتقل فعليًا"* — and that answer is why the board did **not**
> reclassify `R6` here. But "no money moves" answers §19.1; the word SC-67 uses is *implies*,
> and a priced entry gate is the case that word exists for. **Rule 4 makes silence safe to
> build. This is not silence**, so the classification rests on a reading of SC-67 that only
> the owner can confirm. If it is a conflict, `R6` stops gating nothing and the split becomes
> five conflicting records rather than four.
>
> **7. `R5` calls the AI surface gap-filling, and `PRD.md:1952` is not a gap.** `R5`'s cell
> reads *"**silent.** Zero occurrences of 'AI', 'assistant' or 'machine learning'"*. That is
> true, and it is the same search that produced item 6's error one row down: the PRD is silent
> about the **technology** and not about the **function**.
>
> **A-A8** — *"**Sellers will write their own descriptions and provide their own images**; no
> templates needed"* — is an explicit belief about who authors a listing. D-04 feature 1
> («يكتب الإعلان») reads the images and proposes the title, the description and the category;
> `V2-A7` and `V2-B8` build it. A machine drafting the description is the proposition A-A8
> denies, and *"no templates needed"* is the closest the MVP came to anticipating it.
>
> This does not make the feature wrong — the owner decided all five, twice, and D-04 §1 records
> it. It makes **rule 4 the wrong justification**. `R5` gates nothing today on the grounds that
> silence is safe to build; if A-A8 binds, `R5` gates `V2-A7` and `V2-B8` at least, and the
> split becomes **six** conflicting records rather than four. Item 6 raises the identical
> question for `R6`. **Both were classified by keyword search, and the keyword was the wrong
> unit of meaning** — that is one defect with two instances, not two defects.
>
> **8. A host can end a published lot early, and five lines say nobody can.** This is the
> largest item here and the only one where the tickets that build the power carry **no `R` at
> all**:
>
> | | `PRD.md` | says |
> |---|---|---|
> | the rule | `:798` | **BR-30** — *"An auction **cannot be cancelled**. Once published it **runs to its end time** and closes automatically."* |
> | the lifecycle | `:1218` | *"This is the **complete and only** lifecycle. There are **no branches, no cancellation, and no manual intervention** anywhere in it"* |
> | …and again | `:1223` | *"The transition to Ended is **automatic**, driven by the end time, requiring **no administrator and no human action**"* |
> | the register | `:2031` | **Q1** — *"**No cancellation.** No cancel control, no cancellation rule … A published auction runs to its end time and closes."* |
> | the register, again | `:2032` | **Q2** — *"**No reserve price.** The highest valid bid wins regardless of amount. **No hidden threshold, no "reserve not met" outcome.**"* |
>
> **`:2032` is the sharpest of the five, because it forbids the outcome rather than the
> control.** Q1 removes the cancel *button*; Q2 removes the *result* — there is no state in
> which an auction ends without its highest bid winning. A host who advances past a lot sitting
> below what he hoped for produces a "reserve not met" outcome under another name, and does it
> without any threshold being stored anywhere, which is precisely why `:798` calls the seller
> version an **informal** reserve. Removing the control while leaving the outcome reachable is
> the gap this row closes.
>
> D-03 §3.1 grants the opposite, in the owner's words: *«الزر للمضيف اللي يبي **يسرّع**»* — a
> host button that closes a lot before its end time. `V2-A11` (*open / close a lot*) and
> `V2-A12` (*host powers: advance, end session*) build it. **Both carry `—` in the `R` column.**
>
> **The strongest form of this is not that a row is stale — it is that BR-30's own stated
> reason applies to the new power, unchanged.** `:798` gives the reason as: *"A seller able to
> cancel after seeing a low price would hold an **informal reserve**, undermining BR-06 and
> fairness."* A host who advances past a lot sitting at a disappointing price is holding an
> informal reserve by exactly that definition. D-03 §3.1 already reasons carefully about one
> abuse of advance — defeating anti-sniping, which it refuses **server-side** rather than by
> disabling a button — and does not mention BR-30 or the reserve at all.
>
> **The board has this question one level too high.** `O10` asks *"Can a session be
> cancelled?"* and is open. The **lot** advance is not asked about anywhere; it is treated as
> decided in D-03 §3.1 and it is the thing `:1223` forbids by name.
>
> **Pause is the same question about the same clock.** `:2033` — **Q3** — lists what is
> immutable after publication: *"Name, description, starting price, **end time**, and image."*
> Anti-sniping moves `end_time` too, but `BR-36` was reversed by a recorded owner decision and
> Q7's register row was amended to say so; Q3's was not. A **host** moving the end time by
> pausing is nearer to *"a seller edits the end time"* than an automatic extension is. `V2-A19`
> carries `R3`, so unlike the advance this one has a record — but `R3` does not cite Q3.
>
> *(Why all eight surfaced this late: the `R` register was built by reading the six decision
> records and following their citations outward. The PRD's exclusions chapter is reached only
> when a record happens to cite into it, and §19.2 is a table **no record cites**, so nothing
> led to it. Items 4, 5 and 6 came from running that read in the other direction — every
> §19 and §22 row, asked which ticket builds it — which is why they are adjacent to rows the
> register already had. Item 7, and the assumption rows now attached to items 2, 4 and 5, came
> from doing the same to §20 — reached only because A-U1 turned up in item 5 and proved that an
> *assumption* row can bind as hard as an exclusion. Item 8 came from §21, which is the last
> section read and should have been the first: it is the register the other three sections are
> summarised into, **no document cites it**, and it took three sweeps to reach because each
> sweep chose its next surface by adjacency to the last finding rather than by authority. The
> one guard that overlaps — INT-08's `no bid increment / minimum raise` — covers item 3 and will
> go red the day a `bid_increment` column lands, as `CLAUDE.md` §9 already predicts. **Nothing
> watches the other seven** except the citation resolver added alongside them, which only proves
> the lines still say what is quoted here.)*
>
> *(Item 8 is the one item on this list that is not about a **scope** boundary. Items 1–7 ask
> whether V2 may build something the MVP put out of scope — an ordinary question for a second
> version, and the honest answer to most of them is probably "yes, ratify it". Item 8 asks
> whether a host may hold an informal reserve, which `BR-06` and `:798` call a **fairness**
> rule. Fairness rules are the ones `CLAUDE.md` §5 says were deliberately removed and whose
> **absence is the requirement**. It should be read on its own terms, not as the eighth
> instance of the same pattern.)*
>
> *(Items 6 and 7 are the same defect twice. `R5` and `R6` were both classified **silent,
> therefore gap-filling, therefore safe under rule 4**, and both classifications were reached
> by searching `PRD.md` for a word — "deposit", "AI". The PRD does not organise itself by the
> vocabulary a later decision happens to use. Any record classified `no` because a term does
> not appear is worth re-reading against what the feature **does**.)*
>
> **The precedent for what ratifying any of these looks like is already on the record.** When
> `BR-36` reversed anti-sniping, `docs/decisions/README.md:145` notes that **§19.2 and §22.1
> were both un-marked** — the exclusion row *and* the future-enhancement row, in the same
> change. Every item above names its §19 row, its §22 row where one exists, and — since the
> §20 sweep — the **assumption** row underneath it. `A-U9` and `A-B6` show the third of those
> being retired in place when a decision moved, so the precedent covers all three.
>
> **§21 adds a fourth, and `BR-36` demonstrates it too.** Q7's register row at `PRD.md:2037`
> was rewritten in place — *"REOPENED AND REVERSED 2026-08-13"* — and `:2056` records the new
> accepted consequence, that an auction can now run ten minutes past its stated end. So the
> full act, performed once already on this exact document, is: **un-mark the §19 row, un-mark
> the §22 row, retire the §20 assumption, amend the §21 register entry, and write the accepted
> consequence in §21.2.** Q7 also shows the register does not update itself — item 8 exists
> partly because Q3 was left saying `end_time` is immutable while Q7 was amended to move it.

### `ARCHITECTURE.md` and this board do not cite each other — six crossings, none of them the owner's

**These are deliberately not a ninth blockquote item, and the reason is in the documents
themselves.** `PRD.md:2025` forbids a decision being *"reopened, reinterpreted, defaulted, or
worked around during implementation"*, so a PRD crossing can only be closed by the owner. Every
`ADR` in `ARCHITECTURE.md` §20 instead **carries its own reversal condition in writing** — the
document authorises its own amendment and says what triggers one. That makes the list below a
**steward** matter (`CLAUDE.md` §1: stewards advise, they do not gate), and mixing it into the
owner's eight would make his page longer without making any of it his.

`CLAUDE.md` §2 ranks `ARCHITECTURE.md` **second, above this file**. This board cites it **zero
times** — not `SPEC.md`, not `TICKETS.md`, not `docs/ai/local-model.md`, counted mechanically.
Two of the six decision records mention it once each and **both mentions are prospective**:
`D-01`'s completion checklist has an unticked box reading *"an `ADR` in `ARCHITECTURE.md` §20
recording that the increment is presentation"*, and `D-03`'s `O4` calls the lot-versus-auction
choice *"an `ARCHITECTURE.md` decision with a large blast radius"*. Neither cites a line that
exists today.

The other direction is worse and is the reason this section exists: **`ARCHITECTURE.md`
contains no V2 vocabulary at all** — no session, no host, no lot, no pause, no deposit, no
model — and **no ticket on this board changes it**, including the one `D-01` says is required.

| # | The line | What crosses it | Whose call |
|---|---|---|---|
| **1** | `ARCHITECTURE.md:1384` — ADR-3's reversal condition | the hosted AI provider | architecture steward |
| **2** | `ARCHITECTURE.md:328` — "server-side" means inside PostgreSQL | `app/api/ai/*` on Vercel | architecture steward |
| **3** | `ARCHITECTURE.md:1218` — the application holds no elevated credential | `AI_API_KEY` | architecture steward |
| **4** | `ARCHITECTURE.md:958` — realtime is scoped per auction | the session room | Rayan (realtime) |
| **5** | `ARCHITECTURE.md:681`, `:685` — the owner has **no** update rights | host powers, pause | Rayan (bidding/closing) |
| **6** | `20260812120000_bid02_bid_acceptance.sql:500` — `end_time` required at insert | a lot has none until it opens | Rayan (bidding/closing) |

> **1. ADR-3's reversal condition has already fired, and nobody re-ran the decision.**
> `ARCHITECTURE.md:1384` names the trigger in its own words — *"an outbound integration appears
> — payments, an external API, a webhook receiver"* — and then says **"None exists in the
> MVP"**. `ARCHITECTURE.md:469` says the same thing at length, listing *"or a third-party
> API"*. `V2-A6`, `V2-A18` and `V2-A20` build exactly that, and it is not a plan — it is a
> recorded owner decision of **2026-08-15**, quoted at `docs/ai/local-model.md` §4:
> *"Production uses a hosted OpenAI-compatible provider, selected through a capability check."*
> `V2-A14` adds a second third party for image processing.
>
> The finding is **not** "ADR-3 is wrong". It is that ADR-3 asks a question — *where does an
> outbound call live?* — and V2 answered it in a document ADR-3 has never heard of, choosing a
> **third** option ADR-3 never weighed. ADR-3 considered database versus Edge Function;
> `docs/ai/local-model.md` §5 puts the call in a Next.js **Route Handler** on Vercel. That may
> well be the right answer. It has not been written down as one.

> **2. §6.5 defines "server-side" as the place V2 does not put its server code.**
> `ARCHITECTURE.md:328`: *"'Server-side' in Dalal means **inside PostgreSQL**, not inside a
> Vercel function. This is a deliberate decision (ADR-3, §20)."* Every row of §6.5's table
> resolves to the database. `lib/ai/` plus `app/api/ai/*` is the first server-side code in this
> product that is not in the database, and §7.1's trust-tier table has **no row for it** — so
> the tier of *"the model suggested this"* is unclassified. That is not cosmetic:
> `docs/ai/local-model.md` §6 rule 3 says **no amount is ever produced by, passed to, or
> validated by the model**, and "which tier is that enforced in" is precisely the question
> §7.2 exists to answer.

> **3. §17.3's security property survives; its sentence does not.**
> `ARCHITECTURE.md:1218`: *"**If the design holds, the application never holds an elevated
> credential.** … **the appearance of a service-level key in application configuration is a
> signal that something has drifted from this architecture** and should trigger a review, not a
> shrug."* V2 puts `AI_API_KEY` in Vercel's environment configuration.
>
> **Read carefully, because the two halves come apart.** `AI_API_KEY` is not a Supabase service
> key: it grants nothing against Dalal's data, bypasses no policy in §11, and the property
> §17.3 was written to protect — that a leak cannot become a data breach — is untouched. What
> it *is* is a billable third-party credential, which §17.3's absolute phrasing does not
> anticipate. Distinguishing "elevated against our data" from "a secret we hold" is a one-line
> amendment to §17.3 and it should be made deliberately rather than by the sentence quietly
> becoming untrue. **This section is the review §17.3 asks for.** Which provider, and therefore
> whose bill, is already `O11` and is not re-raised here.

> **4. There is no subscription scope for a room.**
> `ARCHITECTURE.md:958` scopes realtime **per auction**, and the next line says *"Not global — a
> viewer receives only the auction they are watching"*. §14.2's whole cost argument rests on it:
> a bid fans out to one auction's viewers, which is what keeps NFR-SCA-03 cheap. `V2-B9`,
> `V2-B10` and `V2-B11` need a viewer to see a **session** — the attendance count («38 حاضر»),
> which lot is open, the host advancing. That is a channel §14.2 does not have, and its fan-out
> is a session's whole audience rather than one lot's. `O9` asks whether attendance leaks
> identity; nothing on this board asks what carries it or what it costs.

> **5. The architecture says the permission a host needs does not exist — and it says so where
> item 8 is strongest.** `ARCHITECTURE.md:681` gives the owner of an auction `✗` on update
> (*"immutable (BR-31)"*) and `✗` on delete (*"no cancellation (BR-30)"*), and
> `ARCHITECTURE.md:685` explains
> why: *"The owner having **no** update rights is the structural expression of Q1 and Q3's
> resolution. There is no edit path to secure because there is no edit path."*
>
> **That sentence names Q1 and Q3 — the same register entries item 8 rests on.** Item 8 argues
> from five `PRD.md` lines; this is the sixth line and the only one that says how the rule is
> *enforced*. `V2-A12` (host powers) and `V2-A19` (pause) both need a write path §11.2 says was
> deliberately not built. The §11.4 elevated-privilege route is the obvious shape — it is how
> `place_bid` already moves `end_time` — but `V2-A10`'s change surface does not mention a policy
> change, and "there is no edit path" is a sentence someone will read while reviewing the ticket
> that builds one.

> **6. A lot cannot be inserted under the policy that is on `main` today. This one is code, not
> prose.** `supabase/migrations/20260812120000_bid02_bid_acceptance.sql:500` — inside the
> `auctions_owner_insert` `WITH CHECK` — requires `end_time >= now() + interval '5 minutes'` at
> **insert** time, with `:501` capping it at seven days. `V2-A11` says the opposite in one
> sentence: *"`end_time` is **computed when the lot opens**, not at creation."* If `O4` is
> answered "a lot is an `auctions` row with a nullable `session_id`" — which is what `D-03` says
> the owner's «كل قطعة مزاد كامل» *suggests* — then a lot created before its session opens has no
> `end_time` the policy will accept, and the insert is refused with `42501`.
>
> **`O23` is not this question.** `O23` asks whether `BR-38`'s five-minute-to-seven-day bound
> applies to a *lot's duration*. This is an *insert-time* problem and it survives **either**
> answer, because the bound is evaluated against `now()` when the row is written, not when the
> lot runs. The same `WITH CHECK` also demands `status = 'active'` and
> `current_price = starting_price`, so a not-yet-open lot would be born `active` with `LC-03`
> having no `end_time` to compare the clock against.
>
> The comment above the policy, at `:485`, states the other half in the same breath: *"There is
> NO update and NO delete policy on auctions for any user"*. Crossings 5 and 6 are one code
> block.

**Three things were checked and are recorded as not crossing, so nobody re-runs them:**

- **`ARCHITECTURE.md:310`** — *"A separate admin service | No Admin role exists (PRD §4.3)"*.
  The §19/§22 sweep reached this judgement from `PRD.md` §4.3 and flagged it as the one place a
  sweep decided a row did *not* apply. Re-tested here from the second source of truth, it
  **holds**: a host controlling their own session is a seller power over their own property,
  which is what §6.3 means by "no admin", and no V2 ticket gives anyone authority over another
  user's auction.
- **`ARCHITECTURE.md:1372`** — ADR-1's reversal condition, *"a requirement appears that needs a
  long-running process or in-memory state"*. **Not fired.** Pause is an atomic database
  operation, a lot advance is host-invoked, and closing already runs on `pg_cron` under ADR-4.
  Nothing in phase 4 needs a daemon. This is worth recording precisely because a live host-run
  session *sounds* like it does.
- **§4.4 and §24's native-mobile and public-API rows** — read, nothing in V2 approaches them.

**And one existing item gets a second and third witness rather than a new number.** The deposit
(`V2-A13`) is excluded by `ARCHITECTURE.md:169` (*"No payment integration, no PCI scope"*),
`ARCHITECTURE.md:174` (*"any payment, contact, or fulfillment capability"*) and
`ARCHITECTURE.md:1532` (*"Payment, messaging,
notification, admin, or fulfillment infrastructure"*) — all three sourced back to `PRD.md`
§19.0, which is where item 6 above already argues from. Item 6 does not become stronger by
being repeated; it becomes harder to dismiss as one stale table row, which is a different
thing and worth one sentence.

> **One stale figure, left for whoever amends this document.** `ARCHITECTURE.md:1552` says
> `PRD.md` §21.1 *"closes all fifteen"*. §21.1 holds **sixteen** — Q1 through Q16, no gap — and
> `CLAUDE.md` §3 cites Q16 by name. The same sentence's *"There are zero unresolved product
> questions"* was true of V1 and is not of V2, where the `O` register stands at 34. **It is not
> fixed here on purpose:** the six crossings above will touch §6.5, §8.5, §11.2, §14.2, §17.3
> and §20, and this document should be amended once by the steward rather than twice, the
> second time for a word.

A previous draft of this board claimed phase 1 had *"no cross-track dependency at all"* and
that nine tickets could run in parallel. **Both were wrong**: `V2-B4` needs the category
contract and `V2-B5` needs the bid contract, and `V2-C1` is itself blocked on `O1`/`O2`.

**`V2-C4` now depends on `V2-C3`**, which it did not before, and that gap was the same kind
of thing. D-01 §1 puts the increment on the **create** form — the seller sets it when
creating the auction — so the create-auction payload contract cannot be complete without it.
The asymmetry was visible: `V2-A5`, the create-auction *server action*, already depended on
`V2-A3`, the column. The implementation side knew the increment was part of creation and the
contract side did not. Adding the edge changes no ticket's startability — `V2-C4` was already
blocked through `V2-C1` — but it changes what unblocking `O1`, `O2` and `O20` actually buys,
and that number is below.

**And that is the finding worth reading twice.** `O1` (*is a category required?*) and `O2`
(*is a sub-category stored?*) look like schema trivia. They gate `V2-C1`, which gates
`V2-A1` and `V2-C4` and `V2-C5` and `V2-C8` — which is **the entire create flow, the entire
assistant, and all of phase 4**. Two sentences from the owner sit upstream of **28 of the 40
tickets**.

> **But do not read that as "28 tickets become startable."** They do not, and the difference
> is worth stating because it is the mistake this board is designed to prevent. Answering
> `O1` and `O2` moves the unblocked set from **4 to 9** — `V2-C1`, `V2-C5`, `V2-C8`,
> `V2-A1`, `V2-A17` — measured by re-running the same closure with those two removed, not
> estimated. The other **23** carry a *second* blocker further up their chain: `V2-A2`
> still waits on `O20`, everything in phase 4 still waits on `O4`, and the whole bid-button
> chain now waits on `O25`–`O30`.
>
> **That "23" was "eighteen" until 2026-08-15, and eighteen was 27 − 9 — a subtraction of
> the wrong two numbers.** The unblocked set going to 9 does not mean 9 of the reached
> tickets were released; **5** were, and the other 4 (`V2-A14`, `V2-B1`, `V2-B2`, `V2-B3`)
> were never in the reach set to begin with — none of them waits on a category. Reach minus
> *released* is the quantity this sentence is about, and it is now asserted rather than
> subtracted by hand.
>
> **Reach counts what an item sits upstream of. Startability needs every blocker on the
> chain cleared, not the biggest one.** Add `O20` and the set goes 9 → 10 — `V2-C2` alone.
> It used to say 12 → 14, and the second of those two was `V2-C4`, which is now held by the
> bid-button contract as well. The board opens up by *clearing chains*, not by answering the
> highest-reach question first.

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

**Blocked on all six of `O25`–`O30`**, which is every open item in D-01 §5. This contract
cannot publish a shape without knowing whether the increment is nullable (`O25`), what
"multiple of ten" constrains (`O26`), whether it has a maximum (`O27`), how many buttons
there are (`O28`), what a button offers when the price is off-grid (`O29`), and whether the
value can change after publish (`O30`). It is the most-blocked ticket on the board, and it
read `—` until 2026-08-15.

### V2-C4 — the create-auction payload
The four steps collapsed into one atomic create. Names every server-side rule so V2-B6 does
not reimplement them as form attributes: title 3–120, description 20–2000, **duration 5
minutes to 7 days inclusive (`BR-38`)**, valid category, **1–10 images**.

**Depends on V2-C3.** D-01 §1 puts the increment on the create form — *"an increment the
seller sets when creating the auction"* — so the increment is part of this payload and its
shape is V2-C3's to publish. The edge was missing while `V2-A5`, the server action, already
depended on `V2-A3`, the column: the implementation side knew, the contract side did not.

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

1. **A range, not a point.** `percentile_cont` at two bounds — **which two is `O34`, and
   until it is answered this deliverable is a shape without a query.** A single number reads
   as a valuation; a range reads as what it is.
2. **The comparable count, shown.** «مبني على 27 مزادًا مشابهًا» — a suggestion whose sample
   size is invisible is a suggestion the seller cannot weigh.
3. **A stated similarity definition**, in the contract and in the query, not implied by
   whatever the `WHERE` clause happens to say.
4. **A minimum sample threshold**, below which **no suggestion is shown at all** — not a
   wider range, not a caveat. Nothing.

**Blocked on O14** — *what counts as "similar"* (same category? sub-category? city? window?)
and *what the minimum sample is*. Both change the number on the screen, so neither is a
session's to pick.

**Blocked on O34, and this cell said `O14` alone until 2026-08-15.** The sentence that used
to close this section read *"deliverables 1 and 2 are shapes and are safe to build; 3 and 4
need the answer."* Deliverable 2 is a shape. **Deliverable 1 is not**, and calling it one is
how the last unanswered number on this ticket got permission to be guessed: you cannot write
`percentile_cont` without naming the two bounds, and `p25`/`p75` versus `p10`/`p90` are
different suggestions over identical data. That is the same test `O14` passes — *it changes
the number on the screen* — so it gets the same treatment and the same kind of id.

Neither bound is picked here. Both failure modes are real and they point in opposite
directions: a wide band («بين 500 و 90,000») is technically honest and useless, and a narrow
one reads as precisely the valuation D-04 §3.2 chose a range to avoid publishing. Choosing
between those is a product decision (`CLAUDE.md` §8, `TEAM.md` rule 16).

**Deliverable 2 is the only one of the four that is safe to build today.**

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
candidate; this ticket decides whether the candidate is usable. **V2-A20** is the one that
runs it against the candidate and leaves the answer somewhere a reader can find.

### V2-A20 — qualify the production provider, and make "it was qualified" a file
**Blocked on O11.** Nothing here picks a provider, sets a latency threshold, or decides
`AI_ENABLED`'s value. It is the step *after* the owner answers `O11`.

V2-A18 builds a test that is *runnable* against any endpoint and runs in CI against the dev
one. Building a test is not running it. `local-model.md` §4 already states the missing half
as a requirement — «run V2-A18 against each C candidate, and let the test decide which ones
are usable» — and the day this board was written that sentence had no owner, no PR and no
artifact. This ticket gives it all three:

| deliverable | why it is not a comment in a PR body |
|---|---|
| **`docs/ai/provider-qualification.md`** — the recorded run: date, endpoint host, model id, each of V2-A18's five capabilities pass/fail, and the measured latencies | "we checked" is the claim; the numbers are the evidence. `local-model.md` §1.5 already shows the same call taking 6 s and 54 s on one afternoon — a single figure is not a result |
| **The production variable names**, documented: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_ENABLED` | names only. **Values never enter the repository** — `CLAUDE.md` §6, and this repository is public. `AI_API_KEY` is a secret; a base URL with a key in the query string is a secret too |
| **`tests/ai/provider-qualification.check.sh`**, wired into `ci-coverage.sh` | without it the record is a promise again. It asserts the record **exists and is complete** — every capability answered, a model id present, no `TODO` — and it goes red on a stub |

**Say what the check does not do.** It cannot read Vercel's environment, so it cannot prove
production points at the endpoint the record describes. It proves that *a* qualification
record is complete. That is a smaller claim than "production is qualified" and the ticket
must not be written up as the larger one — `CLAUDE.md`'s standing rule is that a passing
static check is not an end-to-end verification.

**The check ships in the same PR as the record, not before it** — same reasoning as D-01 §3.
A check added first is a red build on `main` waiting for an answer nobody has yet; a check
added after is a follow-up, and this ticket exists because of a follow-up that never came.

**A candidate that fails is a result, not a blocked ticket.** If the provider the owner picks
fails a capability, the record says which one, and `O11` goes back to the owner with evidence
attached. Do not work around a failure by relaxing V2-A18.

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

**Blocked on `O31`, `O32` and `O33` — and this cell read `—` until 2026-08-15.** Everything
above is decided and every line of it is about **the lot being paused**. A session is a room
of lots, and three things nobody wrote down are each load-bearing on this ticket's schema:

| | what it decides here |
|---|---|
| **`O31`** — is total paused time bounded; what if the host never resumes? | whether there is a **`CHECK` constraint** at all, and on what column. `CLAUDE.md` §5 makes the extension cap a constraint rather than an `if` because *"without it a contested auction never ends, never finalizes, and never has a winner"* — pause is the other door onto `end_time` and today it has no cap. **Build this ticket without an answer and the invariant is gone by the more reasonable-looking of two routes** |
| **`O32`** — does pausing lot 3 move lots 4…N? | whether resume writes one row or N, and whether a queued lot stores a time at all |
| **`O33`** — a lot, or the session? | the function's signature. `pause_lot(lot_id)` and `pause_session(session_id)` are not the same operation, and D-03 §3.0 and §3.2 quote the owner saying each |

Two of the three are `SECURITY DEFINER` surface (`CLAUDE.md` §6) and one is a bidding
invariant (§5), so this ticket **requests Rayan's steward review** whatever the answers turn
out to be — per `CLAUDE.md` §1, requested and not waited on.

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

**And what that button says.** «أوقف مؤقتًا» is one control, and D-03 quotes the owner
describing pause as a **lot** operation in one sentence and as *«إيقاف الجلسة مؤقتًا»* — a
**session** operation — in another (**`O33`**). Whichever it is, the lot list behind it shows
بالانتظار rows whose timing a pause moves, and whether those rows carry a **time**, an
**order**, or nothing is **`O32`** — which also lands on the public live room (V2-B10), where
the person who came for lot 9 is reading it and cannot be told it changed.

---

## The register this board is waiting on

Thirty-four open items, listed in full with their sources in
[`SPEC.md` §4.3](SPEC.md#43-the-open-register--thirty-four-real-blockers). The two that
unblock the most work are not the ones that look important.

The **reach** column is the count of tickets that cannot start until the item is answered —
computed over the *transitive* closure of the *depends on* column above, not counted by eye
from the *blocked on* cells. A ticket is reached if the item blocks it **or** blocks
anything it waits on. Every figure below is printed by
[`tests/v2/graph.check.mjs`](../../tests/v2/graph.check.mjs).

**This table names eighteen of the thirty-four, and the omissions are a claim, not an
oversight: every item it leaves out reaches six tickets or fewer.** Both halves of that
sentence are asserted, because a table that is allowed to be a selection is a table a row
can quietly fall out of — delete one and the numbers that remain are all still correct.
That is the vacuous pass in a different costume, and `#121` is the reason this file counts
its own rows.

| | | reach |
|---|---|---|
| **O1** | Is a category required on every auction? | **28 of 40** — V2-C1 → A1, C4, C5, C8 → the create flow, the assistant, and phase 4 |
| **O2** | Is a sub-category stored, or presentation only? | **28 of 40** — the same chain |
| **O20** | Where do images live? | **21 of 40** — V2-C2 → A2, A15, B7, B12, and the create wizard behind them |
| **O25**–**O30** | The six bid-button questions in D-01 §5 | **19 of 40 each** — V2-C3 → A3, B5, C4 → A5, A10, and everything downstream of the create payload |
| **O21** | What happens to abandoned uploads? | **10 of 40** |
| **O4** | Is a lot an `auctions` row, or a separate entity? | **9 of 40** — and it is by far the expensive one to *reverse*, which reach does not measure |
| **O23** | Does a lot use the same `BR-38` bound? | **9 of 40** |
| **O24** | Which image-processing provider? | **4 of 40** — and V2-A14 exists to produce the options |
| **O32** | Does pausing lot 3 move lots 4…N? | **3 of 40** — V2-A19, and the two screens that render a paused room |
| **O33** | A lot, or the session? | **2 of 40** — V2-A19 and the host control room; it decides a function signature, not a screen |
| **O31** | Is total paused time bounded? | **1 of 40** — V2-A19. The lowest reach on this board and the one that can remove an invariant |
| **O11** | Which hosted provider? | **1 of 40** — V2-A20. It reached **nothing** until 2026-08-15, and the reason was not that it blocks nothing: the ticket it blocks did not exist |
| **O34** | Which two percentiles bound the range? | **1 of 40** — V2-A4, whose deliverable 1 was described as a safe-to-build *shape* while the query it needs had no bounds |

**The D-01 row is new, and its position in this table is the point.** Those six questions
rank **third**, above `O21` and `O4` — and until 2026-08-15 they appeared in no *blocked on*
cell, in no register, and in no reach table, because they had no ids to appear as. The board
was not wrong about them. The board could not see them.

**Reach is not importance, and the table above is the proof.** `O4` reaches nine tickets
and `O21` reaches ten, yet `O4` is the one that rewrites every existing query, RLS policy
and test if it is answered late — `O21` is a storage-cleanup rule. Sort by reach to decide
*what unblocks the most work today*; sort by blast radius to decide *what costs the most to
get wrong*. They are different questions and this board answers only the first.

Across the whole register, **twenty-two items reach six tickets or fewer** and
**twelve reach exactly one ticket**. The three that reach exactly six are `O3`, `O8` and
`O12`; `O10` reaches five. Every number here is reproducible from the *depends on* /
*blocked on* columns — that is the point of writing the graph down instead of asserting it.

**Reach is not blast radius, and `O31` is this table's sharpest example.** It reaches
**one** ticket and sits at the bottom of every ordering here — and what it decides is
whether an uncapped pause can hold a lot open forever, the same failure the extension cap is
a `CHECK` constraint to prevent (`CLAUDE.md` §5). `O4` carries the same warning higher up.
Sort by reach to plan the week; do not sort by reach to decide what is dangerous.

**`O31`, `O32` and `O33` got rows above for the reason the next paragraph gives.** This
section was written in the same change that added them, and the first draft stated their
reach in this prose and nowhere else — the exact shape the `O11` failure had, reproduced
within an hour of documenting it. A negative probe found it: mutating a reach figure that
lives only in a sentence changes nothing a check can see. They have rows now, so
`graph.check.mjs` asserts all three.

**The `O11` row is what an unchecked sentence looks like when it goes wrong.** This
paragraph used to end *"`O11` reaches none, for the reason given at the top of the board."*
Every figure in the table above it was asserted by `graph.check.mjs`; that sentence was not,
because `O11` had no row to assert. It was the only claim in this section a check could not
see, and it was the false one.
