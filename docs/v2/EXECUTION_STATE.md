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
| **Last updated** | 2026-08-15, after queue item 3 — this file is the commit that follows `aa8b70d` |
| **Branch** | `feature/rayan-v2-spec` |
| **HEAD** | `aa8b70d` + this commit |
| **Base** | **19 commits ahead of `origin/main`**, and it contains `.github/workflows/ci.yml`, which `main` does not. Everything through `aa8b70d` **is pushed**; this commit is the only one that may not be. Push, never force-push — #168 is open and others may be reading it |
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
| `tests/guards/run.sh` | **PASS** 20/20 | 20/20 |
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
4. Only then create the V2 issues.

**Blocked, with the reason:**

- **All 40 V2 tickets** — the board is not to be turned into issues until #168 is internally
  consistent and owner-approved. The owner said so explicitly.
- **`V2-00`** — needs a human to merge #155; protection forbids a self-merge.
- **Six tickets behind an unanswered question raised by this run** — `V2-A4` (`O14`, `O34`),
  `V2-A19` (`O31`, `O32`, `O33`), `V2-A20` (`O11`), `V2-C3`/`V2-A3`/`V2-B5` (`O25`–`O30`). The
  register is at **34 open items**, all 34 blocking at least one ticket. **None of them was
  answered by this run**, by design — `CLAUDE.md` §8, `TEAM.md` rule 16.

**Fallback queue** (independent, safe, needs no unblocking) — used the moment the above
stalls: the #168 corrective items; documentation-consistency sweeps; re-verifying `#165`;
adversarial re-reads of the D-0x records against `PRD.md`; and the research passes behind
`O14` and `O24` that produce *options* rather than decisions.

---

## Decisions and assumptions made by this run

| id | what | evidence | reversible? |
|---|---|---|---|
| — | Run database suites from a detached worktree rather than the working tree | the 28-vs-1 measurement above | yes, it is a procedure |
| — | Treat the red Vercel check on #155/#165/#167/#168 as **not a code signal** | Vercel returned `api-deployments-free-per-day`, "try again in 24 hours" | yes |
| — | `PRD.md` is **not touched** by this run | owner: "the owner will ratify it manually" | n/a |
| — | The untracked migration is **never staged and never edited** | `git status` shows it untracked at every commit in this run | n/a |
| — | Every board number is **machine-derived**, never hand-counted | `tests/v2/graph.check.mjs`, 93 assertions | it is a procedure |
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
