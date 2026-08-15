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
| **Last updated** | 2026-08-15, after writing the **tracker-configuration proposal** the previous sweep's three team gates were waiting on — [`TRACKER_PROPOSAL.md`](TRACKER_PROPOSAL.md), posted on #168. **The first artefact of this run that is a question rather than a record**, and governed differently for that reason: nine assertions that all *derive* and none that pin its prose, nine probes that mutate **the proposal** rather than the documents it describes. **Nothing was created** — no label, no milestone, no issue, `PRD.md` unopened. The finding is that **gate 3 dissolved**: `GITHUB_PLAN.md:163` and `TEAM.md:1090` already chose GitHub's native blocked-by links over a label, for this exact shape of problem, so it needs no tracker change at all and S0-14's AC ends up *more* strongly satisfied — which corrects the previous item, the second consecutive correction of the sweep before it. One defect in the first posted draft (six pinned lines claimed, seven real, one of the six deliberately untouched) was caught by writing the check, not by reading, and the posted comment was edited to match the file |
| **Branch** | `feature/rayan-v2-spec` |
| **HEAD** | `f031b28` + this commit |
| **Base** | **50 commits ahead of `origin/main`** at `f031b28`, and it contains `.github/workflows/ci.yml`, which `main` does not. Push, never force-push — #168 is open and others may be reading it |
| **CI status** | Local, clean tree, at `f031b28`: `190 passed, 0 failed` and `147 caught, 0 not caught (0 no-op), 147 of 147 probes reached`; guards `21/21`, ci-coverage `21 suites, 0 unwired`, governance `14/14`. **The `ubuntu-latest` figures for this commit are recorded below once the run reports** — do not copy the previous commit's forward. At `1c96f5b` `static` was **GREEN on `ubuntu-latest`** ([run 31874041504](https://github.com/RayanAlDwlah/dallal/actions/runs/31874041504)) with `181`/`138`, **byte-identical to the macOS clean-tree figures**, as at `00352f4`, `61e102f` and `81578ae` — no figure on this page has been macOS-only across four commits, the last three of which added mutation surfaces. **`database` still RED** on the pre-existing #147 (`auth` and `bidding` pass; `auction` does not), which **PR #155 fixes and only a human can merge** — so the *run* conclusion reads `failure` while `static` is green. **Read the job, not the run** |
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
8. ~~**§21, the Product Decision Register, read the same way**~~ — **done**, `4cfe47d`,
   `81578ae` and this commit. **The last unread `PRD.md` surface**, and the sweep found that
   **no document on this board cites a single line of it** — zero matches in `:2019`–`:2073`
   from `TICKETS.md`, `SPEC.md` or any of the six records, checked mechanically. **The
   blockquote has eight questions now, not seven.** Item 8 — *a host can end a published lot
   early, and five lines say nobody can* — is the largest of the three sweeps and the only
   ratification item whose tickets (`V2-A11`, `V2-A12`) carry **no `R` at all**. It is a
   **fairness** question rather than a scope one; read it on its own terms. Two defects were
   found on the way and both are written up below: a pin aimed at the wrong half of `:798`,
   found by a MISSED probe, and a "crosses nothing" sentence that was one commit from being
   false. Nothing reclassified, nothing decided. Posted on #168 as
   [`#issuecomment-5301121679`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301121679),
   with the addendum naming `:2032` and `:2035` at
   [`#issuecomment-5301143245`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301143245).
   See the §21 section below.
9. ~~**`ARCHITECTURE.md`, read the same way**~~ — **done**, `5034e21`. Not `PRD.md` at all:
   **source of truth #2**, which `CLAUDE.md` §2 ranks *above* this board and which the board
   cited **zero times**, in either direction — and the other direction is worse, because
   `ARCHITECTURE.md` contains **no V2 vocabulary at all** and no ticket changes it, including
   the one `D-01` says is required. **Six crossings, and they are deliberately NOT a ninth
   blockquote item**: `PRD.md:2025` forbids reinterpretation, so a PRD crossing is the owner's;
   every `ADR` **carries its own reversal condition in writing**, so an architecture crossing
   is a steward's (`CLAUDE.md` §1). That separation is now machine-asserted rather than left to
   a regex boundary. The strongest of the six is **not prose**: a `WITH CHECK` live on `main`
   refuses a lot with no `end_time` at insert. Three negative results are recorded on purpose,
   including a re-test of the §19.6 admin judgement this file flagged as most worth a second
   reader — **it holds**. `ARCHITECTURE.md:1552`'s stale count is left **unfixed on purpose**
   and says why. See the section below, and [`#issuecomment-5301265091`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301265091) on #168.
10. ~~**`TEAM.md` and `GITHUB_PLAN.md`, read the same way**~~ — **done**, `6553d24`. Sources of
   truth **#3 and #4**, the last two `CLAUDE.md` §2 names that nothing had ever read against
   V2 — and they turned out to be the two that block item 11. **Five crossings**, and unlike
   items 8 and 9 they are neither the owner's nor a steward's: these are **process** documents
   with no ADR and no reversal condition, so a crossing here is a **team** decision about how
   the issue tracker is configured. Three of the five were **measured against the live
   tracker**, not just read: `gh api .../milestones` returns exactly `M0`–`M4`, all MVP, while
   `GITHUB_PLAN.md:214` forecloses a sixth in writing; `gh label list` returns **22**, the
   figure two documents assert as a *total* and a third defends as a merged ticket's AC; and
   `needs-decision` is forbidden by **four** documents on the premise *"zero open product
   questions"* against a register of **34**. The fourth is a **missing row** — `TEAM.md` §26
   calls itself a convenience copy of `PRD.md` §21.1 and holds **fifteen rows for sixteen**,
   the absent one being **Q16, Arabic RTL and `1,250.00 SAR`**; recorded as a documentation
   defect and *not* a live risk, because `CLAUDE.md` §3 states it and four guards enforce it.
   The fifth is the owner's: `bid increment` is still under *"Things nobody may build"*. See
   the section below.
11. ~~**A tracker-configuration proposal the team can answer in one reading**~~ — **done**,
    `f031b28`. Item 10 named three team gates; a sweep names a problem and this names the
    options. [`docs/v2/TRACKER_PROPOSAL.md`](TRACKER_PROPOSAL.md) — three gates, three named
    options each, one recommendation each, the exact document edits every option requires
    *including the merged acceptance criteria it falsifies*, and what stays untouched.
    **Nothing was created**: no label, no milestone, no issue, and `PRD.md` was not opened.
    Posted on #168 as
    [`#issuecomment-5301370669`](https://github.com/RayanAlDwlah/dallal/pull/168#issuecomment-5301370669).
    Its own correction is the part worth reading — **gate 3 turned out to be far cheaper than
    item 10 implied**, which makes this the second consecutive item to correct the sweep before
    it. See the section below.
12. Only then create the V2 issues.

**Blocked, with the reason:**

- **All 40 V2 tickets** — the board is not to be turned into issues until #168 is internally
  consistent and owner-approved. The owner said so explicitly. **And that is no longer the only
  gate — this page said "solely" and was wrong.** Item 10 found three more, none of them the
  owner's: the issues need a **milestone that does not exist** (`GITHUB_PLAN.md:214` forecloses
  a sixth, and the tracker has exactly the five it names), an **`area:` value that does not
  exist** (`area:` is `auth`/`auction`/`bidding`/`realtime`/`shared`, and `type:feature` is
  defined as *"MVP functionality"*), and — for the tickets blocked on an `O` — **a way to say
  so that four documents forbid**. Those are team decisions, takeable without the owner but
  not by one session alone. **Creating the issues today would mean inventing a taxonomy in the
  tracker**, which is `CLAUDE.md` §8's failure mode wearing a different hat.
  **Item 11 has now put all three in front of the team as named options**, so what is missing
  is a *reply*, not more analysis — and only two of the three turned out to change the tracker
  at all. Writing gate 3's options out showed it needs **no label and no milestone**: the
  mechanism it wants was already chosen, by the same two documents, for the same shape of
  problem. Analysis that shrinks the ask is worth more here than analysis that lengthens it.
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
> **§21 has come off this list as well** — item 8 — and with it the last unread `PRD.md`
> surface. What replaced it was **not** more of `PRD.md`: item 9 picked `ARCHITECTURE.md`,
> **by authority rather than by adjacency**, which is the method fault the §21 write-up named.
> Four consecutive sweeps had read the product document while the one ranked *above this board*
> had never been read at all. If a later session is choosing a surface, that is the question to
> ask — *which source of truth has nothing watching it?*, not *what is next to the thing I just
> read?*
>
> **`TEAM.md`/`GITHUB_PLAN.md` have come off this list too** — item 10, and the same method
> picked them: they were ranks **three and four**, and nothing was watching them. That is now
> four consecutive surfaces chosen by authority, and the fourth was the one that mattered most,
> because it is the one standing between this board and item 11.
>
> **The remaining unread surfaces are the six `D-0x` records read inward** (item 5 read them
> *against* `PRD.md`; nobody has read them against what the board builds) and
> **`docs/contracts/*.md`**, rank **five**, which `CLAUDE.md` §2 says *wins* against an older
> document — a contract that contradicts a V2 ticket beats the ticket, and no sweep has looked.
> Both are sweeps, not decisions, so both are safe to run unattended; anything they find is a
> blockquote question, a steward note or a team note, never a reclassification.
>
> **But the honest next move was not another sweep, and it was taken** — item 11. The three
> team-decision gates were named and evidenced, and a fifth sweep would not have moved them;
> what moves them is a proposal somebody can say yes or no to in one reading, which is work
> rather than a decision and therefore in scope. **It paid immediately**: writing gate 3's
> options out reduced it from *"four documents forbid the only label that fits"* to *"one
> clause of the reason is stale, and the mechanism these documents already chose does the job
> with no label at all."* A fifth sweep would have re-found the prohibition and re-reported it
> as a wall.
>
> The two surfaces above stay unread, and they are still the right sweeps if this run needs
> one — but they are now **behind a reply**, not in front of it, and a session that opens
> `docs/contracts/` before reading #168's latest comment is optimising the wrong queue.
>
> One caution earned in item 9, worth more than the finding: the two lists must stay separate.
> Six `> **n.` items now sit below the owner's eight and are numbered `1..6` like his. They are
> a steward's list. Anything that merges them — widening a regex, promoting a crossing "so it
> is not lost" — makes his page longer without making any of it his, and there is now an
> assertion and a probe against exactly that.

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

> **That last sentence has since been acted on, and the paragraph it sits in was nearly wrong
> the same way §21's was.** The §21 sweep below found that its own draft "crosses nothing"
> sentence was false for two of twelve rows. This one was re-checked at the same time and
> holds — but the pattern is now named twice, so treat every *"and it produced nothing"*
> paragraph on this page as a claim to re-verify, not a result to rely on.

---

### §21 at `81578ae` — the register nothing cites, and the pin that watched the wrong clause

**The last unread PRD surface, and it was last for a reason worth recording.** §21 is the
**Product Decision Register**. It opens with *"There are ZERO unresolved product questions"*, and
`:2025` reads: *"No decision here may be reopened, reinterpreted, defaulted, or worked around
during implementation."* `:2067` says how one *is* reopened — *"The resolution is recorded here
first, then built"* — and **here** means `PRD.md`, not a `D-0x` record.

**Checked mechanically at `eca50cd`: zero citations into `PRD.md:2019`–`:2073`** from
`TICKETS.md`, `SPEC.md`, or any of the six decision records. Not one line of the register is
referenced anywhere on this board.

That is the outward-read defect a third time, and this instance names the *method* fault rather
than another instance of it: **each sweep chose its next surface by adjacency to the previous
finding.** §19.2 was reached because a record cited near it; §20 because `A-U1` turned up inside
item 5. Nothing was adjacent to §21, so nothing led there — and §21 is the section the other
three are summarised *into*. **It should have been read first and was read last.** If a fourth
sweep is ever run, pick the surface by authority, not by adjacency.

| # | the §21 line nobody cited | what it collides with |
|---|---|---|
| **8** | `:2031` **Q1** — *"**No cancellation.** … A published auction runs to its end time and closes"* | `D-03` §3.1's host advance; `V2-A11`, `V2-A12` |
| **8** | `:2032` **Q2** — *"**No reserve price.** … **no hidden threshold, no "reserve not met" outcome**"* | the same, and it is the **sharpest** of the five — see below |
| **8** | `:798` **BR-30** + `:1218` + `:1223` — *"no branches, no cancellation, and no manual intervention"*, *"no administrator and no human action"* | the same |
| 8 | `:2033` **Q3** — *"starting price, **end time**, and image are immutable once published"* | pause moves `end_time`; `V2-A19` carries `R3`, but `R3` does not cite Q3 |
| 3 | `:2034` **Q4** — *"**Never `+5 / +10 / +50`**"*; `:2055` — *"**Implementers must not add one**"* | `D-01`'s button in multiples of ten |
| 2 | `:2035` **Q5** — *"5 minutes to 7 days, inclusive, **measured from creation using server time**"* | `D-03` §1's scheduled start; the register row underneath item 2 |

**Q2 forbids the OUTCOME where Q1 forbids the control, and that is the strongest line in the
item.** Q1 removes the cancel button; Q2 removes the *result* — there is no state in which an
auction ends without its highest bid winning, *"no hidden threshold, no 'reserve not met'
outcome."* A host who advances past a lot sitting below what he hoped for produces a
reserve-not-met outcome under another name, **and does it with no threshold stored anywhere** —
which is exactly why `:798` calls the seller version an *informal* reserve. Removing the control
while leaving the outcome reachable is the gap Q2 closes and the advance re-opens.

**Q5 bites differently from an exclusion.** It does not only bound a duration, it fixes when the
clock starts — *at creation*. A session scheduled for next Tuesday creates its lots now, so
either "creation" comes to mean something `PRD.md` does not define, or a five-minute lot has a
from-creation duration of a week and Q5's upper bound is crossed by scheduling alone. **A
measured bound changing, not a row being un-marked.**

**Item 8 is the largest finding of the three sweeps and the only one whose tickets carry no `R`
at all.** `V2-A11` and `V2-A12` both show `—`. And the strongest form of it is *not* "a row is
stale": **BR-30's own stated reason survives onto the new power unchanged.** `:798` gives the
reason as *"a seller able to cancel after seeing a low price would hold an **informal reserve**,
undermining BR-06 and fairness."* A host who advances past a lot at a disappointing price is
holding an informal reserve by that exact definition. `D-03` §3.1 reasons carefully about a
*different* abuse of advance — defeating anti-sniping, refused server-side — and never mentions
BR-30.

**The board also has the question one level too high.** `O10` asks whether a *session* can be
cancelled and is open; the *lot* advance is asked about nowhere.

**Recorded as a fairness question, not a scope one.** Items 1–7 ask whether V2 may build
something the MVP deferred — an ordinary question for a second version, and the honest answer to
most is probably *yes*. Item 8 asks whether a host may hold an informal reserve, which is the
class of rule `CLAUDE.md` §5 says was deliberately removed and whose **absence is the
requirement**. Do not let it be read as the eighth instance of the same pattern.

**Item 3 is explicitly NOT decided by this.** `D-01` §2's server-vs-screen distinction may hold —
Q4 answers *"is there a minimum bid increment?"*, and a button offering `+10` while the server
accepts `+0.01` imposes no minimum. But `:2034` is a register entry and `:2025` forbids
*reinterpreting* one. Whether `D-01` §2 is a distinction or a reinterpretation is the owner's
call, and this run did not make it.

**The BR-36 precedent gained a fourth act, demonstrated by Q7 itself.** `:2037` was rewritten in
place — *"REOPENED AND REVERSED 2026-08-13"* — with its accepted consequence at `:2056`. So the
full act, already performed once on this document, is: un-mark the §19 row, un-mark the §22 row,
retire the §20 assumption, **amend the §21 register entry**, and write the consequence in §21.2.
Q7 also proves the register does not update itself: **item 8 exists partly because Q3 was left
saying `end_time` is immutable while Q7 was amended to move it.**

```
V2 — graph.check.mjs   164 passed, 0 failed                                    (unchanged again)
V2 — graph-negative    115 caught, 0 not caught (0 no-op), 115 of 115 reached  (113)
```

**Both figures confirmed on `ubuntu-latest`**, at `81578ae`
([31871628931](https://github.com/RayanAlDwlah/dallal/actions/runs/31871628931)) and again at
`61e102f` ([31871898634](https://github.com/RayanAlDwlah/dallal/actions/runs/31871898634)), byte
for byte identical to the macOS clean-tree run. `EXCLUSIONS` grew 30 → 32 in the second of those
two commits without moving either number — which is correct and is the point of stating it: the
tuples are data for one existing assertion, not new assertions, and the probe added per *kind*
rather than per row means the probe count holds too.

#### The MISSED, and the defect it found — read this before adding a probe to that label

The negative suite came back **`114 caught, 1 not caught`** on the first clean-tree run at
`4cfe47d`. The check was right **twice over**, and only one of the two is about the probe:

1. **The probe's own fault.** Its mutation *truncated* the expected string
   (`"…and closes automatically"` → `"…and closes"`). The comparison is `.includes()`, so a
   truncated expectation is still contained in the line. **A pin can only be broken by *changing*
   a word, never by dropping one** — a shorter expectation is a weaker pin, not a false one.
2. **The defect it exposed, which the reading had not.** The single `:798` tuple pinned BR-30's
   **rule** half, and item 8 argues from its **reason** half. Both live on line 798; delete the
   reason and the rule still reads perfectly, so the pin stayed green through **the exact edit
   item 8 warns about**. The comment above the tuple even said *"edit that clause away and the
   argument goes with it"* — while the tuple below it pinned the other clause. **A pin aimed at
   the wrong half of the line it cites is not watching anything.**

Fixed in `81578ae`: both halves pinned (`EXCLUSIONS` 18 → **30**, two tuples on line 798), probe
re-aimed at a word change. This is §9's doctrine paying out in the intended direction — reading
the assertion would not have found it, because **the comment and the tuple disagreed, and the
comment is the part a reader believes.**

`graph.check.mjs` stayed at 164 for the third commit running: tuples were added, not `chk` calls.
Stated every time on purpose — coverage growing while the assertion count holds still is the
shape that should draw suspicion.

**Two probes added, by kind not by row** — a §21 *register entry* and the one *rationale clause*.
Four kinds now sit in that list and each has at least one probe. Thirty probes against a one-line
shared loop body would be theatre; five against four kinds is the claim the suite can defend. The
two count-naming probes were re-aimed to eight, which is the recurring tax the header names.

#### The sentence that was one commit away from being false

**Q2 and Q5 were not in the first draft of this section.** It was about to say *"the remaining
twelve register entries were read and cross nothing this board builds"* — the unbacked
already-verified sentence this project keeps producing, and the one thing `docs` doctrine says to
distrust hardest. The finding, the guard change, the commit and **the comment on #168 had all
already gone out** naming four §21 lines.

What caught it was re-reading the twelve before writing the claim, exactly as the §20 sweep
re-read its own "crosses nothing" line. Two of them crossed, and one of them (**Q2**) is now the
strongest single line in item 8. A third (**Q9**, *"no chat, messaging, or contact exchange"*)
was checked properly rather than assumed: `grep` across `SPEC.md`, `TICKETS.md` and
`D-03` returns one hit, and it is the word "chat" describing the owner's own conversation, not a
product surface. **Q9 genuinely does not cross** — recorded as a negative result for the same
reason `:1936` was, so nobody re-derives it.

**The rule this earns:** the "what this sweep did *not* find" paragraph is the most dangerous
paragraph on the page, because it is the one that talks the next session out of looking. Write it
last, and re-read the rows before writing it. Twice now that has been the step that produced a
finding.

**What §21 did *not* produce, so nobody re-runs it:** the remaining ten register entries
(**Q6, Q8, Q9, Q10, Q11, Q12, Q13, Q14, Q15, Q16**) were each read against what V2 builds and
none crosses. Q9 is the one worth naming, above. **All four PRD surfaces — §19, §20, §21, §22 —
have now been read inward.** There is no fifth. A future sweep should aim at the `D-0x` records
or at `ARCHITECTURE.md`, not at `PRD.md`.

---

### `ARCHITECTURE.md` at `5034e21` — the document one rank higher, which nothing was watching

The paragraph above said where to aim next and this is that sweep. It is the first one whose
target is **not `PRD.md`**, and the choice was made **by authority, not by adjacency** — the
method fault the §21 section named. `CLAUDE.md` §2 ranks `ARCHITECTURE.md` **second, above this
board**. Four consecutive sweeps had read the document one rank *below* it.

**The zero-citation finding runs both ways, and the second direction is the worse one.** The
board cites `ARCHITECTURE.md` zero times — counted mechanically across `SPEC.md`, `TICKETS.md`
and `docs/ai/local-model.md`. Two records mention it once each and **both mentions are
prospective**: `D-01`'s completion checklist has an unticked box for an ADR that does not exist,
and `D-03`'s `O4` calls the lot-versus-auction choice *"an `ARCHITECTURE.md` decision with a
large blast radius"*. Neither cites a line. In the other direction, `ARCHITECTURE.md` contains
**no V2 vocabulary at all** — no session, host, lot, pause, deposit or model — and **no ticket
on the board changes it**, including the one `D-01` says is required.

#### Why the six are a separate list and not a ninth ratification item

This is the judgement most worth a second reader, so it is argued from the documents rather than
asserted. `PRD.md:2025` forbids a decision being *"reopened, reinterpreted, defaulted, or worked
around during implementation"* — a PRD crossing can be closed **only by the owner**. Every `ADR`
in `ARCHITECTURE.md` §20 instead **carries its own reversal condition in writing**: the document
authorises its own amendment and names what triggers one. That makes these a **steward** matter
(`CLAUDE.md` §1: *stewards advise, they do not gate*), and folding them into the owner's eight
would lengthen his page without adding anything that is his to decide.

The separation is fragile in a specific, mechanical way: six `> **n.` items now sit below the
owner's eight and are numbered `1..6` exactly as his are. The blockquote capture in
`graph.check.mjs` stops at the first non-blockquote line, so it is correct **today** — and the
comment above it used to say the widening was safe *"because nothing in those paragraphs happens
to be a numbered blockquote item"*. That clause stopped being true in this commit. It now carries
a warning, an assertion (`the steward crossings have not been swept into the owner's blockquote`)
and a probe that performs the promotion a helpful editor would perform.

#### The one that is code

Five of the six are prose. **Crossing 6 is a `WITH CHECK` that is live on `main`**:
`20260812120000_bid02_bid_acceptance.sql:500` requires `end_time >= now() + interval '5 minutes'`
at **insert** time, and `V2-A11` says a lot's `end_time` is *"computed when the lot opens, not at
creation"*. If `O4` resolves to "a lot is an `auctions` row with a nullable `session_id`", the
insert is refused with **42501**. It escalates the finding from *a document says* to *a
deployment will fail*, and it **survives either answer to `O23`**, because the bound is evaluated
against `now()` when the row is written rather than when the lot runs — checked explicitly,
because "isn't this just `O23`?" is the first thing a reader will ask.

That is also why `supabase/migrations/20260812120000_bid02_bid_acceptance.sql` is now a declared
mutation surface in the negative suite — **the first executable file this harness mutates.** The
safety argument is the harness's and is unchanged (dirty-tree refusal first, trap armed after,
`git checkout --` restore before any verdict is read), nothing runs SQL, and the header says all
of this out loud instead of letting the new surface appear as one more line in a list.

#### Three negative results, one of them a re-test

Recorded so nobody re-derives them: **`ARCHITECTURE.md:310`** (the admin row), **`:1372`**
(ADR-1's reversal condition — *not* fired: pause is atomic, a lot advance is host-invoked, and
closing already runs on `pg_cron`), and **§4.4/§24's native-mobile and public-API rows**.

`:310` is the one that matters. This file recorded the §19.6 admin judgement as *"the one most
worth a second reader's eye, since it is the only place the sweep decided a row did not apply"*.
It has now been re-tested **from the second source of truth** rather than re-read in the first,
and it **holds**. A flagged judgement that gets re-tested from a different document is worth more
than one that gets re-read in the same one.

#### Verification

```
V2 — graph.check.mjs   172 passed, 0 failed                                    (164)
V2 — graph-negative    126 caught, 0 not caught (0 no-op), 126 of 126 reached  (115)
```

**The first sweep of the five to move `graph.check.mjs` at all.** The four before it added tuples
to existing lists and the number stayed at 164 three commits running; this one adds eight `chk`
calls, because a second document needed its own citation regex, its own dangling check, its own
uncited check, its own self-count, and two pins that are not in a document. `guards` 21/21,
`guards-negative` 21/21, `governance-workflow` 14 + 16, `ci-coverage` 21 suites / 0 unwired,
`lint` 0 errors, `typecheck` clean — all on a clean tree, on macOS. The Linux figures are
confirmed separately below the run header.

The pin list carries **five kinds** — reversal condition, prose absolute, table row, stale count,
and shipped constraint — and the probe budget stays **one per kind**, per the standing rule. The
fifth kind is genuinely different and the suite header says why: prose rots when somebody rewords
it; a policy changes when somebody changes **behaviour**.

**The new checks caught a real defect on their first run.** `TICKETS.md still cites every
ARCHITECTURE.md line its crossings section rests on` failed with three entries — `:174`, `:685`,
`:1532` had been written in the shorthand `` `:NNN` `` form, which the `ARCHITECTURE.md` citation
regex does not accept (the PRD regex has a bare-`:NNN` alternative; this one does not). Written
by hand, verified by machine, and the machine was right.

**One stale figure is left unfixed on purpose.** `ARCHITECTURE.md:1552` says `PRD.md` §21.1
*"closes all fifteen"*; §21.1 holds **sixteen**, and `CLAUDE.md` §3 cites Q16 by name. The six
crossings will touch §6.5, §8.5, §11.2, §14.2, §17.3 and §20 — the document should be amended
**once** by its steward rather than twice, the second time for a word. The figure is pinned, so
the day it *is* fixed, the paragraph explaining why it was left goes red rather than quietly
describing a number that has moved. That pin is also a probe, which makes it the only mutation in
the suite that is scheduled to become a real commit.

---

### `TEAM.md` and `GITHUB_PLAN.md` at `6553d24` — the two documents that gate issue creation

Ranks **three and four**. The method from item 9 held — *which source of truth has nothing
watching it?* — and this time the answer was standing directly in front of the next task.
The board cites `GITHUB_PLAN.md` **zero** times and `TEAM.md` twice, neither by line; going the
other way, `TEAM.md` says `v2` twice (once a document version, once a branch-name example) and
`GITHUB_PLAN.md` six times, **all six about `TEAM.md` v2.0 the document**. Neither process
document knows the V2 phase exists.

**These are neither the owner's list nor a steward's, and that is a third category.** Items 8
and 9 split on a real distinction: `PRD.md:2025` forbids reinterpretation, so a PRD crossing is
the owner's ratification; every `ADR` carries its own reversal condition, so an architecture
crossing is a steward's amendment. Neither applies here. `TEAM.md` and `GITHUB_PLAN.md` do not
*describe* the system, they **configure the issue tracker** — so a crossing is a **team**
decision, takeable without the owner and not by one session. One row is the exception and is
marked: `bid increment` under "Things nobody may build" is prefaced *"a deliberate product
decision (PRD SD-05)"*, and that is his.

**Three of the five were measured against the live tracker, not inferred from the documents.**
This matters because the documents and the tracker **agree** — the finding is not drift, it is
that both are correct and neither has room for V2:

| Claimed | Measured | Verdict |
|---|---|---|
| `GITHUB_PLAN.md:214` — *"no extra milestones are created"* | `gh api …/milestones` → `M0`–`M4`, all MVP | agree; V2 has nowhere to go |
| `TEAM.md:1076` + `GITHUB_PLAN.md:151` — *"22 labels"* as a total | `gh label list` → **22** | agree; no `area:` fits V2 |
| `GITHUB_PLAN.md:11` — *"No Issues … created yet"* | **105 issues** | stale, and nothing rests on it |

The fourth crossing is a **missing row**, and it is the one worth reading twice. `TEAM.md:1308`
introduces §26 as *"a convenience copy for daily work"* of `PRD.md` §21.1. §21.1 holds `Q1`
through `Q16`; §26 holds **fifteen numbered rows and stops**. The absent decision is **Q16 —
Arabic right-to-left and the canonical `1,250.00 SAR`**, which governs every string and every
amount in the product. **It is recorded as a documentation defect and explicitly not as a live
risk**, because `CLAUDE.md` §3 states Q16 in full and four checks in `tests/guards/run.sh`
enforce it; saying otherwise would be the inflation this run is forbidden.

**And item 9 under-counted its own last finding — corrected here rather than quietly.** The
`ARCHITECTURE.md` section left `:1552`'s *"closes all fifteen"* for the steward, reading it as
one stale word in one document. Counted across the tree it is **13 occurrences in 4 documents**
— `PRD.md` ×7, `TEAM.md` ×3, `ARCHITECTURE.md` ×2, `README.md` ×1 — against a sixteen-row
register, and **one of the thirteen is correct and must not be "fixed"** (`PRD.md:2157`,
*"Version 1.0 raised fifteen product questions"*, is history and sums to fifteen). One of the
stale twelve is `PRD.md:2027`, **the register's own heading**. Because **seven are in `PRD.md`**,
which no session may edit, the correction **starts as the owner's, not the steward's** — which
is the opposite of what item 9 implied.

> **The mechanism is the finding, not the figure.** Q16 was decided 2026-08-12 and added to
> §21.1. Nothing downstream was renumbered — not the heading above it, not `SD-03`, not the
> quick reference, which is *why* that table stops at fifteen. **A sixteenth row landed and
> thirteen counts stayed put.** The V2 ratification asks the owner to do the same thing to the
> same register, and until this commit there was no check anywhere tying a count to the thing
> it counts. There are now two, and they are **derived rather than pinned**: the register-vs-copy
> row count and the census are recomputed every run, so they go red when the defect is **fixed**
> as well as when it worsens. That is deliberate — it stops a paragraph explaining a gap from
> outliving the gap.

**A second precedent, recorded because V2 leans on it.** `PRD.md:419` (`SD-03`) says the
decisions may never be *"reopened"*. §21.1's **`Q7` was reopened** — *"REOPENED AND REVERSED
2026-08-13"* — and `TEAM.md:1318` carries the same note. Separately, `TEAM.md:1331` records
*"`anti-sniping extension` was removed from this list on 2026-08-13"*, inline, with the date.
So both procedures the V2 ratification needs — reopening a register entry, and amending the
"nobody may build" list — have been performed once each, on this project, and are documented in
place. **Nothing here reopens anything.** It means the ask is a second instance, not a first.

**Three things were checked and are not findings**, listed because a sweep that only reports
hits is not measuring: `TEAM.md:1105` and `GITHUB_PLAN.md:776` are permanent-ownership text, but
`CLAUDE.md` §1 **names both documents** and declares such text stale, so they are governed
already; and the five milestones' exit criteria were read one at a time and **none is falsified
by V2** — V2 has no place in the sequence, which is a gap, not a contradiction.

**What the apparatus caught in this change while it was being written**, recorded because it is
the whole argument for having it — none of the four was visible by reading:

- `GITHUB_PLAN.md:139` and `TEAM.md:1099` were cited from memory. The real lines are `:144` and
  `:1097`; `:1099` is a **section heading**.
- `TEAM.md:1318` was written as `:1319`.
- `` `TEAM.md:1091`/`:1095` `` as a shorthand registered as a **phantom `PRD.md:1095` citation** —
  the bare `` `:NNN` `` form is reserved for PRD lines by a regex that predates this section.
- The negative suite reported one **MISSED** and one **NO-OP** *in its own new section*. The
  MISSED was a **section-J** probe: the census blockquote cites `ARCHITECTURE.md:1552` a second
  time, so a single-copy mutation two hundred lines away left the assertion satisfied by the
  survivor. **That is the close-all-doors rule regressing from prose added elsewhere**, and it
  is the strongest evidence yet that these probes need re-running rather than trusting.

Fixed in `1c96f5b`, committed **separately** from the sweep so the failures and their fixes are
both in the history rather than only the green end state.

---

### `TRACKER_PROPOSAL.md` at `f031b28` — the first artefact of this run that is a question

Ten sweeps in a row produced *records*: things that are true, written down. This is the first
that is a **decision request** — and it behaves differently enough to be worth naming, because
the next session will write more of them.

**A record is re-read and argued with. A proposal is read once and acted on.** That asymmetry
is the whole risk: somebody replies *"2A"* to an area table that no longer covers every ticket,
and the drift stops being a documentation defect and becomes a decision. So every assertion
attached to it **derives**, and none pins its prose — a decision request must stay rewritable
by whoever answers it, while the arithmetic underneath may not move. Nine assertions
(190 total) and nine probes (147), and **every probe mutates the proposal, never the documents
it describes**: sections A–K prove the board notices when the tree moves; L proves the board
notices when the proposal stops describing the tree.

**What it proposes**, in one line each, with the recommendation:

| gate | recommended | creates | falsifies |
|---|---|---|---|
| **1** V2 has no milestone | one `M5 — V2` | +1 milestone | `GITHUB_PLAN.md:214`, and S0-03's merged AC |
| **2** no `area:` fits; `type:feature` means *MVP* | +3 `area:` (`sessions`, `ai`, `images`), +3 `track:` | +6 labels, 22 → 28 | `TEAM.md:1076`, `GITHUB_PLAN.md:151`, `:144`, and S0-03's AC again |
| **3** no way to say "blocked on a product question" | GitHub's native issue relationships, six tracking issues | **nothing** | nothing — one clause of a *reason* is stale |

**The finding is gate 3, and it corrects item 10.** That sweep reported three gates of roughly
equal weight. Writing the options out, gate 3 dissolved: `GITHUB_PLAN.md:163` and `TEAM.md:1090`
**already dropped the `blocked` label** in favour of *"GitHub's native 'blocked by' Issue links"*,
in writing, for exactly this shape of problem. Using them applies an existing team decision
rather than overturning one. The `needs-decision` prohibition survives **intact**, all four
copies of it; `GITHUB_PLAN.md:271` (S0-14), which makes preserving that prohibition a merged
ticket's AC, ends up satisfied *more* strongly than before. Only the premise attached to the
rule — *"`PRD.md` v3.0 has zero open product questions"* — is stale, and that is one clause in
two lines.

**`O23` is the argument, not a footnote.** It is mapped to *both* `D-03` and `D-06` in
`SPEC.md`, so the tracking table sums to **35 for 34 questions**. Under native relationships
that costs nothing — an issue can be blocked by two. A label cannot express it at all:
`needs-decision` on `V2-A10` says *blocked*, not *by which of two unrelated decisions*, and
removing it when `D-03` closes marks the ticket ready while `D-06` is still open. That
overshoot is asserted and probed, precisely so a later tidy-up cannot make the table
internally consistent and the paragraph beside it a lie.

**A defect in the first posted draft, caught by writing the check rather than by reading.**
The closing paragraph claimed six pinned lines would break, naming `GITHUB_PLAN.md:271` — which
the proposal deliberately does **not** edit — and omitting `TEAM.md:1095` and
`GITHUB_PLAN.md:164`, which it does. The real figure is **seven of eighteen**. It now sits in a
table, per gate, and the arithmetic (18 total, 7 edited, 11 untouched) is derived from
`BOARD_LINES` on every run. The posted comment was edited to match the file, so the two are not
allowed to disagree.

**Two things it does not do**, stated because the temptation in both directions was real:

- **It creates nothing.** No label, no milestone, no issue, no `PRD.md` edit. Executing it
  unilaterally is the invented-taxonomy failure the sweep warned about, wearing the sweep's own
  clothes.
- **It leaves crossing 5 alone.** `bid increment` under `TEAM.md:1334`'s *"things nobody may
  build"* is the owner's, it is `D-01`, and a process proposal is not the place to move it.

**Nine probes, nine CAUGHT, zero NO-OP, on the first run** — which by this run's own standard is
the result deserving least trust, so it is recorded with the caveat rather than as a boast. The
harness that reports it has been shown to discriminate MISSED, BROKEN and NO-OP, and it caught
three real defects the previous section's first run.

---

## Decisions and assumptions made by this run

| id | what | evidence | reversible? |
|---|---|---|---|
| — | Run database suites from a detached worktree rather than the working tree | the 28-vs-1 measurement above | yes, it is a procedure |
| — | Treat the red Vercel check on #155/#165/#167/#168 as **not a code signal** | Vercel returned `api-deployments-free-per-day`, "try again in 24 hours" | yes |
| — | `PRD.md` is **not touched** by this run | owner: "the owner will ratify it manually" | n/a |
| — | The untracked migration is **never staged and never edited** | `git status` shows it untracked at every commit in this run | n/a |
| — | Every board number is **machine-derived**, never hand-counted | `tests/v2/graph.check.mjs`, 190 assertions | it is a procedure |
| — | A **shipped migration** may be a declared mutation surface for a text probe, where `PRD.md` may not | the two are not the same risk: the harness refuses on a dirty tree, restores with `git checkout --`, and runs no SQL — and crossing 6 rests on a live `WITH CHECK`, so a pin nothing can break is not a pin. `PRD.md` stays out because the owner ratifies it by hand | yes — remove it from `neg_files` and the two probes go NO-OP, loudly |
| — | `PRD.md` is not a **mutation surface** either — not even for a probe that would restore it | an interrupted run must not be able to leave the file the owner ratifies broken; the probe breaks the checker's expectation instead | it is a procedure |
| — | An **unratified decision blocks a ticket**, exactly as an unanswered question does | not invented here: `docs/decisions/README.md:82` already records the precedence rule, and `CLAUDE.md` §2 already orders the sources. The **`R`→ticket mapping** is judgment, and the rule used is stated in prose for the owner to correct | yes — it is a column, and the owner ratifying anything empties it |
| — | Two assertions **DERIVE rather than pin** — the register-vs-copy row count and the `fifteen` census are recomputed each run | a pin fails when a claim is reworded; these also fail when the defect is **fixed**, so the paragraph explaining a gap cannot outlive the gap. Q16 landed in `PRD.md` on 2026-08-12 and thirteen counts in four documents stayed put, with nothing anywhere tying a count to the thing it counts | yes — they are two `chk` calls |
| — | `TEAM.md` and `GITHUB_PLAN.md` are **process** documents, so a crossing in them is a **team** decision — a third category alongside the owner's and the steward's | neither carries an ADR with a reversal condition nor an owner's ratification clause; what they contain is tracker configuration. The one product row in them is marked as the owner's and not counted with the rest | yes — it is a column in the section above |
| — | Reporting a sweep's **negative results** and its own **caught defects** is part of the sweep, not decoration | a sweep that only reports hits is not measuring; and four of this one's defects — two wrong line numbers, a phantom citation, and a MISSED probe caused by prose added elsewhere — were invisible by reading | it is a procedure |
| — | A new check is not trusted until a **negative probe** makes it fail | four real check defects found this way, two of them in PZ-8 | it is a procedure |
| — | A **decision request** is governed differently from a record: every assertion on it DERIVES, and none pins its prose | a record is re-read and argued with; a proposal is read once and acted on, so a stale one gets *approved*. What may not drift is its arithmetic — the area coverage against the board, the guard-pin claims against `BOARD_LINES`, the tracking grouping against `SPEC.md`. What must stay free is its wording, so whoever answers can rewrite it | yes — it is nine `chk` calls in one block |
| — | A proposal's probes mutate **the proposal**, not the documents it describes | sections A–K prove the board notices when the tree moves; section L proves the board notices when the proposal stops describing the tree. Those are different failures and only one of them ends in somebody approving the wrong thing | it is a procedure |
| — | Writing the **options** is worth more than another sweep once the gates are named | gate 3 went from *"four documents forbid the only label that fits"* to *"the mechanism was already chosen; one clause of the reason is stale"* — a fifth sweep would have re-found the prohibition and re-reported it as a wall | it is a procedure |

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
