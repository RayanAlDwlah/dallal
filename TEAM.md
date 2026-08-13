# TEAM.md — Dalal Live Auction Platform

**Team collaboration, ownership, and GitHub workflow guide.**

| Field | Value |
|---|---|
| Project | Dalal — Live Auction Platform |
| Repository | One shared GitHub repository |
| Team size | 3 developers |
| **Platform** | **Responsive web application (website).** Desktop and mobile **browsers**. **Not** a native mobile app — see §27 |
| Document version | **2.0 — synchronized with PRD v3.0** |
| Date | 2026-08-12 |
| Status | Active — read this before your first commit |
| Related | [PRD.md](PRD.md) v3.0 — finalized product requirements, **zero open questions** · [ARCHITECTURE.md](ARCHITECTURE.md) — technical architecture |

> **Product decisions are final.** `PRD.md` v3.0 closes all fifteen product questions. Nothing in this document defers work pending a product answer, because there are none outstanding. See §26 for the finalized decisions that most affect day-to-day work.

> **Read this first.** This document tells you who owns what, which branch you work on, who you must talk to before touching something, and how work gets into `main`. If you are about to change a file and you are not sure whether it is yours, the answer is in §6 (Ownership Matrix) and §11 (Shared Files).

---

## Table of Contents

1. [Final Team Map](#1-final-team-map)
2. [The Team at a Glance](#2-the-team-at-a-glance)
3. [Developer 1 — Abdulrahman](#3-developer-1--abdulrahman)
4. [Developer 2 — Mohammed](#4-developer-2--mohammed)
5. [Developer 3 — Rayan](#5-developer-3--rayan)
6. [Ownership Matrix](#6-ownership-matrix)
7. [The Ownership Principle](#7-the-ownership-principle)
8. [Branch Structure](#8-branch-structure)
9. [Dependencies Between Workstreams](#9-dependencies-between-workstreams)
10. [Integration Points](#10-integration-points)
11. [Shared Files & Conflict Zones](#11-shared-files--conflict-zones)
12. [Sprint 0 — Shared Foundation](#12-sprint-0--shared-foundation)
13. [Work Breakdown](#13-work-breakdown)
14. [Parallel Development](#14-parallel-development)
15. [GitHub Workflow](#15-github-workflow)
16. [Branch Naming Convention](#16-branch-naming-convention)
17. [Keeping Branches Updated](#17-keeping-branches-updated)
18. [Merge Conflict Rules](#18-merge-conflict-rules)
19. [GitHub Issues](#19-github-issues)
20. [Pull Request Template](#20-pull-request-template)
21. [Commit Convention](#21-commit-convention)
22. [Definition of Done](#22-definition-of-done)
23. [Team Rules](#23-team-rules)
24. [Repository Documentation](#24-repository-documentation)
25. [Risks in This Structure](#25-risks-in-this-structure)
26. [Finalized Product Decisions — Quick Reference](#26-finalized-product-decisions--quick-reference)
27. [Platform Statement — Dalal is a Website](#27-platform-statement--dalal-is-a-website)

---

## 1. Final Team Map

```text
                         DALAL
                           |
                    GitHub Repository
                           |
                         main
                           |
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
  Abdulrahman          Mohammed             Rayan
  Authentication       Auctions              Bidding
  & Users              & Products            & Realtime
        │                  │                  │
        │                  │                  │
 feature/             feature/             feature/
 abdulrahman-auth     mohammed-auctions     rayan-bidding
```

**Data flows left to right.** Authentication provides identity to both Auctions and Bidding. Auctions provide auction state to Bidding. Bidding provides price and outcome back to the Auction display. Nobody flows backwards into Authentication.

---

## 2. The Team at a Glance

| Developer | Role | Branch | Owns | Talk to them before touching |
|---|---|---|---|---|
| **Abdulrahman** | Authentication & User Management Owner | `feature/abdulrahman-auth` | Registration, login, logout, session, user identity, profile, auth-based access control | Anything that reads or establishes "who is the current user" |
| **Mohammed** | Auction Management Owner | `feature/mohammed-auctions` | Auction creation, validation, product images, listing page, detail page shell, auction status display, seller views | Anything that reads or writes auction records, or changes the auction pages |
| **Rayan** | Bidding & Realtime Owner | `feature/rayan-bidding` | Bid submission, bid validation, current price, bid history, realtime updates, auction closing, winner determination and display | Anything that touches bids, the current price, realtime delivery, or the auction outcome |

**Quick answers to the questions you will actually have:**

- *Who is Abdulrahman?* Authentication and users. Branch `feature/abdulrahman-auth`. He is the only person who builds sign-in; everyone else consumes it.
- *Who is Mohammed?* Auctions and products. Branch `feature/mohammed-auctions`. He owns the auction record and the pages that display it.
- *Who is Rayan?* Bidding and realtime. Branch `feature/rayan-bidding`. He owns everything about a bid, the live price, and the winner.
- *What can I push to `main`?* Nothing directly. Everything goes through a Pull Request with one review. See §15.
- *What if I hit a conflict?* Find the owner of the conflicting code, talk to them, resolve together, and have the owner verify. Never blind-pick "ours" or "theirs". See §18.

---

## 3. Developer 1 — Abdulrahman

### Role

**Authentication & User Management Owner**

### Branch

```text
feature/abdulrahman-auth
```

### What Abdulrahman owns

- User registration
- User login
- User logout
- **Password reset** — the full self-service account-recovery flow (PRD M24, FR-AUTH-25 → 31)
- Authentication state and session persistence
- User identity (the internal identifier and the public display name, which **must be unique** — PRD BR-39)
- User profile (the minimal profile defined in the PRD)
- Authentication-related authorization — "is this request from a signed-in user, and which user?"
- Authentication **behaviour** behind the register, login, logout, signed-in-indicator and **password reset** screens — what they do, not how they look. Mohammed owns their presentation
- Profile **data and identity behaviour**. Mohammed owns the profile screen's presentation

### What Abdulrahman does *not* own

- Auction-level authorization such as "is this user the owner of this auction?" — that ownership check belongs to Mohammed's auction workstream, using the identity Abdulrahman provides.
- Bid-level rules such as "the seller cannot bid on their own auction" — that is Rayan's validation, using identity from Abdulrahman and ownership from Mohammed.

> **Why the split matters:** Abdulrahman answers *who you are*. Mohammed and Rayan answer *what you are allowed to do with this specific auction or bid*. Keeping that line clean is what stops authorization logic from being scattered across three branches.

### Ownership rule

Abdulrahman is the primary owner of authentication. **Other developers consume authentication; they do not reimplement it.** If Mohammed or Rayan needs identity, session state, or a way to require sign-in, they ask Abdulrahman for it rather than writing their own.

### PRD coverage

Abdulrahman's workstream delivers PRD sections §8.1 (Authentication, **including password reset**) and §8.2 (User Profile), and contributes to §14.1 (Authentication security).

### Finalized product decisions affecting this workstream

| Decision | Requirement | What it means for Abdulrahman |
|---|---|---|
| **Password reset is MVP** | M24, FR-AUTH-25 → 31 | Build it. Self-service, single-use, time-limited, and **non-enumerating** — the same response whether or not the address is registered (FR-AUTH-27) |
| **No email verification** | BR-37, FR-AUTH-07 | Do **not** build a verification step or an "unverified" account state. A user registers and can immediately bid |
| **A valid email is still required** | FR-AUTH-07a/07b | It is the login identifier and the only reset channel. The form must make its recovery role clear, because an unreachable address means permanent lockout |
| **Display names must be unique** | BR-39, FR-PROF-03 | Registration needs a uniqueness check and a clear "name taken" failure path |
| **No Admin role** | PRD §4.3 | Nobody can recover an account manually. Password reset is the only recovery path — treat it as such |

---

## 4. Developer 2 — Mohammed

### Role

**Auction Management Owner**

### Branch

```text
feature/mohammed-auctions
```

### What Mohammed owns

- The auction record and its structure
- Create-auction flow and form
- Auction creation validation (all rules in PRD §8.3)
- Product information (name, description)
- Product image upload, storage, and display
- Auction listing page
- Auction detail page — **the page shell and all product/seller content**
- Auction status display
- Auction lifecycle presentation (Active vs Ended states in the UI)
- Seller / auction-owner views, including the seller's view of a completed auction

### What Mohammed does *not* own

- The **current price value** — that is derived from bid history and owned by Rayan (PRD BR-13). Mohammed owns the *place on the page where the price appears*; Rayan owns *what the number is and when it changes*.
- The **behaviour inside the bidding panel** — submission, validation, accept/reject semantics and their realtime updates are Rayan's. Mohammed owns how that panel looks.
- The **winner and final price values** — Rayan determines them; Mohammed presents them.
- **Closing the auction** — the automatic Active → Ended transition is Rayan's (PRD §8.8). Mohammed displays the resulting status.

> **This is the most important boundary in the project.** The auction detail page is where all three workstreams meet. See §11 for the rule that keeps it from becoming a permanent merge conflict.

### Ownership rule

Mohammed is the primary owner of auction functionality. **Other developers must not duplicate auction-management logic.** If Rayan needs auction information — ID, owner, status, end time, starting price — he consumes what Mohammed provides rather than reading or reconstructing it himself.

### PRD coverage

Mohammed's workstream delivers PRD sections §8.3 (Auction Creation), §8.4 (Auction Listing), and the non-bidding parts of §8.5 (Auction Details).

---

## 5. Developer 3 — Rayan

### Role

**Bidding & Realtime Owner**

### Branch

```text
feature/rayan-bidding
```

### What Rayan owns

- Bid submission
- Server-side bid validation (all rules in PRD §9)
- Minimum valid bid behavior
- Current price — the value itself and every update to it
- Bid history — **recording, ordering and correctness**. Mohammed presents the list
- Realtime bid updates
- Realtime auction status updates
- Concurrent bidding behavior and correctness
- Auction expiration handling and the automatic close
- Winner determination
- The **winner and final-price values**, and when they become visible. Mohammed presents them
- **All bidding-related behaviour** — what the bid input accepts, what submission does, which rejection reason is returned and why, what the history contains and in what order, and what the outcome states are. **Mohammed owns the presentation of every one of those surfaces** (bid input, submit control, accept/reject feedback, bid history list, outcome banner); Rayan owns what they do

### What Rayan does *not* own

- The auction record itself — he reads it, Mohammed owns it.
- User identity and sessions — he consumes them, Abdulrahman owns them.
- The auction detail page shell and product content — Mohammed owns the page **and all presentation on it**; Rayan owns the bidding **behaviour** inside it.

### Ownership rule

Rayan is the primary owner of bidding and realtime functionality. **Bidding and realtime stay in one workstream** because they are inseparable: a bid is only "real" once the server accepts it, and the realtime update is how everyone else learns that it happened. Splitting them across two developers would put the accept-then-broadcast sequence on either side of a merge boundary, which is exactly where correctness bugs hide.

### PRD coverage

Rayan's workstream delivers PRD sections §8.6 (Bidding), §8.7 + §13 (Realtime), §8.8 (Auction Ending), and the bidding parts of §8.5.

> **Load warning:** Rayan's workstream is the largest and hardest of the three — it contains all the concurrency correctness requirements (PRD BR-11, BR-12) and the automatic closing mechanism. See §25 for how the team should handle this.

---

## 6. Ownership Matrix

| Feature | Owner | Supporting Member | Note |
|---|---|---|---|
| Registration | Abdulrahman | Mohammed | Abdulrahman owns the behaviour, including display-name uniqueness (BR-39); Mohammed owns the screen |
| Login | Abdulrahman | — | |
| Logout | Abdulrahman | — | |
| **Password Reset** | **Abdulrahman** | — | *Added in v2.0* — PRD M24, FR-AUTH-25 → 31. The MVP's only outbound email |
| User Profile | Abdulrahman | Mohammed | Abdulrahman owns the data and identity behaviour — unique display name, email never public; Mohammed owns the screen |
| Authentication State | Abdulrahman | Rayan | Rayan consumes it for every bid |
| Auction Creation | Mohammed | Abdulrahman | Needs authenticated identity as the owner |
| Product Images | Mohammed | — | |
| Auction Listing | Mohammed | Rayan | *Adjusted* — listing shows current price, which Rayan owns |
| Auction Details | Mohammed | Rayan | Shared page: Mohammed owns the shell **and all presentation on it, bidding panel included**; Rayan owns the bidding behaviour inside it |
| Auction Lifecycle | Mohammed | Rayan | Mohammed displays state; Rayan drives the Active → Ended transition |
| Bidding | Rayan | Abdulrahman | Needs identity to attribute the bid |
| Bid Validation | Rayan | Mohammed | *Adjusted* — validation reads auction status, end time, and owner from Mohammed |
| Bid History | Rayan | Mohammed | Rayan owns what is recorded and its order (`bids.id`, never `created_at`); Mohammed owns how the list is presented |
| Realtime Updates | Rayan | Mohammed | Broadcast is scoped to an auction; Mohammed's pages host the live regions |
| Auction Ending | Rayan | Mohammed | Rayan closes it; Mohammed's UI reflects the ended state |
| Winner Determination | Rayan | Mohammed | Rayan computes it from bid history |
| Winner Display | Mohammed | Rayan | **Reversed** — Mohammed owns the outcome and winner presentation; Rayan owns the values it shows and when they become visible |
| **Current Price (value)** | **Rayan** | **Mohammed** | *Added* — see the note below; this was the biggest ambiguity in the baseline matrix |
| **Session / identity contract** | **Abdulrahman** | **Mohammed, Rayan** | *Added* — the shape both consumers depend on |

### Two adjustments explained

Primary ownership is unchanged from the baseline. Two supporting-member changes and two added rows:

1. **Auction Listing gains Rayan as supporting.** The listing shows each auction's current price (PRD FR-LIST-02, FR-LIST-03). That value is derived from bid history, which is Rayan's. Mohammed builds the listing; Rayan supplies how the price is obtained.
2. **Bid Validation gains Mohammed as supporting.** Three of the eight core bidding rules (PRD BR-02, BR-03, BR-04) depend on auction data — owner, current price, end time. Rayan writes the validation; Mohammed must guarantee the auction data it reads is correct and available.
3. **Current Price (value) added, owned by Rayan.** The baseline matrix never assigned this, and it is the single most contested piece of state in the product. It appears on Mohammed's listing and detail pages, but PRD BR-13 defines it as "the highest accepted bid, or the starting price if none" — a value derived entirely from bidding. **Rayan owns the value and every change to it. Mohammed owns where and how it is displayed.**
4. **Session / identity contract added, owned by Abdulrahman.** Both other workstreams depend on a stable way to answer "who is the current user?" This is the first thing that must be agreed (see §12).

---

## 7. The Ownership Principle

> Ownership does **not** mean a developer is forbidden from touching another area.
> It means **one developer is responsible for the functionality, and other developers coordinate with that owner before changing it.**

### The axis is presentation vs. behaviour, not file

A single component routinely contains both, and each half has a different owner. **Never
read ownership as ownership of a whole file.**

| Responsibility | Owner |
|---|---|
| **All presentation** — every screen, layout, component, visual state, the design system | **Mohammed** |
| **Bidding behaviour** — validation, submission, the atomic operation, concurrency, current-price correctness, realtime bidding behaviour, closing, winner determination, bid recording and order | **Rayan** |
| **Authentication and identity behaviour and data** — auth logic, session, authorization, identity and profile data | **Abdulrahman** |

Mohammed's presentation ownership is total: auction screens, the bid panel, bid history,
the outcome and winner views, and the login / registration / password-reset / profile
screens — layout, typography, spacing, colour, motion, responsive behaviour, and the
loading, empty, error and 404 states.

**What each may do in a file the other half of which is not theirs:**

| | May change | Must preserve exactly | Must not do |
|---|---|---|---|
| **Mohammed** | presentation in any component | the behaviour and its contracts | redesign, rewrite or refactor another owner's business logic unless that owner asks |
| **Rayan** | bidding behaviour in any component | Mohammed's presentation | restyle or redesign the UI unless Mohammed asks |
| **Abdulrahman** | auth/identity behaviour in any component | Mohammed's presentation | redesign the UI unless Mohammed asks |

This does **not** weaken the boundary. Changing another owner's behaviour or data still
means stop and ask them — the boundary simply runs through files rather than between them.

**In practice this means:**

| Situation | What to do |
|---|---|
| You need something from another area | Ask the owner. Do not build your own version. |
| You need a small change in another owner's file | Message them, agree on the change, then make it — and tag them as the PR reviewer. |
| You found a bug in another owner's area | Open an Issue assigned to that owner. Do not fix it silently in your branch. |
| The owner is unavailable and you are blocked | Make the smallest change that unblocks you, note it clearly in the PR description under **Dependencies**, and require the owner's review before merge. |
| You disagree with how an owner built something | Raise it as a discussion, not as a rewrite in your branch. |

**This prevents:** duplicated logic, conflicting implementations, unnecessary merge conflicts, and unclear responsibility when something breaks.

**The single rule to remember:** *touching another person's area is fine; touching it without telling them is not.*

---

## 8. Branch Structure

```text
main
├── feature/abdulrahman-auth
├── feature/mohammed-auctions
└── feature/rayan-bidding
```

### `main`

`main` is the stable integration branch.

| Rule | Detail |
|---|---|
| No direct feature development | Do not write features on `main` |
| No direct pushes of feature work | Everything arrives via Pull Request |
| Review required | At least one other team member approves before merge |
| Always usable | `main` must build and run at all times |

**If `main` is broken, fixing it is the whole team's top priority**, ahead of any feature work. Whoever merged the breaking change leads the fix.

### The three feature branches

Each developer works primarily on their own branch. These are long-lived and map exactly to the three workstreams. They are the team's main lines of work and should not be deleted between merges — keep merging `main` into them and continue.

---

## 9. Dependencies Between Workstreams

Three dependencies exist. All flow in one direction — **Auth → Auctions → Bidding** — with one feedback path for price and outcome. There are no circular dependencies, which is what makes parallel work possible.

---

### 9.1 Abdulrahman → Mohammed

**Mohammed needs authenticated user information when creating an auction.**

| Aspect | Detail |
|---|---|
| **Why it exists** | Every auction has exactly one owner (PRD BR-10, FR-CREATE-02), and that owner is the authenticated user creating it — taken from the session, never from client input |
| **Source owner** | Abdulrahman |
| **Consumer** | Mohammed |
| **What is shared** | (a) The current user's internal identifier, (b) the current user's display name, (c) a way to require an authenticated session before the create action proceeds, (d) a way to know on the client whether someone is signed in |
| **Avoiding duplication** | Mohammed must never read session state directly or construct his own identity check. He calls what Abdulrahman provides. If it does not exist yet, he asks for it rather than writing a temporary version that becomes permanent. |
| **Minimizing file conflicts** | Abdulrahman's identity helpers live in files Abdulrahman owns. Mohammed imports them; he does not edit them. |

**Unblocking rule:** Mohammed can build the entire create-auction form, validation, and image upload *before* auth exists, using an agreed placeholder for "current user". The placeholder must be a single, clearly marked point of substitution — not scattered assumptions — so swapping in real auth is a one-file change.

---

### 9.2 Abdulrahman → Rayan

**Rayan needs authenticated user identity when submitting bids.**

| Aspect | Detail |
|---|---|
| **Why it exists** | Only authenticated users can bid (PRD BR-01), every bid must be attributed to a real account (FR-BID-01), and bid history displays the bidder's display name (FR-BID-23) |
| **Source owner** | Abdulrahman |
| **Consumer** | Rayan |
| **What is shared** | (a) The bidder's internal identifier, verified server-side on every bid, (b) the bidder's display name for history, (c) rejection of unauthenticated bid attempts, (d) client-side knowledge of sign-in state so the bid control can show a sign-in prompt instead (FR-DETAIL-15) |
| **Avoiding duplication** | Rayan performs the bidding rules; Abdulrahman performs the identity check. Rayan does not write his own session validation. |
| **Minimizing file conflicts** | Same rule — Rayan imports Abdulrahman's identity helpers and does not edit them. |

**Critical requirement:** identity for bidding must be verified **server-side on every bid** (PRD FR-BID-01, SEC-A1). A client-side check is not sufficient and is not what Rayan is consuming. Abdulrahman must make clear which of his helpers is the server-side authoritative one.

---

### 9.3 Mohammed → Rayan

**Rayan's bidding functionality depends on auction information owned by Mohammed.** This is the tightest coupling in the project.

| Aspect | Detail |
|---|---|
| **Why it exists** | Bid validation cannot run without auction data. Three of the eight core business rules read it: BR-02 (owner cannot bid) needs the auction owner; BR-03 (bid must be higher) needs the current price and starting price; BR-04 (no bids after end) needs the end time. Closing needs the end time too. |
| **Source owner** | Mohammed |
| **Consumer** | Rayan |
| **What is shared** | Auction ID · auction owner identifier · auction status · auction end time · starting price · existence of the auction |
| **Avoiding duplication** | Mohammed owns reading and writing auction records. Rayan reads auction data through what Mohammed provides — he does not write his own auction queries and never writes to the auction record except for the fields explicitly assigned to him at close (status, final price, winner, close time). |
| **Minimizing file conflicts** | The auction record definition is a shared file. Mohammed owns it. Rayan's close-related fields must be agreed with Mohammed **in Sprint 0**, added once, and not renegotiated mid-sprint. |

**The feedback path.** Rayan writes back to the auction in exactly two situations, both agreed with Mohammed up front:

1. **On each accepted bid** — the auction's current price becomes the new bid amount.
2. **At close** — status becomes Ended, and final price, winner, and close time are recorded (PRD FR-END-08).

**No other write from Rayan to the auction record is permitted without coordinating with Mohammed.**

**Unblocking rule:** Rayan can build bid validation logic, the bidding UI, and the bid history component against agreed placeholder auction data before Mohammed's auction record is merged. The concurrency work (PRD BR-11, BR-12) — the hardest part of his workstream — does not depend on Mohammed at all and should start early.

---

## 10. Integration Points

Five integration points. Each one is a conversation that must happen in Sprint 0, before the branches diverge.

---

### 10.1 Authentication → Auction

| | |
|---|---|
| **Owner** | Abdulrahman |
| **Consumer** | Mohammed |
| **Required information** | Current authenticated user's identifier and display name; a server-side guarantee that the request is authenticated |
| **Coordination rule** | Abdulrahman defines and documents how identity is obtained, on both client and server, before Mohammed builds the create flow. Mohammed uses only that route. Any change to it requires notifying Mohammed and Rayan in the same message. |

---

### 10.2 Authentication → Bidding

| | |
|---|---|
| **Owner** | Abdulrahman |
| **Consumer** | Rayan |
| **Required information** | Bidder's identifier and display name; **server-side** verification that the bid request is authenticated; client-side sign-in state for UI |
| **Coordination rule** | Same contract as 10.1 — one identity mechanism, used by both consumers. Abdulrahman must clearly mark which helper is authoritative server-side; Rayan must use that one for validation, never the client-side convenience. |

---

### 10.3 Auction → Bidding

| | |
|---|---|
| **Owner** | Mohammed |
| **Consumer** | Rayan |
| **Required information** | Auction ID, owner identifier, status, end time, starting price, and whether the auction exists |
| **Coordination rule** | Mohammed defines the auction record fields in Sprint 0 and does not rename or remove any of the six fields above without telling Rayan first. Rayan reads only through Mohammed's access path. This is the field set that bid validation depends on — treat it as frozen once agreed. |

---

### 10.4 Auction → Realtime

| | |
|---|---|
| **Owner** | Mohammed (auction state) → **Rayan** (realtime delivery) |
| **Consumer** | Every viewer of an auction page |
| **Required information** | Which auction a viewer is watching; the auction's current price, bid history, and status |
| **Coordination rule** | Rayan owns the realtime mechanism and decides what is broadcast. Mohammed's pages provide the live regions where updates render and tell Rayan's components which auction is being viewed. **Realtime payloads must contain only publicly visible data — display names, never email addresses (PRD RT-S2).** Mohammed must not add a second, competing update mechanism to his pages. |

---

### 10.5 Bidding → Auction Completion

| | |
|---|---|
| **Owner** | Rayan |
| **Consumer** | Mohammed (seller view), and every viewer of the ended auction |
| **Required information** | Winner identifier and display name, final price, close time, ended status — or an explicit "no winner" when the auction closed with zero bids (PRD BR-09) |
| **Coordination rule** | Rayan determines and records the outcome; it is never claimed, granted, or set by anyone else (PRD BR-06, FR-SEC-07). Mohammed's seller view and Rayan's outcome component both read the same recorded result — **neither recomputes it**. The zero-bid case is a normal outcome, not an error, and both developers must handle it. |

---

## 11. Shared Files & Conflict Zones

These are the files where two or more developers will collide. Each has a designated owner and a coordination rule. **The goal is that no two people edit the same file in the same week.**

| Category | Examples | Owner | Coordination rule |
|---|---|---|---|
| **Shared data model / types** | Auction structure, bid structure, user structure | Split by entity: user = Abdulrahman, auction = Mohammed, bid = Rayan | Each entity's definition lives in **its own file**, owned by one person. Never one combined file. Adding a field to someone else's entity requires their approval. |
| **Routing / navigation** | Route table, page registration, navigation links | **Mohammed** (most pages are his) | Each developer adds their own routes in one focused commit, early, in one agreed place. Do not restructure routing without telling everyone. Small additive edits only. |
| **Shared services / utilities** | Formatting, date/time display, currency display, validation helpers | **Whoever creates it first**, recorded in the PR | Prefer adding a new small file over editing an existing shared one. If you must edit a shared utility, tag its creator as reviewer. |
| **Shared UI components** | Buttons, form inputs, layout shell, cards, loading and error states | **Mohammed** (owns the most UI surface) | Build these in Sprint 0 so nobody invents their own. If you need a variant, extend rather than rewrite. Discuss in the group before changing a shared component's behavior. |
| **Global configuration** | Build config, linting, dependency manifest | **Whole team — highest conflict risk** | Announce **before** adding a dependency or changing config. One person changes it at a time. Keep these changes in their own small PR, never bundled with feature work. |
| **Application entry point** | Root component, app bootstrap, providers | **Whole team, Mohammed coordinates** | Should be touched rarely and only by agreement. All three of you will need something registered here — do it once, together, in Sprint 0. |
| **Environment configuration** | Environment variable names, the example env file | **Whole team** | Add your variable to the example file; announce it in the group. **Never commit real secrets or a populated `.env` file** (Rule 9/10 in §23). |
| **Money representation (SAR)** | How a price is stored, compared, and formatted | **Shared — one agreed representation, no exceptions** | See the dedicated rule below. |
| **The auction detail page** | The single highest-traffic shared file | **Mohammed owns the page and all presentation on it; Rayan owns the bidding behaviour inside it** | See the dedicated rule below. |

### The money representation rule (SAR)

Prices touch two workstreams: Mohammed sets and displays the starting price, Rayan owns bid amounts, the current price, and the final winning bid. **If they pick different representations, the same amount will be stored, compared, or formatted two different ways** — and a rounding mismatch between the price a bidder sees and the price the server validates against is a correctness bug, not a cosmetic one.

**The rule: one representation, agreed once in Sprint 0 (S0-12), used by everyone.**

| Rule | Source |
|---|---|
| The currency is **Saudi Riyal (SAR)**. There is no other currency and no second unit | PRD BR-33 |
| Values are **simulated demonstration values**. No real money, no payments, no checkout | PRD §19.0, BR-34 |
| Exactly **two decimal places**, exact arithmetic. **Never floating point** | PRD NFR-DAT-05 |
| **No maximum.** Large values must be handled correctly, never rejected for size | PRD BR-21, SEC-R3 |
| **One display format** everywhere — listing, detail, bid input, history, results. The same amount never appears formatted two ways | PRD NFR-DAT-08 |
| The term **"Demo Points" is prohibited.** Prices are SAR | PRD §19.0 |

**Ownership:**

| Who | Owns |
|---|---|
| **Mohammed** | Auction creation input, starting-price validation, and price **display** on the listing and detail pages |
| **Rayan** | Bid amounts, current-price **correctness**, bid history amounts, and the final winning bid |
| **Both** | Use the **same** PRD-defined SAR representation. Whoever creates the shared formatting/parsing helper owns it; the other consumes it |

> **No developer may invent a different currency, a different unit, a different precision, or a second price representation.** If the agreed representation turns out to be wrong, that is a team decision and a change to this section — not a local workaround.

### The auction detail page rule

The auction detail page is where all three workstreams meet. Left as one file, it will conflict on nearly every merge.

**The rule: split it into separately owned components from day one.**

| Part of the page | Owner |
|---|---|
| Page shell, layout, data loading for the auction | Mohammed |
| Product name, description, image, seller display name | Mohammed |
| Auction status label and countdown display | Mohammed |
| **Current price display region** | Mohammed builds the region — **Rayan supplies the value and its updates** |
| **Bid input, submit control, accept/reject feedback** | Mohammed presents — **Rayan owns what it accepts, what submission does, and which rejection reason is returned** |
| **Bid history list** | Mohammed presents — **Rayan owns what is recorded and its order** |
| **Outcome / winner banner** | Mohammed presents — **Rayan owns the outcome values and when they become visible** |

Mohammed's page mounts Rayan's components and passes them the auction ID. The split is **by responsibility, not by file** (CLAUDE.md §1): Mohammed may change presentation in any of these components provided behaviour and contracts are unchanged, and Rayan may implement bidding behaviour inside a component Mohammed presents — but neither rewrites the other's half without asking. **Agree this split in Sprint 0 and create the empty component files immediately** — so both developers have a file of their own to work in from their very first commit.

---

## 12. Sprint 0 — Shared Foundation

**Do this together, before anyone starts feature work on their own branch.**

The branch structure assigns every MVP feature to someone, but it does not assign the *foundation those features sit on*. If the three of you start in parallel without this step, all three branches will invent their own version of the same shell and the first integration will be painful.

**Sprint 0 is short — aim for one working session, done as a group, merged to `main` as one or two small PRs.**

| # | Item | Led by | Why it must be first |
|---|---|---|---|
| S0-1 | Repository initialized, `main` created and protected, three feature branches created | Whole team | Nothing starts until the branches exist |
| S0-2 | Project scaffold that builds and runs — an empty app that starts | Whole team | All three need somewhere to put code |
| S0-3 | Application entry point and provider setup | Mohammed coordinates | Everyone needs to register something here; do it once |
| S0-4 | Routing structure and the three page placeholders (auth pages, listing, detail) | Mohammed | Prevents three competing routing approaches |
| S0-5 | Shared UI primitives — button, input, form field, card, loading state, error state | Mohammed | Prevents three visual languages in one product |
| S0-6 | **Identity contract agreed** — how "current user" is obtained on client and server | Abdulrahman | Blocks both other workstreams (§10.1, §10.2) |
| S0-7 | **Auction record fields agreed** — the six fields Rayan's validation depends on, plus the four fields Rayan writes at close | Mohammed + Rayan | Blocks all bid validation (§10.3) |
| S0-8 | **Auction detail page component split** — create the empty component files per §11 | Mohammed + Rayan | Prevents the worst recurring conflict in the project |
| S0-9 | Environment variable naming and the example env file | Whole team | Prevents secret leaks and config drift |
| S0-10 | `README.md`, this `TEAM.md`, and `PRD.md` committed to the repo | Whole team | Shared reference from commit one |
| S0-11 | Issue labels created: `auth`, `auction`, `bidding`, `realtime`, `shared`, `blocked` | Whole team | Makes the board readable immediately |
| **S0-12** | **Money representation agreed (SAR)** — how a price is stored, compared, and formatted, per the rule in §11 | **Mohammed + Rayan, recorded for all** | Prices cross both workstreams. Three developers will otherwise pick three representations |

**Exit criteria for Sprint 0:** all three developers can pull `main`, run the app, see an empty page, and start working in a file that nobody else is editing.

---

## 13. Work Breakdown

Tasks are MVP-focused and reference the approved PRD requirement IDs. **No implementation details are prescribed** — how each task is built is the developer's decision within the architecture the team agrees.

**Legend:**
- 🟢 **Can start immediately** after Sprint 0 — no dependency on another developer
- 🟡 **Partially blocked** — can be built against a placeholder, needs real integration later
- 🔴 **Blocked** — needs another developer's work merged first

---

### 13.1 Abdulrahman — Authentication & User Management

| ID | Task | Status | PRD reference | Depends on |
|---|---|---|---|---|
| **A-01** | Authentication foundation — establish how authentication works in the app and how sessions are held | 🟢 | §8.1, SEC-A1, SEC-A2 | Sprint 0 |
| **A-02** | **Identity contract** — define and document how any part of the app obtains the current user, on client and on server. Publish it to Mohammed and Rayan. | 🟢 **Do this first** | §10.1, §10.2 | Sprint 0 |
| **A-03** | Registration — form, server-side validation, account creation, auto sign-in on success | 🟢 | FR-AUTH-01 → 06 | A-01 |
| **A-04** | Registration validation rules — email format, email uniqueness, **display-name uniqueness (BR-39)**, password minimum length, per-field error messages. **No email-verification step** (BR-37) | 🟢 | FR-AUTH-02 → 05, FR-AUTH-07 → 07b, FR-PROF-03, US-01, SC-69, SC-70 | A-03 |
| **A-05** | Login — form, credential verification, session establishment, generic failure message | 🟢 | FR-AUTH-08 → 10, US-02 | A-01 |
| **A-06** | Return-to-page after login — send the user back where they came from | 🟡 | FR-AUTH-11, US-02 | Mohammed's/Rayan's pages existing |
| **A-07** | Logout — control on every page, session termination, redirect to a public page | 🟢 | FR-AUTH-12 → 14, US-03 | A-05 |
| **A-08** | Authentication state in the UI — signed-in indicator showing the display name, consistent placement | 🟢 | FR-AUTH-15, US-04 | A-05 |
| **A-09** | Session persistence — survives reload, navigation, and browser restart | 🟢 | FR-AUTH-16 | A-05 |
| **A-10** | Session expiry handling — clear message, re-authentication prompt, public viewing still works | 🟢 | FR-AUTH-17, FR-AUTH-18, EC-12 | A-09 |
| **A-11** | User identity — stable internal identifier and public display name; display name is never the email | 🟢 | FR-AUTH-19 → 21 | A-03 |
| **A-12** | Minimal user profile — identifier, email (private), display name (public), created timestamp | 🟢 | FR-PROF-01 → 04 | A-11 |
| **A-13** | Profile view UI — the user can see their own profile information | 🟢 | FR-PROF-04 | A-12 |
| **A-14** | Access restriction helpers — require an authenticated session for protected actions, enforced server-side | 🟢 | FR-AUTH-22 → 24, SEC-A1 | A-02 |
| **A-15** | Privacy enforcement — email addresses never exposed to other users anywhere | 🟢 | FR-PROF-06, SEC-P1 | A-12 |
| **A-16** | Auth security review — credentials never stored recoverably or returned; failures do not reveal whether an account exists | 🟢 | SEC-A4, SEC-A5, FR-SEC-14 | A-05 |
| **A-17** | Integration support for Mohammed — verify auction creation correctly attributes the authenticated owner | 🔴 | FR-CREATE-02, SC-39 | Mohammed's create flow |
| **A-18** | Integration support for Rayan — verify bids are correctly attributed and unauthenticated bids are rejected | 🔴 | FR-BID-01, SC-10 | Rayan's bid flow |
| **A-19** | Authentication testing — registration, login, logout, session persistence, expiry, and unauthorized-access rejection | 🟢 | SC-01, SC-10, SC-38 → 43 | A-03 → A-16 |
| **A-20** | **Password reset — request flow.** Startable from the login screen without being authenticated; user supplies their registered email | 🟢 | FR-AUTH-25, FR-AUTH-26, M24, US-23 | A-01 |
| **A-21** | **Password reset — non-enumerating response.** Identical confirmation whether or not the address is registered, in content **and** timing | 🟢 | FR-AUTH-27, SEC-A5, SC-61 | A-20 |
| **A-22** | **Password reset — delivery and mailbox possession.** Delivered to the registered address; knowing the address alone must be insufficient | 🟢 | FR-AUTH-28, SC-62 | A-20 |
| **A-23** | **Password reset — single-use and expiry.** A reset is consumed on use and expires; reuse and expiry both rejected with a clear message and a way to request another | 🟢 | FR-AUTH-29, SC-63, EC-28 | A-22 |
| **A-24** | **Password reset — completion.** New password meets the registration strength rule; user can sign in immediately; **the old password stops working**; no other account is created or altered | 🟢 | FR-AUTH-30, FR-AUTH-31, SC-64 | A-23 |
| **A-25** | **Password reset testing** — full flow, unregistered address, reuse, expiry, old-password invalidation | 🟢 | SC-60 → 64, US-23, EC-27, EC-28 | A-20 → A-24 |

**Product decisions affecting Abdulrahman — all final, none blocking:** password reset **is** MVP (M24 → tasks A-20 → A-25); email verification is **not** required (BR-37 — do not build one); display names **must be unique** (BR-39 → A-04). Nothing in this workstream waits on a product answer.

**Note on A-22:** password reset is the MVP's only outbound email (PRD §16.5). Confirm it works in the preview environment before opening the PR, or US-23 cannot be exercised by a reviewer — see [ARCHITECTURE.md](ARCHITECTURE.md) §22, spike V-3.

---

### 13.2 Mohammed — Auctions & Products

| ID | Task | Status | PRD reference | Depends on |
|---|---|---|---|---|
| **M-01** | **Auction record structure** — define the auction fields, including the six Rayan's validation reads and the four he writes at close. Agree with Rayan and publish. | 🟢 **Do this first** | §10.3, S0-7 | Sprint 0 |
| **M-02** | Create-auction form — image, name, description, starting price, end time; all required | 🟢 | FR-CREATE-01, FR-CREATE-03 | M-01 |
| **M-03** | Creation validation — name 3–100, description 10–2000, price > 0 with 2 decimals, end time within duration bounds, all server-side using server time | 🟢 | FR-CREATE-04 → 14, US-06 | M-02 |
| **M-04** | Validation error presentation — every failing field reported at once, entered values preserved | 🟢 | FR-CREATE-12, US-06 | M-03 |
| **M-05** | Product image upload — one image, JPEG/PNG/WebP, 5 MB limit, type validated server-side | 🟢 | FR-CREATE-15 → 18, US-07 | M-02 |
| **M-06** | Image failure handling — no partial auction created, no orphaned image, retry without re-entering fields | 🟢 | FR-CREATE-19, EC-08, SC-04 | M-05 |
| **M-07** | Image display and public readability — visible to all viewers including unauthenticated ones | 🟢 | FR-CREATE-20 | M-05 |
| **M-08** | Auction ownership — owner taken from the authenticated session, never from client input; permanent | 🟡 | FR-CREATE-02, FR-CREATE-22, BR-10 | A-02 (placeholder until then) |
| **M-09** | Publication behavior — auction becomes Active immediately, current price = starting price, empty history, redirect to detail page | 🟢 | FR-CREATE-26 → 29, BR-14 | M-02 |
| **M-10** | Auction listing page — public, no auth required; thumbnail, name, current price, status, time remaining | 🟡 | FR-LIST-01 → 03, US-08 | Current price from Rayan |
| **M-11** | Listing countdown and status display — live countdown for active, ended visually distinguished | 🟢 | FR-LIST-04, FR-LIST-05 | M-10 |
| **M-12** | Listing ordering and empty state — active first by soonest end time, ended after; clear empty message | 🟢 | FR-LIST-06, FR-LIST-08 | M-10 |
| **M-13** | Listing privacy — no bidder identities, no email addresses | 🟢 | FR-LIST-11 | M-10 |
| **M-14** | **Auction detail page shell** — layout, data loading, and the mount points for Rayan's components | 🟢 **Coordinate with Rayan** | §8.5, S0-8 | M-01 |
| **M-15** | Detail page product content — name, full description with line breaks, image with placeholder fallback, seller display name | 🟢 | FR-DETAIL-02 → 04, FR-DETAIL-13 | M-14 |
| **M-16** | Detail page status and countdown — explicit status, live countdown, absolute end time in local timezone | 🟢 | FR-DETAIL-07, FR-DETAIL-08 | M-14 |
| **M-17** | Current price display region — prominent, and distinguishes "starting price, no bids" from "current bid" | 🟡 | FR-DETAIL-05, FR-DETAIL-06 | Value from Rayan |
| **M-18** | Viewer-type rendering — sign-in prompt (unauthenticated), owner message (seller), nothing (ended); bidding control slot for eligible bidders | 🟡 | FR-DETAIL-14 → 17, SC-07 | A-02, Rayan's control |
| **M-19** | Not-found and expired-auction handling — clear not-found message; expired auction presented as ended | 🟢 | FR-DETAIL-24, FR-DETAIL-25, EC-04, EC-13 | M-14 |
| **M-20** | Seller view of a completed auction — outcome, winner display name, final price, or clear "no bids, did not sell" | 🔴 | FR-END-13, FR-DETAIL-21, US-16 | Rayan's outcome |
| **M-21** | Auction lifecycle presentation — Active and Ended states rendered correctly across listing and detail | 🟡 | §12 of PRD, FR-DETAIL-09 | Rayan's close |
| **M-22** | Auction authorization — a user cannot create an auction attributed to another user, or modify another user's auction | 🟡 | FR-SEC-03, FR-SEC-04, SC-38, SC-39 | A-02 |
| **M-23** | Auction testing — creation happy path, every validation rule, image handling, listing rendering, detail rendering per viewer type | 🟢 | SC-01 → SC-07 | M-02 → M-19 |

**Product decisions affecting Mohammed — all final, none blocking:**

| Decision | Requirement | What Mohammed builds — or does not |
|---|---|---|
| **Duration: 5 minutes to 7 days** | BR-38, FR-CREATE-09/10/10a | M-03 validates against this inclusive range. **Not 30 days** |
| **Currency: SAR, simulated, no maximum** | BR-21, BR-33, FR-CREATE-07/13 | Prices display as `100 SAR`. Validate `> 0` and two decimals. **Do not add a price ceiling** |
| **No cancellation** | BR-30 | No cancel control anywhere. M-20/M-21 need **no seller controls** |
| **No editing after publish** | BR-31 | No edit screen, control, or route |
| **No reserve price** | BR-35 | No reserve field on the creation form |
| **Listing shows Active auctions only** | FR-LIST-05/05a/05b/06 | M-10/M-12: active only, ordered soonest-ending first. Ended auctions leave the listing but stay reachable by direct link |

**M-03 and M-10 are fully specified and unblocked.** Nothing in this workstream waits on a product answer.

---

### 13.3 Rayan — Bidding & Realtime

| ID | Task | Status | PRD reference | Depends on |
|---|---|---|---|---|
| **R-01** | **Bid record structure and history storage** — append-only, permanent, no modify or delete path | 🟢 **Do this first** | BR-05, BR-18, SEC-I1 | Sprint 0 |
| **R-02** | Bid submission flow — bidder enters an amount and receives a definitive accept or reject | 🟡 | FR-BID-01, FR-BID-27, US-10 | Placeholder auction/user data |
| **R-03** | **Server-side bid validation** — authenticated, auction Active by server time, not the owner, well-formed amount, strictly greater than current price | 🟡 | BR-01 → BR-04, FR-BID-01 → 08 | A-02, M-01 |
| **R-04** | Minimum valid bid behavior — the minimum acceptable amount is shown to the user before submitting | 🟢 | FR-BID-05, FR-BID-10 | R-03 |
| **R-05** | **Concurrency correctness** — definitive ordering of simultaneous bids; at most one accepted per price level; none lost or duplicated; history strictly increasing | 🟢 **Start early — hardest task in the project** | BR-11, BR-12, FR-BID-11 → 17, US-12 | R-01 |
| **R-06** | Concurrent-loss messaging — "someone bid before you, the price is now X", not a generic error | 🟢 | FR-BID-13, EC-01, SC-18 | R-05 |
| **R-07** | Rejection feedback — every rejection gives a specific, actionable reason; state entirely unchanged | 🟢 | BR-23, BR-27, FR-BID-22, US-11 | R-03 |
| **R-08** | **Current price ownership** — price is always the highest accepted bid, or the starting price when none; never set directly by any user | 🟢 | BR-07, BR-13, SEC-Z5, NFR-DAT-01 | R-01 |
| **R-09** | Bid history display — amount, bidder display name, timestamp, most recent first, highest clearly marked, "No bids yet" empty state | 🟡 | FR-BID-23, FR-DETAIL-10 → 12 | A-02 for display names |
| **R-10** | Realtime foundation — establish the live update mechanism, scoped per auction | 🟢 | §13, FR-RT-01 | Sprint 0 |
| **R-11** | Realtime price and history updates — new price and history entry reach all current viewers within 2 seconds | 🟢 | FR-RT-03, FR-RT-04, NFR-RT-01, US-13 | R-10, R-08 |
| **R-12** | Realtime UX rules — visible change, no cleared input, no stolen focus, no scroll, price never appears to move down | 🟢 | RT-X1 → RT-X5, FR-RT-05 → 07 | R-11 |
| **R-13** | Realtime status transition — Active → Ended propagates live; bid control disappears; outcome appears | 🔴 | FR-RT-08, US-18 | R-17, M-14 |
| **R-14** | Connection loss handling — clear indicator, bid control disabled or marked stale, readable data retained | 🟢 | FR-RT-11, FR-RT-13, RT-R2, EC-10 | R-10 |
| **R-15** | Reconnection resync — resynchronize to authoritative current state, not a resumed partial stream | 🟢 | FR-RT-12, RT-R3, US-14 | R-14 |
| **R-16** | Realtime privacy — payloads carry only publicly visible data; never email addresses | 🟢 | RT-S1, RT-S2, SC-42 | R-11 |
| **R-17** | **Automatic auction closing** — at end time, bidding stops and the auction is marked Ended within 30 seconds, with no human action and regardless of whether anyone is viewing | 🟡 | FR-END-01 → 04, US-15, SC-25, SC-26 | M-01 |
| **R-18** | End-time boundary enforcement — bids at or after the end time always rejected using server time, even before the record is marked Ended | 🟢 | BR-04, BR-19, FR-BID-18 → 21, EC-02, SC-27 | R-03 |
| **R-19** | **Winner determination** — highest valid bid in history wins; runs exactly once; idempotent | 🟡 | BR-06, BR-17, FR-END-05, FR-END-10, SC-29, SC-32 | R-17, R-01 |
| **R-20** | Zero-bid closure — closes cleanly with no winner and no final price; a normal outcome, never an error | 🟡 | BR-09, FR-END-07, EC-05, SC-31 | R-19 |
| **R-21** | Outcome recording — ended status, close time, final price, winner (or explicitly none), permanently and immutably | 🟡 | FR-END-08, FR-END-09, SEC-I2 | R-19, M-01 |
| **R-22** | Winner display — explicit "you won" for the winner with the final price; winner and final price visible to all viewers | 🔴 | FR-END-14, FR-END-16, FR-DETAIL-18 → 20, US-17 | R-21, M-14 |
| **R-23** | Terminal-state enforcement — no route to reopen, extend, or re-run an ended auction | 🟢 | BR-15, FR-END-18, SC-34 | R-17 |
| **R-24** | Bidding authorization — no user can create, modify, or delete a bid outside the normal path; no user can set price, status, or winner | 🟢 | SEC-Z4 → SEC-Z7, SC-40, SC-43 | R-03 |
| **R-25** | **Concurrency testing** — automated test submitting simultaneous bids, asserting exactly one acceptance and a strictly increasing history | 🟢 **Required, not optional** | NFR-MNT-02, SC-16 → SC-19 | R-05 |
| **R-26** | Bidding and realtime testing — every rejection path, boundary bids at the end time, two-browser realtime verification, connection loss and recovery | 🟢 | SC-08 → SC-24 | R-02 → R-22 |

**Product decisions affecting Rayan — all final, none blocking:**

| Decision | Requirement | What Rayan builds — or does not |
|---|---|---|
| **Minimum acceptable bid** | BR-28 | No bids yet → `bid >= starting price`. Has bids → `bid > current price`. This is the whole amount rule |
| **First bid may equal the starting price** | BR-29, FR-BID-06 | An explicit special case in R-03. Starting price 100 SAR → a first bid of 100 SAR is **valid**; a second bid of 100 SAR is **not** |
| **No bid increment** | BR-32, FR-BID-09 | Never require `+5 / +10 / +50`. A 0.01 SAR raise is valid |
| **No maximum bid** | BR-21, FR-BID-08 | Never reject a bid for being too large. Handle large values correctly instead (SEC-R3) |
| **Leading bidder may bid again** | BR-24, FR-BID-04/04a | Leading is never grounds for rejection — only the amount matters. A UI warning is advised; the server must accept a qualifying bid |
| **Anti-sniping exists** *(BR-36 reversed 2026-08-13; this row said "end time is fixed")* | BR-36 as amended | R-17 closes at the **current** `end_time`, which is not necessarily the one recorded at creation. Extension logic exists and is Rayan's: an accepted bid in the final 15 s adds 30 s, capped at 20 extensions |
| **Bid history is public** | BR-40, FR-BID-22/22a | R-09 renders to unauthenticated visitors. Display names only, **never** emails |
| **Currency: SAR** | BR-33 | All prices, bids, and results in SAR, using the shared representation (§11) |

**R-03 and R-17 are fully specified and unblocked.** Nothing in this workstream waits on a product answer.

---

## 14. Parallel Development

### The intended primary flows

**Abdulrahman**
```text
Authentication
↓
User Profile
↓
Authentication Integration
```

**Mohammed**
```text
Auction Structure
↓
Create Auction
↓
Product Images
↓
Auction Listing
↓
Auction Details
↓
Auction Lifecycle
```

**Rayan**
```text
Bidding Flow
↓
Bid Validation
↓
Bid History
↓
Realtime Updates
↓
Auction Completion
↓
Winner
```

**These are sequences, not a schedule.** Nobody should wait for a date; everybody should know what they can start right now.

### What can start immediately after Sprint 0

All three developers have substantial independent work from day one:

| Developer | Independent work available immediately |
|---|---|
| **Abdulrahman** | A-01 through A-05, A-07 through A-16 — essentially his entire workstream. He is the least blocked person on the team. |
| **Mohammed** | M-01 through M-07, M-09, M-11 through M-16, M-19 — the create flow, images, listing structure, and detail page shell. |
| **Rayan** | R-01, R-05, R-08, R-10, R-14, R-15, R-18, R-23 — including **R-05, the concurrency work, which is his hardest task and depends on nobody**. |

### What genuinely blocks

| Blocked work | Blocked on | How to unblock early |
|---|---|---|
| M-08, M-18, M-22 (auction ownership and viewer-type rendering) | Abdulrahman's identity contract (A-02) | **A-02 is the highest-priority task on the team.** Until it lands, Mohammed uses one clearly marked placeholder. |
| R-03 (bid validation) | A-02 for identity, M-01 for auction fields | Rayan builds the validation *structure* against agreed placeholders; swapping in the real sources should be a small change. |
| M-10, M-17 (price on listing and detail) | Rayan's current-price value (R-08) | Mohammed builds the display regions; the value arrives later. |
| M-20, M-21 (seller completed view, lifecycle display) | Rayan's close and outcome (R-17, R-19, R-21) | Genuinely late work. Mohammed should schedule it last and have other tasks queued. |
| R-13, R-22 (live status transition, winner display) | Mohammed's detail page shell (M-14) | **M-14 should be one of Mohammed's first tasks**, even as an empty shell, so Rayan has somewhere to mount. |

### The three things that unblock everyone

Do these first, in the first working session:

1. **A-02 — the identity contract** (Abdulrahman). Unblocks Mohammed and Rayan.
2. **M-01 — the auction record fields** (Mohammed, agreed with Rayan). Unblocks bid validation and closing.
3. **M-14 + S0-8 — the detail page shell and component split** (Mohammed + Rayan). Unblocks all of Rayan's bidding work and prevents the project's worst recurring merge conflict.

Everything else can proceed in parallel.

### Integration checkpoints

Rather than a rigid schedule, use three checkpoints where the team deliberately integrates. At each one, everybody merges `main` into their branch and the team verifies the joint behavior together.

| Checkpoint | Trigger | What must work end to end |
|---|---|---|
| **CP-1 — Identity flows** | A-02, A-03, A-05 merged; M-08 wired | A user can register, sign in, and create an auction correctly attributed to them |
| **CP-2 — The live loop** | M-14, R-03, R-08, R-11 merged | Two browsers on one auction; a bid from one updates the other within 2 seconds without a refresh |
| **CP-3 — The full lifecycle** | R-17, R-19, R-21, M-20 merged | An auction runs, receives bids, closes automatically, and shows the correct winner to seller, winner, and other viewers |

**CP-3 is the PRD's demonstration scenario (PRD §18.3).** Run it in full before declaring the MVP complete.

---

## 15. GitHub Workflow

```text
Developer
    ↓
Work on assigned feature branch
    ↓
Commit focused changes
    ↓
Push branch
    ↓
Open Pull Request
    ↓
Another team member reviews
    ↓
Address review comments
    ↓
Approval
    ↓
Merge into main
```

### Rules

**Direct pushes**
Developers must not push feature work directly to `main`. Every change to `main` arrives through a Pull Request.

**Pull Requests**
Every completed feature or meaningful unit of work goes through a Pull Request. Do not accumulate three weeks of work into one enormous PR — **open a PR when a coherent piece is done**, not when the whole workstream is done. A reviewable PR is one another developer can genuinely read in 15–20 minutes.

**Reviews**
At least one other team member reviews every Pull Request.

Choose the reviewer deliberately:

| If your PR... | Request review from |
|---|---|
| Touches only your own area | Either other developer |
| Consumes another developer's functionality | **That developer** |
| Modifies a shared file (§11) | **The owner of that file** |
| Changes global config or the entry point | **Both** other developers |
| Changes an agreed contract (identity, auction fields) | **Both** other developers |

**Merge**
Only merge after:

- Review is completed
- Required changes are addressed
- Tests pass
- No known breaking changes exist

**Who merges:** the PR author merges their own PR after approval. This keeps responsibility with the person who understands the change. If it breaks `main`, that same person leads the fix.

---

## 16. Branch Naming Convention

```text
feature/<developer>-<feature>
```

### Primary branches — the three team workstreams

```text
feature/abdulrahman-auth
feature/mohammed-auctions
feature/rayan-bidding
```

These are long-lived and map to the three ownership areas. Keep them; do not delete them between merges.

### Temporary sub-branches

When a piece of work is large enough to deserve its own PR, branch from your primary branch:

```text
feature/abdulrahman-auth-login
feature/mohammed-auctions-create
feature/rayan-bidding-realtime
```

**Rules for sub-branches:**

- Branch from your primary feature branch, not from `main`
- Merge back into your primary branch, or open a PR straight to `main` if the work is self-contained
- Delete them once merged — only the three primary branches persist
- Keep them short-lived; a sub-branch older than a few days is a merge conflict waiting to happen

### Other prefixes

| Prefix | Use for | Example |
|---|---|---|
| `fix/` | Bug fixes | `fix/rayan-bidding-expired-bid` |
| `docs/` | Documentation only | `docs/update-team-ownership` |
| `chore/` | Config, dependencies, cleanup | `chore/add-shared-formatting` |

---

## 17. Keeping Branches Updated

**Bring `main` into your branch regularly.** A branch that has not seen `main` in a week is the most reliable way to create a painful conflict.

### When to sync

| Situation | Action |
|---|---|
| Start of each working session | Merge `main` into your branch |
| Someone announces a merge that affects you | Merge `main` the same day |
| Before opening a Pull Request | Always — a stale PR is hard to review |
| Before merging an approved Pull Request | Always — `main` may have moved since approval |
| A shared file (§11) changed in `main` | Immediately |

### The process

```bash
git checkout main
```

```bash
git pull origin main
```

```bash
git checkout feature/your-branch
```

```bash
git merge main
```

Then:

1. Resolve any conflicts carefully — see §18
2. **Run the application and test your feature** after resolving
3. Commit the merge
4. Push your branch

**Do not blindly overwrite changes.** If a merge produces something you do not understand, stop and ask the owner of that code before committing.

**A note on rebasing:** the team default is **merge, not rebase**, on shared branches. Rebasing a branch someone else has pulled rewrites history they already have. If you want to rebase a purely personal sub-branch nobody else has touched, that is fine — but never rebase `main` or another developer's branch (Team Rule 11).

---

## 18. Merge Conflict Rules

If a conflict occurs:

1. **Identify which developer owns the conflicting functionality.** Use §6 (Ownership Matrix) and §11 (Shared Files).
2. **Communicate with that developer.** Tell them what you are trying to do and what conflicts.
3. **Understand both changes before resolving.** Read both sides fully. If you do not understand why the other change exists, ask before touching it.
4. **Resolve the conflict carefully.** The correct resolution is usually a combination of both intentions, not one side winning.
5. **Test the affected functionality** — both your change and theirs.
6. **The owner of the affected feature verifies the final behavior.** If you resolved a conflict in someone else's area, they must confirm it still works.

> **Never resolve conflicts by blindly choosing "ours" or "theirs".** That silently deletes someone's work and the loss is often not discovered until much later.

### Escalation

| Situation | What to do |
|---|---|
| Conflict is in your own area only | Resolve it yourself |
| Conflict is in someone else's area | Message the owner before resolving; tag them on the PR |
| Conflict is in a shared file (§11) | Message the whole team; resolve with the file's owner present |
| Conflict is large or you are unsure | **Stop. Do not force it.** Bring both developers together and resolve as a pair. |
| Conflict recurs in the same file every merge | That is a structural problem, not a git problem. Split the file by owner (as §11 does for the detail page). |

---

## 19. GitHub Issues

**Every significant task should have an Issue.** The tasks in §13 are the starting set — turn each one into an Issue.

### Issue structure

Each Issue contains:

```text
Title
Description
Owner
Feature
Acceptance Criteria
Dependencies
Branch
```

### Title convention

```text
[AUTH] Implement user login
[AUCTION] Create auction
[BIDDING] Validate bid
[REALTIME] Update current price
```

Use one of four tags: `[AUTH]`, `[AUCTION]`, `[BIDDING]`, `[REALTIME]`. Add `[SHARED]` for work in shared files (§11).

### Example Issue

```markdown
Title: [BIDDING] Validate bid against current price

Description:
Reject any bid that is not strictly greater than the current valid price.
The rejection message must state the current price so the bidder can correct it.

Owner: Rayan

Feature: Bidding / Bid Validation

Acceptance Criteria:
- A bid equal to the current price is rejected
- A bid below the current price is rejected
- The rejection message names the current price
- Auction state is entirely unchanged after a rejection
- No entry is added to bid history
- The rule is enforced server-side and holds when the UI is bypassed

Dependencies:
- Blocked by: [AUCTION] Define auction record structure (M-01)
- Related: PRD BR-03, FR-BID-05, US-11, SC-09

Branch: feature/rayan-bidding
```

### Labels

Create these in Sprint 0: `auth` · `auction` · `bidding` · `realtime` · `shared` · `blocked` · `verify`

**There is no `needs-decision` label.** `PRD.md` v3.0 has zero open product questions, so no Issue can be blocked on one.

Use **`verify`** for an Issue that depends on a **technical** platform verification recorded in [ARCHITECTURE.md](ARCHITECTURE.md) §22 — for example, whether the platform supports the scheduling granularity auction closing needs. **These are technical questions about what the platform can do, never product questions about what Dalal should do.** A technical finding never rewrites a product requirement; if one appears to, raise it with the team (Rule 16).

### Working with Issues

- Assign every Issue to exactly one owner
- Link the Issue in your PR description
- Close Issues through the PR, not manually
- If you discover work that is not in an Issue, create the Issue first
- If an Issue turns out to belong to someone else's area, reassign it rather than doing it yourself

---

## 20. Pull Request Template

Save this as `.github/pull_request_template.md` so it appears automatically on every PR.

```markdown
## What changed?

## Why?

## Related Issue

## Testing

## Screenshots

## Dependencies

## Checklist
- [ ] Feature is complete
- [ ] Acceptance criteria are satisfied
- [ ] Tested locally
- [ ] No unnecessary files were modified
- [ ] No known breaking changes
- [ ] Another team member reviewed the changes
```

### How to fill each section

| Section | What to write |
|---|---|
| **What changed?** | A short, factual list of what this PR does. Not a story. |
| **Why?** | The reason — usually the Issue and the PRD requirement it satisfies. |
| **Related Issue** | `Closes #12`, so the Issue closes on merge. |
| **Testing** | What you actually tested, and how. "Tested locally" alone is not useful — say what you exercised. |
| **Screenshots** | Required for any UI change. For realtime changes, show both browsers. |
| **Dependencies** | **Important.** Name anything this depends on, anything it unblocks, any shared file it touches, and any placeholder it leaves behind. This is how the other two developers know whether they are affected. |
| **Checklist** | Tick honestly. An untested box that turns out false costs the team more than the delay of testing. |

### Review expectations

**As the author:** keep PRs small and focused. Explain anything non-obvious in the description rather than making the reviewer work it out. Respond to every comment, even if only to say you disagree and why.

**As the reviewer:** review within one working day — a blocked teammate is worse than a slightly less thorough review. Check that the change stays within the author's ownership area, that it does not duplicate something that already exists elsewhere, and that acceptance criteria are actually met. Approve when it is good enough, not when it is perfect.

---

## 21. Commit Convention

Use a simple Conventional Commits style.

```text
feat: add auction creation
feat: add user login
feat: add bid submission
fix: prevent invalid bid
fix: handle expired auction
refactor: simplify auction service
docs: update team documentation
test: add bidding tests
```

### Prefixes

| Prefix | Use for |
|---|---|
| `feat:` | A new capability |
| `fix:` | A bug fix |
| `refactor:` | Restructuring with no behavior change |
| `docs:` | Documentation only |
| `test:` | Adding or changing tests |
| `style:` | Formatting only, no logic change |
| `chore:` | Config, dependencies, housekeeping |

### Keep commits

- **Small** — one logical change per commit
- **Focused** — do not mix a bug fix with a refactor
- **Descriptive** — the message says what changed, in the imperative

### Avoid

```text
update
changes
fix stuff
test
new
```

These tell a reviewer nothing and make history useless when tracing when something broke.

### Good vs. bad

| ✅ Good | ❌ Bad |
|---|---|
| `feat: reject bids below current price` | `fix bidding` |
| `fix: use server time for auction expiry check` | `time fix` |
| `test: add concurrent bid ordering test` | `tests` |
| `refactor: split auction detail into owned components` | `cleanup` |

---

## 22. Definition of Done

A task is complete only when **all** of the following are true:

- [ ] Implementation is complete
- [ ] Acceptance criteria from the Issue are satisfied
- [ ] Local testing is completed
- [ ] No obvious regressions exist
- [ ] Relevant documentation is updated if necessary
- [ ] Pull Request is created
- [ ] Pull Request is reviewed
- [ ] Review comments are resolved
- [ ] Pull Request is merged successfully

### Additional criteria for this project

Given what Dalal is, three more apply to specific kinds of work:

| Applies to | Extra criterion |
|---|---|
| **Anything enforcing a business rule** | The rule is enforced **server-side** and still holds when the UI is bypassed (PRD BR-08, SC-43) |
| **Anything touching bids or price** | Correctness is verified under **concurrent** bidding, not just sequentially (PRD BR-11, SC-16) |
| **Anything crossing an ownership boundary** | The **owner of the consumed functionality has reviewed it** (§7) |

**"Done" is not "it works on my branch."** It is merged into `main`, with `main` still in a usable state.

---

## 23. Team Rules

1. **Do not push feature work directly to `main`.**
2. **Work primarily within your assigned branch.**
3. **Do not modify another developer's owned functionality without coordination.**
4. **Keep commits focused.**
5. **Keep branches reasonably synchronized with `main`.**
6. **Every significant feature should have a GitHub Issue.**
7. **Every completed feature should go through a Pull Request.**
8. **Pull Requests require review.**
9. **Never commit secrets or credentials.**
10. **Never commit `.env` files containing secrets.**
11. **Do not rewrite another developer's history without coordination.**
12. **Keep the repository clean and organized.**
13. **Update documentation when team structure or responsibilities change.**

### Four more, specific to how this team is set up

14. **Announce before changing a shared file or a shared contract.** Identity (A-02), auction fields (M-01), routing, global config, and the app entry point affect everyone. A message before the change costs seconds; discovering it in a conflict costs an afternoon.
15. **If you are blocked, say so the same day.** Do not spend a day working around a missing piece — the person who owns it may be 20 minutes from finishing it, or may not know you need it.
16. **`PRD.md` contains the finalized MVP product decisions. Developers must follow `PRD.md` as the product source of truth. If a genuinely new ambiguity is discovered during implementation, it must be raised with the team rather than silently invented.**
17. **A broken `main` is everyone's problem.** If `main` does not build, fixing it comes before your feature work. Whoever merged the break leads the fix.

---

## 24. Repository Documentation

```text
README.md
PRD.md
TEAM.md
docs/
```

| File | Purpose | Owner |
|---|---|---|
| **`README.md`** | Project introduction and setup. What Dalal is, how to get the project running locally, and where to go next — which is `PRD.md` for what to build and `TEAM.md` for how the team works. Keep it short; setup instructions must actually work from a clean clone. | Whole team — whoever changes setup updates it |
| **`PRD.md`** | The approved product requirements. The single source of truth for **what** the product must do. Every Issue should trace to a PRD requirement. Do not restate requirements in other files — link to the ID instead. | Product owner; developers propose changes via PR |
| **`TEAM.md`** | This document. Team members, ownership, branches, GitHub workflow, and collaboration rules. The single source of truth for **who** does what and **how** work gets merged. | Whole team — update it whenever ownership changes |
| **`ARCHITECTURE.md`** | The technical architecture derived from `PRD.md` and this document. The single source of truth for **how** the system is built — platform split, trust boundary, data ownership, deployment. Read it before implementing anything that touches bidding, authorization, or closing. | Software architecture; developers propose changes via PR |
| **`docs/`** | Additional technical and project documentation, added **later, only when needed**. Likely candidates: records of the technical verification spikes (ARCHITECTURE.md §22) once resolved. | Author of each document |

### Documentation rules

- **Do not create unnecessary documentation files.** Four locations is enough for a three-person team. A document nobody reads is worse than no document, because it goes stale and then misleads.
- **`docs/` starts empty.** Add a file only when there is a real question it answers.
- **Update `TEAM.md` when reality changes.** If ownership shifts, a branch is renamed, or a rule stops being followed, fix this file. An inaccurate `TEAM.md` is worse than none.
- **One place per fact.** Requirements live in `PRD.md`. Ownership lives in `TEAM.md`. Setup lives in `README.md`. Do not copy between them — link.

---

## 25. Risks in This Structure

Recorded honestly so the team can watch for them. The structure is sound; these are the places where it will strain.

| # | Risk | Why it matters | Mitigation |
|---|---|---|---|
| **1** | **Rayan's workstream is significantly larger than the other two** | It contains bidding, all validation, realtime, concurrency correctness, automatic closing, and winner determination — including every correctness-critical requirement in the PRD (BR-11, BR-12, FR-END-10). Abdulrahman's workstream is the smallest and the least blocked. | Watch this from week one. **When Abdulrahman finishes authentication, he should move to support whichever half is behind** — presentation work is routed through Mohammed, who owns all of it (CLAUDE.md §1); bidding behaviour is routed through Rayan — realistically rejection-reason wiring, bid recording and order, or closing and winner determination. Helping does not change primary ownership of either half. |
| **2** | **The auction detail page is a three-way shared surface** | All three workstreams render on it. Left as one file, it conflicts on nearly every merge. | The component split in §11, created as empty files in Sprint 0 (S0-8). Do this before anyone writes page code, not after the first painful conflict. |
| **3** | **Current price sits across an ownership boundary** | Rayan owns the value; Mohammed owns where it appears — on two different pages. Ambiguity here produces two competing sources of truth and a price that disagrees between listing and detail. | The added matrix row in §6 and PRD BR-13: the price is **always** derived from bid history. Mohammed never computes it, only displays it. |
| **4** | **~~PRD Open Questions block Must Have work~~ — RESOLVED.** All fifteen product decisions are final (PRD §21.1); no workstream waits on a product answer. **The residual risk is different: a developer encountering something the PRD genuinely does not cover, and inventing an answer in code.** | Team Rule 16. Raise it with the team; it gets recorded in the PRD, then built. Note that **technical** platform verifications (ARCHITECTURE.md §22) are a separate category and must not be treated as product questions |
| **5** | **Everyone is blocked on A-02 (the identity contract)** | Both Mohammed and Rayan need identity. If it arrives in week three, they either wait or build two different placeholders that both need unpicking. | A-02 is the single highest-priority task on the team. It is a contract, not an implementation — it can be agreed and documented on day one, before the auth code is finished. |
| **6** | **Long-lived branches drift** | Three parallel branches over several weeks, each touching shared files, will diverge badly if they only meet at the end. | §17 sync discipline, the three integration checkpoints in §14, and small frequent PRs rather than one large merge per workstream. |
| **7** | **Concurrency correctness may be discovered late** | R-05 is the hardest task in the project and the easiest to postpone because it is invisible when only one person is testing. Discovering it is wrong at CP-3 is very expensive. | R-05 depends on nothing — **Rayan should start it early**, and R-25 (the automated concurrent-bid test) is required, not optional. |

---

## 26. Finalized product decisions — quick reference

All fifteen are closed in `PRD.md` v3.0 §21.1. This table is a convenience copy for daily work; **the PRD is authoritative**. Nothing here is negotiable during implementation.

| # | Decision | Rule |
|---|---|---|
| 1 | **No auction cancellation** | BR-30 |
| 2 | **No reserve price** | BR-35 |
| 3 | **No editing after publication** | BR-31 |
| 4 | **No fixed minimum bid increment** | BR-32 |
| 5 | **Auction duration: 5 minutes to 7 days** | BR-38 |
| 6 | **First bid may equal the starting price** | BR-29 |
| 7 | **Anti-sniping — an accepted bid in the final 15 s adds 30 s, capped at 20 extensions** *(reversed 2026-08-13; this entry read "no anti-sniping — end time is fixed")* | BR-36 as amended |
| 8 | **No email verification; a valid unique email is still required** | BR-37 |
| 9 | **No seller/winner messaging or contact** | BR-34 |
| 10 | **Bid history is public** | BR-40 |
| 11 | **Display names must be unique** | BR-39 |
| 12 | **Currency is SAR — simulated values, no payments, no maximum price** | BR-21, BR-33 |
| 13 | **Main listing shows active auctions only** | FR-LIST-05 |
| 14 | **A leading bidder may bid again if the amount is strictly greater** | BR-24 |
| 15 | **Password reset is in the MVP** | M24 |

### Things nobody may build

Each is a deliberate product decision, not an oversight to correct in code (PRD SD-05).
**`anti-sniping extension` was removed from this list on 2026-08-13** — BR-36 was reversed
and the extension is now a required feature, not a prohibited one:

`Cancelled` state · cancel control · edit screen or route · persisted Draft · reserve-price field · bid increment · maximum price or bid ceiling · email-verification step · Admin role · payment, checkout, or wallet · seller/winner messaging · shipping or fulfillment · **native mobile app, Flutter/Android/iOS build, or app-store submission (§27)** · the term "Demo Points"

---

## 27. Platform statement — Dalal is a website

> **Dalal is a responsive web-based live auction platform. The MVP is accessed through web browsers and deployed on Vercel. Native mobile applications are out of scope for the MVP.**

```text
Browser  (desktop or mobile)
    ↓
Dalal Web Application
    ↓
Vercel
    ↓
Supabase
```

| In scope | Out of scope |
|---|---|
| Desktop web browsers | Flutter application |
| Mobile web browsers | Android native application |
| Responsive web design | iOS native application |
| Browser-based authentication | App Store distribution |
| Browser-based auction experience | Google Play distribution |
| Responsive auction pages | Native mobile architecture |
| Vercel deployment | Mobile app builds |

**"Mobile responsive" means the website works well in a mobile browser. It does not mean we are building a mobile application.**

**What this means for each of you:**

| Developer | Implication |
|---|---|
| **Abdulrahman** | Auth screens are **web** pages — register, login, logout, password reset — usable at 375 px in a mobile browser. No native auth, no device keychain, no biometric flow |
| **Mohammed** | The listing, detail page, creation form, and image upload are **responsive web** surfaces. The upload uses the browser's file input; there is no camera or gallery integration |
| **Rayan** | Realtime is a **browser** connection to Supabase. There are no push notifications and no background delivery — a user sees live updates while the page is open in their browser |

**Everyone:** every deliverable is part of one responsive web codebase deployed to Vercel (§18 of [ARCHITECTURE.md](ARCHITECTURE.md)). There is no second build target, no app store submission, and no device release pipeline. Test your work in both a desktop browser and a mobile-width browser — PRD NFR-USA-06 and SC-49 require 375 px to be fully usable, and that is a shared responsibility across all three workstreams.

---

## Quick Reference Card

**Print this part, or keep it open.**

| Question | Answer |
|---|---|
| Which branch am I on? | `feature/abdulrahman-auth` · `feature/mohammed-auctions` · `feature/rayan-bidding` |
| Can I push to `main`? | No. Pull Request with one review, always. |
| Who owns identity / "current user"? | Abdulrahman |
| Who owns the auction record? | Mohammed |
| Who owns the price, bids, realtime, and the winner? | Rayan |
| Who owns the auction detail page? | Mohammed owns the shell and all presentation on it, bidding panel included; Rayan owns the bidding behaviour inside it |
| I need something from another area | Ask the owner. Do not build your own. |
| I need to edit another owner's file | Message them first, then tag them as reviewer |
| I hit a conflict | Find the owner → talk → resolve together → owner verifies. Never blind "ours"/"theirs". |
| How often do I sync with `main`? | Start of every session, and always before opening or merging a PR |
| I need to know what the product should do | Read `PRD.md` — it is final, with zero open questions. |
| The PRD genuinely does not cover my situation | Raise it with the team. It gets recorded in the PRD, then built. Never invent it in code (Rule 16). |
| My task depends on a **technical** platform unknown | Label the Issue `verify` and see [ARCHITECTURE.md](ARCHITECTURE.md) §22. This is not a product question. |
| `main` is broken | Everyone stops. Whoever merged the break leads the fix. |
| When is my task done? | Merged into `main`, reviewed, tested, and `main` still works. See §22. |
| Are we building a mobile app? | **No.** Dalal is a responsive website (§27). Test at desktop **and** 375 px mobile-browser width. |

---

*Update this document whenever ownership, branches, or team rules change. An out-of-date `TEAM.md` is worse than none.*
