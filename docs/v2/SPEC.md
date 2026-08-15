# Dalal V2 — the spec

**What this is:** the delta between what is deployed today and what the approved prototype
shows. Not a second PRD (`CLAUDE.md` §2 — product decisions live in `PRD.md`). This
document says *what is being built and in what order*; the decisions it builds on are in
`docs/decisions/D-01` … `D-06`, each of which quotes the owner and names its own gaps.

| | |
|---|---|
| Date | 2026-08-15 |
| Source | `design-system/previews/*.html` — **the prototype is the spec** |
| Feasibility | measured, not assumed — [`docs/ai/local-model.md`](../ai/local-model.md) |
| Tickets | [`TICKETS.md`](TICKETS.md) — **39 tickets plus the unblock step** |
| Governance | `CLAUDE.md` §1 — nobody owns a file; work is **claimed**, per ticket |

---

## 1. The one-paragraph version

V1 is a working single-item auction: create, bid, close, winner, realtime, Arabic RTL,
money that never touches a float. V2 keeps every one of those rules and adds four things —
**a taxonomy** (13 categories), **a real create flow** (images first, one to ten, four
steps), **an assistant** (five approved features, each built on the technology that can
actually deliver it), and **sessions** (a room of lots opened one at a time by a live
host). The bid control becomes a **button** carrying a seller-set amount. The design system
stops being a folder of HTML previews and becomes components.

## 2. What does NOT change — read this first

Everything in `CLAUDE.md` survives V2 unchanged, with **one amendment the owner made
explicitly** and which is written into `CLAUDE.md` §5 itself, not left here: pause/resume
becomes a second permitted caller of a forward `end_time` move. Nothing else moves.

The four rules a V2-sized diff is most likely to break, and where each is anchored:

| rule | anchored in |
|---|---|
| **No floating point on an amount, no ceiling, one formatter, `::text` on every read** | `tests/guards/run.sh`, `docs/contracts/S0-12-money.md` |
| **No bid increment, no reserve, no leading-bidder rejection on the server** | `tests/integration/excluded-features.check.sh`, and D-01 §2 |
| **Anti-sniping: 15 s → +30 s, cap 20, the cap is a `CHECK`** | `tests/bidding/closing.sql` |
| **Email never public; identity from the verified server session** | `CLAUDE.md` §6 |

And the bound that V2 does **not** get to redefine, because it already exists and is
already enforced:

> **Auction duration is 5 minutes to 7 days, inclusive, by server time** — `BR-38`,
> `FR-CREATE-09/10/10a`, `SC-68`. It is a `CHECK` constraint today
> (`supabase/migrations/20260812120000_bid02_bid_acceptance.sql:500-501`). D-06 §2 step 3
> described the 5-minute floor as *"a new rule"* — **it is not new**, it is BR-38, and V2
> enforces the existing range at both ends rather than inventing a floor.

Three of the new features press directly on these, and each is called out where it does:

- the **bid button** (D-01) looks like a minimum raise and is not — §2 of that record
- the **deposit** (D-05) adds a *new rejection reason*, and a rejected bid must not extend
- the **AI** (D-04) is kept away from money by measurement as much as by rule — the model
  got the amount wrong ten times out of ten, which is why the price suggestion is SQL

## 3. The four things being added

### 3.1 Categories — [D-02](../decisions/D-02-categories.md)
Thirteen main sections, 110 sub-sections, sourced from حراج and four Gulf auction platforms
read directly, with everything that is a classified ad rather than an auction removed.
`misc` («منقولات متنوعة») exists on purpose: a closed taxonomy turns a legitimate seller
away. **The category changes which extra fields the form asks for**, and those fields are
optional and never block publishing.

**Owner decision, 2026-08-15:** category-specific values are stored as **validated `jsonb`,
backed by normalized category and field-definition tables**. The tables define which keys
exist for a category and what shape each takes; the `jsonb` carries the values and is
validated against those definitions server-side. This is neither of the two bad options
D-02 §2.1 named — not sixty mostly-null columns, and not a free-for-all `jsonb` any session
can write any key into.

### 3.2 The create flow — [D-06](../decisions/D-06-images-and-create-flow.md)
Four steps: **الصور · التفاصيل · المزايدة · المراجعة**. JPG/PNG/WebP, 5 MB each, drag to
reorder, **first is the cover**. Images are step 1 for two stated reasons and the second one
is structural: **the assistant cannot help before it has seen the thing.** The review step
renders the *real card component*, not a text summary.

**Owner decision, 2026-08-15:** **every auction requires 1 to 10 images, validated
server-side.** One is the floor, ten is the ceiling, and both are enforced where `SC-43`
says a rule has to live — in the server, not in the form.

### 3.3 The assistant — [D-04](../decisions/D-04-ai-product-surface.md)

**Five features were approved and all five are being built.** What measurement determined
is **which technology implements each one** — not which ones survive. A feature is not
smaller because the correct implementation of it contains no language model; the price
suggestion is *more* reliable for being SQL, not less.

| # | feature | built with |
|---|---|---|
| 1 | **يكتب الإعلان** | a **VLM** — images → title, description, category. Vision + `json_schema`, ~11 s measured |
| 2 | **يصلّح الصور** | a **separate image-processing / image-model pipeline** — not the text model. Its own provider, its own cost, its own ticket (V2-A14 spike → V2-A16) |
| 3 | **يفهم البحث** | **the model plus deterministic parsers** — category and city from the model; brand, minimum year, price band and «تنتهي خلال ٢٤ ساعة» from parsers that cannot hallucinate |
| 4 | **يجاوب عن القطعة** | the model, grounded in **the seller's description and specifications only**. «ما أعرف» must be easy |
| 5 | **يقترح سعر البداية** | **SQL / data analysis** over comparable ended auctions. Still the approved **seller-only** feature, and it returns a **range** with the comparable count beside it |

Measurement is recorded where it belongs — [`local-model.md`](../ai/local-model.md) — and
it constrains *how*, never *whether*.

#### 3.3.1 Where the model runs — decided, with one thing still to pick

**Owner decision, 2026-08-15:** **LM Studio is for local development. Production uses a
hosted OpenAI-compatible provider, selected through a capability check.**

The adapter speaks the OpenAI API and reads `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` —
**never `NEXT_PUBLIC_`**. That is how the endpoint is *configured*.

> **It is not a guarantee that any endpoint will work.** An earlier draft of this document
> said swapping providers "changes only those three values". **That claim is withdrawn.**
> Three variables point the client somewhere; they say nothing about whether what is there
> accepts an image, honours `response_format: {type: "json_schema", strict: true}`, returns
> the schema it was given, or holds an Arabic enum. A provider that fails any of those
> breaks features 1, 3 and 4 at runtime, in production, with a green build behind it.

So a provider is qualified by a **capability contract test** (**V2-A18**), run against the
endpoint before it is used: vision input accepted, structured output returned and
schema-valid, Arabic enum values preserved, and a measured latency. Configuration selects a
provider; **the test qualifies it**.

*Still to pick:* **which** hosted provider — `O11` in §4.

### 3.4 Sessions — [D-03](../decisions/D-03-sessions.md), and the deposit — [D-05](../decisions/D-05-deposit.md)
A room of lots opened one at a time, built before the date and run live from a host control
room. **A session is a kind of auction, not a kind of account** — any individual or company
can create one. Each lot is a complete auction with a **duration, not an absolute end time**.
The deposit is **simulated** — no payment gateway, no card field, no amount that moves,
anywhere — and it unlocks **bidding, not watching**.

**Two owner decisions, 2026-08-15:**

- **Pause is supported.** A **host-only atomic database operation** pauses and resumes a
  lot, and **moves `end_time` forward by the paused duration**. The `CLAUDE.md` §5
  invariant and `tests/bidding/closing.sql` are amended *explicitly* for it — the amendment
  is written into `CLAUDE.md` §5 and the required test changes are named there. A pause
  implemented by switching the guard off is a pause that removed the invariant.
- **Deposit access expires when the session ends. There is no refund transaction.** Nothing
  moves, because nothing ever moved — the row's entitlement simply stops applying. The
  screen has to say so (`O15`), but there is no reversal to build.

Sequenced **last**, by the owner: *«داخلة، بس آخر شي»*.

## 4. What is decided, and what is still open

### 4.0 Decided is not ratified — and three of these contradict the PRD

Every decision below is `DECIDED` in `docs/decisions/`, and **none of them is in `PRD.md`**.
For three, that is not merely a lag — the PRD says the opposite:

| | the PRD today | what V2 assumes |
|---|---|---|
| **categories** | `PRD.md:411` out of scope; `PRD.md:508` *"category and condition are Future"* | 13 categories with category-driven fields |
| **images** | `PRD.md:527` **FR-CREATE-15** *"Exactly one image per auction in the MVP"* | 1 to 10, required |
| **pause** | `PRD.md:784` **BR-16** *"The single exception is the automatic anti-sniping extension"* | a second door on `end_time` |

`CLAUDE.md` §2 puts `PRD.md` first, so **the PRD currently wins all three** and the records
lose. Nobody intended that; it is what a decision looks like a week after it was made and
before anyone wrote it down where it counts. The full evidence, with what each ratification
would require, is the **`R` register** in
[`docs/decisions/README.md`](../decisions/README.md) — *"The ratification gate"*.

**Only the owner ratifies.** No ticket below may edit `PRD.md`, and no ticket resolves this
by choosing a side. Two checks in `tests/guards/run.sh` hold the queue; neither can ratify.

### 4.1 The vocabulary — corrected

`docs/decisions/README.md` defines three statuses and **`DECIDED in shape` is not one of
them.** It was invented by a session to describe a record that is decided *and* still
carries unanswered sub-questions, and it did real damage: three records wore it, and it
read as "half-decided, so proceed carefully" when the truth was "decided, and here are four
separate things nobody has decided yet."

The fix separates the two ideas, because they were never the same idea:

| | applies to | values |
|---|---|---|
| **Status** | the **record** — was the decision made? | `DECIDED` · `OPEN` · `IN PRD` |
| **Open item** | a **named gap** inside a decided record | `O1` … `O30`, each with an id, an owner-question, and the tickets it blocks |

A record can be `DECIDED` and still carry open items. That is normal and it is the whole
purpose of the "Still open" section (`README.md` rule 2). What is **not** allowed is a gap
with no id, because a gap with no id cannot appear in a ticket's *blocked on* column — and
the register below exists so that every one of them can.

### 4.2 The six questions this board was waiting on — five decided, one narrowed

| # | question | decision |
|---|---|---|
| Q1 | How are category-specific fields stored? | **DECIDED — validated `jsonb`, backed by normalized category and field-definition tables** |
| Q2 | Is a pause allowed to freeze a lot's clock? | **DECIDED — pause is supported: a host-only atomic operation that moves `end_time` forward by the paused duration.** `CLAUDE.md` §5 and `closing.sql` are amended explicitly |
| Q3 | Is image editing in scope now that it is known not to be an LLM? | **DECIDED — in scope**, as a separate image-processing pipeline with its own provider spike |
| Q4 | Where does the model run in production? | **DECIDED in part — LM Studio for local dev; production on a hosted compatible provider selected through a capability check.** Which provider is `O11` |
| Q5 | What happens to a deposit when the session ends? | **DECIDED — access expires with the session; there is no refund transaction** |
| Q6 | Is at least one image required? | **DECIDED — 1 to 10 images, required, validated server-side** |

### 4.3 The open register — thirty real blockers

Every unresolved item from every decision record, given an id so a ticket can cite it.
**None of these may be answered by whoever picks up the ticket** (`CLAUDE.md` §8). A ticket
whose *blocked on* column names an id is not startable in the part that touches that id.

| id | the question nobody has answered | from | blocks |
|---|---|---|---|
| **O1** | Is a category **required** on every auction? `misc` existing is not the same as the column being `not null` | D-02 | V2-A1, V2-C1 |
| **O2** | Sub-category — **stored, or presentation only?** 110 appear in the picker; none appears on a card | D-02 | V2-A1, V2-C1 |
| **O3** | **Which** categories appear on the filter bar, and is that set fixed or volume-driven? | D-02 | V2-B4 |
| **O4** | Is a lot an `auctions` row with a nullable `session_id`, or a **separate entity**? Large blast radius on every query, policy and test | D-03 | V2-A10, V2-C6 |
| **O5** | What happens to bids on a lot the **host closes early**? | D-03 | V2-A11 |
| **O6** | «أنهِ الجلسة» with lots still waiting — unsold, rolled over, or become standalone auctions? | D-03 | V2-A12 |
| **O7** | What if the **host never shows up**? Auto-run or hang are both decisions | D-03 | V2-A12 |
| **O8** | «بدعوة فقط» — **invited how**, given there is no messaging and email is never exposed (§6)? | D-03 | V2-A10, V2-B9 |
| **O9** | Does the attendance count expose anything? A count is safe; a list is not | D-03 | V2-B11 |
| **O10** | **Can a session be cancelled?** `status` having exactly two values is a stated invariant | D-03 | V2-A10 |
| **O11** | **Which** hosted provider, concretely? The capability test (V2-A18) says whether a candidate qualifies; it does not choose one | D-04 | **no ticket** — see below |
| **O12** | Is `AI_ENABLED` **on or off by default**? | D-04 | V2-A6 |
| **O13** | Is an AI-proposed **title** labelled the way an edited **image** is? The same argument applies and only images are covered | D-04 | V2-B8 |
| **O14** | For the price suggestion: **what counts as "similar"**, and what is the **minimum sample** below which nothing is shown? | D-04 | V2-A4 |
| **O15** | What does a **losing bidder** see about the deposit, now that access simply expires? | D-05 | V2-B10 |
| **O16** | Is «بدون» the **default** preset? | D-05 | V2-B9 |
| **O17** | Is «مبلغ آخر» **bounded**? `BR-21`/`SEC-R3` forbid a ceiling on a *price*; a deposit is not a price | D-05 | V2-A13 |
| **O18** | Is the deposit stored as **`sar_amount`**? If stored, `CLAUDE.md` §4 applies in full. **Do not create a second money type** | D-05 | V2-A13 |
| **O19** | Can the host **see who paid**? A list of entrants is a list of people | D-05 | V2-B11 |
| **O20** | **Where do images live** — bucket, path convention, and the RLS on it? A storage path is an identifier printed in an `<img src>` | D-06 | V2-C2, V2-A2, V2-A15 |
| **O21** | What happens to **abandoned uploads** in a product with no delete (`BR-30`, `BR-31`)? | D-06 | V2-A2, V2-A15 |
| **O22** | Does **reordering images after publish** exist? Arguably not editing the auction — arguably is not a decision | D-06 | V2-B7 |
| **O23** | Does a **session lot** use the same `BR-38` 5 min–7 day bound as a standalone auction? | D-03, D-06 | V2-A10, V2-C6 |
| **O24** | **Which image-processing provider or library**, at what cost and what latency? *This one is answered by a ticket*: **V2-A14** is a timeboxed spike that produces the options; the owner picks from them | D-04 | V2-C7, V2-A16, V2-B12 |
| **O25** | Is the increment **required at creation, or optional with a default?** If optional: what default, and does "no increment" hide the button or give it a fallback? | D-01 | V2-C3, V2-A3, V2-B5 |
| **O26** | **"مضاعفات العشره" — multiples of ten of what?** Ten SAR (10, 20, 30…), or any value that is itself a multiple of ten (10 and 500 legal, 15 not)? Two different `CHECK`s, and both fit the sentence | D-01 | V2-C3, V2-A3 |
| **O27** | Is there an **upper bound on the increment**? `BR-21`/`SEC-R3` forbid a ceiling on a *price*; an increment is not a price — but a maximum has to be decided, not assumed | D-01 | V2-C3, V2-A3 |
| **O28** | **One button, or several** (×1 / ×2 / ×5)? The prototype shows one. The extension is obvious and has not been asked for | D-01 | V2-C3, V2-B5 |
| **O29** | The current price is **off-grid** after a crafted `+0.01` bid that D-01 §2 says must be accepted. Does the button then offer `current + increment`, or round up to the next multiple? **Round-up changes what a bidder is charged** | D-01 | V2-C3, V2-B5 |
| **O30** | Can the seller **change the increment after publishing**? `BR-31` freezes the auction; if the increment lives on the row the answer is no *by construction* — which is not the same as by decision | D-01 | V2-C3, V2-A3 |

**`O25`–`O30` are not new questions — they are old questions that finally have ids.** All
six have been written down in [D-01 §5](../decisions/D-01-bid-increment-button.md) since the
record was authored, under a heading that reads *"do NOT pick an answer for any of these"*.
What they lacked was numbers. Rule 5 of `docs/decisions/README.md` says why that matters and
D-01 §5a measures what it cost: `V2-C3`, `V2-A3` and `V2-B5` each carried `blocked on: —`,
and all three appeared in this board's *"startable today"* set. They were startable in the
only sense the board could compute — **nothing they cited was open, because they had nothing
to cite.** A gap with no id does not read as a blocker. It reads as an absence of blockers,
and on a board those are the same shape.

D-01 was the last record whose gaps were unnumbered. There are now none.

**`O11` blocks no ticket, and that is not an oversight.** `V2-A6` (the adapter) and `V2-A18`
(the capability test) are both written and run against LM Studio on a laptop; neither needs
a hosted provider chosen to be built or to pass. What `O11` gates is the **production
deployment** — and a deployment is not a row on this board. It is listed here because it is
genuinely unanswered and someone will otherwise answer it by typing a base URL into Vercel;
it is kept out of the *blocked on* cells because counting it there would have made the board
report more blocked work than exists. **29 of the 30 items block a ticket. This is the one
that does not.**

**The *blocks* column above and the *blocked on* column in `TICKETS.md` are the same graph,
written twice.** Two copies of a graph drift — silently, and in the direction that makes the
plan look better. They were checked against each other mechanically before this document was
committed, and four disagreements were found and fixed rather than argued about: `O20` also
blocks `V2-C2`, `O23` also blocks `V2-C6`, `O24` also blocks `V2-C7` and `V2-B12`, and `O11`
blocks nothing. If you edit one column, re-derive the other; do not patch it by eye.

**"Mechanically" is now a file, not a claim.** [`tests/v2/graph.mjs`](../../tests/v2/graph.mjs)
parses both tables, diffs the two copies of the graph, and recomputes every count either
document states about itself — ticket count, dependency edges, blocking edges, register size,
how many items block nothing, and the startable closure. The sentence above was true when it
was written and there was no way for a reader to confirm it; run the file instead.

**O4 is now the expensive one.** Q1 and Q2 were, and both are decided. O4 is what remains
that is painful to reverse: it decides whether phase 4 is a migration on an existing table
or a new entity, and every existing query, policy and test sits downstream of it.

## 5. How the work is claimed, and what the lanes actually are

**Nobody owns a lane.** `CLAUDE.md` §1 governs: no developer, no account and no Claude
session permanently owns a file or a feature, and any available contributor may claim any
**ready** ticket. A steward is someone to request review from — **a steward's absence must
not block a ready, well-specified ticket.**

An earlier draft of this section said Track A *"owns"* a set of directories and *"owns the
data shape"*. **That is withdrawn.** What was actually useful in it was never ownership — it
was the observation that two sessions working the same file at the same time resolve the
same conflict twice, and `CLAUDE.md` §7 says whoever resolves a conflict is making a
decision. That is a **scheduling** fact, not a permission one.

So the lanes are **expected change surfaces**, declared by the ticket:

| lane | the surface a ticket in it is expected to touch | what it proves with |
|---|---|---|
| **A — the spine** | `supabase/migrations/`, `lib/`, `tests/`, `app/api/` | a SQL suite or a `.check.mjs` |
| **B — the surface** | `app/(routes)`, `components/`, `design-system/`, `styles/` | a preview matching the prototype, INT-06 at 375 px |
| **C — the contracts** | `docs/contracts/` only | two consumers signing the header |

A lane is a **prediction about which files a ticket will touch**, published so two
in-flight tickets can be sequenced instead of collided. It is not a licence and not a
fence. If a lane-B ticket genuinely needs a line in `lib/`, it writes the line — and says
so in the PR's changed-files section, which is where a surprise gets noticed.

### 5.1 The workflow — seven steps, per ticket

1. **Check dependencies and confirm the issue is `ready`** — every id in its *depends on*
   is merged, and no id in its *blocked on* is still open.
2. **Claim the issue before coding.** Assign it to yourself. An unclaimed ticket is
   available to anyone; a claimed one is not being done twice.
3. **One branch per ticket:** `feature/<ticket-id>-<short-name>` — e.g.
   `feature/V2-A3-bid-increment`. Not one long-lived branch per person.
4. **The ticket declares an expected change surface, not exclusive file ownership.** If
   your work lands outside the surface you declared, that is information for the PR, not a
   violation.
5. **If two tickets need the same file, merge the shared contract or foundation first.**
   That is what the **C** lane is for, and why every contract in `TICKETS.md` now has a
   ticket id and a real file path instead of a name like `contract-A1` that pointed at
   nothing.
6. **A PR carries four things:** changed files · verification evidence · remaining risks ·
   handoff notes. Evidence means output, not the assertion that something passes.
7. **After merge, any available contributor claims the next ready ticket.** Including a
   ticket in a lane the previous one was not in.

The only two things that legitimately stop you are: **the product question is not decided**
(a `blocked on` id in §4.3), and **your change would break a stated contract**. Neither of
them is a person.

## 6. The order

```
  PHASE 0   unblock            #155 lands, main is green            everything blocked
  PHASE 1   foundations        A: categories, images, increment     ── parallel ──
                               B: tokens, card, topbar, picker
                               C: C1, C3 first — B4 and B5 need them
  PHASE 2   the create flow    A: server action   B: the wizard     C2, C4 first
  PHASE 3   the assistant      A: adapter, capability test, 4 tasks C5, C7, C8 first
                               A: image pipeline (after the A14 spike)
                               B: AI surfaces, enhancement surface
  PHASE 4   sessions           the largest, and last                blocked on O4
                               includes pause/resume + the closing.sql amendment
```

Phase 1 is where parallel work pays off most — but **it is not dependency-free**, and an
earlier draft claimed it was. `V2-B4` needs the category contract and `V2-B5` needs the bid
contract; both are lane **C** tickets that must merge first (workflow step 5). Everything
else in phase 1 is genuinely independent.

## 7. What "done" means for a V2 ticket

Unchanged from V1, and non-negotiable:

1. **CI green** — `static` and `database`, both jobs (`CLAUDE.md` §9)
2. **A new rule ships with the thing that enforces it.** A `CHECK`, a guard check, or a
   test whose *name is the rule*. Not a follow-up issue — D-01 §3: *a follow-up issue is a
   promise, and promises are not mechanisms*
3. **A guard that goes red is answered in a PR, never with an ignore** (`CLAUDE.md` §9)
4. **PR, one approval, `main` protected** (§7), carrying the four things in §5.1 step 6
5. **Every gap the ticket did not fill is written into its decision record's "Still open"**
   and given an `O` id in §4.3 — that register is the mechanism, and a ticket that quietly
   answers an entry has broken it
