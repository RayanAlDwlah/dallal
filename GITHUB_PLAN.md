# GITHUB_PLAN.md — Dalal, Live Auction Web Platform

**GitHub execution plan. Planning only — nothing has been created or modified on GitHub.**

| Field | Value |
|---|---|
| Project | Dalal — Live Auction **Web** Platform |
| Document | GitHub Execution Plan **v1.1** |
| Date | 2026-08-12 |
| Author | Lead Engineering Project Management |
| Status | **Plan finalized.** No Issues, milestones, or labels created yet — awaiting the go-ahead |
| Sources of truth | [PRD.md](PRD.md) v3.0 · [TEAM.md](TEAM.md) v2.0 · [ARCHITECTURE.md](ARCHITECTURE.md) v1.1 |
| Repository | **`RayanAlDwlah/dallal`** — renamed and initialized since v1.0. See §1 |
| Platform | Responsive **web application**. Desktop + mobile browsers. No native mobile app |
| Total Issues | **84** — 15 Sprint 0 · 5 verification · 14 Abdulrahman · 19 Mohammed · 21 Rayan · 10 integration |

### Changes in v1.1

| # | Change | Reason |
|---|---|---|
| 1 | **S0-00b removed** — GitHub usernames are confirmed | `Dem4t`, `m7ya505`, `RayanAlDwlah` supplied |
| 2 | **Issue count 85 → 84**; Sprint 0 16 → 15 | Consequence of removing S0-00b |
| 3 | **GitHub usernames added** to every owner reference | Issues can now be assigned to real accounts |
| 4 | **S0-00 marked COMPLETE** — Rayan renamed `dllal` → `dallal` | Verified live |
| 5 | **§1 repository status rewritten** — repo is no longer empty | `main` exists with one commit |
| 6 | **S0-01 rescoped** — repository is already initialized | Remaining work is documentation, not initialization |
| 7 | **Abdulrahman's support model documented** (§7.1) | Rayan retains **all** bidding ownership; support is lower-risk UI and testing only |

---

## 1. Repository status — what actually exists

Re-inspected live on 2026-08-12 at 10:46 UTC via the public GitHub API and `git ls-remote`. **Nothing was created, modified, or deleted by this inspection.**

> **The repository changed between plan v1.0 and v1.1.** Two of the three findings in v1.0 have been resolved by Rayan, and the repository is no longer empty. This section reflects the live state, not the state described when planning began.

### 1.1 ✅ Resolved — the repository has been renamed to `dallal`

Plan v1.0 reported the canonical name as `dllal`. **Rayan has renamed it.**

| | v1.0 (09:37 UTC) | **Now (10:46 UTC)** |
|---|---|---|
| Canonical `full_name` | `RayanAlDwlah/dllal` | **`RayanAlDwlah/dallal`** ✅ |
| Repository ID | 1331850595 | 1331850595 *(same repository — renamed, not recreated)* |

The repository ID is unchanged, confirming this was a rename of the existing repository and **not** a second repository. `https://github.com/RayanAlDwlah/dallal.git` is now the canonical URL, and the old `dllal` URL will redirect.

**Issue S0-00 is therefore COMPLETE.** No further action. This resolves v1.0 risk 1.

### 1.2 ✅ Resolved — GitHub usernames are confirmed

| Developer | GitHub username | Ownership (TEAM.md — unchanged) |
|---|---|---|
| **Abdulrahman** | **`Dem4t`** | Authentication & User Management |
| **Mohammed** | **`m7ya505`** | Auction Management |
| **Rayan** | **`RayanAlDwlah`** | Bidding & Realtime · repository owner |

**Issue S0-00b is removed from the plan** — it existed only to obtain these. This resolves v1.0 risk 2.

### 1.3 ⚠ Changed — the repository is no longer empty

`main` now exists. Rayan pushed an initial commit at **10:44 UTC**, after plan v1.0 was written.

```text
$ git ls-remote https://github.com/RayanAlDwlah/dallal.git
9326623c3e0e51ea12b05aefd1a0c8142f30f75f    HEAD
9326623c3e0e51ea12b05aefd1a0c8142f30f75f    refs/heads/main
```

| Property | Value |
|---|---|
| Branches | **1 — `main` only.** No feature branches yet |
| Head commit | `9326623c3e0e51ea12b05aefd1a0c8142f30f75f` |
| Author / committer | `RayanAlDwlah` |
| Committed | 2026-08-12 10:40:25 UTC |
| Files changed | 1 file, 41 insertions, 0 deletions |
| Commit message | `Initialise empty repository`<br><br>`Scaffold only: .gitignore. Product documentation and design system`<br>`to be added once the updated PRD lands.` |

**Repository contents: exactly one file — `.gitignore` (356 bytes).**

**This is existing work and must not be overwritten.** The commit message explicitly anticipates the current step: *"Product documentation … to be added once the updated PRD lands."* The PRD has landed at v3.0. **The remaining work is therefore to add documentation on top of this commit — not to initialize the repository.** Issue S0-01 is rescoped accordingly (§3.2).

### 1.4 The committed `.gitignore` — assessed, not replaced

The existing file is sound and already covers almost everything the project needs. It is **not** an oversized generic template:

```text
OS            .DS_Store · Thumbs.db
Dependencies  node_modules/ · .pnp/ · .pnp.js
Build output  dist/ · build/ · .next/ · out/ · *.tsbuildinfo
Environment   .env · .env.local · .env.*.local
Logs          *.log · npm-debug.log* · yarn-debug.log* · yarn-error.log* · pnpm-debug.log*
Editors       .vscode/ · .idea/ · *.swp
Testing       coverage/ · playwright-report/ · test-results/
Misc          .cache/ · .turbo/
```

**One real gap.** It ignores `.env`, `.env.local`, and `.env.*.local` — but **not** plain `.env.production` or `.env.development`. Those are exactly the filenames a developer reaches for when setting up a second environment, and ARCHITECTURE §17 requires that no environment values ever reach the repository.

**Recommended change — three lines, surgical, not a rewrite:**

```text
# Environment
.env
.env.*
!.env.example
```

This ignores every `.env` variant while explicitly allowing the placeholders-only example file. **No other change to `.gitignore` is needed or recommended.**

### 1.5 Existing GitHub configuration — unchanged since v1.0

| Item | Found | Action |
|---|---|---|
| **Issues** | **0** | Nothing to duplicate. All 84 are new |
| **Pull Requests** | **0** | — |
| **Milestones** | **0** | All five are new |
| **Labels** | **9 — GitHub defaults only** | See §1.6 |
| **Feature branches** | **0** | The three must still be created (§3.2, S0-02) |
| **Branch protection** | Not verifiable without authentication. **Now possible to apply** — `main` exists |
| **GitHub Actions** | None. **None will be created** |

### 1.6 Label plan — preserve, add, retire

**Preserve all nine defaults.** None conflicts with the project scheme.

| Existing label | Disposition |
|---|---|
| `bug`, `documentation` | **Keep and use** — defects found during integration; PRD/TEAM/ARCHITECTURE updates |
| `duplicate`, `invalid`, `question`, `wontfix` | **Keep.** Standard triage, harmless |
| `good first issue`, `help wanted` | **Keep but unused.** Meaningless on a closed three-person team; not worth deleting |
| `enhancement` | **Keep but do not use.** Overlaps `type:feature` and would create ambiguity |

**Add 13 project labels**, namespaced so they group in GitHub's picker:

| Label | Meaning |
|---|---|
| `type:foundation` | Sprint 0 shared setup |
| `type:feature` | MVP functionality |
| `type:verification` | **Technical** platform verification (ARCHITECTURE §22). **Never a product question** |
| `type:integration` | Cross-workstream integration |
| `type:testing` | Test coverage |
| `area:auth` · `area:auction` · `area:bidding` · `area:realtime` · `area:shared` | Workstream |
| `priority:critical` · `priority:high` · `priority:medium` | Scheduling |

**Total after setup: 22 labels** (9 preserved + 13 new). **No duplicates** — none of the 13 collides with an existing name.

**TEAM.md §19 mapping.** TEAM.md v2.0 §19 uses a flat list. **GITHUB_PLAN.md's namespaced scheme is the final project decision.** The mapping is one-to-one and must be recorded in TEAM.md:

| TEAM.md §19 (older, flat) | **Final (this plan)** |
|---|---|
| `auth` | `area:auth` |
| `auction` | `area:auction` |
| `bidding` | `area:bidding` |
| `realtime` | `area:realtime` |
| `shared` | `area:shared` |
| `verify` | `type:verification` — **technical items only** |
| `blocked` | *(dropped — GitHub's native "blocked by" Issue links express this better than a label that must be manually added and removed)* |
| ~~`needs-decision`~~ | **Does not exist.** PRD v3.0 has zero open product questions |

Tracked as Issue **S0-14**.

### 1.7 Local working copy

| Property | Value |
|---|---|
| Path | `C:\src\Dallal` |
| Git initialized | ❌ **No** — not a git repository, no remote |
| Files present | `PRD.md` v3.0 · `TEAM.md` v2.0 · `ARCHITECTURE.md` v1.1 · `GITHUB_PLAN.md` v1.1 |

**The four source-of-truth documents still exist only on one machine and are not in version control.** This remains the highest-priority action (S0-01). The repository's own commit message anticipates it.

### 1.8 ⚠ Automation access — read-only

**This environment has no authenticated GitHub access.** Verified:

| Check | Result |
|---|---|
| `GITHUB_TOKEN` / `GH_TOKEN` environment variable | Not set |
| `gh` CLI | Not installed |
| Git credential helper | Not configured |
| `GET https://api.github.com/user` | **HTTP 401 Requires authentication** |

**Consequence: I can read the repository but cannot write to it.** The following require Rayan (or a developer with push access) and are set out as ready-to-run commands in §16:

- Pushing the documentation commit to `main`
- Creating the three feature branches on the remote
- Applying branch protection to `main`
- Creating labels and milestones
- Creating Issues

**No commit hash is reported for work I did not perform.** Everything in §16 is prepared and verified locally in content, but unexecuted.

### 1.9 Summary

| Question | Answer |
|---|---|
| Right repository, right name? | ✅ **Yes — `RayanAlDwlah/dallal`**, renamed by Rayan. Same repository ID |
| Does it contain existing work? | ⚠️ **Yes — one commit with `.gitignore`.** Must be built on, not overwritten |
| Issues / PRs / milestones to avoid duplicating? | ✅ **None** |
| Labels worth preserving? | ✅ **9 defaults — all preserved** |
| Does `main` exist? | ✅ **Yes** — protection can now be applied |
| Do the feature branches exist? | ❌ **No** — all three still to be created |
| Are the source documents in the repository? | ❌ **No** — this is the immediate next action |
| Can this environment perform the writes? | ❌ **No** — read-only. See §1.8 and §16 |

## 2. Milestones

The five-milestone structure from the brief is kept. It maps cleanly onto TEAM.md's three-way workstream split plus a foundation phase and an integration phase, and it matches ARCHITECTURE.md's three integration checkpoints. **No reason to deviate, and no extra milestones are created.**

| # | Milestone | Purpose | Owner emphasis | Exit criteria |
|---|---|---|---|---|
| **M0** | **Sprint 0 — Foundation** | Shared groundwork before any feature work. Repository live, `main` protected, scaffold running, contracts agreed, critical spikes answered | **All three** — not a fourth workstream | All three developers can clone, run the app, and start work in a file nobody else is editing (TEAM.md §12 exit criteria) |
| **M1** | **MVP Authentication** | Registration, login, logout, session, identity, unique display name, profile, **password reset** | **Abdulrahman** | PRD §8.1, §8.2 delivered; SC-01, SC-10, SC-60 → 64, SC-69, SC-70 pass |
| **M2** | **MVP Auctions** | Auction creation and validation, image upload, active-only listing, detail page shell, seller views | **Mohammed** | PRD §8.3, §8.4, non-bidding §8.5 delivered; SC-01 → 07, SC-58, SC-59, SC-68, SC-71 pass |
| **M3** | **MVP Bidding & Realtime** | Bid acceptance, concurrency, current price, history, realtime, closing, winner determination | **Rayan** | PRD §8.6, §8.7, §8.8, §13 delivered; SC-08 → 34, SC-55 → 57, SC-72 → 75 pass |
| **M4** | **Integration & MVP Validation** | Cross-workstream integration, the three checkpoints, security and responsive audits, end-to-end validation, production deploy | **All three** | PRD §18.3 demonstration scenario passes in full on the Vercel production deployment |

**Milestones M1, M2, and M3 run in parallel.** They are sequenced by number for readability, not by time — see §9.

---

## 3. Sprint 0 (Milestone M0)

Sprint 0 is **shared foundation work, not a fourth workstream.** Every Issue has a single owner drawn from the existing three, and the work is deliberately distributed so it does not all land on one person.

**Sizing note:** Sprint 0 is intended to be short — roughly one focused working session plus the two critical spikes. It is not a sprint of feature work.

### 3.1 Prerequisite — already complete

| ID | Title | Owner | Status | Outcome |
|---|---|---|---|---|
| **S0-00** | Rename repository `dllal` → `dallal` | **Rayan** (`RayanAlDwlah`) | ✅ **COMPLETE** | Done before this plan revision. Canonical name is now `RayanAlDwlah/dallal`, same repository ID 1331850595 — a rename, not a new repository (§1.1). **No GitHub Issue needed; close as done or do not create it** |

> **S0-00b has been removed from this plan.** It existed solely to obtain the two unknown GitHub usernames, which are now confirmed: **Abdulrahman → `Dem4t`**, **Mohammed → `m7ya505`**, **Rayan → `RayanAlDwlah`**. **Do not create a GitHub Issue for S0-00b.**

### 3.2 Repository and platform baseline

| ID | Title | Owner | Labels | Depends on | Description & Acceptance Criteria |
|---|---|---|---|---|---|
| **S0-01** | **Commit the approved source documents to `main`** | **Rayan** — `RayanAlDwlah` | `type:foundation` `area:shared` `priority:critical` | None *(S0-00 complete)* | **Rescoped in v1.1: the repository is already initialized.** Commit `9326623c` created `main` with a `.gitignore`, and its message states documentation is "to be added once the updated PRD lands." It has landed.<br>**Description:** Add on top of the existing commit — do **not** overwrite it. Commit `PRD.md` v3.0, `TEAM.md` v2.0, `ARCHITECTURE.md` v1.1, `GITHUB_PLAN.md` v1.1; add `README.md`; add `.env.example` with **placeholder values only**; apply the three-line `.gitignore` fix from §1.4.<br>**AC:** all four documents are on `main` at their current versions · `README.md` states Dalal is a **responsive web application** on Vercel with Supabase, and links to all four documents · `.env.example` contains **names and placeholders only — no real values** · `.gitignore` ignores every `.env` variant while allowing `.env.example` · **the existing `.gitignore` content is preserved, not replaced** · **no secret, key, token, or connection string is committed** · all three developers can clone and read the documents |
| **S0-02** | **Protect `main` and create the three feature branches** | **Rayan** — `RayanAlDwlah` | `type:foundation` `area:shared` `priority:critical` | **S0-01** | **Description:** Configure branch protection on `main` per TEAM.md §8 and §15, then create the three permanent feature branches from `main`. **`main` now exists, so protection can be applied** (§1.5).<br>**AC:** direct pushes to `main` are blocked for **all** collaborators, owner included · merges require a Pull Request · a PR requires **at least one** approving review · `feature/abdulrahman-auth`, `feature/mohammed-auctions`, `feature/rayan-bidding` all exist and **all branch from the same `main` commit** · **branch names exactly as specified — none renamed, no fourth permanent branch** · a test direct push to `main` is rejected |
| **S0-03** | **Create labels, milestones, and Issue/PR templates** | **Rayan** — `RayanAlDwlah` | `type:foundation` `area:shared` `priority:high` | S0-01 | **Description:** Add the 13 project labels (§1.5), preserving all 9 existing defaults. Create milestones M0 → M4. Add the Pull Request template from TEAM.md §20 and an Issue template matching the Phase 6 structure.<br>**AC:** 22 labels exist, no existing label deleted · five milestones exist · `.github/pull_request_template.md` matches TEAM.md §20 verbatim · opening a PR pre-fills the template · **no GitHub Actions workflow is created** |
| **S0-04** | **Connect Supabase projects (production + non-production)** | **Abdulrahman** — `Dem4t` | `type:foundation` `area:shared` `priority:critical` | S0-01 | **Description:** Create the two Supabase projects the deployment model requires (ARCHITECTURE §18.1, §18.4). Record connection details for the team. Assigned to Abdulrahman because Supabase Auth is the first service consumed and he owns it — and to keep Sprint 0 load off Rayan (TEAM.md §25 risk 1).<br>**AC:** a production Supabase project exists · a non-production project exists for previews and local work · both are reachable by all three developers · connection values are distributed **out of band, never committed** · which project each environment targets is written down |
| **S0-05** | **Connect the Vercel project and verify preview deployments** | **Abdulrahman** — `Dem4t` | `type:foundation` `area:shared` `priority:high` | S0-01, S0-04 | **Description:** Link the GitHub repository to Vercel per ARCHITECTURE §18. Confirm `main` → production and PR branches → preview.<br>**AC:** merging to `main` deploys to production · opening a PR produces a preview deployment with a unique URL · production points at the production Supabase project and previews at the non-production one (per V-3) · a failed build leaves the previous deployment live · **no GitHub Actions workflow is added — Vercel's own integration is used** |
| **S0-06** | **Agree the environment variable strategy** | **Abdulrahman** — `Dem4t` | `type:foundation` `area:shared` `priority:high` | S0-04 | **Description:** Define variable names and where values live, per ARCHITECTURE §17. Distinguish public configuration from server-only secrets **by name**, so a mistake is visible in review.<br>**AC:** an example file listing **names only, no values**, is committed · public and server-only variables are distinguishable by naming convention · values are set in Vercel per environment, never in the repository · TEAM.md rules 9 and 10 restated in the example file's comments · **confirmed that the application holds no elevated Supabase credential** (ARCHITECTURE §17.3); if one appears, raise it |

### 3.3 Web application scaffold

| ID | Title | Owner | Labels | Depends on | Description & Acceptance Criteria |
|---|---|---|---|---|---|
| **S0-07** | **Create the responsive web application scaffold** | **Mohammed** — `m7ya505` | `type:foundation` `area:shared` `priority:critical` | S0-01 | **Description:** A web application that builds and runs, deployable to Vercel. Compatible with Vercel's stateless execution model (ARCHITECTURE §18.5) — no long-running process, no in-memory state. TEAM.md §12 S0-2/S0-3.<br>**AC:** the app builds and runs locally with one documented command · it deploys successfully to Vercel · an empty page renders in a desktop browser **and** a 375 px-wide mobile browser without horizontal scrolling · the entry point and provider setup are established once, so all three developers register into it rather than each inventing their own · **framework choice is the team's, constrained only by ARCHITECTURE §18.5** |
| **S0-08** | **Establish routing and page placeholders** | **Mohammed** — `m7ya505` | `type:foundation` `area:shared` `priority:critical` | S0-07 | **Description:** One routing structure with empty placeholders for every MVP page, so three developers do not invent three routing approaches. TEAM.md §12 S0-4.<br>**AC:** placeholder routes exist for: auction listing, auction detail, register, login, **password reset**, profile · each is reachable and renders an empty page · adding a route is a small additive edit, not a restructure · the convention is documented in the README |
| **S0-09** | **Build shared responsive UI primitives** | **Mohammed** — `m7ya505` | `type:foundation` `area:shared` `priority:high` | S0-07 | **Description:** Button, text input, form field with error state, card, loading state, error state — built once so the product does not end up with three visual languages. TEAM.md §12 S0-5.<br>**AC:** each primitive exists and is usable by all three developers · each renders correctly at desktop **and** 375 px width · error/loading states are included, since every workstream needs them · extending a primitive is preferred to rewriting it (TEAM.md §11) |

### 3.4 Shared contracts — the work that unblocks everyone

> These three are the highest-leverage Issues in the entire plan. TEAM.md §14 identifies them as the items that unblock all parallel work.

| ID | Title | Owner | Labels | Depends on | Description & Acceptance Criteria |
|---|---|---|---|---|---|
| **S0-10** | **Publish the identity contract** | **Abdulrahman** — `Dem4t` | `type:foundation` `area:auth` `priority:critical` | S0-04 | **Description:** TEAM.md task **A-02**, ARCHITECTURE §10.4 — **the single highest-priority task on the team.** Define how any part of the app obtains "the current user", and publish it to Mohammed and Rayan. Must define **two distinct things** and mark clearly which is which.<br>**AC:** **(1) client-side session state** — is someone signed in, and their display name — documented and marked **UX only, never an authorization decision** · **(2) server-side verified identity** — the authenticated user identifier as the database sees it — documented and marked **authoritative** · it is unambiguous which to use for auction ownership (FR-CREATE-02) and bid attribution (FR-BID-01) · both Mohammed and Rayan confirm in writing they can build against it · **this is a contract, not an implementation — it can be agreed and published before the auth code is finished** |
| **S0-11** | **Agree the auction record contract** | **Mohammed** — `m7ya505` | `type:foundation` `area:auction` `priority:critical` | S0-07 | **Description:** TEAM.md task **M-01**, ARCHITECTURE §10.3 — agree the auction fields Rayan's bid validation reads and the fields Rayan writes at close. Agreed jointly with Rayan; **Mohammed owns the auction record** (TEAM.md §4).<br>**AC:** the six read fields are defined and frozen: auction id, owner, status, end time, starting price, current price · the four fields Rayan writes at close are agreed: status, final price, winner, close time · it is explicit that **Rayan writes current price on each accepted bid and nothing else** (ARCHITECTURE §10.3) · Rayan confirms bid validation can be built against it · renaming or removing any of the six requires telling Rayan first |
| **S0-12** | **Agree the SAR money representation** | **Rayan** — `RayanAlDwlah` | `type:foundation` `area:shared` `priority:critical` | None | **Description:** TEAM.md §11 "The money representation rule (SAR)" and §12 **S0-12**. One representation for storing, comparing, and formatting prices. **Assigned to Rayan as primary because the correctness-critical half — exact comparison in the bid operation — is his**; Mohammed is a required reviewer because he owns creation input and display. Neither may proceed with a different representation.<br>**AC:** storage/comparison representation agreed — **exact decimal, two places, never floating point** (NFR-DAT-05) · **no maximum** — large values handled correctly, never rejected for size (BR-21, SEC-R3) · one display format agreed for listing, detail, bid input, history, and results (NFR-DAT-08) · currency is **SAR** and values are **simulated** (BR-33) · the term **"Demo Points" is prohibited** · Mohammed has reviewed and confirmed · recorded where both can find it |
| **S0-13** | **Split the auction detail page into owned components** | **Mohammed** — `m7ya505` | `type:foundation` `area:shared` `priority:critical` | S0-08 | **Description:** TEAM.md §11 and §12 **S0-8** — the project's worst recurring merge-conflict risk. Create the **empty component files** now, per the ownership split, so both developers have a file of their own from their first commit. Agreed jointly with Rayan.<br>**AC:** **Mohammed's** files exist and are empty: page shell + data loading, product content, status label + countdown, current-price **display region** · **Rayan's** files exist and are empty: bid input + submit + feedback, bid history list, outcome/winner banner · the page mounts Rayan's components and passes the auction id · **neither developer edits the other's component files** · the split is recorded in the README or a code comment so it survives the sprint |
| **S0-14** | **Update TEAM.md §19 label list to the namespaced scheme** | **Rayan** — `RayanAlDwlah` | `type:foundation` `documentation` `priority:medium` | S0-03 | **Description:** TEAM.md §19 lists flat labels (`auth`, `verify`, …); this plan uses `area:*` / `type:*` (§1.5). Align the document with reality rather than leaving a discrepancy.<br>**AC:** TEAM.md §19 lists the actual labels · the `verify` → `type:verification` mapping is preserved, including the note that it is for **technical** items only and that `needs-decision` does not exist · no product decision is altered |

### 3.5 Sprint 0 exit criteria

Sprint 0 is complete when **all** of these are true:

- [ ] `main` exists and is protected; direct pushes are rejected
- [ ] The three feature branches exist with the exact specified names
- [ ] All four documents are committed and shared
- [ ] Every developer can clone, install, run, and see a page render at desktop and 375 px widths
- [ ] Vercel production and preview deployments both work
- [ ] Supabase production and non-production projects exist and are reachable
- [ ] The **identity contract** (S0-10) is published and confirmed by both consumers
- [ ] The **auction record contract** (S0-11) is agreed and confirmed by Rayan
- [ ] The **SAR representation** (S0-12) is agreed and confirmed by Mohammed
- [ ] The **detail page component split** (S0-13) exists as empty files
- [ ] **V-1 and V-2 are answered** (§4)
- [ ] Each developer has a file of their own to start in that nobody else is editing

---

## 4. Technical verification spikes (V-1 → V-5)

> ### These are TECHNICAL verifications, not product decisions
>
> Every Issue in this section asks **"can the platform do X?"** — answered by testing infrastructure. None asks **"what should Dalal do?"** — `PRD.md` v3.0 has **zero open product questions** (§21.1).
>
> **A technical finding never rewrites a product requirement.** If a spike shows the platform cannot do what a requirement needs, **the requirement stands and the finding is escalated.** It is not quietly relaxed to fit.
>
> All five carry `type:verification`. **None may be labelled or discussed as a product question.**

| ID | Title | Owner | Labels | Depends on | Blocks | Description & Acceptance Criteria |
|---|---|---|---|---|---|---|
| **V-1** | **Verify database transaction and row-locking semantics** | **Rayan** — `RayanAlDwlah` | `type:verification` `area:bidding` `priority:critical` | S0-04 | **BID-02, BID-03** — the entire bidding design | **Description:** ARCHITECTURE §22 V-1, §13. Confirm the platform database supports the row-level locking and transactional semantics the bid-acceptance design assumes, and measure behavior under genuinely concurrent bids. **This is the architecture's foundation** — ADR-2 depends on it.<br>**AC:** an exclusive row lock on a single auction row serializes concurrent operations as designed · concurrent bids against the same auction resolve to **exactly one acceptance** per price level · bids on **different** auctions do **not** block one another (ARCHITECTURE §13.3) · results are written up in the Issue · **if the semantics do not hold, escalate immediately — do not design around it silently** |
| **V-2** | **Verify scheduling granularity for auction closing** | **Rayan** — `RayanAlDwlah` | `type:verification` `area:bidding` `priority:critical` | S0-04 | **BID-15** — automatic closing | **Description:** ARCHITECTURE §22 V-2, §15.6. Determine the minimum scheduling frequency available in Supabase. Can a sweep run every ~30 seconds — directly, or via two sweeps offset by 30 seconds?<br>**AC:** the minimum achievable frequency is measured and documented · whether **FR-END-03's 30 seconds** is achievable directly is answered yes/no · if there is a one-minute floor, whether **two offset sweeps** achieve 30-second effective granularity is answered · findings recorded in the Issue.<br>**Critical framing:** **FR-END-03 stands as written.** Correctness is never at stake — bid rejection is driven by the actual end timestamp against the database clock, never by the status flag (PRD LC-03, ARCHITECTURE §13 step 4). Only *presentation latency* is affected. A product conversation arises **only** if every technical mitigation fails, and then it is the product owner's call — never a developer's |
| **V-3** | **Verify preview Supabase target and password-reset email in previews** | **Abdulrahman** — `Dem4t` | `type:verification` `area:shared` `priority:high` | S0-04, S0-05 | S0-05 completion; **AUTH-12, AUTH-13** review | **Description:** ARCHITECTURE §22 V-3, §18.4. Decide which Supabase project preview deployments target — **option A** (one shared non-production project) or **option B** (per-branch isolation, if available). **Option C — previews pointing at production — is rejected and must not be chosen.** Also confirm password-reset email works in previews, or Abdulrahman cannot exercise US-23 before merging.<br>**AC:** option A or B chosen and recorded, with reasoning · **option C explicitly not chosen** · a preview deployment demonstrably reads and writes the non-production project · a password reset initiated from a preview URL delivers successfully, or a documented workaround exists · if shared-project interference between branches is a concern, it is noted in the Issue |
| **V-4** | **Verify image thumbnail/transformation capability** | **Mohammed** — `m7ya505` | `type:verification` `area:auction` `priority:medium` | S0-04 | **AUC-09** listing performance | **Description:** ARCHITECTURE §22 V-4, §16.3. Confirm whether platform-side image transformation is available, or whether a smaller derivative must be generated at upload. NFR-PERF-05 forbids a listing thumbnail downloading the full-resolution original, and NFR-PERF-01 gives the listing a 3-second budget with up to 100 auctions.<br>**AC:** transformation capability confirmed or ruled out · if unavailable, the derivative-at-upload approach is planned · a rough measurement supports the listing meeting NFR-PERF-01 with 100 entries · findings recorded |
| **V-5** | **Verify the full lifecycle can be run locally or in isolation** | **Rayan** — `RayanAlDwlah` | `type:verification` `area:shared` `priority:high` | S0-04, S0-07 | Everyone's inner development loop | **Description:** ARCHITECTURE §22 V-5. NFR-MNT-03 requires triggering auction closing **without waiting real elapsed time**, and NFR-MNT-04 requires running the full lifecycle locally. **A design where closing can only happen on a timer would fail NFR-MNT-03** (ARCHITECTURE §21.4).<br>**AC:** a developer can create → bid → close → see the winner without shared infrastructure, or with a documented shared non-production fallback · **closing is invocable directly in a test environment**, not only by waiting · realtime works in the local setup · the procedure is documented so all three can use it |

### 4.1 Spike dependency summary

```text
V-1 ──blocks──► BID-02 (bid acceptance)  ──► BID-03 (concurrency)
                 └─ the whole trust boundary rests on this

V-2 ──blocks──► BID-15 (automatic closing)
                 └─ presentation latency only; correctness unaffected

V-3 ──blocks──► reviewable password-reset PRs (AUTH-12, AUTH-13)
                 └─ without it, US-23 cannot be exercised in a preview

V-4 ──blocks──► AUC-09 listing performance work

V-5 ──blocks──► nothing formally, but slows EVERY developer's loop
                 └─ Rayan most of all: closing and concurrency are the
                    hardest things to exercise without it
```

**V-1 and V-2 run first, in Sprint 0, before Rayan commits to BID-02 or BID-15.** They are the only two that could change the architecture. Neither can change a product requirement.

---

## 5. Abdulrahman — Milestone M1, Authentication & User Management

**Assignee:** Abdulrahman — GitHub **`Dem4t`** · **Branch:** `feature/abdulrahman-auth` · **Ownership:** TEAM.md §3, unchanged · **14 Issues**

*All 14 Issues in this section are assigned in GitHub to **`Dem4t`**.*

Every Issue carries `area:auth`. Shared traceability: TEAM.md §3, §13.1 · ARCHITECTURE §10, §11.2.

| ID | Title | Labels | Depends on | Traceability | Acceptance Criteria |
|---|---|---|---|---|---|
| **AUTH-01** | Establish Supabase Auth foundation and session handling | `type:feature` `priority:critical` | S0-04, S0-06 | PRD §8.1 · TEAM A-01 · ARCH §10.1, §8.1 | Supabase Auth is reachable from the app · a session can be established and read on both client and server · the identity reaches the database so RLS can evaluate it (ARCH §10.1) · **Vercel neither issues nor validates credentials** |
| **AUTH-02** | Registration — create an account and sign in automatically | `type:feature` `priority:critical` | AUTH-01 | FR-AUTH-01, 03, 05, 06 · US-01 · TEAM A-03 | Form captures email, password, display name · password rule stated **before** submission · valid submission creates the account, signs the user in, and lands on the listing · **validated server-side**; bypassing the client form is rejected identically · SC-01 passes |
| **AUTH-03** | Registration validation — unique email, **unique display name**, no email verification | `type:feature` `priority:critical` | AUTH-02 | **BR-37, BR-39** · FR-AUTH-02, 04, 07→07b · FR-PROF-03→03b · SC-69, SC-70 · TEAM A-04 | Duplicate email rejected without revealing account details · **duplicate display name rejected with a specific "name taken" message** (BR-39) · display name 2–50 chars · password ≥ 8 chars · malformed email rejected · **no verification step, no verification email, no unverified account state** (BR-37) · a user can register and **immediately** create and bid (SC-70) · the form makes clear the email is used for account recovery (FR-AUTH-07b) · every failing field reported at once with entries preserved · two simultaneous registrations cannot both take the same display name |
| **AUTH-04** | Login and return-to-page | `type:feature` `priority:critical` | AUTH-01 | FR-AUTH-08→11 · US-02 · TEAM A-05, A-06 | Correct credentials authenticate · **wrong credentials give one generic message that never reveals whether the email exists** (SEC-A5) · a user prompted to sign in from an auction returns to that auction afterwards · the bid amount is **not** carried over and must be re-entered (FR-AUTH-11) |
| **AUTH-05** | Logout and authentication-state indicator | `type:feature` `priority:high` | AUTH-04 | FR-AUTH-12→15 · US-03, US-04 · TEAM A-07, A-08 | Logout control on every page in a consistent place · logout ends the session; later requests are anonymous · lands on a public page · signed-in display name visible on every page · **browser-back to a page showing authenticated controls does not permit a protected action** · renders correctly at 375 px |
| **AUTH-06** | Session persistence and expiry handling | `type:feature` `priority:high` | AUTH-04 | FR-AUTH-16→18 · EC-12 · TEAM A-09, A-10 | Session survives reload, navigation, and browser restart · expiry produces a clear message and re-authentication prompt, not a silent failure · **on expiry, public viewing keeps working — only bidding requires re-auth** (FR-AUTH-18, ARCH §10.2) |
| **AUTH-07** | User identity and profile record | `type:feature` `priority:critical` | AUTH-02 | FR-AUTH-19→21 · FR-PROF-01→03b · TEAM A-11, A-12 · **ARCH ADR-7** | Stable internal identifier, never changing, used for all attribution · unique public display name · **display name is never the email** (FR-AUTH-21) · **profile is stored separately from the auth record so the publicly-readable data contains no email** (ADR-7) · internal identifier remains the source of truth for authorization (FR-PROF-03b) |
| **AUTH-08** | Profile view | `type:feature` `priority:medium` | AUTH-07 | FR-PROF-04 · TEAM A-13 | A user can view their own profile · **no avatars, bios, locations, phone numbers, payment details, ratings, or public profile pages** (FR-PROF-07) · **no contact control of any kind** · usable at 375 px |
| **AUTH-09** | Server-side access guards | `type:feature` `priority:critical` | AUTH-01, S0-10 | FR-AUTH-22→24 · SEC-A1 · TEAM A-14 · ARCH §11 | Creating an auction and placing a bid require an authenticated session **verified server-side on every request** · browsing and detail viewing require no authentication (FR-AUTH-23) · **client-side route protection is a UX affordance only** and the server rejects independently (FR-AUTH-24) |
| **AUTH-10** | Email privacy and authentication hardening | `type:feature` `priority:critical` | AUTH-07 | FR-PROF-06, FR-SEC-14→16 · SEC-A4, SEC-P1 · SC-42 · TEAM A-15, A-16 | **Email addresses are never visible to any user but their owner**, anywhere, including realtime payloads (SC-42) · credentials never stored recoverably and never returned by any read · error messages never disclose account existence or internal detail · **structural, not filtered** — the publicly-readable profile data contains no email (ADR-7) |
| **AUTH-11** | Authentication testing | `type:testing` `priority:high` | AUTH-02 → AUTH-10 | SC-01, SC-10, SC-38→43 · TEAM A-19 | Automated coverage for registration, login, logout, session persistence, expiry · **unauthorized access rejected when the UI is bypassed entirely** (SC-43) · display-name uniqueness tested including the concurrent case · no-email-verification path tested (SC-70) |
| **AUTH-12** | **Password reset — request and non-enumerating response** | `type:feature` `priority:critical` | AUTH-01, **V-3** | **M24** · FR-AUTH-25→27 · US-23 · SC-61 · TEAM **A-20, A-21** · ARCH §10.3 | Reset is startable from the login screen **without being authenticated** · user supplies their registered email · **the confirmation message is identical whether or not the address is registered — in content and in timing** (FR-AUTH-27, SC-61) · nothing is sent for an unregistered address (EC-27) · screens usable at 375 px |
| **AUTH-13** | **Password reset — delivery, single-use, expiry, completion** | `type:feature` `priority:critical` | AUTH-12 | **M24** · FR-AUTH-28→31 · SC-62→64 · EC-28 · TEAM **A-22→A-24** · ARCH §10.3 | Delivered to the registered address; **knowing the address alone is insufficient** (FR-AUTH-28, SC-62) · reset is **single-use** and **time-limited**; reuse and expiry both rejected with a clear message and a way to request another (SC-63, EC-28) · new password meets the registration strength rule · user signs in immediately with it · **the old password stops working** (SC-64) · **no other account is created or modified** (FR-AUTH-31) · **this is the MVP's only outbound email — no auction, bid, or outcome event may send one** (PRD RS-1) |
| **AUTH-14** | Password reset testing | `type:testing` `priority:high` | AUTH-12, AUTH-13 | SC-60→64 · US-23 · EC-27, EC-28 · TEAM A-25 | Full flow tested end to end (SC-60) · unregistered-address response identical to registered · reuse rejected · expiry rejected · old password invalidated · **reset verified working from a preview deployment** (per V-3) |

**Nothing in this workstream waits on a product answer.** All decisions are final (PRD §21.1).

**Must NOT be built here:** an email-verification step or unverified account state (BR-37) · an Admin role or any admin recovery path (PRD §4.3) · MFA, account deletion, or data export (PRD §14.8) · social/OAuth sign-in · any public profile page or contact mechanism (FR-PROF-07) · native mobile auth, device keychain, or biometrics (PRD §1.1).

---

## 6. Mohammed — Milestone M2, Auction Management

**Assignee:** Mohammed — GitHub **`m7ya505`** · **Branch:** `feature/mohammed-auctions` · **Ownership:** TEAM.md §4, unchanged · **19 Issues**

*All 19 Issues in this section are assigned in GitHub to **`m7ya505`**.*

Every Issue carries `area:auction`. Shared traceability: TEAM.md §4, §13.2 · ARCHITECTURE §12, §16, §9.6.

| ID | Title | Labels | Depends on | Traceability | Acceptance Criteria |
|---|---|---|---|---|---|
| **AUC-01** | Create-auction form | `type:feature` `priority:critical` | S0-09, S0-11 | FR-CREATE-01, 03 · US-05 · TEAM M-02 | Form captures **all five required fields**: image, name, description, **starting price in SAR**, end time · **no optional fields** · **no reserve-price field** (BR-35, FR-CREATE-03) · usable at 375 px |
| **AUC-02** | Creation validation — **5 minutes to 7 days**, SAR, no ceiling | `type:feature` `priority:critical` | AUC-01, S0-12 | **BR-38, BR-21, BR-33** · FR-CREATE-04→14 · US-06 · **SC-68** · TEAM M-03, M-04 | Name 3–100, description 10–2000 after trimming · starting price **> 0, two decimals, in SAR** · **end time between 5 minutes and 7 days ahead — inclusive at both ends** (SC-68); exactly 5 min and exactly 7 days accepted; less or more rejected with a message naming the range · **compared against server time, never client time** (BR-19) · **no maximum starting price — a large value must not be rejected for size** (FR-CREATE-07) · all failing fields reported at once with entries preserved · **enforced server-side; bypassing the form is rejected identically** |
| **AUC-03** | Duplicate-submission prevention | `type:feature` `priority:high` | AUC-01 | **EC-21** · FR-CREATE-26a · ARCH §12.3 | A double-click or retry cannot create two auctions from one intent · **this is a correctness requirement, not polish: with no cancellation (BR-30) and no editing (BR-31), a duplicate can never be removed by anyone** · the form gives a clear view of values before submission |
| **AUC-04** | Product image upload with server-side validation | `type:feature` `priority:critical` | AUC-01, S0-04 | FR-CREATE-15→18, 21 · US-07 · TEAM M-05 · ARCH §16 | Exactly one image per auction · JPEG, PNG, WebP accepted; others rejected with a specific message · 5 MB limit enforced · **type validated server-side by content, not by file extension** (FR-CREATE-18) · **write access scoped to the owner — a user cannot attach an image to another user's auction** (SEC-Z8) · uses the browser file input; **no camera or gallery integration** (PRD §1.1) |
| **AUC-05** | Image failure handling — no partial auction | `type:feature` `priority:high` | AUC-04 | FR-CREATE-19 · EC-08 · **SC-04** · TEAM M-06 · **ARCH ADR-6** | Upload failure creates **no auction** · clear message; retry **without re-entering the other fields** · **image is uploaded before the record is created** (ADR-6) so a failure leaves an invisible orphan rather than a visible broken listing · rejected type/size names the accepted formats and the limit |
| **AUC-06** | Image display and public read access | `type:feature` `priority:high` | AUC-04 | FR-CREATE-20 · FR-DETAIL-04 · EC-18 | Image visible on listing and detail **to unauthenticated visitors** · sensible placeholder if it fails to load, with the auction still fully functional and biddable (EC-18) |
| **AUC-07** | Auction ownership from the verified session | `type:feature` `priority:critical` | AUC-01, **S0-10** | FR-CREATE-02, 22 · BR-10 · **SC-39** · TEAM M-08 · ARCH §10.4 | Owner taken from the **server-side verified identity**, never from the request payload · **a crafted request naming a different owner is attributed to the authenticated caller** (SC-39) · ownership is permanent and non-transferable |
| **AUC-08** | Publication and immutability | `type:feature` `priority:critical` | AUC-02, AUC-07 | **BR-30, BR-31** · FR-CREATE-24→29 · **SC-58, SC-59** · TEAM M-09 | Auction becomes **Active immediately**; current price = starting price; empty history · appears in the listing at once · user lands on its detail page · **no edit control, screen, or route exists** (SC-58) · **no cancel control, rule, or route exists; no `Cancelled` state is reachable** (SC-59) · **no persisted Draft** |
| **AUC-09** | Auction listing — **active auctions only** | `type:feature` `priority:critical` | AUC-08, S0-09, **V-4** | **FR-LIST-05, 05a, 06** · FR-LIST-01→03, 08→13 · **SC-71** · US-08 · TEAM M-10, M-12, M-13 · ARCH §9.6 | Public, no authentication required · **only Active auctions appear; an ended auction never appears** (SC-71) · ordered **soonest end time first** · each entry shows thumbnail, name, **current price in SAR** labelled as current bid or starting price, status, time remaining · empty state with a create prompt when signed in · **no bidder identities or emails** · usable with 100 auctions inside NFR-PERF-01's 3 s · responsive at 375 px |
| **AUC-10** | Listing countdown and leave-on-end behavior | `type:feature` `priority:high` | AUC-09 | **FR-LIST-05b** · FR-LIST-04 · TEAM M-11 | Countdown runs continuously without a page refresh · **when an auction ends it leaves the listing, and the transition does not look like a page error** (FR-LIST-05b) · **ended auctions remain reachable by direct link with full outcome and history** (FR-LIST-05a, FR-END-12) |
| **AUC-11** | Auction detail page shell and component mount points | `type:feature` `priority:critical` | **S0-13**, S0-09 | PRD §8.5 · FR-DETAIL-01 · TEAM M-14 · **TEAM §11 page split** | Page shell, layout, and auction data loading · **mounts Rayan's components and passes the auction id** · **Mohammed does not edit Rayan's component files** · public, no authentication required · responsive at 375 px · **one of Mohammed's first tasks so Rayan has somewhere to mount** (TEAM §14) |
| **AUC-12** | Detail page product content and seller identity | `type:feature` `priority:high` | AUC-11 | FR-DETAIL-02→04, 13 · TEAM M-15 | Full name; full description with line breaks preserved; image at evaluable size with placeholder fallback · **seller's display name shown, never their email** (FR-DETAIL-13) |
| **AUC-13** | Detail page status and countdown | `type:feature` `priority:high` | AUC-11 | FR-DETAIL-07, 08 · TEAM M-16 | Status shown explicitly · live countdown updating at least once per second, **derived from the server-supplied end time** (RT-P3) · absolute end time shown in the viewer's local timezone with the zone explicit (NFR-USA-07) · **the end time never changes — there is no anti-sniping extension** (BR-36) |
| **AUC-14** | Current price display region | `type:feature` `priority:high` | AUC-11, S0-12 | FR-DETAIL-05, 06 · **BR-13** · TEAM M-17 · **ARCH §9.4** | Current price is the **most visually prominent element** on the page (NFR-USA-04) · shown in SAR using the agreed format · distinguishes `Starting price: 100 SAR (no bids yet)` from `Current bid: 250 SAR` · makes clear a first bid of exactly the starting price is acceptable (BR-29) · **Mohammed builds the region; Rayan supplies the value and its updates — Mohammed never computes the price** (ARCH §9.4) |
| **AUC-15** | Viewer-type rendering on the detail page | `type:feature` `priority:high` | AUC-11, **S0-10** | FR-DETAIL-14→17 · **SC-07** · TEAM M-18 | **Unauthenticated** → sign-in prompt where the bid control would be · **signed-in non-owner, Active** → Rayan's bid control slot rendered · **owner** → no usable control plus a message explaining owners cannot bid (BR-02) · **any viewer, Ended** → no control · SC-07 matrix passes |
| **AUC-16** | Not-found and expired-auction presentation | `type:feature` `priority:medium` | AUC-11 | FR-DETAIL-24, 25 · EC-04, EC-13 · TEAM M-19 | A non-existent auction shows a clear not-found message, not an error page · **an auction whose end time has passed is presented as ended even before close processing has run**, and no bid is accepted meanwhile (EC-04, LC-03) |
| **AUC-17** | Seller view of a completed auction | `type:feature` `priority:high` | AUC-11, **BID-16** | FR-END-13 · FR-DETAIL-21, 21a · US-16 · **SC-66** · TEAM M-20 | With bids → `Auction Ended` / `Winner: <display name>` / `Final Bid: <amount> SAR` · with no bids → clear statement that it ended with no bids and no winner (BR-09) · full unchanged bid history · **no control to reopen, extend, re-run, edit, or cancel** · **presents no next step — no payment, contact, or shipping** (FR-DETAIL-21a, SC-67) |
| **AUC-18** | Auction authorization — no modify or delete route | `type:feature` `priority:critical` | AUC-08 | FR-SEC-03, 04, 09 · **SC-38, SC-58, SC-59** · TEAM M-22 · ARCH §11.2 | A user cannot modify or delete **any** auction, their own included · no route exists via UI or crafted request to change name, description, starting price, end time, or image (SC-58) · no route exists to cancel or reach a `Cancelled` state (SC-59) · a user cannot create an auction attributed to another user (SC-39) |
| **AUC-19** | Auction testing | `type:testing` `priority:high` | AUC-01 → AUC-18 | SC-01→07, SC-58, SC-59, SC-68, SC-71 | Creation happy path · **every validation rule individually, including the 5-minute and 7-day boundaries** (SC-68) · image handling including failure · listing shows active only (SC-71) · detail rendering per viewer type (SC-07) · edit/cancel routes absent (SC-58, SC-59) · **tests exercise the server path directly, bypassing the UI** |

**Nothing in this workstream waits on a product answer.**

**Must NOT be built here:** cancel control or `Cancelled` state (BR-30) · edit screen or route (BR-31) · persisted Draft (BR-14) · reserve-price field (BR-35) · maximum price ceiling (BR-21) · ended auctions in the main listing (FR-LIST-05) · any payment, checkout, shipping, or contact surface (§19.0) · camera/gallery integration or any native mobile capability (PRD §1.1).

---

## 7. Rayan — Milestone M3, Bidding & Realtime

**Assignee:** Rayan — GitHub **`RayanAlDwlah`** · **Branch:** `feature/rayan-bidding` · **Ownership:** TEAM.md §5, unchanged · **21 Issues**

*All 21 Issues in this section are assigned in GitHub to **`RayanAlDwlah`**. **Rayan is and remains the primary owner of the entire bidding and realtime domain** — see §7.1 on the support model, which transfers no ownership.*

Shared traceability: TEAM.md §5, §13.3 · ARCHITECTURE §13, §14, §15, ADR-2, ADR-9.

> **This is the largest and hardest workstream, and it carries almost all of the architectural risk** (TEAM.md §25 risk 1, ARCHITECTURE §23 risks 2 and 4). BID-02, BID-03, BID-15, and BID-20 deserve the majority of the team's review attention.

### 7.1 Support model — Rayan retains full ownership of the bidding domain

> **Rayan is and remains the primary owner of the entire bidding and realtime domain. Nothing below transfers ownership.**

**Rayan owns, exclusively and permanently:**

| Domain | Issues |
|---|---|
| **Bid validation** | BID-02, BID-04, BID-13 |
| **The atomic bid operation** | **BID-02** — the trust boundary |
| **Concurrency** | **BID-03**, BID-20 |
| **Current-price correctness** | **BID-05** |
| **Bid history logic** | BID-01 |
| **Realtime bidding updates** | BID-08, BID-09, BID-10, BID-11, BID-12, BID-17 |
| **Auction closing** | **BID-15**, BID-19 |
| **Winner determination** | **BID-16** |

**The planned support, if and when capacity allows.** Abdulrahman's workstream is the smallest and least blocked (§10.1); Rayan's is the largest and carries the correctness-critical work. TEAM.md §25 risk 1 and ARCHITECTURE §23 risk 4 both flag this imbalance. **After Abdulrahman completes his critical authentication work** (AUTH-01 → AUTH-11 and the password-reset Issues AUTH-12 → AUTH-14), he may support Rayan with **lower-risk** work only:

| Eligible for support | Issue | Why it is low-risk |
|---|---|---|
| **Bid history UI** | BID-07 | Presentation of already-committed data. No validation, no state change |
| **Winner / result UI** | BID-18 | Renders a recorded outcome. Computes nothing |
| **Bid rejection messaging** | BID-04 | Wording and presentation of reasons the operation already returns |
| **Integration testing** | INT-02, INT-05 | Verification, not implementation |
| **UI verification** | INT-06 | Responsive checking at 375 px |

**Rules governing this support — non-negotiable:**

| Rule | |
|---|---|
| **Ownership does not move.** Rayan stays the primary owner of every Issue above, including any he receives help on | TEAM.md §7 |
| **Rayan reviews and approves** every PR arising from this support | §11.3 |
| **Never eligible for support:** BID-02 (bid operation), BID-03 (concurrency), BID-05 (current price), BID-13 (end-time boundary), BID-14 (authorization), BID-15 (closing), BID-16 (winner determination), BID-20 (concurrency test) | These are the correctness-critical core |
| Support is **offered when capacity exists**, not scheduled as a dependency. No Issue is planned assuming it happens | |
| If support occurs, it is noted in the Issue thread so ownership stays unambiguous | TEAM.md §7 |

| ID | Title | Labels | Depends on | Traceability | Acceptance Criteria |
|---|---|---|---|---|---|
| **BID-01** | Bid record and append-only history storage | `type:feature` `area:bidding` `priority:critical` | S0-11 | **BR-05, BR-18** · SEC-I1 · **SC-15** · TEAM R-01 · ARCH §11.2 | Bids are append-only and permanent · **no update or delete path exists for any user, including the bidder and the seller** (SC-15) · records amount, bidder identity, and timestamp · history survives auction close unchanged |
| **BID-02** | **Bid acceptance operation — the trust boundary** | `type:feature` `area:bidding` `priority:critical` | **V-1**, S0-10, S0-11, BID-01 | **BR-01→04, BR-28, BR-29, BR-32** · FR-BID-01→10 · **ARCH ADR-2, §13.2, §13.2a** | **One serialized atomic operation is the only path that can insert a bid; direct insert is denied to every user role** (ADR-2) · in one transaction: verify authentication → **lock the auction row** → re-read state inside the lock → check end time against the **database clock** → check caller is not the owner → check amount well-formed → check **minimum acceptable bid** → append bid → update current price · **no bids yet → `amount >= starting price`; has bids → `amount > current price`** (BR-28) · **a first bid exactly equal to the starting price is accepted** (SC-55) · **immediately after, a second bid of the same amount is rejected; +0.01 SAR is accepted** (SC-56) · **no increment check, no maximum check, no leading-bidder check, no reserve check** (§13.2a) · SC-08→14, SC-55→57 pass |
| **BID-03** | **Concurrency correctness** | `type:feature` `area:bidding` `priority:critical` | **V-1**, BID-02 | **BR-11, BR-12** · FR-BID-11→17 · NFR-DAT-03 · **SC-16, SC-17, SC-19** · TEAM R-05 | Concurrent bids on one auction resolve to **one definitive ordering** · **exactly one bid accepted per price level** (SC-16) · **no bid lost, none duplicated** — accepted count equals history count (NFR-REL-04) · history amounts **strictly increasing** (SC-17) · **bids on different auctions do not block each other** (ARCH §13.3) · after concurrent bidding, close yields exactly one winner matching the highest bid (SC-19) |
| **BID-04** | Rejection feedback — every path, with a distinct concurrency message | `type:feature` `area:bidding` `priority:high` | BID-02 | **BR-23, BR-27** · FR-BID-13 · EC-01, EC-06 · **SC-13, SC-18** · TEAM R-06, R-07 · ARCH §13.5 | Every rejection gives a **specific, actionable** reason (SC-13) · the eight reasons in ARCH §13.5 are distinguishable · **losing a concurrent race says "Someone bid before you — the current price is now X SAR", clearly different from a plain too-low bid, because the user did nothing wrong** (SC-18, EC-01) · **a rejection leaves auction state entirely unchanged and adds nothing to history** (BR-23) |
| **BID-05** | Current price derivation | `type:feature` `area:bidding` `priority:critical` | BID-02 | **BR-07, BR-13** · NFR-DAT-01 · **SC-40** · TEAM R-08 · **ARCH §9.4** | Current price is **always** the highest accepted bid, or the starting price when there are none — zero tolerance for divergence · **written only by the bid operation, in the same transaction as the bid it derives from** · **no user can set it** (SC-40) · independently recomputable from history at any time |
| **BID-06** | Minimum acceptable bid display | `type:feature` `area:bidding` `priority:high` | BID-02, S0-12 | FR-BID-10 · **NFR-USA-11** · TEAM R-04 | The minimum is shown in SAR before submission · **the inclusive/exclusive distinction is unmistakable** — "Bidding starts at 100 SAR" with no bids, "Enter more than 250 SAR" once bidding has begun · updates when the price changes |
| **BID-07** | Bid history display — public | `type:feature` `area:bidding` `priority:high` | BID-01, S0-13 | **BR-40** · FR-BID-22, 22a, 23 · FR-DETAIL-10→12 · **SC-75** · TEAM R-09 | Visible to **unauthenticated visitors** (SC-75) · each entry shows amount in SAR, **display name**, timestamp · most recent first, highest clearly marked · "No bids yet" empty state · **never an email address** (BR-26) · remains visible after close · responsive at 375 px |
| **BID-08** | Realtime foundation | `type:feature` `area:realtime` `priority:critical` | S0-04 | PRD §13 · FR-RT-01 · **ARCH §14.1, ADR-9** | Clients subscribe **directly to Supabase, not through Vercel** (ARCH §14.1) · subscriptions are **scoped per auction**, not global (§14.2) · **realtime is a projection of committed state, never an authority** (ADR-9, BR-22) |
| **BID-09** | Realtime price and history updates | `type:feature` `area:realtime` `priority:critical` | BID-08, BID-05, BID-07 | FR-RT-03, 04 · **NFR-RT-01, NFR-RT-02** · US-13 · **SC-20, SC-21** · TEAM R-11 | An accepted bid reaches **all current viewers within 2 seconds** with no refresh (SC-20) · the new history entry arrives in the same update (SC-21) · **holds with at least 20 simultaneous viewers** (NFR-RT-02) · all viewers converge on the same displayed state |
| **BID-10** | Realtime UX rules | `type:feature` `area:realtime` `priority:high` | BID-09 | FR-RT-05→07, 09, 10 · RT-X1→X5 · **SC-22** · TEAM R-12 | The change is **visually noticeable** · **does not clear a partially typed amount, steal focus, or scroll the page** (SC-22) · if the new price exceeds what the user typed, that is indicated **without altering their entry** · **price never appears to move downward** (RT-X5) · duplicate delivery has no visible effect |
| **BID-11** | Realtime connection loss and reconnection resync | `type:feature` `area:realtime` `priority:high` | BID-08 | FR-RT-11→13 · RT-R2, RT-R3 · EC-10 · US-14 · **SC-24** · TEAM R-14, R-15 | Loss of the live connection is surfaced clearly and calmly within 10 s · loaded data stays readable · bid control disabled or marked stale · **on reconnect the client resynchronizes to authoritative current state, not a resumed partial stream** (SC-24) · **bidding still works when realtime is unavailable — the paths are independent** (RT-R7) · a refresh always recovers correct state (EC-09) |
| **BID-12** | Realtime payload privacy | `type:feature` `area:realtime` `priority:critical` | BID-09 | RT-S1→S3 · **SC-42** · TEAM R-16 · ARCH §14.4 | Payloads carry only data the recipient may already see · **never an email address** (SC-42) · **structural, not filtered**: authorization applies to subscriptions identically, and emails are not in any publicly-readable data (ADR-7, ARCH §14.4) |
| **BID-13** | End-time boundary enforcement | `type:feature` `area:bidding` `priority:critical` | BID-02 | **BR-04, BR-19** · FR-BID-18→21 · EC-02, EC-17 · **SC-27, SC-28** · TEAM R-18 · **PRD LC-03** | **A bid at or after the end time is always rejected — even if the record still says Active** (SC-27, LC-03) · a bid accepted a fraction before the end time counts toward the winner (SC-28) · **comparison uses the database clock; a wrong or manipulated client clock changes nothing** (EC-17) · the user is always told definitively which side of the deadline they fell on |
| **BID-14** | Bidding authorization | `type:feature` `area:bidding` `priority:critical` | BID-01, BID-02 | SEC-Z4→Z7 · **SC-40, SC-43** · TEAM R-24 · ARCH §11.2, §11.4 | No user can create, modify, or delete a bid outside the operation · no user can set current price, status, or winner (SC-40) · **every bidding rule holds when the UI is bypassed entirely** (SC-43) · **the elevated-privilege operation re-verifies identity internally, since it bypasses row-level security** (ARCH §11.4) |
| **BID-15** | **Automatic auction closing** | `type:feature` `area:bidding` `priority:critical` | **V-2**, BID-13 | FR-END-01→04 · US-15 · **SC-25, SC-26** · TEAM R-17 · **ARCH §15.3** | Marked Ended **within 30 seconds** of the end time (SC-25) · **automatic — no human action, no admin, no manual control** · **closes whether or not anyone is viewing** (SC-26) · **three triggers against one idempotent operation**: scheduled sweep (the SC-26 guarantee), on-read, on-bid-attempt (ARCH §15.3) · **the end time is the one recorded at creation — no extension logic** (BR-36, SC-74) · **invocable directly in a test environment without waiting real time** (NFR-MNT-03) |
| **BID-16** | Winner determination, zero-bid closure, and outcome recording | `type:feature` `area:bidding` `priority:critical` | BID-15 | **BR-06, BR-09, BR-17, BR-35** · FR-END-05→11 · **SC-29→33** · TEAM R-19→R-21 | **The recorded winner is the highest bidder in history for 100% of closed auctions, verified by independent recomputation** (SC-29) · final price equals the winning bid (SC-30) · **zero bids → no winner, no final price, no error — a normal path** (SC-31, BR-09) · **no reserve check; the highest bid wins whatever its amount** (BR-35) · **runs exactly once and is idempotent — re-running changes nothing** (SC-32) · history preserved unchanged (SC-33) |
| **BID-17** | Realtime status transition on close | `type:feature` `area:realtime` `priority:high` | BID-15, BID-09, AUC-11 | FR-RT-08 · US-18 · **SC-23** · TEAM R-13 | When an auction ends while a user watches: **status changes, bid control disappears, outcome appears — with no refresh** (SC-23) · the transition is clean and unmistakable (RT-X7) |
| **BID-18** | Winner display | `type:feature` `area:bidding` `priority:high` | BID-16, S0-13 | FR-END-14, 16 · FR-DETAIL-18→21a · US-17 · **SC-66, SC-67** · TEAM R-22 | Winner sees `🎉 You won this auction!` / `Final Bid: <amount> SAR` / `Status: Ended` · any viewer sees the winner and final price · non-winning bidders see the outcome · **no screen offers or implies payment, contact, messaging, or shipping** (SC-67, BR-34) · responsive at 375 px |
| **BID-19** | Terminal-state enforcement | `type:feature` `area:bidding` `priority:high` | BID-15 | **BR-15** · FR-END-18 · **SC-34** · TEAM R-23 | **No route exists to reopen, extend, or re-run an ended auction** (SC-34) · outcome fields are not user-writable · Ended is terminal |
| **BID-20** | **Concurrency testing — required, not optional** | `type:testing` `area:bidding` `priority:critical` | BID-03 | **NFR-MNT-02** · SC-16→19 · TEAM R-25 | **An automated test submits genuinely simultaneous bids and asserts exactly one acceptance** (NFR-MNT-02) · a stress run shows every accepted bid exactly once with strictly increasing amounts · run repeatedly, not once · **this is the single most important test in the project** (ARCH §23 risk 2) |
| **BID-21** | Bidding and realtime testing | `type:testing` `area:bidding` `priority:high` | BID-02 → BID-19 | SC-08→28, SC-55→57, SC-72→75 | Every rejection path · **boundary bids at the end time** (SC-27, SC-28) · **first bid equal to starting price accepted; second equal rejected; +0.01 accepted** (SC-55, SC-56) · **a bid never rejected for being too large or too small an increase** (SC-57) · **a leading bidder can bid again** (SC-72) · **no reserve outcome exists** (SC-73) · **a late bid does not extend the end time** (SC-74) · two-browser realtime verification · connection loss and recovery (SC-24) |

**Nothing in this workstream waits on a product answer.**

**Must NOT be built here:** a bid increment (BR-32) · a maximum bid or price ceiling (BR-21) · a leading-bidder block (BR-24) · a reserve check or "reserve not met" outcome (BR-35) · anti-sniping extension (BR-36) · manual or admin closing (PRD §4.3) · push notifications or any outbound message (PRD §16, RS-1) · any payment or contact step after the result (BR-34).

---

## 8. Shared and integration Issues — Milestone M4

These belong to no single workstream. Each still names **one** primary owner, with the other two as required reviewers.

| ID | Title | Owner | Labels | Depends on | Traceability | Acceptance Criteria |
|---|---|---|---|---|---|---|
| **INT-01** | **Checkpoint CP-1 — identity flows end to end** | **Abdulrahman** — `Dem4t` | `type:integration` `area:shared` `priority:high` | AUTH-04, AUC-07 | TEAM §14 CP-1 · SC-01, SC-39 | Everyone merges `main` into their branch first · a user registers, signs in, and creates an auction **correctly attributed to them** · a crafted request naming a different owner is attributed to the caller (SC-39) · verified jointly by Abdulrahman and Mohammed |
| **INT-02** | **Checkpoint CP-2 — the live loop, two browsers** | **Rayan** — `RayanAlDwlah` | `type:integration` `area:realtime` `priority:critical` | AUC-11, BID-02, BID-05, BID-09 | TEAM §14 CP-2 · **SC-20→22** | Two browsers open the same auction · a bid in one updates the other's price **and** history **within 2 seconds with no refresh** · the update does not clear a typed amount, steal focus, or scroll · **this is the product's defining characteristic and cannot be verified from a diff — it needs a running preview** |
| **INT-03** | **Checkpoint CP-3 — full lifecycle** | **Rayan** — `RayanAlDwlah` | `type:integration` `area:shared` `priority:critical` | BID-15, BID-16, BID-18, AUC-17 | TEAM §14 CP-3 · SC-25→37 | An auction runs, takes bids, **closes automatically**, and shows the **correct winner** to seller, winner, and other viewers · the zero-bid auction closes cleanly with no winner · all three developers present |
| **INT-04** | Verify auction ownership attribution | **Abdulrahman** — `Dem4t` | `type:integration` `area:auth` `priority:high` | AUC-07 | FR-CREATE-02 · SC-39 · TEAM **A-17** | Abdulrahman confirms Mohammed's creation flow uses the **server-side verified identity**, not the client-side convenience (ARCH §10.4) · the crafted-owner case is rejected |
| **INT-05** | Verify bid attribution and unauthenticated rejection | **Abdulrahman** — `Dem4t` | `type:integration` `area:auth` `priority:high` | BID-02 | FR-BID-01 · **SC-10** · TEAM **A-18** | Abdulrahman confirms bids are attributed to the verified session identity · **an unauthenticated bid is rejected including via a crafted request** (SC-10) · confirms the **server-side authoritative** identity path is used, never the client one |
| **INT-06** | **Responsive validation at 375 px across every surface** | **Mohammed** — `m7ya505` | `type:integration` `area:shared` `priority:high` | AUTH-05, AUC-09, AUC-11, BID-07, BID-18 | **PRD §1.1** · NFR-USA-06 · **SC-49** | **Every** MVP surface fully usable in a **mobile web browser** at 375 px: register, login, password reset, profile, listing, detail, bid control, history, results · **no horizontal scrolling, no inaccessible controls** · **this validates responsive web design — it is not a mobile-app test; no native build, emulator, or store submission is involved** (PRD §1.1) |
| **INT-07** | Security and authorization audit | **Rayan** — `RayanAlDwlah` | `type:integration` `area:shared` `priority:critical` | AUC-18, BID-14, AUTH-09, AUTH-10 | **SC-38→43, SC-58, SC-59** · ARCH §11, §23 risk 1 | Every state-changing operation fails without proper authorization · **the UI is bypassed entirely and every rule still holds** (SC-43) · no route to modify another user's auction (SC-38), edit (SC-58), cancel (SC-59), set price/status/winner (SC-40), or attach an image to another's auction (SC-41) · **emails invisible everywhere including realtime payloads** (SC-42) · **authorization policies reviewed for completeness — a single permissive table is a full data exposure** (ARCH §23 risk 1) |
| **INT-08** | **Excluded-features audit** | **Mohammed** — `m7ya505` | `type:integration` `area:shared` `priority:high` | INT-03 | **SC-67** · PRD §19.0, SD-05 · TEAM §26 | Walk every screen and confirm **none** of the following was built: payment, checkout, wallet, card entry, refund, shipping, fulfillment · seller/winner messaging or contact exchange · cancel control or `Cancelled` state · edit screen or route · reserve field · bid increment · price ceiling · anti-sniping · email-verification step · Admin role · ended auctions in the main listing · **the term "Demo Points"** · **any native mobile artifact** · SC-67 passes |
| **INT-09** | **MVP end-to-end validation** | **Rayan** — `RayanAlDwlah` | `type:integration` `area:shared` `priority:critical` | INT-01→INT-08 | **PRD §18.3** | §13 of this plan. **The MVP is not complete until this passes in full** |
| **INT-10** | Production deployment verification on Vercel | **Abdulrahman** — `Dem4t` | `type:integration` `area:shared` `priority:high` | INT-09 | ARCH §18.3 · PRD §1.1 | `main` deploys to the Vercel production URL · production targets the **production** Supabase project · the full §13 scenario passes **on the deployed production URL**, not only locally · a failed build leaves the previous deployment live · reachable and usable from a desktop **and** a mobile browser |

---

## 9. Dependency graph

```text
                          ┌──────────────────────────────┐
                          │  S0-00  rename  ✅ COMPLETE  │
                          │  usernames      ✅ CONFIRMED │
                          └──────────────┬───────────────┘
                                         ▼
                          ┌──────────────────────────────┐
                          │  S0-01  commit the four docs │  ← main already exists (9326623c)
                          └──────────────┬───────────────┘
                     ┌───────────────────┼───────────────────┐
                     ▼                   ▼                   ▼
             S0-02 protect main    S0-03 labels/       S0-04 Supabase
             + 3 branches          milestones/PR       projects
                     │             template                  │
                     │                                       ├──► S0-05 Vercel
                     │                                       ├──► S0-06 env vars
                     │                                       ├──► V-1 ★ locking
                     │                                       ├──► V-2 ★ scheduling
                     │                                       ├──► V-3 preview target
                     │                                       └──► V-4 thumbnails
                     ▼
             S0-07 web scaffold ──┬──► S0-08 routing ──► S0-13 detail page split ★
                                  ├──► S0-09 UI primitives
                                  ├──► S0-11 auction contract ★
                                  └──► V-5 local lifecycle

             S0-10 identity contract ★        S0-12 SAR representation ★
             (needs S0-04)                    (no dependency — can start day one)

  ════════════════ SPRINT 0 EXIT: contracts published, V-1 + V-2 answered ════════════════

        ABDULRAHMAN                 MOHAMMED                    RAYAN
        (M1, branch auth)           (M2, branch auctions)       (M3, branch bidding)
             │                           │                           │
        AUTH-01 foundation          AUC-01 create form          BID-01 bid record
             │                           │                           │
        AUTH-02 registration        AUC-02 validation           BID-02 ★ bid acceptance
        AUTH-03 validation            (5min–7d, SAR)              (needs V-1, S0-10, S0-11)
          (unique name,             AUC-03 dup prevention           │
           no verification)         AUC-04 image upload         BID-03 ★ concurrency
        AUTH-04 login               AUC-05 image failure        BID-04 rejection msgs
        AUTH-05 logout + state      AUC-06 image display        BID-05 current price
        AUTH-06 session/expiry      AUC-07 ownership ◄──────┐   BID-06 min bid display
        AUTH-07 identity+profile ───┼───────────────────────┘   BID-07 history (public)
        AUTH-08 profile view        AUC-08 publication          BID-08 realtime foundation
        AUTH-09 access guards       AUC-09 listing (active)     BID-09 ★ live updates
        AUTH-10 email privacy       AUC-10 countdown/leave      BID-10 realtime UX
        AUTH-11 auth testing        AUC-11 detail shell ───────►BID-13 end-time boundary
        AUTH-12 reset request       AUC-12 product content      BID-11 conn loss/resync
        AUTH-13 reset completion    AUC-13 status+countdown     BID-12 realtime privacy
        AUTH-14 reset testing       AUC-14 price region ◄───────BID-14 authorization
             │                      AUC-15 viewer rendering     BID-15 ★ auto closing
             │                      AUC-16 not-found/expired      (needs V-2)
             │                      AUC-17 seller result ◄──┐   BID-16 ★ winner determ.
             │                      AUC-18 authorization     │  BID-17 status transition
             │                      AUC-19 auction testing   └──BID-18 winner display
             │                           │                      BID-19 terminal state
             │                           │                      BID-20 ★ concurrency test
             │                           │                      BID-21 bid/realtime tests
             └───────────────────────────┼───────────────────────────┘
                                         ▼
                              INTEGRATION (M4)
              INT-01 CP-1 identity  ·  INT-02 CP-2 live loop
              INT-03 CP-3 lifecycle ·  INT-04/05 attribution
              INT-06 responsive 375px · INT-07 security audit
              INT-08 excluded-features audit
                                         ▼
                          INT-09 ★ MVP end-to-end validation
                                         ▼
                          INT-10 Vercel production verification

  ★ = highest risk / highest review priority
```

### 9.1 The genuine cross-developer blocks

Only **five** real cross-workstream dependencies exist. Everything else is internal to one workstream.

| Blocked work | Blocked by | Owner of blocker | Why it is real | Early-unblock |
|---|---|---|---|---|
| AUC-07, AUC-15 | **S0-10** identity contract | Abdulrahman | Auction ownership must come from verified identity (FR-CREATE-02) | **S0-10 is a contract, not an implementation** — publish it on day one, before the auth code is finished |
| BID-02 | **S0-10** + **S0-11** | Abdulrahman, Mohammed | Bid validation reads verified identity and six auction fields | Rayan builds the validation **structure** against agreed placeholders; substitution is small |
| AUC-14 price region | **BID-05** current price | Rayan | Rayan owns the value; Mohammed owns the display (ARCH §9.4) | Mohammed builds the display region; the value arrives later |
| BID-17, BID-18 | **AUC-11** detail shell | Mohammed | Rayan's components need somewhere to mount | **AUC-11 is one of Mohammed's first tasks**, even as an empty shell (TEAM §14) |
| AUC-17 seller result | **BID-16** winner determination | Rayan | Mohammed displays an outcome Rayan computes | Genuinely late. Mohammed should schedule it last with other work queued |

**No artificial dependencies have been created.** Where a dependency exists, an early-unblock path is given.

---

## 10. Parallel work

### 10.1 Available immediately after Sprint 0

| Developer | Can start at once, blocked by nobody |
|---|---|
| **Abdulrahman** | AUTH-01 → AUTH-08, AUTH-10 → AUTH-14. **Essentially his whole workstream, including all of password reset.** He is the least blocked person on the team |
| **Mohammed** | AUC-01 → AUC-06, AUC-08 → AUC-13, AUC-16. The create flow, images, listing, and the detail shell |
| **Rayan** | BID-01, BID-06, BID-08, BID-11, BID-12, BID-19 — **and critically BID-03's concurrency work, which depends on nobody and is his hardest task** |

### 10.2 The three Issues that unblock everyone

Do these first, in the first working session:

1. **S0-10 — identity contract** (Abdulrahman). Unblocks Mohammed and Rayan. **The single highest-priority task on the team** (TEAM §14).
2. **S0-11 — auction record contract** (Mohammed, agreed with Rayan). Unblocks all bid validation and closing.
3. **S0-13 — detail page component split** (Mohammed with Rayan). Unblocks Rayan's UI and prevents the project's worst recurring merge conflict.

Plus **S0-12 (SAR)**, which depends on nothing and can be agreed on day one.

### 10.3 Parallelism during Sprint 0

Sprint 0 itself parallelizes three ways, which is why it should take a session rather than a week:

```text
Rayan:        S0-01 → S0-02 → S0-03    then    V-1 ★, V-2 ★, V-5, S0-12
Abdulrahman:  S0-04 → S0-05 → S0-06    then    S0-10 ★, V-3
Mohammed:     S0-07 → S0-08 → S0-09    then    S0-11 ★, S0-13 ★, V-4
```

Only S0-01 is a hard serialization point — nothing else can happen until `main` exists.

---

## 11. Git and Pull Request workflow

### 11.1 The loop

```text
Developer picks an Issue from their milestone
        ↓
git checkout feature/<their-branch>   ·   git merge main   (sync first — TEAM §17)
        ↓
Focused commits, Conventional Commits style (TEAM §21)
        ↓
git push
        ↓
Open a Pull Request → main, referencing the Issue ("Closes #N")
        ↓
Vercel builds a PREVIEW deployment with its own URL
        ↓
At least one other team member reviews (TEAM §15)
        ↓
Review comments addressed
        ↓
Approved
        ↓
Author merges their own PR    (responsibility stays with who understands it)
        ↓
main  →  Vercel PRODUCTION
        ↓
Issue closes automatically
```

### 11.2 Rules

| Rule | Source |
|---|---|
| **Nobody commits directly to `main`** — enforced by protection, not discipline | TEAM §8, S0-02 |
| Every change reaches `main` through a reviewed PR | TEAM §15 |
| **At least one approving review** before merge | TEAM §15 |
| A PR references its Issue and describes what changed and what was tested | TEAM §20 |
| **A PR does not mix unrelated features** | TEAM §15 |
| Open a PR when a coherent piece is done, not when the workstream is done — reviewable in 15–20 minutes | TEAM §15 |
| **Resolve conflicts in the feature branch before merging**, never in `main` | TEAM §18 |
| Merge `main` into your branch before opening **and** before merging a PR | TEAM §17 |
| **Merge, not rebase**, on shared branches | TEAM §17 |
| The **author** merges after approval | TEAM §15 |
| **A broken `main` is everyone's problem** — fixing it precedes feature work | TEAM Rule 17 |
| **No GitHub Actions are created.** Vercel's own integration provides preview and production builds | This phase's restrictions |

### 11.3 Choosing a reviewer

| If the PR… | Review by |
|---|---|
| Touches only your own area | Either other developer |
| Consumes another's functionality | **That developer** |
| Modifies a shared file (TEAM §11) | **The file's owner** |
| Changes global config or the entry point | **Both others** |
| Changes an agreed contract (identity, auction record, SAR) | **Both others** |
| **Touches the bid operation, concurrency, or closing** | **Both others** — highest-risk code in the project |

### 11.4 Shared-file conflict prevention

The component boundaries from TEAM.md §11 are respected exactly; **no ownership is changed**. Sprint 0 creates the boundaries before any feature code:

| Shared surface | Prevention | Issue |
|---|---|---|
| **Auction detail page** — the three-way collision | Split into separately owned **empty component files** on day one. Mohammed owns shell, product content, status/countdown, price display region; Rayan owns bid control, history, outcome banner. Neither edits the other's files | **S0-13** |
| Routing | One structure, additive edits only | **S0-08** |
| Shared UI primitives | Built once by Mohammed; others extend, never rewrite | **S0-09** |
| Entry point / providers | Established once in Sprint 0; touched rarely and by agreement | **S0-07** |
| Global config / dependencies | Announce before changing; one person at a time; own small PR, never bundled with feature work | TEAM §11 |
| Environment configuration | Names in the example file; announce additions | **S0-06** |
| **Money representation** | One agreed representation; nobody invents another | **S0-12** |
| Data model | **Per entity, per owner** — profiles Abdulrahman, auctions Mohammed, bids Rayan. Each in its own file, never one combined file | TEAM §11, ARCH §9.1 |

### 11.5 Commit convention

Conventional Commits, per TEAM.md §21: `feat:` `fix:` `refactor:` `docs:` `test:` `style:` `chore:`.

```text
✅  feat: reject bids below the current price
✅  fix: use server time for auction expiry check
✅  test: add concurrent bid ordering test
❌  update        ❌  fix stuff        ❌  changes
```

---

## 12. Definition of Done

An Issue is **Done** only when **all** apply:

- [ ] **Acceptance criteria in the Issue are satisfied** — every one, checked explicitly
- [ ] Relevant tests and checks pass
- [ ] **No known regression** is introduced
- [ ] Documentation updated where necessary
- [ ] Code follows the conventions agreed in Sprint 0
- [ ] **PR created**, referencing the Issue
- [ ] **PR reviewed** by at least one other team member
- [ ] **PR approved**
- [ ] **PR merged successfully**, with `main` still building
- [ ] The linked Issue can be closed

### 12.1 Additional criteria by Issue type

Applied **only where appropriate to the Issue** — not every Issue needs every check.

| Applies to | Additional criterion |
|---|---|
| **Anything enforcing a business rule** | The rule is enforced **server-side** and still holds when the UI is bypassed (BR-08, SC-43) |
| **Anything touching bids or price** | Correctness verified under **concurrent** bidding, not just sequentially (BR-11, SC-16) |
| **Anything crossing an ownership boundary** | The **owner of the consumed functionality has reviewed it** (TEAM §7) |
| **Any user-facing surface** | Verified in a desktop browser **and** at **375 px** mobile-browser width (NFR-USA-06) |
| **Anything displaying a price** | Uses the agreed **SAR** representation and format; **no second representation invented** (S0-12) |
| **A technical verification spike** | Findings **written up in the Issue**, not only communicated verbally |

> **"Done" is not "it works on my branch."** It is merged into `main`, with `main` still usable.

---

## 13. MVP end-to-end validation — Issue INT-09

Traces directly to **PRD §18.3**. The MVP is not complete until this passes in full on the Vercel production deployment.

| # | Step | Verifies |
|---|---|---|
| 1 | A user **registers** — no email verification step appears; a duplicate display name is rejected | BR-37, BR-39, SC-69, SC-70 |
| 2 | The user **logs in**; their display name shows on every page | FR-AUTH-08, FR-AUTH-15 |
| 3 | The seller **creates an auction** with a **starting price of 100 SAR** and a **10-minute** end time | FR-CREATE-01, **BR-38** |
| 4 | The **product image uploads** and displays on listing and detail | FR-CREATE-15→20, SC-04 |
| 5 | The auction is **Active immediately** and appears in the **active-only listing**; **no edit and no cancel control exists anywhere on it** | BR-14, **BR-30, BR-31**, FR-LIST-05, SC-58, SC-59 |
| 6 | **Another user views the auction** in a second browser — including one **signed out**, who sees full detail and **public bid history** with a sign-in prompt in place of the bid control | FR-DETAIL-01, **BR-40**, SC-75 |
| 7 | Bidder B **bids exactly 100 SAR** — the starting price — and it is **accepted** | **BR-29**, SC-55 |
| 8 | **Other viewers see the bid via realtime within 2 seconds, with no refresh** — price and history both | **FR-RT-03**, SC-20, SC-21 |
| 9 | **Current price updates** to 100 SAR everywhere. C bids 100 SAR → **rejected**; C bids **100.01 SAR** → **accepted** (no increment); C bids **50,000 SAR** → **accepted** (no ceiling); the **leading bidder bids again higher** → accepted | BR-13, **BR-28, BR-32, BR-21, BR-24**, SC-56, SC-57, SC-72 |
| 9a | The seller attempts to bid on their own auction → **rejected**; two users bid simultaneously → **exactly one accepted**, the other told "someone bid before you" | BR-02, **BR-11, BR-12**, SC-11, SC-16, SC-18 |
| 10 | The auction **reaches its fixed end time** — **not extended by the late bids** — and is marked Ended **within 30 seconds**, with nobody required to be watching | **BR-36**, FR-END-01→03, SC-25, SC-26, SC-74 |
| 11 | **Further bids are rejected** with a clear message; the page moves to the ended presentation with no refresh | BR-04, SC-27, SC-23 |
| 12 | The **winner is determined** — the highest valid bid, verified by independent recomputation; a separate zero-bid auction closes cleanly with **no winner and no error** | **BR-06, BR-09**, SC-29, SC-30, SC-31 |
| 13 | The **seller sees the result**: `Auction Ended` / `Winner: <name>` / `Final Bid: <amount> SAR` plus full history | FR-END-13, SC-66 |
| 14 | The **winner sees the result**: `🎉 You won this auction!` / `Final Bid: <amount> SAR` / `Status: Ended` | FR-END-14, SC-66 |
| 15 | A user completes a **password reset** and signs in with the new password; the old one no longer works | **M24**, SC-60, SC-64 |
| 16 | **Excluded-features sweep**: no payment, checkout, wallet, card entry, refund, shipping, fulfillment, or seller/winner contact appears **anywhere** | **SC-67**, §19.0 |
| 17 | The **whole scenario is repeated at 375 px in a mobile browser** | NFR-USA-06, SC-49 |

**Financial scope reminders for whoever runs this:** currency is **SAR**; all values are **simulated**; **no real payment, checkout, shipping, or messaging occurs at any point**; the product **ends at result display**.

---

## 14. Execution order

| Step | What | Gate to the next step |
|---|---|---|
| **1 — Repository verification** | ✅ **Complete.** Repository renamed to `dallal` (S0-00); usernames confirmed; `main` exists at `9326623c` | Done |
| **2 — Sprint 0** | S0-01 → S0-14, parallelized three ways (§10.3) | Sprint 0 exit criteria (§3.5) |
| **3 — Technical spikes V-1 and V-2** | Run during Sprint 0, before BID-02 and BID-15 | Both answered and written up |
| **4 — Parallel feature development** | M1, M2, M3 simultaneously (§10.1) | Each milestone's exit criteria |
| **5 — Integration** | INT-01 → INT-08, at the three checkpoints | All checkpoints pass |
| **6 — End-to-end validation** | INT-09 (§13) | Every step passes |
| **7 — MVP release via Vercel** | INT-10 | Scenario passes on the production URL |

---

## 15. Risks and blockers

Only real technical and execution risks. **No product questions — there are none** (PRD §21.1).

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **1** | ~~Repository name is `dllal`~~ — **RESOLVED.** Renamed to `dallal` by Rayan; same repository ID (§1.1) | — | None. S0-00 complete |
| **2** | ~~Two GitHub usernames unknown~~ — **RESOLVED.** `Dem4t`, `m7ya505`, `RayanAlDwlah` confirmed (§1.2) | — | None. S0-00b removed |
| **3** | ~~`main` does not exist~~ — **RESOLVED.** `main` exists at `9326623c` (§1.3) | — | Protection can now be applied. **S0-01 must still precede S0-02**, and feature work must not start until a test direct push to `main` is rejected |
| **3a** | **This environment cannot write to GitHub** (§1.8) — no token, no `gh` CLI, `GET /user` returns 401 | **Blocker for execution, not planning** | All repository writes must be run by Rayan. Ready-to-run commands in §16 |
| **3b** | **`main` already contains a commit that must not be overwritten** (§1.3) | High if mishandled | Documentation is added **on top of** `9326623c`. **Never force-push; never re-initialize.** The existing `.gitignore` is amended by three lines, not replaced |
| **4** | **The bid operation is a single point of correctness** — every concurrency guarantee depends on it | **Critical** | V-1 first · BID-20's automated concurrent test is required, not optional · both other developers review it (§11.3) · ARCH §23 risk 2 |
| **5** | **Authorization completeness is load-bearing** — the public client key is safe only because policies are complete | **Critical** | Default deny everywhere · each developer owns their entity's policies · INT-07 audit before release · ARCH §23 risk 1 |
| **6** | **Rayan's workstream is far larger** — 21 Issues including all four highest-risk ones | **High** | **§7.1 documents the support model in full.** After Abdulrahman completes his critical authentication work he may assist with **lower-risk** items only: bid history UI (BID-07), winner/result UI (BID-18), rejection messaging (BID-04), integration testing, UI verification. **The correctness-critical core — BID-02, BID-03, BID-05, BID-13, BID-14, BID-15, BID-16, BID-20 — is never eligible for support. Rayan remains the primary owner of the entire bidding domain; no ownership transfers** |
| **7** | **Scheduling granularity may not reach 30 s** (V-2) | Low–Medium | **Presentation only, never correctness** (LC-03). Offset sweeps likely resolve it. **FR-END-03 stands as written; no silent relaxation** |
| **8** | **Shared preview database causes cross-branch interference** (V-3 option A) | Medium | Coordinate schema changes as TEAM §11 requires; evaluate option B if painful. **Never option C** |
| **9** | **The three source documents exist on one machine, unversioned** (§1.6) | **High until S0-01** | S0-01 is the first Issue for exactly this reason |
| **10** | **A developer re-adds a deliberately removed check** — increment, ceiling, leading-bidder block, reserve, anti-sniping, email verification | Medium | ARCH §13.2a lists what the bid operation must **not** check · TEAM §26 lists what nobody may build · **INT-08 audits for it** · called out explicitly at code review |
| **11** | **Long-lived branches drift** over parallel milestones | Medium | TEAM §17 sync discipline · the three checkpoints (§8) · small frequent PRs rather than one merge per workstream |
| **12** | **T1's scheduled sweep can fail silently** — the one component whose failure is invisible | Medium | ARCH §24 notes it. The team should know how to check it. **No monitoring tooling is in MVP scope** — this is an accepted gap |

---

## Plan summary

| Group | Count | IDs |
|---|---|---|
| Milestones | **5** | M0 → M4 |
| **Sprint 0 Issues** | **15** | S0-00, S0-01 → S0-14 |
| **Technical verification spikes** | **5** | V-1 → V-5 |
| **Abdulrahman — M1** (`Dem4t`) | **14** | AUTH-01 → AUTH-14 |
| **Mohammed — M2** (`m7ya505`) | **19** | AUC-01 → AUC-19 |
| **Rayan — M3** (`RayanAlDwlah`) | **21** | BID-01 → BID-21 |
| **Integration — M4** | **10** | INT-01 → INT-10 |
| **TOTAL** | **84** | |

**Arithmetic check:** `15 + 5 + 14 + 19 + 21 + 10 = 84` ✅

> **Note on the count.** Sprint 0 (15) + Abdulrahman (14) + Mohammed (19) + Rayan (21) + Integration (10) = **79**. The remaining **5** are the technical verification spikes V-1 → V-5, which are their own group because they are neither Sprint 0 setup nor feature work. **79 + 5 = 84.**

| | |
|---|---|
| Labels | 9 preserved + 13 new = **22**, no duplicates |
| Branches | `main` + the **3 specified feature branches**. None renamed, no fourth permanent branch |
| GitHub Actions | **0** — none created |
| Issues assignable to real accounts | ✅ **Yes** — `Dem4t`, `m7ya505`, `RayanAlDwlah` |

**No Issues, milestones, or labels have been created on GitHub.** Repository writes require credentials this environment does not have (§1.8); the ready-to-run commands are in §16.

---

## 16. Repository initialization — ready-to-run commands

**Run by: Rayan (`RayanAlDwlah`), or any developer with push access.**

This environment has **no authenticated GitHub access** (§1.8), so the following were prepared but **not executed**. Every file is written and verified locally at `C:\src\Dallal`.

### 16.1 What is being committed

| File | Status | Size | Purpose |
|---|---|---|---|
| `PRD.md` | New | ~204 KB | Product requirements v3.0 |
| `TEAM.md` | New | ~79 KB | Team ownership v2.0 |
| `ARCHITECTURE.md` | New | ~108 KB | Technical architecture v1.1 |
| `GITHUB_PLAN.md` | New | ~94 KB | This plan, v1.1 |
| `README.md` | New | ~5 KB | Project introduction, platform statement, financial scope, team, branching |
| `.env.example` | New | ~2 KB | **Placeholder names only — no values** |
| `.gitignore` | **Modified** | ~353 B | Three-line environment fix (§1.4) |

**Secret scan run against all seven files: clean.** No tokens, keys, connection strings, passwords, or credentials. The only environment file is `.env.example`, which contains placeholders.

**No application code, no SQL, no schema, no migrations, no Supabase configuration, no GitHub Actions.**

### 16.2 Step 1 — clone and stage

```bash
git clone https://github.com/RayanAlDwlah/dallal.git && cd dallal
```

Then copy the seven files from `C:\src\Dallal` into the clone, overwriting only `.gitignore`.

```bash
git status
```

> **Expected:** six new files, one modified (`.gitignore`). **If anything else appears, stop and investigate.**

### 16.3 Step 2 — verify no secrets before committing

```bash
git diff --cached --name-only && grep -rniE "(eyJ[A-Za-z0-9_-]{10,}|ghp_|github_pat_|postgres://|service_role)" . --exclude-dir=.git
```

> Only the commented placeholder line in `.env.example` should match `service_role`. **Any other hit: do not commit.**

### 16.4 Step 3 — commit to `main`

Conventional Commits per TEAM.md §21. **Adds to the existing history — never force-push, never re-initialize.**

```bash
git add PRD.md TEAM.md ARCHITECTURE.md GITHUB_PLAN.md README.md .env.example .gitignore
```

```bash
git commit -m "docs: add approved product, team, architecture and GitHub planning documents

Adds the four approved source-of-truth documents, completing the
documentation the initial commit anticipated:

- PRD.md v3.0 - product requirements, zero open product questions
- TEAM.md v2.0 - ownership, branches, collaboration rules
- ARCHITECTURE.md v1.1 - platform split, trust boundary, deployment
- GITHUB_PLAN.md v1.1 - 84 issues across 5 milestones

Also adds README.md and .env.example (placeholder values only), and
extends .gitignore to cover every .env variant while allowing the
example file.

Dalal is a responsive web application on Vercel and Supabase.
Prices are simulated SAR values; no real payments. Native mobile
applications are out of scope.

No application code, SQL, schema, or CI configuration."
```

```bash
git push origin main
```

> **If `main` is already protected**, this push will be rejected. Either push this documentation commit **before** applying protection (S0-01 precedes S0-02 for exactly this reason), or open it as a Pull Request.

### 16.5 Step 4 — create the three feature branches

**All three must branch from the same `main` commit.** No implementation work starts on them.

```bash
git checkout main && git pull origin main
```

```bash
git branch feature/abdulrahman-auth && git branch feature/mohammed-auctions && git branch feature/rayan-bidding
```

```bash
git push origin feature/abdulrahman-auth feature/mohammed-auctions feature/rayan-bidding
```

Verify all four refs point at the same commit:

```bash
git ls-remote --heads https://github.com/RayanAlDwlah/dallal.git
```

> **Expected:** four refs — `main` plus the three feature branches — **all with the same SHA**.

### 16.6 Step 5 — protect `main` *(only after step 4)*

Via **Settings → Branches → Add branch protection rule** on `main`:

- ✅ Require a pull request before merging
- ✅ Require **at least 1** approval
- ✅ Apply to administrators — **so the owner cannot bypass it either** (TEAM.md §8)
- ❌ Do **not** add status checks — no GitHub Actions exist

Then verify protection actually works:

```bash
git checkout main && git commit --allow-empty -m "test: verify branch protection" && git push origin main
```

> **This push must be REJECTED.** If it succeeds, protection is not configured correctly. Clean up with `git reset --hard origin/main`.

### 16.7 Deliberately not included

| Not done | Why |
|---|---|
| Creating the 84 Issues | Explicitly deferred |
| Creating the 5 milestones | Explicitly deferred |
| Creating the 13 labels | Explicitly deferred |
| Any GitHub Actions workflow | Out of scope |
| Any application code, SQL, schema, or Supabase configuration | Out of scope |
| Vercel project linking | Sprint 0 Issue S0-05 |
