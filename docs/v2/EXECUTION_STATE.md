# Execution state — the file a new session reads first

**This is not a specification.** The spec is [`SPEC.md`](SPEC.md); the board is
[`TICKETS.md`](TICKETS.md); the durable record of work is GitHub issues and PRs. This file
holds only what those three cannot: *where the run stopped, what it measured, and what to do
next.*

Update it after every ticket or material state transition. Keep it short — if it starts
restating the dependency graph, delete that part and link instead.

---

## Run header

| | |
|---|---|
| **Run id** | `e33684e-20260815T0250` |
| **Last updated** | 2026-08-15, after reading `PRD.md` §20 **inward** against the board — four more crossings, one of them item 6's defect a second time, none decided (`db8f777`) — this file is the commit that follows it |
| **Branch** | `feature/rayan-v2-spec` |
| **HEAD** | `db8f777` + this commit |
| **Base** | **37 commits ahead of `origin/main`** at `db8f777`, and it contains `.github/workflows/ci.yml`, which `main` does not. Everything through `db8f777` **is pushed**; this commit may not be. Push, never force-push — #168 is open and others may be reading it |
| **CI status** | **`static` GREEN on `ubuntu-latest` at `db8f777`** ([run 31870785163](https://github.com/RayanAlDwlah/dallal/actions/runs/31870785163)), reporting `164 passed, 0 failed` and `113 caught, 0 no-op, 113 of 113 reached` — **identical to the macOS figures**, which is the claim worth making given the `grep`-dialect divergence recorded below. **No figure on this page is macOS-only.** **`database` still RED** on the pre-existing #147 (`auth` and `bidding` both pass; `auction` does not), which **PR #155 fixes and only a human can merge**. See the correction under the measurement tables before trusting any green row |
| **Operator** | unattended Claude session, owner asleep, reviewing later |

---

## The one thing to know before running any database test locally

**`supabase/migrations/20260815090000_sec_internal_ids_and_viewer_outcome.sql` is untracked
and protected. Do not stage it, edit it, or delete it — it is the owner's.**

It also **contaminates any local database run made from the working tree**, and it does so
silently, because `tests/*/run.sh` applies *every file in `supabase/migrations/`* rather than
every tracked file. Measured on 2026-08-15:

| where the suite ran | auth | auction | bidding |
|---|---|---|---|
| working tree (10 migrations — includes the untracked one) | **FAILED**, 3 assertions | **FAILED**, **28** assertions, all `42501` | not reached |
| clean `git worktree` (9 migrations — tracked only, = what CI checks out) | **PASSED** | **FAILED, 1** assertion (#147) | **PASSED** |

Twenty-seven of those twenty-eight failures are an artefact of a file CI has never seen. The
migration revokes table-level `SELECT` on `auctions` and `bids` and replaces it with column
grants; an `INSERT … RETURNING` needs `SELECT` on what it returns, so the suite's inserts come
back `42501 insufficient_privilege`. **That is a real finding about that migration** — it is
recorded here, and nothing in this run touches the file.

> **So: run database suites from a detached worktree, never from the working tree.**
>
> ```sh
> git worktree add --detach /tmp/wt <sha>
> ln -sfn "$PWD/node_modules" /tmp/wt/node_modules   # avoid a second npm ci
> cd /tmp/wt && ./tests/auth/run.sh && ./tests/auction/run.sh && ./tests/bidding/run.sh
> ```
>
> A local run that disagrees with CI is the working tree, not CI.

---

## Last known green baseline

`e33684e`, clean worktree, macOS, node v22.18.0, `postgres:17` in Docker:

| suite | result |
|---|---|
| `tests/guards/run.sh` | **PASS** 15/15 |
| `tests/guards/negative.sh` | **PASS** 15 caught / 15 |
| `tests/guards/ci-coverage.sh` | **PASS** 17 suites, 0 unwired |
| *(the three above have since grown — see the next table)* | |
| `tests/integration/excluded-features.check.sh` (INT-08) | **PASS** 17/17 |
| `tests/integration/responsive-375.check.sh` (INT-06 static) | **PASS** 6/6 |
| `tests/auth/run.sh` | **PASS** |
| `tests/bidding/run.sh` | **PASS** — 8/8 rounds, 7 genuinely contended |
| `tests/auction/run.sh` | **FAIL — 1 assertion.** Pre-existing, `main` is red on it, fixed by **#155**. Not introduced by this branch |

**Pre-existing failures, separated as required:** exactly one — #147's
`ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'` in `lib/auctions/validation.ts`, which
stops `tests/auction/image-type.check.mjs` from loading at all.

### Re-measured at `d819d44` — the credential-free half only

The Phase Zero run changed documents, two `.check.mjs` files and `ci.yml`. It touched no
migration and no application code, so **the Docker suites were not re-run and their row above
still stands as measured at `e33684e`.** Saying otherwise would be the exact defect this
project keeps catching.

| suite | at `d819d44` | was |
|---|---|---|
| `tests/guards/run.sh` | **PASS** 20/20, 20 of 20 reached | 15/15 |
| `tests/guards/negative.sh` | **PASS** 20 caught / 20 | 15/15 |
| `tests/guards/ci-coverage.sh` | **PASS** 19 suites, 0 unwired, 11 workflow steps | 17 suites |
| `tests/v2/graph.check.mjs` | **PASS** 93/93 | 57 |
| `tests/governance/workflow.check.mjs` | **PASS** 14/14 | new in PZ-8 |
| `npx tsc --noEmit` | exit 0 | exit 0 |

### Re-measured again at this commit — still the credential-free half only

Same caveat, unchanged and for the same reason: this commit adds two shell suites, one
sourced library, `ci.yml` steps and `CLAUDE.md` §9 prose. **No migration, no application code,
so the Docker rows above were not re-run and are not restated here.**

| suite | at this commit | was at `d819d44` |
|---|---|---|
| `tests/guards/run.sh` | **PASS 20/20 on macOS — and RED IN CI at the same time.** See the correction below; do not read this row as green | 20/20, same inversion |
| `tests/guards/ci-coverage.sh` | **PASS** 21 suites, 0 unwired, 13 workflow steps | 19 suites, 11 steps |
| `tests/v2/graph.check.mjs` | **PASS** 93/93 | 93/93 |
| `tests/v2/graph-negative.check.sh` | **PASS** 52 caught / 52, 0 no-op | new |
| `tests/governance/workflow.check.mjs` | **PASS** 14/14 | 14/14 |
| `tests/governance/workflow-negative.check.sh` | **PASS** 16 caught / 16, 0 no-op | new |
| `tests/integration/excluded-features.check.sh` | **PASS** 17/17 | not re-run |
| `tests/integration/responsive-375.check.sh` | **PASS** | not re-run |
| `tests/realtime/ux-rules.check.mjs` | **PASS** 14/14 | not re-run |
| `npm run lint` | 0 errors, **6 pre-existing warnings** | not re-run |
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run build` | exit 0 | not re-run |

**`tests/guards/negative.sh` is run after the commit, not before it** — and so are the two new
suites when their surface includes a file being edited. All three refuse a dirty tree by
design, and `workflow-negative.check.sh` declares `CLAUDE.md` in its surface, so it cannot run
in the same breath as an edit to §9. Sequence: edit → run everything that tolerates a dirty
tree → commit → run the three refusers. Its result at this commit is in the commit message.

### CORRECTION at `f4ff6f1` — the two tables above are local runs, and one of them was wrong

Written after the fact, deliberately as an amendment rather than an edit of the rows, because
the rows are what a reader would otherwise have believed.

**1. `run.sh` was green here and red in CI the whole time, and this file said only the first
half.** Both tables report `tests/guards/run.sh` **PASS 20/20**. That is a true statement about
macOS and a false impression overall: the same suite failed in CI on **every** push from
`03217f7` onward, on

```
FAIL every decision record declares one of the three defined statuses  got=6 want=0
```

The R-A check used a backslash-escaped tab in a `grep -E` pattern. GNU grep's ERE has no such
escape and reads it as a literal `t`, so nothing matched, `-cv` counted all six records, and
the check reported six violations against a tree with none. macOS grep — BSD *and* the ugrep
shim — honours the escape and returns zero. Verified against the CI runs at `08bd3ba` and
`aa8b70d`: **the failure predates the push of the negative suites and came from my own PZ-1
commit.** Fixed at `f4ff6f1` with a field comparison in awk, plus a new check #21 for the class.

**2. The two new negative suites have never executed on Linux.** `static` runs the guards
first and fail-fast is deliberate there, so every run so far aborted at step 1 and **the steps
added for `graph-negative.check.sh` and `workflow-negative.check.sh` were skipped, not passed.**
Their `PASS 52/52` and `PASS 16/16` rows are macOS-only. The next CI run is the first that can
say anything about them, and given that the defect being corrected here is precisely a
macOS-vs-GNU divergence, those two rows carry less weight than they look like they do.

**3. Check #21 itself could not fire when it was committed.** It was written as
`awk -v n="$BS"t`, and POSIX awk runs escape processing on a `-v` assignment, so the needle was
a literal tab. It was hunting real tab characters and reported PASS. That is the same class of
bug it was written to catch, one tool over — and unlike instance 1 it was green in *both*
environments, so no CI run would ever have surfaced it. It was found by writing the negative
probe, which is the case for the doctrine rather than an anecdote about it.

**What this costs the tables above:** every `PASS` in them is a macOS measurement. Instance 1
shows that is not the same as green, and instance 3 shows a positive run in *both* environments
still is not proof. Rows for the three refuser suites are the ones to trust least until CI has
run them, because they are the newest and the least travelled.

At `f4ff6f1`, on macOS: `run.sh` **21/21**, `negative.sh` **21 caught / 21**,
`graph-negative` **52/52, 0 no-op**, `workflow-negative` **16/16, 0 no-op**. 89 probes.

### Now observed on Linux — run [31866268505](https://github.com/RayanAlDwlah/dallal/actions/runs/31866268505), at `5fee651`

**`static` is GREEN for the first time since the job was written.** Every one of its fifteen
steps passed, and the four steps added for the new suites *executed* rather than being skipped
behind a fail-fast. Read off the CI log, ubuntu-latest, GNU grep, node 22:

| suite | Linux | macOS |
|---|---|---|
| `tests/guards/run.sh` | 21 passed, 0 failed, **21 of 21 reached** | 21/21 |
| `tests/guards/negative.sh` | **21 caught**, 0 not caught, 21 of 21 reached | 21/21 |
| `tests/v2/graph-negative.check.sh` | **52 caught**, 0 not caught, **0 no-op**, 52 of 52 | 52/52 |
| `tests/governance/workflow-negative.check.sh` | **16 caught**, 0 not caught, **0 no-op**, 16 of 16 | 16/16 |
| INT-08 / INT-06 | 17/17, 6/6 | same |

The *reached* counts are quoted deliberately: a suite reporting "0 failed" while reaching 3 of
52 probes is the #121 shape, and these do not have it. **89 probes now agree across both greps**,
which is the specific thing points 1–3 above said was missing.

**`database` is still red, and not on anything from this branch.** `auth` passed, `bidding`
passed — the extension cap, the lock ordering and the money domain all proved on PostgreSQL 17 —
and `auction` failed on the pre-existing `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'
imported from lib/auctions/validation.ts`. That is **#147**, fixed by **PR #155**, which needs a
human to lift `@Dem4t`'s stale CHANGES_REQUESTED and merge. It is the last thing standing
between this branch and a fully green board, and **an unattended session cannot do it.**

That `bidding` reported at all is the `if: !cancelled()` guard earning its place: under
fail-fast this run would have skipped the suite that proves the bidding invariants and looked
complete while saying nothing about them.

---

## Environment

| capability | state |
|---|---|
| repo read/write, `git push` | **yes** — `origin` over SSH |
| `gh` auth | **yes** — `RayanAlDwlah`, scopes `repo`, `read:org`, `gist`, `admin:public_key` |
| repo permissions | `admin=true push=true` |
| node / npm | v22.18.0 / 10.9.3, `node_modules` present (297 pkgs) |
| Docker + `postgres:17` | **yes**, image cached locally |
| `supabase` CLI | 2.114.0 |
| `psql` on PATH | **no** — irrelevant; the suites use `docker exec` |
| `timeout(1)` | **no** (BSD userland; use no timeout or `gtimeout`) |
| `vercel` CLI | **not installed** |
| Vercel deployments | **rate-limited** — `api-deployments-free-per-day`, retry after ~24 h. Every PR's Vercel check is red for this reason and it is **not** a code signal |
| Chrome / browser verification | available, but **no preview to point it at** while Vercel is rate-limited; `npm run dev` against `.env.local` is the fallback |

**Environment variable names** referenced by the code — *names only, never values, never
printed, never committed*: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DALAL_BASE_URL`, `DALAL_TEST_EMAIL`,
`DALAL_TEST_PASSWORD`, `DALAL_E2E_CONFIRM_WRITES`, `NODE_ENV`.
`.env.local` exists locally and is **not tracked** (`git ls-files` shows only `.env.example`)
— `CLAUDE.md` §6 holds. **This run does not read it, source it, or echo it.**

---

## Branch protection — this constrains the merge policy, so it is written down

`main`: **1 approving review required**, and **`enforce_admins: true`**. No required status
check contexts are configured.

Two consequences the operator must not work around:

1. **A session cannot merge its own work.** Admin does not bypass this, by design
   (`CLAUDE.md` §7 — no direct pushes from anyone, including the owner).
2. **CI is not a *required* check**, so a green `static` job does not gate the button. The
   discipline has to come from the PR body carrying the evidence, which is why every PR here
   does.

---

## Open pull requests

| PR | branch | state | blocking fact |
|---|---|---|---|
| [#168](https://github.com/RayanAlDwlah/dallal/pull/168) | `feature/rayan-v2-spec` | open, awaiting owner | the V2 spec, board and governance. `static` green, `database` red **only** on #147 |
| [#167](https://github.com/RayanAlDwlah/dallal/pull/167) | `feature/rayan-guards` | open | CI + the guard suite. `#168` is stacked on it |
| [#165](https://github.com/RayanAlDwlah/dallal/pull/165) | `fix/rayan-plan-sc74-stale` | open | docs-only; only check is the rate-limited Vercel one |
| [#155](https://github.com/RayanAlDwlah/dallal/pull/155) | `fix/mohammed-check-import-alias` | open, **approved by `@RayanAlDwlah` 2026-08-15**; `reviewDecision` is still `CHANGES_REQUESTED` because **`@Dem4t`'s** block from 2026-08-14 is undismissed | this is `V2-00`, and it is what makes `main` green |

### #155 — both blocks are answered by measurement; one needs a human to lift

There were **two** requested changes on this PR, and they are different faults. Only one of
them was mine.

**Mine (`@RayanAlDwlah`, already dismissed).** Check 3 of
`tests/integration/check-imports.check.sh` was **vacuous on macOS**: it used `grep -P`, which
BSD does not have, so it reported `PASS (0)` on a tree where the bug was present. `@m7ya505`
replaced it with three `-E` passes.

**`@Dem4t`'s (still open, and it is the one holding `reviewDecision`).** The fix removed the
`@/lib/money` alias but left the path extensionless, and node's ESM resolver does not infer
extensions — so `lib/auctions/validation.ts:40` still did not resolve. He also made the
sharper point that the guard measured the **spelling** of the fix, not its **effect**, and
would pass a tree where the module still fails to load.

Re-measured at `356704f`, in a detached worktree, macOS, node v22.18.0 — on 2026-08-15, not
read off the diff:

```
lib/auctions/validation.ts:40   import { isSar } from "../money.ts";   ← his two characters
tests/auction/image-type.check.mjs          27 passed, 0 failed, 27 of 27 reached, exit 0
tests/integration/check-imports.check.sh    3 passed, 0 failed
tests/auction/run.sh          (postgres:17)  SUITE PASSED               (was: 1 failing)
```

and both broken shapes reinstated as falsification probes:

| probe | `every discovered check loads` | `no VALUE @/ import` |
|---|---|---|
| `@/lib/money` — #136's alias bug | **FAIL** got=8 want=9 | **FAIL** got=1 want=0 |
| `../money` — extensionless, the shape `@Dem4t` said would slip through | **FAIL** got=8 want=9 | PASS (0) |

Read the second row: the spelling check **passes** and the effect check **fails**. That is
exactly the case he named, and it no longer survives — because the guard now imports every
discovered `*.check.mjs` rather than grepping for a pattern.

**Both blocks are answered on the evidence. This run approved the PR and re-requested
`@Dem4t`, and deliberately did *not* dismiss his review** — lifting another reviewer's block
is a human's call, not an unattended session's, and the merge needs a human anyway.

---

## Current queue

**Phase Zero is complete.** All eight items are done and committed; none was closed by
declaring it out of scope.

| item | outcome | commit |
|---|---|---|
| **PZ-1** ratification gate | `docs/decisions/README.md` gains the R register; three records were found to *contradict* `PRD.md`, not merely extend it | `03217f7` |
| **PZ-2** D-01's six decisions | raised as `O25`–`O30`; three tickets that read `blocked on: —` were not startable | `8319b20` |
| **PZ-3** ownership / personal-branch text | swept; the amendment's stale-document list was itself a closed list and is now open-ended | `f407862` |
| **PZ-4** "7/12 startable" | *unblocked* / *ready* / *wave* separated; the true figure was **4**, not 7 | `08f64ae` |
| **PZ-5** production AI deliverable | `O11` blocked **nothing** in both copies of the graph, in agreement; `V2-A20` created | `52f920b` |
| **PZ-6** pause and subsequent lots | pause is `DECIDED` and has three holes — `O31`, `O32`, `O33`. `O33` is **two owner sentences from the same day disagreeing** (lot vs session) | `27f4415` |
| **PZ-7** percentile bounds | `O34` raised; four stale header/glossary numbers found that predated it | `96bb137` |
| **PZ-8** duplicated sources | the graph half was already closed by `graph.check.mjs`; the workflow was written **three times** and is now written once, with a new check | `d819d44` |

**Ready next, in order:**

1. ~~**Push `feature/rayan-v2-spec`**~~ — **done**, `08bd3ba`. Push, never force-push: #168 is
   open and others may be reading it.
2. ~~Measure #155 against both blocks and approve it~~ — **done**, see above. What is left on
   it is one human action: dismiss `@Dem4t`'s review, or have him re-review, then merge.
3. ~~**A committed negative suite for `graph.check.mjs` and `workflow.check.mjs`**~~ — **done.**
   `tests/v2/graph-negative.check.sh` (52 probes), `tests/governance/workflow-negative.check.sh`
   (16), and the shared `tests/lib/negative.sh` they source; both wired into `ci.yml`, which
   `ci-coverage.sh` had already gone red about — **21 suites, 0 unwired**. All 68 probes CAUGHT
   on the first run, which is the result that deserves the least trust, so the harness was
   itself meta-probed: a mutation that changes nothing reports **NO-OP**, a label no check
   prints reports **BROKEN**, and an unwatched edit reports **MISSED**. It discriminates all
   four, so the 68 are signal. Each suite's header names what it does **not** probe.
4. ~~**Adversarial re-read of the board itself, before it becomes issues**~~ — **done**,
   `d1d8c2e`..`e87a170`. It found that the board could only write half of `ready`. See the
   section below.
5. ~~**Adversarial re-read of the D-0x records against `PRD.md`**~~ — **done**,
   `bb4161a`..`7e4fd90`. It found `PRD.md` §19.2, an excluded table **no record cites**, which
   excludes three things V2 builds by name. The blockquote has three questions now, not two.
   Posted on #168 as
   [`#issuecomment-5300954926`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5300954926).
   See the §19.2 section below.
6. ~~**The same read run inward — §19 and §22 against what V2 builds**~~ — **done**, `02feda4`.
   The sweep item that was in the fallback queue below, promoted because item 5 named its own
   blind spot. Three more crossings — image *editing* (`:1917`, two rows from the one `R2`
   cites), the professional-seller lines (`:1886`, A-U1 at `:1930`) and the deposit against
   SC-67 (`:1813`) — plus two more specific lines for item 1. **The blockquote has six
   questions now, not three.** Nothing reclassified. Posted on #168 as
   [`#issuecomment-5301005402`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301005402).
   See the inward-sweep section below.
7. ~~**§20's assumption rows, read the same way**~~ — **done**, `db8f777`. Four more crossings
   (`:1949` A-A5, `:1945` A-A1, `:1978` A-I4, `:1952` A-A8) and **one negative result recorded
   on purpose** (`:1936` A-U7 — checked, does not break). **The blockquote has seven questions
   now, not six**, and item 7 is item 6's defect a second time: `R5` and `R6` were both
   classified *silent → gap-filling → safe* by searching `PRD.md` for a **word**, when the PRD
   excludes the *function*. Nothing reclassified. Posted on #168 as
   [`#issuecomment-5301053151`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301053151).
   See the §20 section below.
8. Only then create the V2 issues.

**Blocked, with the reason:**

- **All 40 V2 tickets** — the board is not to be turned into issues until #168 is internally
  consistent and owner-approved. The owner said so explicitly.
- **`V2-00`** — needs a human to merge #155; protection forbids a self-merge.
- **Six tickets behind an unanswered question raised by this run** — `V2-A4` (`O14`, `O34`),
  `V2-A19` (`O31`, `O32`, `O33`), `V2-A20` (`O11`), `V2-C3`/`V2-A3`/`V2-B5` (`O25`–`O30`). The
  register is at **34 open items**, all 34 blocking at least one ticket. **None of them was
  answered by this run**, by design — `CLAUDE.md` §8, `TEAM.md` rule 16.

**Fallback queue** (independent, safe, needs no unblocking) — used the moment the above
stalls: the #168 corrective items; documentation-consistency sweeps; re-verifying `#165`; and
the research passes behind `O14` and `O24` that produce *options* rather than decisions.

> **The inward sweep of §19 and §22 has also come off this list, because it ran** — that is
> item 6 above, and it found three more crossings. What it leaves behind is a narrower and
> less promising question, recorded so the next session does not re-run the broad one thinking
> it is new: **§19.3, §19.4, §19.7 and §19.8 were read and produced nothing.** No V2 ticket
> builds notifications, messaging, ratings, a native app, multi-language, multi-currency, MFA
> or OAuth. §19.6's *admin dashboard* row was considered and rejected as a finding — a host
> controlling their **own** session is a seller power, not platform administration, and §4.3
> is about the latter. That judgement is the one most worth a second reader's eye, since it is
> the only place the sweep decided a row did *not* apply rather than surfacing it.
>
> **§20 has since come off this list too** — that is item 7 above, and the guess that a sweep
> of assumptions "will likely be quieter" was **wrong**: it produced four crossings to §19/§22's
> three, and the largest single finding of either sweep (item 7, the keyword-classification
> defect). Recorded because the guess is the kind that talks a later session out of running
> something. What §20 leaves behind: its remaining assumption rows were read and cross nothing
> this board builds, and `:1936` A-U7 was checked and **does not** break — a company hosting a
> room is the case that would, so it is named rather than dropped.
>
> The remaining unread surface is **§21**. It is a sweep, not a decision, so it is safe to run
> unattended; anything it finds is a blockquote question, never a reclassification.

---

## The adversarial re-read of the board — what it found, at `e87a170`

**`ready` has two halves and the board could only write one.** It could say a ticket was
*unblocked* — no open owner question anywhere in its dependency chain. It had no column for
*cleared* — no **unratified contradiction of `PRD.md`** anywhere in that chain. Those are
different gates, and the second one is not an invention of this run: `docs/decisions/
README.md:82` already records the precedence rule that makes it real — *"The owner ratifies,
or nothing is safe."* Six decisions sit in that state as `R1`–`R6`, and the register even
forbids the shortcut of folding them into the `O` register (line 89).

So the fix is a **sixth column**, not a seventh `O`-id. Ten tickets carry an `R` directly.

**Every figure already in the board was correct.** That was measured with a scratch script
before a word of the new prose was written, and it overturned the prediction — the expectation
was degenerate sentences like "4 → 4, nothing released". The actual defect is subtler and
worse: two figures were **load-bearing for a precondition nobody had written down.**
*"Answering `O1`+`O2` moves the unblocked set 4 → 9"* is right **given `R1` is ratified**, and
nothing said so.

| measured | figure |
|---|---|
| tickets downstream of at least one unratified decision | **36 of 40** |
| the four that are not | `V2-A14`, `V2-B1`, `V2-B2`, `V2-B3` — **the same four that are unblocked** |
| unblocked tickets held by ratification alone **today** | **zero** — which is why nothing is stuck yet |
| the same figure once `O1` and `O2` are answered | **five**, all unblocked, **none ready**, all waiting on one signature |

**This is the D-01 failure one register over**, in the same week this board wrote D-01's up:
there the questions had no ids, here the ids had no column.

### The second finding — one document over

`docs/decisions/README.md` summarised its own `conflict?` column in prose and said **three**
records contradict the PRD, next to a table with **four** non-`no` rows. Neither number was
false: `R4`'s cell reads *depends on an open item*, so "three" is true of the direct ones. It
survived because the sentence answered a narrower question than the paragraph around it asked
— and `TICKETS.md` gates three tickets on `R4`, so the two documents disagreed about how many
decisions were holding work, one of them by omission. Now stated as three direct + one
conditional, with five assertions re-deriving both lists from the table.

### Verification, and the three defects the probes found that reading did not

| suite | at `e87a170` | was |
|---|---|---|
| `tests/v2/graph.check.mjs` | **PASS 143/143** | 93 |
| `tests/v2/graph-negative.check.sh` | **PASS 88 caught / 88, 0 no-op** | 52 |
| `tests/guards/run.sh` / `negative.sh` | **PASS 21/21**, **21 caught / 21** | same |
| `tests/guards/ci-coverage.sh` | **PASS** 21 suites, 0 unwired | same |
| `tests/governance/workflow{,-negative}` | **PASS 14/14**, **16 caught / 16** | same |
| INT-08 / INT-06 static / the three realtime checks | **PASS** 17/17, 6/6, 20/20 + 14/14 + 12/12 | same |
| `npm run lint` / `typecheck` / `build` | 0 errors (4 pre-existing warnings) / exit 0 / exit 0 | same |

**No migration and no application code changed, so the Docker rows earlier in this file were
not re-run and are not restated.**

**Confirmed on Linux**, and not only on the machine that wrote the checks. Run
[31868139055](https://github.com/RayanAlDwlah/dallal/actions/runs/31868139055) at `5df7337` —
`static` **GREEN** on ubuntu-latest, GNU grep, node 22, with counts identical to the macOS
column above. Its predecessor [31868067024](https://github.com/RayanAlDwlah/dallal/actions/runs/31868067024)
at `e87a170` measured the same, which is what makes the pair worth citing: the numbers did not
move when the platform did.

```
guards                    21 passed, 0 failed, 21 of 21 checks reached
guards — negative         21 caught, 0 not caught, 21 of 21 probes reached
V2 — graph.check.mjs      143 passed, 0 failed
V2 — graph-negative       88 caught, 0 not caught (0 no-op), 88 of 88 probes reached
governance                14 passed / 16 caught of 16
INT-08 / INT-06           17 of 17 / 6 of 6
```

The *reached* counts matter more than the *failed* ones: a suite reporting "0 failed" while
reaching 3 of 88 probes is the #121 shape.

`database` is red, and it is red for a reason that is not this branch's: **one** assertion, in
`auction`, `AUC-04 — image type by content (node)`, failing
`ERR_MODULE_NOT_FOUND: Cannot find package '@/lib' imported from lib/auctions/validation.ts`.
That is #147 exactly, and PR #155 already fixes it. `auth` and `bidding` passed whole. The
branch touches no migration and no application code, so there is no mechanism by which it could
have caused this — but "it must be pre-existing" is the sentence this project keeps getting
wrong, so the failing assertion was read by name rather than inferred from the job colour.

Three defects, none of them found by reading:

1. **The pin rule was nearly unfallible.** It auto-exempted `R5`/`R6` because they conflict
   with nothing, which left it able to catch only ids that two other assertions already
   caught. Deleted the exemption; `R5`/`R6` are now pinned through an asserted sentence.
2. **Three new labels silently disarmed two working probes.** `neg_probe` finds a check with
   `grep -F -- "$label" | head -1`, so a label that *contains* an earlier one and prints after
   it answers for it. Adding three `…, restated` labels turned two probes from CAUGHT to
   MISSED with neither check touched. A new assertion now forbids the shape, and it
   immediately found more than the two already known — including the generated `reach of On`
   family, where `O2` is a prefix of `O20`..`O29` and nine labels answered for one.
3. **The same symptom, arriving through the shell.** The delimiter added to fix (2) was
   written in double quotes, so the shell ran command substitution and the label reached
   `neg_probe` as `"reach of "`. Single quotes. `word2num("fourth")` returning null is a
   fourth, smaller instance: the draft wrote a count as an ordinal, which reads fine and
   cannot be checked.

**Two questions were surfaced and deliberately not answered** (`TEAM.md` rule 16). Both are in
the closing blockquote of `TICKETS.md`'s ratification section:

- `PRD.md:411` puts **search** out of scope and no `R` item covers it. `V2-C8`/`V2-A17`/`V2-A8`
  inherit `R1` through `V2-C1`, which is a weaker claim than the one that may be needed.
- Does `R3` reach `V2-A11`/`V2-A12`? Measured at **1 → 3** on a throwaway copy of the board;
  the edit was discarded, and an assertion proves it was discarded.

### `PRD.md` §19.2, at `7e4fd90` — and why the sweep above did not find it

**There are three questions now, not two, and the second one's stated reason was false.**

The `R` register was built by reading each `D-0x` record **outward** to the PRD sections it
cites. §19.2 — *Advanced auction mechanics* — is cited by **no record**, so nothing led a
reader there. `grep -rn '19\.2' docs/v2/ docs/decisions/` returns only the `BR-36` worked
example. Reading records outward can only ever find what a record already points at; the
exclusion table is the one place a **missing** pointer is the finding.

| | `PRD.md` | the row, quoted |
|---|---|---|
| scheduled starts | `:1846` | **Scheduled future start times** — *"Adds a third lifecycle state with no MVP demand"* |
| lots | `:1847` | **Multiple quantity / lots** — *"A fundamentally different auction model"* |
| increments | `:1848` | **Bid increments of any kind, per-auction or platform-wide** — *"Decided against entirely (BR-32)"* |

`D-03` §1 gives a session a **start date and time** and §Step 2 is titled *the lots, in order*.
The board had classified those as **silence** — `R5`/`R6`-shaped, gap-filling, safe to build
under rule 4. They are two named exclusions, which is `R3`'s shape. On the wide reading
(carriers `V2-C6`, `V2-A10`, `V2-A11`, `V2-A12`, `V2-B9`, `V2-B10`) **`R3`'s reach goes
1 → 9** — third-largest gate rather than smallest. Measured on a throwaway copy; discarded;
the discard is asserted.

`:1848` is the same question for `D-01`'s button, and it bears on `R4`'s **classification**
rather than its parameters: `R4` is conditional on `O25` (required or optional field), but if
`:1848` binds, the prior question is whether the field exists at all. INT-08 is already the
tripwire — it goes red the day a `bid_increment` column lands.

**Nothing was re-scoped and no `R` was reclassified.** All three are questions in the
blockquote, with both readings and their numbers, for the owner. What did land is the
mechanism that would have caught it: every `PRD.md:NNN` citation in the three documents (23 of
them) is resolved against the file, the three §19.2 rows must still carry the text quoted
beside their numbers, and `TICKETS.md` must still cite all three — dropping a citation is how
a finding gets un-found.

`PRD.md` is read and never written, and it is **not** in the negative suite's `neg_files`
either. Its probe breaks the checker's expectation instead, so an interrupted probe run cannot
leave the file the owner ratifies in a broken state.

```
V2 — graph.check.mjs      163 passed, 0 failed          (143 at e87a170)
V2 — graph-negative       108 caught, 0 not caught (0 no-op), 108 of 108 reached   (88)
guards                    21 passed / 21 caught / ci-coverage 21 suites, 0 unwired
governance                14 passed / 16 caught of 16
INT-08                    17 passed, 17 of 17 reached
lint / typecheck          0 errors (4 pre-existing warnings) / exit 0
```

**Confirmed on Linux**, not just here: `static` is green at `7e4fd90`
([run 31869670980](https://github.com/RayanAlDwlah/dallal/actions/runs/31869670980)) reporting
`163 passed, 0 failed` and `108 caught, 0 not caught (0 no-op), 108 of 108 probes reached` —
identical to the macOS figures above. That agreement is the point of citing both: the
`grep`-dialect divergence recorded further up this file is exactly the kind of thing that makes
a probe count differ between the two, and here it did not.

**Both probe failures on the way were defects in the probe, not in the check** — which is the
usual direction and the reason the suite is run rather than read:

- **NO-OP** — `wider reading #1 — the hypothetical was discarded`. The mutation hard-coded two
  spaces of indentation to find the restore line; moving that line into the new loop put it one
  level deeper and the mutation matched nothing. The checker was fine. What had stopped working
  was the only evidence that its self-honesty assertion could ever fail.
- **MISSED** — `TICKETS.md still cites all three §19.2 exclusion rows`. The mutation removed
  `PRD.md:1848` and the check stayed green, because the same row is cited again six lines later
  as a bare `:1848`. The check was right; the probe was aimed at one of two doors.

A third, caught before commit: `SPEC.slice(indexOf("### 4.0 "), indexOf("### 4.1 "))` with a
weak guard. A renamed §4.1 makes `indexOf` return `-1`, and `slice` reads `-1` as *one from the
end* rather than raising — the slice silently widens to most of the file and the check passes
for an unrelated reason. Both bounds are now asserted, in order, before the slice is used.

### The same read run inward, at `02feda4` — §19 and §22 against what V2 builds

The §19.2 finding above named its own cause: the `R` register was built by reading each record
**outward** to the lines it cites, so a row **no record cites is unreachable by construction**.
That is a defect in the method, not in anyone's attention, and the remedy is to run the method
backwards — every `§19` exclusion row and every `§22` future row, asked *which V2 ticket builds
this?*

Three more crossings. All three are **adjacent to rows the register already had**, which is
exactly what an outward read predicts and is the strongest evidence the diagnosis was right:

| # | the row nobody cited | what builds it | why it was missed |
|---|---|---|---|
| 4 | `PRD.md:1917` — **Image editing / cropping** | `V2-C7`, `V2-A14`, `V2-A15`, `V2-A16`, `V2-B12`; D-04 feature 2 crops and relights | `R2` cites `:1915`, **two rows above it**. `SPEC.md:203` decided "in scope" without the row in front of it. `:1917` also has **no §22 twin** — excluded and not even filed as future |
| 5 | `PRD.md:1886` — **Bulk listing / seller tools**, *"professional sellers are not a target user"*; and `:1930` **A-U1**, *"users are individuals, not businesses"* | phase 4's host control room — `V2-A10`, `A11`, `A12`, `B9`, `B10`, `B11` | item 2's question with different citations. A-U1 is an **assumption** row, not an exclusion, so ratifying it is a different act and one does not cover the other |
| 6 | `PRD.md:1806` **wallets or stored balances**, `:1825` **escrow**, `:1813` **SC-67** — *"no screen … offers or **implies**"* | `V2-A13`, `V2-B10` — a بدون · 25 · 50 · 100 · 500 chooser to enter a hall | `R6` reads *"silent. Zero occurrences of 'deposit'"* — true of the **word**, reached by keyword search. D-05 §2 answers "no money moves", which answers §19.1, not the verb SC-67 uses |

Item 1 also gained the two lines more specific than the `:411` it already quoted: `:1875`
excludes faceted filtering outright, `:2134` files it as Phase 5, and `V2-A17`'s own title is
four facets.

**Nothing was reclassified and no `R` moved.** All six are questions in the blockquote. The
precedent for what ratifying any of them looks like was already on the record and is now named
in the board: when `BR-36` reversed anti-sniping, `docs/decisions/README.md:145` notes **§19.2
and §22.1 were both un-marked** — exclusion row *and* future row, one change.

The pinned-row list went **3 → 12**, so every line these arguments rest on is resolved against
`PRD.md`, must still carry the text quoted beside it, and must still be cited by `TICKETS.md`.
SC-67 got its own assertion because it is a sentence rather than a table row and item 6 turns
on one verb in it.

**Both labels lost their embedded count**, and this is the first time that rule paid. *"the
three §19.2 exclusion rows"* renames itself the moment the list grows; the probe then matches
no line and the suite reports **NO-OP instead of the catch it made**. The rule was learned one
commit earlier on the wider-reading assertions — this list going 3 → 12 is precisely the event
it was written for.

```
V2 — graph.check.mjs   164 passed, 0 failed                                    (163)
V2 — graph-negative    111 caught, 0 not caught (0 no-op), 111 of 111 reached  (108)
```

**No probe defect this time** — five new probes, all CAUGHT on the first run, against two of
the previous three. The difference is not luck: the two probes that failed last commit failed
because a mutation was aimed at a moving target (an indentation level, one of two citation
sites). These were written after that, and the two aimed at the 12-entry list deliberately hit
**different tuples** — a shared loop body means one probe on one tuple is not evidence for the
other eleven.

### §20 read the same way, at `db8f777` — and item 6's defect found a second time

§19 and §22 are exclusions. **§20 is assumptions**, and no `D-0x` record cites a single one of
them — so the outward read could not reach §20 either. Same method, next surface.

| # | the assumption nobody cited | what builds it |
|---|---|---|
| 2 | `:1949` **A-A5** — *"Auctions become live immediately on creation; nobody needs to schedule a future start"* | D-03 §1 gives a session a start date and time |
| 2 | `:1945` **A-A1** — *"An auction sells exactly one item, in one quantity"* | D-03 §Step 2, *the lots, in order*. The weaker of the two: a session holds many lots, each still one item |
| 4 | `:1978` **A-I4** — *"no in-product editing is needed"* | D-04 feature 2 crops and relights. This is the belief `:1917` rests on |
| 4 | `:1975` **A-I1** — *"One image per auction is sufficient"* | D-06, which already reverses it |
| **7** | `:1952` **A-A8** — *"Sellers will write their own descriptions and provide their own images"* | D-04 feature 1 — `V2-A7`, `V2-B8` |

**An assumption is not an exclusion and ratifying it is a different act.** An exclusion says *we
chose not to build this*; an assumption says *we believe nobody wants it*. `A-U9` and `A-B6` are
the precedent — retired in place when their decisions moved. The BR-36 precedent already
required un-marking §19.2 **and** §22.1 together; §20 adds a third thing to retire, and the
board now says so.

**One negative result is written down deliberately.** `:1936` — **A-U7**, *"no separate account
types are needed"* — was checked and does **not** appear to break: a host is a role held over a
session, not a kind of user. It is recorded because a company hosting a room is the case that
*would* break it. A negative result that is not written down gets re-derived by every session
that follows, or worse, silently assumed to have been checked.

**Item 7 is not a new defect — it is item 6's, one row over.** `R5` says *"silent. Zero
occurrences of 'AI'"*; `R6` says *"silent. Zero occurrences of 'deposit'"*. Both true of the
word. Both reached by **searching `PRD.md` for a keyword, and the keyword is the wrong unit of
meaning** — the PRD excludes the *function*, not the technology. Neither makes the feature
wrong; the owner decided all five, twice. Both make **rule 4 the wrong justification**. If both
bind, the split goes from four conflicting records to **six**.

```
V2 — graph.check.mjs   164 passed, 0 failed                                    (unchanged)
V2 — graph-negative    113 caught, 0 not caught (0 no-op), 113 of 113 reached  (111)
```

`graph.check.mjs` stayed at 164 because six tuples were added to a list, not six `chk` calls —
worth stating, since an unchanged assertion count next to a claim of new coverage is exactly the
shape that should draw suspicion. The coverage moved in the **pinned-row list**, `12 → 18`, and
in the probe count.

**Two probes were re-aimed, and that is a recurring cost now named in the header.** Both name the
current count (`Six`→`Seven` became `Seven`→`Eight`; the numbering probe retargeted item 6 → 7).
They go stale every time the blockquote grows. The tax is paid on purpose: a probe that mutated
*whatever number it found* would pass for the wrong reason on the day the count is already wrong.

**Two probes added, not six — probe-per-KIND, not probe-per-row.** The rule from last commit
("one tuple is not evidence for eleven others") does not extend to one probe per tuple against a
one-line shared loop; eighteen would be theatre. The line drawn instead: the existing two aim at
§19/§22 **exclusion table rows**, the new one at a §20 **assumption row** — a different table and
a different sentence shape. The second new probe closes a gap in the *pattern* rather than the
document: it mutates the bare `` `:1949` `` citation form, a **different alternative of the
citation regex** than the long `` `PRD.md:1806` `` form the existing probe uses. That is the
same one-of-two-doors mistake the `:1848` probe made once already, relocated.

**Linux caught up, and then confirmed this commit too.** `static` was green on `ubuntu-latest`
at `02feda4` reporting `164 passed` / `111 caught`, and green again at `db8f777`
([run 31870785163](https://github.com/RayanAlDwlah/dallal/actions/runs/31870785163)) reporting
`164 passed, 0 failed` and `113 caught, 0 not caught (0 no-op), 113 of 113 probes reached` —
both pairs identical to macOS. **No figure on this page is macOS-only any more.** That is worth
one sentence rather than a shrug: this file already records a `grep`-dialect divergence that made
a suite pass locally and go red in CI, and a probe count is exactly the quantity such a
divergence moves.

**What §20 did *not* produce, so nobody re-runs it:** the remaining assumption rows in §20 were
read and cross nothing this board builds. §21 is the next unread surface, and it has not been
started.

---

## Decisions and assumptions made by this run

| id | what | evidence | reversible? |
|---|---|---|---|
| — | Run database suites from a detached worktree rather than the working tree | the 28-vs-1 measurement above | yes, it is a procedure |
| — | Treat the red Vercel check on #155/#165/#167/#168 as **not a code signal** | Vercel returned `api-deployments-free-per-day`, "try again in 24 hours" | yes |
| — | `PRD.md` is **not touched** by this run | owner: "the owner will ratify it manually" | n/a |
| — | The untracked migration is **never staged and never edited** | `git status` shows it untracked at every commit in this run | n/a |
| — | Every board number is **machine-derived**, never hand-counted | `tests/v2/graph.check.mjs`, 164 assertions | it is a procedure |
| — | `PRD.md` is not a **mutation surface** either — not even for a probe that would restore it | an interrupted run must not be able to leave the file the owner ratifies broken; the probe breaks the checker's expectation instead | it is a procedure |
| — | An **unratified decision blocks a ticket**, exactly as an unanswered question does | not invented here: `docs/decisions/README.md:82` already records the precedence rule, and `CLAUDE.md` §2 already orders the sources. The **`R`→ticket mapping** is judgment, and the rule used is stated in prose for the owner to correct | yes — it is a column, and the owner ratifying anything empties it |
| — | A new check is not trusted until a **negative probe** makes it fail | four real check defects found this way, two of them in PZ-8 | it is a procedure |

**No product decision was invented.** Every unresolved one is an `O`-id in
[`SPEC.md` §4.3](SPEC.md).

---

## How to resume

```sh
cd /Users/ry7vv/Documents/Coding_Project/dllal
git fetch --all --prune
gh pr list --state open
gh pr checks 168
```

Then read this file's **Current queue** and take the first item that is not marked blocked.
Do not re-derive the baseline — re-run it only if `main` has moved.
