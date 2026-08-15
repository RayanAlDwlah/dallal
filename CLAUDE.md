# CLAUDE.md — binding instructions for every AI-assisted session on Dalal

All three developers build this project with Claude, in separate sessions that cannot see
each other. This file is the only mechanism that constrains all three at once. **Read it
before writing code.**

---

## 1. What Dalal is

A live auction platform: sellers list items, buyers bid, the highest bid at the end time
wins. Supabase (PostgreSQL 17) + Next.js on Vercel. It is a **demonstration** — SAR
amounts are simulated and **no money changes hands**. There is no payment, no purchase, no
shipping, no messaging, no admin interface.

### Nobody owns a file. Work is claimed, not assigned.

**No developer, no account and no Claude session permanently owns a file or a feature.**
Any available contributor may claim any **ready** ticket. What used to be called ownership
is now **temporary responsibility for a ticket you have claimed** — it lasts until that
ticket merges, and it is *not* an authorization boundary.

This replaces the previous model, in which each area had a permanent owner and a session
was told to refuse work outside it. That model produced its own failure: **work stopped
because the nominal owner was unavailable**, on tickets that were fully specified and ready
to build.

### Stewards advise. They do not gate.

Some areas are **sensitive** — the atomic bid operation, the money representation, identity
and authorization, the closing and extension path. Each has a **steward** who knows it best
and who should be asked to review a change to it:

| Sensitive area | Steward | GitHub |
|---|---|---|
| Bidding, concurrency, closing, extension, current-price correctness | Rayan | `@RayanAlDwlah` |
| Authentication, session, authorization, identity data | Abdulrahman | `@Dem4t` |
| The design system and presentation consistency | Mohammed | `@m7ya505` |

**A steward's absence must not block a ready, well-specified ticket.** Request the review,
say in the PR that you requested it, and proceed. A steward reviews for correctness — they
do not hold a veto over who may write the code.

### The rule for an AI session — read this before you stop

**"Do not write code you do not own" is deleted.** It is no longer a rule on this project,
and a session that refuses work by citing it is citing something that does not exist.

Before starting, check these instead:

1. **Is the ticket ready?** Dependencies merged, acceptance criteria concrete, no unanswered
   product decision. If it is not ready, say what is missing.
2. **Is it claimed by someone else?** If yes, do not duplicate the work.
3. **Does it touch a sensitive area?** Then request the steward's review in the PR — and
   keep going.
4. **Does it require a product decision nobody has made?** **Stop and ask.** This is the
   only remaining reason to refuse, it has nothing to do with ownership, and §8 and rule 16
   of `TEAM.md` are unchanged and absolute.

The distinction that matters is now **"is this decided?"**, never **"is this mine?"**

### The workflow, in seven steps

1. **Check dependencies and confirm the issue is `ready`.**
2. **Claim it** — assign yourself in GitHub — **before writing code.**
3. **One branch per ticket:** `feature/<ticket-id>-<short-name>`, e.g.
   `feature/V2-A3-bid-increment`.
4. The ticket declares an **expected change surface** — the files it is likely to touch.
   That is a planning aid and a conflict predictor, **not exclusive access**.
5. **If two tickets need the same file, merge the shared contract or foundation first.**
   The contract is a real ticket with a real file, not an informal agreement.
6. **Every PR states:** the files changed, the verification evidence, the remaining risks,
   and the handoff notes for whoever picks up next.
7. **After merge, any available contributor claims the next ready ticket.**

> **Status of this amendment.** Recorded by the project owner on **2026-08-15**, replacing
> the presentation/behaviour ownership split recorded in `5b5e698` and propagated in
> `ea0d861`. Where **any other document in this repository** still describes permanent
> ownership, an ownership matrix, a per-developer branch, or a right of refusal based on who
> owns something, **this section governs and that text is stale.** Those documents remain
> authoritative on everything else, per §2.
>
> **That list used to be five paths, and treating it as exhaustive already cost something.**
> The first sweep named `TEAM.md`, `GITHUB_PLAN.md`, `ARCHITECTURE.md`, `README.md` and
> `docs/v2/*` — all at the root — and banner-ed every one. A mechanical sweep on 2026-08-15
> then found `design/STACK.md` §11 still carrying *"Mohammed must not add a second update
> mechanism alongside Rayan's"*: a live prohibition, addressed to a named person, in a file
> the list did not name. **A closed list is a promise that somebody enumerated correctly.**
> `tests/guards/run.sh` now checks it instead of trusting it — see §9.

---

## 2. Sources of truth, in order

1. **`PRD.md`** — what the product must do. Product decisions live here and **nowhere else**.
2. **`ARCHITECTURE.md`** — how it is built.
3. **`TEAM.md`** — the collaboration rules. **Its ownership matrix is superseded by §1**;
   everything else in it stands.
4. **`GITHUB_PLAN.md`** — the issue breakdown.
5. **`docs/contracts/*.md`** — agreed interface contracts between two pieces of work.
   **Where a contract and an older document disagree, the contract wins** — that is what it
   is for. A contract is a **ticket with a file**, and §1 step 5 says it merges before the
   tickets that depend on it.
6. **`docs/decisions/*.md`** — decisions the product owner has **made** but that are not
   in `PRD.md` yet. Read `docs/decisions/README.md` before building anything that is not
   already an issue. A record marked `OPEN` means **do not build it**; a record's "Still
   open" section is a list of things you must **ask about, not decide**. Where a record
   and `PRD.md` disagree, **the PRD wins and the record is stale.**

**`TEAM.md` rule 16 is absolute: never invent a product decision in code.** If the PRD
does not cover your situation, raise it with the team so it gets recorded — do not pick
something reasonable and move on. "The documents were ambiguous" is not a defence; the
documents contradicting each other is a known, recurring condition on this project.

If you find a contradiction between documents, **surface it**. Do not silently pick a side.

---

## 3. The interface is Arabic, right-to-left

`BR-41`, `BR-42`, `PRD §1.2`, `A-U10` (`Q16`). Every user-facing string is Arabic; the
document is `lang="ar"` `dir="rtl"`, set **once** at the root and never overridden per
component.

- Use **logical** CSS properties — `margin-inline-start`, `ps-*`/`pe-*`/`ms-*`/`me-*`/
  `start-*`/`end-*`. Never physical `left`/`right` for layout that should mirror.
- **Digits stay Western (0–9).** Arabic-Indic digits are deliberately not used.
- Wrap numbers, prices and countdowns in a bidirectional isolate (`<bdi>`), and keep the
  currency indicator **outside** the isolate — otherwise the decimal point and the
  indicator reorder.
- Isolate user-supplied Latin text (product names, display names) so it cannot flip the
  direction of the line containing it.

This is **one language, not two.** Multi-language support is out of scope (`§19.7`). Do
not add i18n scaffolding, translation files, or a language switcher.

---

## 4. Money — the rules that break the product when violated

Full contract: `docs/contracts/S0-12-money.md`. A PR doing any of the following is
rejected on sight.

1. **No floating point on an amount. Ever.** No `float8`/`real` column, cast, index
   expression, `ORDER BY`, or test assertion. No JS `Number`, `parseFloat`, `Number()`, or
   arithmetic on amounts. Amounts travel as **strings** and are compared in SQL.
2. **No ceiling of any kind.** There is no maximum price and no bid ceiling (`BR-21`,
   `SEC-R3`). Never a `numeric(P,2)` typmod — "tightening" `numeric` to `numeric(12,2)` is
   the single most likely hygiene refactor on this codebase and it is a **violation, not
   hygiene**. No length cap on the amount input. No `to_char` format picture (it renders
   wide values as `###` — a hidden display ceiling).
3. **Every money column is the `sar_amount` domain.** Never bare `numeric`.
4. **Do not remove `VALUE < 'Infinity'` from the domain.** It looks redundant. It is not:
   PostgreSQL `numeric` accepts `NaN`, and `NaN > 0` and `NaN = round(NaN,2)` are both
   true. An accepted `NaN` bid makes the auction permanently unwinnable.
5. **More than two decimals is REJECTED, never rounded.**
6. **One formatter, byte-identical wherever it exists.** Same amount, same string,
   everywhere. The canonical format is **`1,250.00 SAR`** (`BR-43`, `FR-CREATE-13`,
   `S0-12` §0): grouped thousands, exactly two decimals, one space, the **Latin** `SAR`
   indicator. Never `ر.س`, never "Demo Points", never a second currency, and never a
   second formatter — `styleguide.html` and demo pages included.
7. **Every direct read of a `sar_amount` column casts `::text`, per column, every
   time.** Rule 1 is not satisfied by not writing `Number()`: PostgREST serialises bare
   `numeric` as an unquoted JSON *number*, and `JSON.parse` inside the Supabase client
   corrupts it before a line of this repository runs — the float is produced with **no
   code of yours on the stack** (measured, `#103`). Read through `public.bid_history` /
   `sar_text()`, or cast every money column in the select: `starting_price::text`. A
   review that only greps for `Number(` will pass the violation.

---

## 5. Bidding — three checks that must NOT exist

`ARCHITECTURE §13.2a`. Adding any of these is **a bug**, not an improvement. They were
deliberately removed and their **absence is the requirement**:

- ❌ **no bid increment / minimum raise** — `+0.01` is as valid as `+1000` (`BR-32`)
- ❌ **no maximum / reserve price** (`BR-21`, `BR-35`)
- ❌ **no leading-bidder rejection** — being the current leader is never grounds to reject (`BR-24`)

Also absent by design: no auction cancel, no auction edit, no draft state. `status` has
exactly two values — `active` and `ended`.

### Anti-sniping DOES exist — this list used to say it did not

**`BR-36` was reversed on 2026-08-13** by the project owner, with both other developers
agreeing. This bullet used to read *"❌ no anti-sniping / time extension"*. It is gone
because the feature is real:

> A bid **accepted** in the **final 15 seconds** extends `end_time` by **exactly 30
> seconds**, repeating, to a **hard cap of 20 extensions**.

If a document you are reading says the end time is fixed and never extended, **it is stale
— this section governs**, and say so rather than reverting the code to match it. The
mechanism is in `supabase/migrations/20260814000000_bid15_closing_and_extension.sql`.

Four properties are not negotiable and each is asserted in `tests/bidding/closing.sql`:

- the **cap is a `CHECK` constraint**, not an `if`. Without it a contested auction never
  ends, never finalizes, and never has a winner
- `end_time` moves **forward only** — never backwards, under any mechanism, ever. Inside
  `place_bid` it moves **in 30-second quanta only, and only together with
  `extension_count + 1`**. Every other shape raises. **There is now exactly one other door;
  see the amendment below**
- a **rejected** bid never extends — otherwise an ineligible bidder holds an auction open
  forever with bids that never count
- **at the cap a late bid is still accepted.** The cap ends the extending, not the bidding

### The amendment: pause is a second door on `end_time` — decided 2026-08-15

The owner decided it, in these words:

> **Pause is supported: a host-only atomic DB operation pauses/resumes a lot and moves
> `end_time` forward by the paused duration. Update the existing invariant and tests
> explicitly.**

This is V2 work (`docs/decisions/D-03-sessions.md`). It is recorded here, in the file that
governs `end_time`, because the invariant above is the thing it changes — and a session
reading only §5 must not conclude that a pause implementation is a violation.

**What is unchanged, and is still absolute:**

- `end_time` **moves forward only.** Never backwards, under any mechanism, by any caller,
  ever. Pause does not become an exception to this; a resume *adds* the paused duration.
- **`place_bid` still owns extension.** The 30-second quantum, the `extension_count + 1`
  lockstep and the `CHECK`-constrained cap of 20 are untouched. Pause never increments
  `extension_count`, and an extension never records paused time.

**What changed:** the sentence *"only inside `place_bid`"* is now *"inside `place_bid`,
**or** inside the pause/resume operation"*. Those are the only two doors. Everything else
still raises.

**The pause door has its own conditions, and each one is a requirement:**

- **Host-only.** The caller must be the host of the session that owns the lot, decided from
  the verified server session — never a client-supplied id (§6). A bidder pausing a lot they
  are losing is the attack this exists to refuse.
- **Atomic.** Pause and resume are one DB operation each, taking the same row lock
  `place_bid` takes. A pause that reads-then-writes races a bid landing in the same
  millisecond, and the loser of that race is the auction's correctness.
- **Forward by the paused duration, and nothing else.** `end_time` gains exactly the
  wall-clock interval between pause and resume — not a rounded quantum, not a fixed amount.
- **A paused lot accepts no bids.** Eligibility is still the server clock against `end_time`
  (`LC-03`), so the pause must also refuse bids explicitly; the clock alone will not, because
  `end_time` has moved *away*.

**The tests must change, explicitly — this is not optional and not a follow-up.**
`tests/bidding/closing.sql` section K currently asserts five refusal shapes, and one of them
is about to become a lie:

- `'end_time cannot be moved outside place_bid'` (line ~345, matching `%only be extended by
  place_bid%`) **is now wrong as named and as worded.** Rename it and re-word the raised
  message to name both doors. Do not delete it — the refusal it tests is still the majority
  case; it is the *set* of permitted callers that grew by one.
- The other four (`cannot move backwards`, `cannot move by some other amount`, `cannot move
  without the counter`, `the counter cannot move without end_time`) **stay exactly as they
  are**, and must still pass, because pause changes none of them.
- **New assertions are required** for the door itself: that a non-host is refused, that
  resume moves `end_time` forward by the paused duration and by nothing else, that pause
  never touches `extension_count`, that a paused lot refuses a bid, and that `end_time` still
  cannot go backwards *through* the pause path.

The trigger is `public.auctions_guard_update()` in
`supabase/migrations/20260814000000_bid15_closing_and_extension.sql`, gated by the session
flag `dalal.in_place_bid`. A second gate for the pause path is the obvious shape; whatever
shape is chosen, **the guard must still refuse an unflagged update** — a pause implemented by
turning the guard off is a pause that removed the invariant.

**Two more rules that look like details and are not:**

- **Bidding eligibility is decided by the server clock against `end_time` — never by the
  stored `status` flag** (`LC-03`). There is a window where the end time has passed but the
  flag still says `active`; a status-gated check accepts bids after the auction ended. Use
  `clock_timestamp()`, not `now()` — `now()` freezes at transaction start, before the bid
  queued on the lock.
- **Bid history is ordered by `bids.id`, never by `created_at`.** `created_at` defaults to
  `now()` = transaction start, not lock order. Sorting by it renders a **decreasing** bid
  history under contention — measured at 2 of 12 contended auctions. `created_at` is for
  display only.

The first bid may **equal** the starting price (`BR-29`, `SC-55`); every bid after it must
be **strictly greater** than the current price (`BR-03`). Something must distinguish the
two cases — derive it from the bid table inside the row lock, do not add a column.

---

## 6. Security and privacy

- **Never commit a secret.** No `.env`, no keys, no tokens. The repository is **public**.
  A leaked key is rotated, not deleted from history.
- **`SUPABASE_SERVICE_ROLE_KEY` never reaches the browser** and never appears in a
  client-side environment variable.
- **Email addresses are never visible to anyone but their owner** — not in bid history, not
  in seller names, not in results, **not in realtime payloads**. The guarantee is
  structural: email lives in the auth schema and public reads do not contain it. Do not add
  a join that reintroduces it.
- **Display name is the only public identity.** Internal identifiers stay internal.
- Identity comes from the **verified session on the server**, never from a client-supplied
  user id — this applies especially inside `SECURITY DEFINER` functions, which bypass row
  policies.

---

## 7. Git

- **`main` is protected.** No direct pushes, from anyone, including the repository owner.
  All work goes through a PR with one approval.
- Work on your own branch: `feature/<name>-<area>`.
- **Resolve conflicts on your own branch before merging** — you have the context for your
  own code; whoever resolves a conflict is making a decision.
- Conventional commits. Explain *why* in the body, not just what.

---

## 8. When you are unsure

Say so. Ask. Leave the ambiguity visible.

The failure mode this project is most exposed to is **a confident session filling a gap
with something reasonable** — a reserve price, a bid increment, a `numeric(12,2)`, an
English string, a `COALESCE` that hides a null. Every one of those type-checks, passes
review at a glance, and silently violates a decision someone made deliberately.

An unanswered question costs a message. A wrong assumption costs a sprint.

---

## 9. The guard layer — CI now reads this file back to you

§8 names the failure mode. This section is the machinery that catches it, because a written
rule stops nothing on its own. Every rule above that a session could break *while the diff
still reads as a cleanup* now has something watching it.

`.github/workflows/ci.yml` runs on **every pull request** and on every push to `main`, in
two jobs that do not depend on each other — a broken guard must not hide a broken
migration:

| job | cost | what it runs |
|---|---|---|
| `static` | seconds, no Docker | the three guard scripts, the V2 board check, **the governance workflow check**, INT-06, INT-08, the realtime checks, `lint`, `typecheck`, `build` |
| `database` | minutes, PostgreSQL 17 in Docker | `tests/auth/run.sh`, `tests/auction/run.sh`, `tests/bidding/run.sh` |

Three things in `tests/guards/` are new and each answers a different question:

- **`run.sh`** — **21 checks** over the tree, in under a second. They are the rules from
  §3, §4, §6, §5 **and now §1 and §2** that lived **only** in this file until now: no
  `Number()`/`parseFloat`
  on an amount, every `*_price` read carrying `::text` (§4.7), `bid_history.amount` coming
  from `sar_text()`, no money column declared bare `numeric`, no second formatter outside
  `lib/money.ts`, no `ر.س`, no Arabic-Indic digit, `dir="rtl"` declared exactly once and in
  the root layout, no physical `ml-`/`mr-`/`pl-`/`pr-`, no tracked `.env`, no
  `NEXT_PUBLIC_*SERVICE_ROLE*`, and no `.order("created_at")` on bid history. It strips
  comments before matching, because this repository documents its absences and a plain grep
  reports the healthiest files as the worst offenders.

  **The last two are the governance rules from §1**, added 2026-08-15, and they exist
  because the prose alone had already failed once: no tracked document may re-introduce
  *"do not write code you do not own"*, and no tracked document may forbid a **named
  person** from touching something. They read `git ls-files '*.md'` — never `find` —
  because the first version used `find`, reported four and twenty violations on a tree
  whose tracked files were clean, and every single match came from `.claude/worktrees/`:
  stale checkouts of this repository sitting inside it, git-ignored, absent from a CI
  checkout. That check would have been **green in CI and red locally**, which is the
  precise inversion of a useful guard. Both strip quoted text first, because this
  repository retires a rule by quoting it, and a check that cannot tell *"we deleted
  this"* from *"we require this"* earns an ignore list within a week.

  **Two more come from §2** — the ratification gate in `docs/decisions/README.md`. §2 puts
  `PRD.md` first and says product decisions live there and nowhere else; `docs/decisions/`
  is the holding area for one the owner has made and nobody has written into the PRD yet.
  A sweep on 2026-08-15 found that **three of the six records do not merely fill a gap in
  the PRD — they contradict it**, which by §2 means the PRD wins and the record loses. The
  sharpest is live on `main` right now: §5 above says `end_time` has **two doors**, and
  `PRD.md:784` still says *"the single exception"*. So one check pins the status
  vocabulary — it is what would have caught `DECIDED in shape`, which three records
  actually wore — and one asserts every unratified record appears in the owner's queue.
  **Neither ratifies anything. Only the owner edits `PRD.md`.**

  The twentieth check is this section: **the count above must equal `EXPECTED` in
  `run.sh`.** It went stale twice in two commits before that existed, which is the whole
  argument — a number maintained by hand in a file nobody re-reads is a number that lies.
- **`negative.sh`** — breaks all 20 rules on purpose and asserts each one is caught. A
  check that stays green while its rule is violated is reported as a **failure of the
  check**. This is not ceremony: it found two real defects in `run.sh` the first time it
  ran. **A guard that cannot fail is worse than no guard.**
- **`ci-coverage.sh`** — asserts the workflow itself is complete. Every suite in `tests/` is
  either named by CI or listed in its allowlist **with a reason**. Write a new test file and
  forget to wire it up, and this goes red. Three suites are on that allowlist today; all
  three need credentials to a real project, and this repository is public (§6).

A fourth now runs beside them, on the planning documents rather than the tree:

- **`tests/v2/graph.check.mjs`** — the V2 dependency graph is **written twice**, as
  `SPEC.md` §4.3's *blocks* column and `TICKETS.md`'s *blocked on* column, and both
  documents also state their own totals in English. This diffs the two copies and recomputes
  every stated number — ticket count, dependency edges, blocking edges, register size, reach,
  and the startable closure. `SPEC.md` already warned that two copies of a graph drift *"in
  the direction that makes the plan look better"* and then claimed they had been reconciled
  *"mechanically"*; that was true once, by hand, and unverifiable by the next reader.
  **The same failure as the stale count above, one directory over: a number maintained by
  hand in a document nobody re-reads.**

  It ran clean on its first execution — all ten stated numbers correct — and the board was
  **still wrong**, because six real blockers (`D-01` §5, now `O25`–`O30`) had no ids, and an
  item with no id appears in neither copy. Three tickets read `blocked on: —` and were
  counted startable; the true figure was four, not seven. **A consistency check cannot see a
  question that was never written down as data**, which is why `README.md` rule 5 — every gap
  carries an id — is a mechanism and not a filing convention.

  It then ran clean a second time over a board where `O11` — *which hosted provider* — was
  recorded as blocking **nothing**, in both copies, in agreement. The agreement was the
  defect: the ticket that belonged in both was in neither, because the work had been reasoned
  off the board with *"a deployment is not a row here."* **Two copies agreeing proves they are
  the same graph, never that it is the right one.** Every figure the check *could* see was
  right and the one sentence beside them that it could not see — *"`O11` reaches none"* — was
  the false one, so the third rule this file now carries is: **if a number is worth writing in
  prose, give it a row the check can reach.**

  That rule lasted about an hour as prose. The change that added `O31`–`O33` stated their
  reach in a paragraph and gave them no rows — the `O11` shape again, in the same file, by
  the session that had just finished writing the lesson down. What caught it was not care:
  it was a **negative probe** mutating a figure and observing that nothing went red. The
  check now enforces the rule instead of relying on it — every `O`-id named anywhere in the
  reach section must be pinned by a table row or by a sentence-level assertion, so adding an
  id to that prose costs a row. **Write the rule in the guard, not only in the guide**; a
  rule that lives only in a document is followed exactly as well as this one was.

- **`tests/governance/workflow.check.mjs`** — the same failure again, in prose this time,
  and about **this file**. §1's seven-step workflow was also written out as a numbered list
  in `TEAM.md` §7 and in `docs/v2/SPEC.md` §5.1: three copies, in agreement, on the day they
  were written. Agreement is the state in which a duplicated list looks harmless, and this
  repository already holds the receipt for what comes next — when the ownership model was
  amended, the amendment had to carry a list of other documents still describing the old one,
  because each had restated it instead of pointing at it.

  The steps are now written **once**, here, and the two restatements are gone; what those
  sections legitimately added — what `ready` means on the V2 board, which lane a surface
  belongs to, what to do when a steward is away — stayed. The check extracts each step's
  distinctive phrasing **from this file** rather than carrying its own copy, so rewording a
  step moves the detector with it, and then refuses to find those phrases in a numbered list
  anywhere else. It also requires every document that discusses the workflow to cite §1 as
  the governing statement.

  Two of its own probes came back **MISSED** before it was committed, and both were real:
  fingerprinting a step by its longest bolded phrase went blind when that one bold was
  removed, and the vacuity guard fired the moment de-duplication succeeded, because the
  detector it depended on had nothing left to detect. **A check is not finished when it
  passes; it is finished when it has been made to fail on purpose.**

That sentence was true of `tests/guards/` and a promise everywhere else. Those two document
checks carry **214 assertions** and, until 2026-08-15, not one committed probe between them —
the probes that found the four defects above lived in `/tmp` and were gone by the next
session. So each now has a counterpart that runs in CI beside it:

> **That figure said `107` until G0A, and it was wrong by half.** It was true when written and
> the graph check grew past it; nothing was watching, because this is the one count in §9 that
> **no check reaches** — `EXPECTED` is pinned in `run.sh`, the guard count is pinned against
> this file, and this number sits between them unpinned. It is therefore the exact defect the
> section it lives in was written about, surviving inside the argument against itself. Pinning
> it means executing both node checks to count them, which `run.sh` must not do — it is the
> seconds-no-Docker job and would run them twice per CI pass. **The fix is a real ticket, not a
> line in this paragraph**, and until it lands this figure is hand-maintained and should be
> distrusted on sight: run the two checks and read their totals.

- **`tests/v2/graph-negative.check.sh`** — 52 probes against `graph.check.mjs`.
- **`tests/governance/workflow-negative.check.sh`** — 16 probes against `workflow.check.mjs`,
  including one per step of the seven-step loop, because a seven-long loop is short enough to
  cover exhaustively and each step's copy is caught by a *different* fingerprint.
- **`tests/lib/negative.sh`** — the shared harness they source. It is a library, refuses to be
  executed, and exists so that the `git checkout --` restore loop and its **trap ordering**
  are written once. That ordering is a safety property, not a style: on 2026-08-15 a trap
  armed one block too early fired on the way out of the refusal that had just declined to
  touch anything, and destroyed uncommitted work. `tests/guards/negative.sh` is deliberately
  **not** converted to use it — rewriting a working safety mechanism for a cosmetic gain is
  the trade this file exists to refuse.

It adds a fourth verdict the original could not express. `CAUGHT` / `MISSED` / `BROKEN` assume
the mutation happened; **`NO-OP` says it did not, and blames the probe.** That is not
hypothetical — during PZ-8 a probe silently failed to edit its second file and reported
`MISSED` against a check that was fine, and a reader chasing it would have "fixed" working
code. A mutation that dirties nothing is now a failure of the suite.

**Each suite's header names what it does not probe, and why.** Three loop families in the
graph suite, and in the governance suite both an assertion whose falsification would mean
untracking a hundred files and a limitation the check states about itself. An unprobed
assertion that is written down is a known gap; an unprobed assertion that is not is a
coverage claim that is quietly false — which is the same defect as the stale count, one level
up, and the reason `ci-coverage.sh` exists at all.

### The rule when a guard goes red and you believe the code is right

**It will happen, and the answer is never an ignore list.** Some of these rules are absolute
(money never touches a float) and some are absolute only until the team decides otherwise.
If a check blocks work that is genuinely correct, the fix is to **change the check in a pull
request**, where the person changing it has to say what decision moved and someone else has
to agree.

> The guard does not stop the change. It stops the **silent** change.

Deleting a check, adding an ignore, or renaming an identifier to slip past a pattern all
make the tree green while removing the only thing watching a rule. Each is a worse outcome
than the red build.

**A concrete instance is already written down**: `docs/decisions/D-01-bid-increment-button.md`
records that the bid control becomes a button carrying a seller-set amount, and the INT-08
audit (`tests/integration/excluded-features.check.sh`) will go red the day a `bid_increment`
column lands — measured, not predicted. The one acceptable response is narrowing it *in the same PR*, together
with a test asserting the server still accepts an amount that is **not** a multiple of the
increment. `BR-32` governs what the server accepts; D-01 governs only what the screen
offers.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
