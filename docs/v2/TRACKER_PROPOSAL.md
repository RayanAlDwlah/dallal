# Tracker configuration for V2

> **Status: OPEN — awaiting a team decision. Nothing in it has been executed.**
> Recorded 2026-08-15. Posted for reply on
> [#168](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301370669); this file is
> the durable copy, so whoever executes the answer works from the exact edit list rather than a
> paraphrase of it.
>
> A sweep names a problem; this names the options. **Until it is answered the V2 issues are not
> created** — creating them anyway means inventing a taxonomy unilaterally, which is the failure
> `CLAUDE.md` §8 describes.

## The proposal, as posted

The last sweep found that **the board these issues would be created on has no room for V2**
(`docs/v2/TICKETS.md`, the five-crossings section). Three of those crossings are *team*
decisions about how the tracker is configured, and until they are made, creating 41 issues
means inventing a taxonomy unilaterally — which is the exact failure `CLAUDE.md` §8 names.

**Nothing has been created.** No label, no milestone, no issue. This comment is the decision
put in front of you; the next commit after a `yes` is the one that does it.

**One correction to my own earlier comment before the options.** I reported three gates of
roughly equal weight. Writing the options out, **gate 3 turned out to be much cheaper than the
sweep implied** — the rule it appears to break survives intact, and only the *reason* attached
to it is stale. Details in gate 3. So this is really two decisions and one wording fix.

| | Gate | Recommended | Labels/milestones created | Documents edited |
|---|---|---|---|---|
| **1** | V2 has no milestone | **`M5 — V2`**, one | +1 milestone | `GITHUB_PLAN.md` ×3 lines |
| **2** | No `area:` fits, `type:feature` means *MVP* | **+3 `area:`, +3 `track:`** | +6 labels (22 → 28) | `GITHUB_PLAN.md` ×4, `TEAM.md` ×2 |
| **3** | Tickets blocked on an open product question | **GitHub's native issue relationships** | **none** | one clause ×2 lines |

---

### Gate 1 — V2 has 41 board rows and nowhere to put them

*(40 tickets — 8 in track C, 20 in A, 12 in B — plus `V2-00`, the unblock prerequisite.)*

`GITHUB_PLAN.md:214`: *"No reason to deviate, and **no extra milestones are created**."*
`gh api …/milestones` returns exactly M0–M4, so the document and the tracker agree. It is V2
that has nowhere to go.

| Option | What it is | Cost |
|---|---|---|
| **1A — one `M5 — V2`** ✅ **recommended** | A sixth milestone, closing when V2 ships | +1 milestone; smallest possible edit to `:214` and to S0-03's AC |
| **1B — three per-track milestones** `V2-A` / `V2-B` / `V2-C` | Mirrors how M1/M2/M3 already encode TEAM.md's workstream split | +3 milestones; **no track has an independent exit criterion** — B cannot ship without A — so all three would close on the same day, which is what one milestone is |
| **1C — no milestone; `track:` label only** | Zero milestone change | The `:214` sentence survives, but V2 becomes invisible in the milestone view that M0–M4 established as *the* progress surface, and "is V2 done" has no answer |

**Why 1A.** A milestone closes on an exit criterion. V2's tracks share one. 1B's appeal is the
precedent — but the precedent argues *against* it: `:214` justifies five milestones as
*"three-way workstream split **plus a foundation phase and an integration phase**"*, and V2's
track C is foundation and track B depends on track A. It is one phase, not three.

**Exact edits.**

- `GITHUB_PLAN.md:214` — scope the sentence to the MVP: *"no extra **MVP** milestones are
  created"*, plus one sentence recording that `M5 — V2` was added on ratification of this
  proposal, with the date. **Do not delete the sentence** — it is the record of a real decision.
- `GITHUB_PLAN.md:218–222` — the milestone table gains an `M5` row. Suggested exit criterion:
  *"the V2 demonstration scenario passes on the Vercel production deployment"* — deliberately
  parallel to M4's, and **it needs a V2 scenario to exist**, which no ticket currently writes.
  Flagging that as a gap, not filling it.
- **`GITHUB_PLAN.md:248` (S0-03) — this AC is falsified.** It reads *"22 labels exist, no
  existing label deleted · **five milestones exist** · …"*. S0-03 is **merged**. The correct
  move is to amend the AC in place with a dated note saying what superseded it, not to rewrite
  it as though it always said six.
- **Four other "five milestones" lines stay exactly as they are, and I checked each one:**
  `GITHUB_PLAN.md:855` (the *Plan summary* inventory), `:940` (*"GITHUB_PLAN.md v1.1 — 84 issues
  across 5 milestones"*), `:1005` (§16.7 *Deliberately not included*, written before any of them
  existed) and `README.md:169`. All four describe **the MVP plan's own content**, which adding
  `M5` does not change. Editing them would be the mistake, not the fix.
- **`V2-00` goes in `M4`, not `M5`.** It is "land #155, get `main` green" — MVP repair work.

---

### Gate 2 — the label taxonomy is closed at 22 and none of its values fits

`TEAM.md:1076` and `GITHUB_PLAN.md:151` both state 22 as a **total**, and `GITHUB_PLAN.md:248`
asserts it a third time as an acceptance criterion. `gh label list` returns 22. Three separate
things are missing:

1. **Subject.** `area:` has five members — `auth`, `auction`, `bidding`, `realtime`, `shared`.
   V2 builds sessions, AI, and images. None has an area; `area:shared` means Sprint 0 groundwork.
2. **Layer.** V2 splits into tracks A (behaviour/data), B (presentation) and C (contracts).
   Track is what decides who can work in parallel without conflict — `CLAUDE.md` §1's whole
   model — and it is orthogonal to subject: A and B both span sessions, AI and images.
3. **Phase.** `type:feature` is defined at `GITHUB_PLAN.md:144` as *"MVP functionality"*, so
   **every V2 ticket mislabels itself by definition.**

| Option | New labels | Total | Trade |
|---|---|---|---|
| **2A — 3 areas + 3 tracks** ✅ **recommended** | `area:sessions` `area:ai` `area:images` · `track:a` `track:b` `track:c` | **28** | Phase carried by the M5 milestone, so no `phase:` namespace and no `type:` change beyond rewording `:144` |
| **2B — 3 areas only** | `area:sessions` `area:ai` `area:images` | 25 | Cheapest. Track lives in the issue *title* (`V2-A3 — the bid increment`) and is findable by text search — but not by sidebar filter, and it does not group in the picker |
| **2C — 2A plus `area:deposits`, `area:categories`, `phase:mvp`/`phase:v2`** | +10 | 32 | Honest but heavy; `area:deposits` would carry **one** ticket |

**Why 2A, and why exactly these three areas.** I assigned all 41 rows and counted, rather than
guessing at the namespace:

| area | count | tickets |
|---|---|---|
| `area:sessions` **new** | 8 | C6, A10, A11, A12, A19, B9, B10, B11 |
| `area:ai` **new** | 8 | C5, A6, A7, A8, A9, A18, A20, B8 |
| `area:images` **new** | 8 | C2, C7, A2, A14, A15, A16, B7, B12 |
| `area:auction` *existing* | 10 | C1, C4, C8, A1, A4, A5, A17, B2, B4, B6 |
| `area:bidding` *existing* | 4 | C3, A3, **A13**, B5 |
| `area:shared` *existing* | 3 | V2-00, B1, B3 |

Three new values, each carrying eight tickets. **Categories and search fold into `area:auction`**
— they are how an auction is described and found. **Deposit folds into `area:bidding`**, because
`V2-A13` is literally *"deposit as an eligibility gate"* — it is a rule about who may bid.
That is 2C's two extra areas eliminated on the evidence rather than on taste.

**Exact edits.**

- `GITHUB_PLAN.md:139` — *"Add **13** project labels"* → 19, and the table below it gains six rows.
- `GITHUB_PLAN.md:151` — *"Total after setup: **22** labels (9 preserved + 13 new)"* → 28 (9 + 19).
- **`GITHUB_PLAN.md:144` — `type:feature` = *"MVP functionality"* → *"product functionality"*.**
  This is the change that lets a V2 ticket be labelled at all. The MVP/V2 distinction moves to
  the milestone, where it is already unambiguous.
- **`GITHUB_PLAN.md:248` (S0-03) — falsified a second time** (*"22 labels exist"*). Same
  treatment as gate 1: amend in place with a dated supersession note.
- `TEAM.md:1076` — *"**22 labels exist**"* → 28, and TEAM.md §19's label table gains the six rows.
- **`GITHUB_PLAN.md:271` (S0-14) is *not* falsified by this gate** — its AC is about the
  `verify` → `type:verification` mapping and the `needs-decision` prohibition, both of which
  survive 2A untouched.

---

### Gate 3 — a ticket blocked on an open product question has no way to say so

34 open `O` items block **26 of the 41** tickets. Four lines forbid the obvious label, all
giving the same reason: `TEAM.md:1091`, `TEAM.md:1095`, `GITHUB_PLAN.md:164`,
`ARCHITECTURE.md:1485` — *"`PRD.md` v3.0 has zero open product questions, so no Issue can be
blocked on one."* And the designated alternative refuses the job by definition:
`GITHUB_PLAN.md:145` defines `type:verification` as *"**Technical** platform verification …
**Never a product question**"*.

| Option | What it is | Cost |
|---|---|---|
| **3A — native issue relationships** ✅ **recommended** | Six *tracking* issues, one per decision record, listing that record's `O` items. Each blocked V2 ticket is marked **blocked by** the tracking issue(s) it depends on | **Zero labels, zero milestones.** One stale clause to fix |
| **3B — revive `needs-decision`** | The label the four lines forbid | Falsifies all four, **and** S0-14's acceptance criterion at `GITHUB_PLAN.md:271`, which makes preserving the prohibition a *merged ticket's* AC |
| **3C — a new `type:` value** (`type:product-question`) | Same idea under a new name | Same premise problem, plus `type:` describes the *kind of work*, not a *state* — and blocked-ness is a state |

**Why 3A is not a compromise but the mechanism these documents already chose.**
`GITHUB_PLAN.md:163` and `TEAM.md:1090` dropped the `blocked` label with this reason:
*"GitHub's native 'blocked by' Issue links express this better than a label that must be
manually added and removed."* That sentence was written about exactly this shape of problem.
Using it applies an existing team decision instead of overturning one.

The six tracking issues fall out of the register cleanly — `docs/v2/SPEC.md` already maps every
`O` item to its decision record:

| tracking issue | `O` items | count |
|---|---|---|
| `D-01` — the bid-increment button | O25, O26, O27, O28, O29, O30 | 6 |
| `D-02` — categories | O1, O2, O3 | 3 |
| `D-03` — sessions | O4, O5, O6, O7, O8, O9, O10, **O23**, O31, O32, O33 | 11 |
| `D-04` — the AI product surface | O11, O12, O13, O14, O24, O34 | 6 |
| `D-05` — the deposit | O15, O16, O17, O18, O19 | 5 |
| `D-06` — images and the create flow | O20, O21, O22, **O23** | 4 |

**The column sums to 35 for 34 questions, and the extra one is the argument.** `O23` is mapped
to *both* records in `docs/v2/SPEC.md`, so it appears twice — and under 3A that costs nothing,
because an issue can be blocked by two. A label cannot express that at all: `needs-decision` on
`V2-A10` says it is blocked, not *by which of two unrelated decisions*, and removing the label
when D-03 closes would silently mark it ready while D-06 is still open. **That is the concrete
failure 3B has and 3A does not**, and it is why this table is the argument rather than an
appendix to it.

Closing one tracking issue then unblocks its dependants *visibly*, with no label to remember to
remove — which is the argument `GITHUB_PLAN.md:163` made.

**Exact edits — and this is the whole of it.**

- `TEAM.md:1095` and `GITHUB_PLAN.md:164` — the **rule stands**; the **reason is stale**. Change
  *"`PRD.md` v3.0 has zero open product questions"* to record that V2's open questions are
  carried as tracking issues with native blocked-by links, not as a label. **`TEAM.md:1091`
  (*"never existed, and must not be created"*) does not change at all**, and neither does
  `ARCHITECTURE.md:1485`, which is about V1's five architecture items.
- `GITHUB_PLAN.md:271` (S0-14) — **untouched.** Its AC is satisfied more strongly after this
  than before.

---

### What stays untouched under all three recommendations

- **`PRD.md`.** Not one line. The `O` items are questions *for* the owner; nothing here answers one.
- **GitHub's nine default labels** — none deleted, none renamed (`GITHUB_PLAN.md:151`'s
  *"no existing label deleted"* survives).
- **The existing 13 project labels' meanings**, with one exception, stated plainly: `type:feature`
  widens from *"MVP functionality"* to *"product functionality"*. `area:auth`, `area:auction`,
  `area:bidding`, `area:realtime`, `area:shared`, the three `priority:` values and the other four
  `type:` values are unchanged.
- **M0–M4**, their titles, their exit criteria, and their 96 issues.
- **The `needs-decision` prohibition**, and `type:verification`'s "never a product question" rule.
- **Every product decision.** Nothing above decides an `O` item, and crossing 5 of the sweep —
  `bid increment` on `TEAM.md:1334`'s "things nobody may build" list — is **not** in this
  proposal. That one is the owner's, it is `D-01`, and it stays where it is.

### The guards will go red, and that is the point

`tests/v2/graph.check.mjs` pins eighteen board lines by file, line number and substring, and
`tests/v2/graph-negative.check.sh` proves each pin can fail. **Seven of them are lines this
proposal edits**, so accepting it turns `static` red until the same PR moves them:

| pinned line | which gate edits it |
|---|---|
| `GITHUB_PLAN.md:214` — *"no extra milestones are created"* | 1 |
| `GITHUB_PLAN.md:248` — S0-03's AC | 1 **and** 2 |
| `GITHUB_PLAN.md:151` — *"Total after setup: 22 labels"* | 2 |
| `GITHUB_PLAN.md:144` — *"MVP functionality"* | 2 |
| `TEAM.md:1076` — *"22 labels exist"* | 2 |
| `TEAM.md:1095` — the stale premise | 3 |
| `GITHUB_PLAN.md:164` — the same premise, second copy | 3 |

The other eleven stay green, and one of those is worth naming: **`GITHUB_PLAN.md:271` (S0-14)
is pinned and deliberately not edited.** If a future draft of this proposal starts touching it,
the guard going red is the signal that gate 3 quietly turned into option 3B.

Per `CLAUDE.md` §9 the answer to the seven is **not** an ignore: the same PR that makes the edit
moves the pins, and its description says which decision moved. That is the mechanism working,
not the mechanism in the way.

### To approve

Reply with three letters — e.g. **1A / 2A / 3A** — or the changes you want. On a `yes` the next
commits are, in order: (1) the document edits with the pins moved in the same PR; (2) the
milestone and labels created; (3) the six tracking issues; (4) the 41 V2 issues, labelled,
milestoned and linked. **Nothing in that list starts before the reply.**

Steward review requested from **@Dem4t** and **@m7ya505** — this is a *process* decision under
`CLAUDE.md` §2's ranking of `TEAM.md` and `GITHUB_PLAN.md`, so it is the team's, not one
person's. Per `CLAUDE.md` §1 I am **not blocking** on it; there is nothing to build until it
is answered.
