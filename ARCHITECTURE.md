# ARCHITECTURE.md — Dalal, Live Auction Platform

**Technical architecture. How the system is to be built, decided before implementation begins.**

| Field | Value |
|---|---|
| Project | Dalal — Live Auction Platform |
| Document | Technical Architecture |
| Version | **1.1 — synchronized with PRD v3.0 and TEAM v2.0** |
| Date | 2026-08-12 |
| Author | Software Architecture |
| Status | **Ready for review** — all document conflicts resolved (§2); of five **technical** verification spikes (§22), **V-1 and V-2 are executed** and three remain |
| Sources of truth | [PRD.md](PRD.md) **v3.0** (requirements — zero open product questions) · [TEAM.md](TEAM.md) **v2.0** (ownership) |
| **Platform** | **Responsive web application (website).** Desktop and mobile **browsers**. **No** native mobile application — see §4.4 |
| Deployment | Vercel (web application) + Supabase (backend platform) |
| Phase boundary | No code, no SQL, no migrations, no API specs, no CI configuration, no task assignment |

> **How to read this document.** §2 records the document conflicts found in v1.0 and confirms each is now resolved. §3–§8 define the system shape and trust boundary. §9–§16 are the subsystem designs, one per capability. §17–§19 cover deployment and ownership. §20–§23 record decisions, risks, and the **technical** items to validate before implementation starts.
>
> **Product vs. technical.** Everything in §22 is a **technical platform question** — what the infrastructure can do. `PRD.md` v3.0 has **zero open product questions**. A technical finding never rewrites a product requirement; where the two appear to collide (§15.6), that is stated explicitly and the requirement is left intact.

---

## 1. Table of Contents

1. Table of Contents
2. **Document conflicts — all resolved**
3. Requirements extracted from the source documents
4. Architectural goals and constraints — **includes §4.4 Platform statement**
5. System context
6. Platform split — what runs where
7. The trust boundary model
8. Supabase service evaluation
9. Conceptual data architecture
10. Authentication architecture
11. Authorization architecture
12. Auction creation and immutability
13. Bidding architecture and concurrency
14. Realtime architecture
15. Auction closing and winner determination
16. Storage architecture
17. Environment variables and secrets
18. Deployment architecture
19. Architectural stewardship and the invariants
20. Architecture Decision Records
21. Cross-cutting concerns
22. Verification spikes required before implementation
23. Architectural risks
24. Explicitly out of architectural scope

---

## 2. Document conflicts — all resolved

Architecture v1.0 reported six conflicts between `PRD.md` and `TEAM.md`, all caused by TEAM.md v1.0 having been written against PRD v1.0. **`TEAM.md` v2.0 and `PRD.md` v3.0 resolve every one.** The record is kept for traceability.

| # | Conflict reported in v1.0 | Resolution | Status |
|---|---|---|---|
| **C-1** | TEAM.md deferred Abdulrahman's registration work pending Q15 (password reset) | Q15 closed — password reset **is** MVP. TEAM.md §13.1 now states no product answer is outstanding | ✅ Resolved |
| **C-2** | **Password reset was a Must Have with no task and no owner** | TEAM.md v2.0 adds **tasks A-20 → A-25** under Abdulrahman, adds it to his responsibilities in §3, and adds a **Password Reset** row to the ownership matrix (§6). **Primary ownership unchanged — authentication remains Abdulrahman's** | ✅ Resolved |
| **C-3** | No password-reset row in the ownership matrix | Added, owned by Abdulrahman | ✅ Resolved |
| **C-4** | TEAM.md deferred Mohammed's M-03 and M-20/M-21 pending Q1, Q3, Q5, Q12 | All four closed. TEAM.md §13.2 now carries a decision table: **7-day maximum duration, SAR with no ceiling, no cancellation, no editing, no reserve, active-only listing** | ✅ Resolved |
| **C-5** | TEAM.md deferred Rayan's R-03 and R-17 pending Q4, Q6, Q7, Q14 | All four closed. TEAM.md §13.3 now carries a decision table: **no increment, first bid may equal starting price, ~~fixed end time~~ *(Q7 reversed 2026-08-13 — see BR-36 as amended)*, leading bidder may re-bid** | ✅ Resolved |
| **C-6** | Team Rule 16 and Risk 4 cited "15 unresolved, six blocking" | Rule 16 replaced with the PRD-as-source-of-truth rule; Risk 4 rewritten; `needs-decision` label removed and replaced with `verify` for **technical** items only | ✅ Resolved |
| **G-1** | TEAM.md never mentioned currency, so SAR had no agreed representation | TEAM.md §11 adds **The money representation rule (SAR)** — **one representation and one formatter**, `lib/money.ts`, used everywhere. Nobody may invent a second. Added to Sprint 0 as **S0-12**, contracted in `docs/contracts/S0-12-money.md`, and enforced by `tests/guards/run.sh` | ✅ Resolved |

### Consequences for this architecture

Eight product decisions were closed in PRD v3.0 after this document's first version. Their architectural impact:

| Decision | Impact on the architecture | Where updated |
|---|---|---|
| **Q5 — duration 5 min to 7 days** *(changed from 30 days)* | Creation validation bound. Also shortens the maximum lifetime of an un-editable, un-cancellable listing | §12.4 |
| **Q2 — no reserve price** | **Simplifies winner determination.** No hidden threshold, no third close outcome | §15.7 |
| **Q7 — ~~no anti-sniping~~ REVERSED 2026-08-13** | The simplification is withdrawn. The end time now moves: an accepted bid in the final 15 s adds 30 s, capped at 20 (PRD BR-36 as amended). The sweep copes because it re-reads `end_time` under a row lock on every pass and never caches a deadline | §15, BID-15 |
| **Q8 — no email verification** | Removes a registration state. **Does not remove the email-delivery dependency** — password reset still needs it | §10.2, §10.3 |
| **Q11 — unique display names** | A uniqueness constraint on the profile record; a new registration failure path | §9.3, §10.2 |
| **Q10 — public bid history** | Confirms anonymous read access to bids as designed. No change | §11.2 |
| **Q13 — active-only listing** | The listing query filters to Active. Ended auctions stay readable by direct link | §9.6 *(new)* |
| **Q14 — leading bidder may re-bid** | **No new rule in the bid operation** — leading status is simply never checked | §13.2 |

**None of these invalidated an architectural decision.** Every ADR in §20 stands. One of them — no reserve — makes the design simpler than v1.0 assumed it might need to be. The other, no anti-sniping, **was reversed on 2026-08-13** (PRD BR-36 as amended); the simplification it bought is gone, and BID-15 pays for it explicitly rather than pretending the end time is still static.

## 3. Requirements extracted from the source documents

What follows is the architecturally-significant subset. Every row traces to a PRD identifier; the PRD remains authoritative.

### 3.1 Requirements that shape the architecture most

| Area | Requirement | Architectural consequence |
|---|---|---|
| **Trust** | The client is never trusted to determine bid validity (BR-08, FR-SEC-10, SEC-V1) | Bid acceptance cannot be a client-issued database write. A server-side trust boundary is mandatory — §7, §13 |
| **Concurrency** | One definitive ordering; at most one bid accepted per price level; none lost or duplicated (BR-11, BR-12, FR-BID-11 → 17) | Bid acceptance must be a single serialized atomic operation, not read-then-write — §13 |
| **Price integrity** | Current price is always the highest accepted bid, else the starting price; no user may set it (BR-07, BR-13, NFR-DAT-01) | Price is derived, never client-written. Its update must be in the same transaction as the bid — §13 |
| **Immutability** | Bid history is append-only; no modify or delete path may exist for anyone (BR-05, BR-18, SEC-I1) | No update/delete permission on bids for any role, including the owner — §11 |
| **Time authority** | All time decisions use server time; client clocks are display-only (BR-19, SEC-V3, EC-17) | One clock: the database. No application-server or browser timestamp may decide validity — §21.1 |
| **Auto-close** | Auctions close within 30 s of end time, with no human action, whether or not anyone is viewing (FR-END-01 → 03, SC-25, SC-26) | Requires a scheduler. **Vercel provides no always-on process** — §15 |
| **Idempotent close** | Winner determination runs exactly once and is idempotent (BR-17, FR-END-10, SC-32) | Finalization must be safe to invoke repeatedly from multiple triggers — §15 |
| **Realtime** | Price, history, and status reach all current viewers within 2 s, ≥20 concurrent viewers (FR-RT-03, NFR-RT-01, NFR-RT-02) | Server-push per auction. Polling is not acceptable — §14 |
| **Realtime is not authority** | Liveness never determines validity (BR-22, FR-RT-14, RT-R1) | The realtime channel is a projection of committed state, never a decision path — §14 |
| **Public read** | Listing, detail, and bid history are readable without authentication (FR-AUTH-23, FR-LIST-01, FR-DETAIL-01, FR-BID-22) | Anonymous read access is a first-class case in the authorization model — §11 |
| **Privacy** | Email addresses never exposed to any other user, including in realtime payloads (SEC-P1, RT-S2, SC-42) | Public-facing identity must be separable from the auth record — §9, §14 |
| **Money** | SAR, exactly two decimals, no rounding drift, **no maximum** (BR-21, BR-33, NFR-DAT-05) | Exact decimal representation, never floating point, with no imposed upper bound — §21.2 |
| **Storage** | One image per auction, ≤5 MB, type validated server-side, publicly readable (FR-CREATE-15 → 21) | Object storage with public read and owner-scoped write — §16 |
| **No partial state** | A failed creation leaves no partial auction and no orphaned image (FR-CREATE-19, SEC-I6) | Upload and record creation need a defined ordering and cleanup path — §12, §16 |
| **Password reset** | Self-service, single-use, time-limited, non-enumerating (FR-AUTH-25 → 31, M24) | Requires an email delivery capability — the MVP's only outbound message (PRD §16.5) — §10 |
| **No email verification** | A user registers and can immediately bid; no verification step, no unverified state (BR-37) | Removes a registration state. **Does not remove the email dependency** — reset still needs a reachable mailbox — §10.3 |
| **Unique display names** | Display names unique across all accounts (BR-39) | A uniqueness constraint on the profile record, with a registration failure path — §9.3, §10.2 |
| **Duration bounds** | 5 minutes to 7 days inclusive, from creation, by server time (BR-38) | Creation validation bound — §12.4 |
| **No reserve** | Highest valid bid wins regardless of amount (BR-35) | **Simplifies winner determination.** There is no third close outcome — §15 |
| **Anti-sniping** *(amended 2026-08-13)* | An accepted bid in the final 15 s extends the end by 30 s, capped at 20 extensions (BR-36 as amended) | **The end time is no longer static.** Closing must re-read it, never cache it, and realtime must propagate it — §15.2, BID-15 |
| **Active-only listing** | The main listing shows Active auctions only; ended remain reachable by direct link (FR-LIST-05, FR-LIST-05a) | A filter on the listing read, not a data-lifecycle change — §9.6 |

### 3.2 Lifecycle the architecture must implement

```text
Auction Creation
       ↓
     Active          ← becomes Active immediately on creation (BR-14); immutable thereafter (BR-31)
       ↓
   Bidding           ← server-validated, serialized, append-only (§13)
       ↓
     Ended           ← automatic at end time, ≤30 s, no human action (§15)
       ↓
Winner Determined    ← highest valid bid; exactly once; idempotent (§15)
       ↓
Result Displayed     ← terminal. Nothing follows (BR-34)
```

**No `Cancelled` state. No Draft persistence. No transition out of Ended.** (PRD §12.0, §12.4.)

### 3.3 The domain map — review interest, not permission

> **Amended 2026-08-15.** This table used to be titled *"Ownership boundaries"* and assigned
> an architectural surface to each developer. **Nobody owns a file or a surface any more**
> (`CLAUDE.md` §1, `TEAM.md` §6–§7): any available contributor may claim any ready ticket, and
> **a steward's absence does not block one.** The table survives because knowing *who to ask*
> is still useful — it just no longer decides *who may build*.

| Steward | Domain | Architectural surface they know best |
|---|---|---|
| **Abdulrahman** | Authentication & identity | Supabase Auth integration, session handling, identity contract, profile record, password reset |
| **Mohammed** | Presentation & design system | Listing and detail pages, page shell, Storage integration, creation form |
| **Rayan** | Bidding & realtime | Bid record, the bid-acceptance operation, price derivation, Realtime integration, closing and winner determination |

This architecture assigns no work. The **contracts** in §19 are what a change must not break;
they hold regardless of who writes the change.

---

## 4. Architectural goals and constraints

### 4.1 Goals, in priority order

1. **Correctness under concurrency before everything else.** The PRD's central claim is that the auction mechanics are right. An architecture that is fast, elegant, and occasionally awards the wrong winner has failed.
2. **A trust boundary a reviewer can point at.** It must be possible to say "here is the one place a bid can be accepted, and it cannot be bypassed" — not "validation is spread across these six files."
3. **Fit the three-way team split.** The component boundaries should match TEAM.md's ownership so that parallel work does not collide (TEAM.md §11).
4. **Minimum viable infrastructure.** Every service must earn its place against a specific requirement (§8). No service is included because it is available.
5. **Demonstrability.** Dalal is an educational MVP (PRD §2.1). A developer must be able to run a full lifecycle locally and quickly (NFR-MNT-03, NFR-MNT-04).

### 4.2 Hard constraints

| Constraint | Source | Implication |
|---|---|---|
| Vercel has **no permanently running process** | Stated in this phase's brief | Anything periodic must be externally scheduled — §15 |
| Vercel functions are **short-lived and stateless** | Platform model | No in-memory bid queues, locks, timers, or WebSocket servers of our own |
| Supabase is the backend platform | Stated in this phase's brief | Auth, database, storage, realtime, and any server-side compute default to Supabase |
| Three developers, parallel workstreams | TEAM.md | Component boundaries must align to ownership |
| No real money (PRD §19.0) | PRD | No payment integration, no PCI scope, no financial-grade audit requirements |
| Two-decimal exact SAR, no ceiling | BR-21, BR-33 | Exact decimal type; unbounded magnitude |

### 4.3 Non-goals for this architecture

Scaling beyond the PRD's stated targets (100 concurrent auctions, 50 users, 20 viewers per auction — NFR-SCA-01 → 03); multi-region; offline support; a public API; any payment, contact, or fulfillment capability; **any native mobile platform (§4.4)**.

### 4.4 Platform statement

> **Dalal is a responsive web-based live auction platform. The MVP is accessed through web browsers and deployed on Vercel. Native mobile applications are out of scope for the MVP.**

The delivery chain is therefore, in full:

```text
Browser  (desktop or mobile — the only client)
    ↓
Dalal Web Application  (responsive web UI)
    ↓
Vercel                 (hosts and serves the web application)
    ↓
Supabase               (auth, database, storage, realtime)
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

**Architectural consequences — all of which this document already assumes:**

| Consequence | Where it appears |
|---|---|
| **The browser is the only client.** Every diagram's client node is a web browser; there is no second client type to design for | §5, §6.4 |
| **Authentication is browser-based** — a web session, not a device-held token or a native keychain | §10 |
| **Realtime is a browser WebSocket** to Supabase, not a native push channel or a mobile notification service | §14 |
| **"Mobile" means a narrow viewport**, not a different platform. NFR-USA-06's 375 px requirement is responsive layout work in the same codebase, not a separate build | §21, NFR-USA-06 |
| **One deployable artifact** — the web application on Vercel. No device builds, no store submissions, no release pipelines beyond §18 | §18 |
| **No native platform code** anywhere in the system | Whole document |

**This clarifies rather than changes the architecture.** Every design decision in this document was already made for a browser client on Vercel; nothing here requires revision.

---

## 5. System context

```text
                    ┌──────────────────────────────┐
                    │   Browser — the only client  │
                    │   desktop or mobile (§4.4)   │
                    │  (rendering + input only)    │
                    │  • displays price & history  │
                    │  • submits bid requests      │
                    │  • NEVER decides validity    │
                    └──────┬────────────────┬──────┘
                           │                │
              HTTPS        │                │  WebSocket
              (page loads, │                │  (live price, bids,
               form posts) │                │   status changes)
                           ▼                │
        ┌──────────────────────────┐        │
        │         VERCEL           │        │
        │  Application layer       │        │
        │  • UI rendering          │        │
        │  • routing               │        │
        │  • session handling      │        │
        │  • server-side data      │        │
        │    fetching for pages    │        │
        │  • NO auction rules      │        │
        └──────────┬───────────────┘        │
                   │                        │
                   │  Supabase client       │
                   │  (user's identity      │
                   │   attached)            │
                   ▼                        │
        ┌───────────────────────────────────┴──────────────┐
        │                   SUPABASE                       │
        │  ┌────────────┐  ┌──────────────────────────┐    │
        │  │    Auth    │  │        PostgreSQL        │    │
        │  │ identity,  │  │  • auctions, bids,       │    │
        │  │ sessions,  │  │    profiles              │    │
        │  │ password   │  │  • RLS = authorization   │    │
        │  │ reset      │  │  • bid acceptance =      │    │
        │  └────────────┘  │    THE trust boundary    │    │
        │                  │  • finalization          │    │
        │  ┌────────────┐  │  • server clock          │    │
        │  │  Storage   │  └───────────┬──────────────┘    │
        │  │  product   │              │                   │
        │  │  images    │              ▼                   │
        │  └────────────┘  ┌──────────────────────────┐    │
        │                  │       Realtime           │    │
        │  ┌────────────┐  │  broadcasts committed    │    │
        │  │ Scheduler  │  │  changes to viewers      │    │
        │  │ closes     │  └──────────────────────────┘    │
        │  │ auctions   │                                  │
        │  └────────────┘                                  │
        └──────────────────────────────────────────────────┘
```

**The single most important property of this diagram:** the browser's realtime connection goes to Supabase directly, not through Vercel. Vercel serves the application; it is not in the live-data path. This is what makes the design compatible with Vercel's stateless, short-lived execution model — there is no long-running connection for Vercel to hold.

---

## 6. Platform split — what runs where

### 6.1 On Vercel

| Runs on Vercel | Why | Notes |
|---|---|---|
| The **responsive web application** UI | It is the web application host | All pages: listing, auction detail, auth screens, profile. One responsive codebase serving desktop and mobile browsers alike — **no separate mobile build** (§4.4) |
| Routing and navigation | Part of the application | |
| Server-side page rendering and initial data fetch | Fast first paint; PRD NFR-PERF-01/02 require usable content in 3 s | Reads go through Supabase with the viewer's identity |
| Session handling at the edge of the app | Reading and refreshing the Supabase session on requests | Session **issuance** is Supabase Auth's, not Vercel's |
| Client-side validation for fast feedback | UX only (SEC-V6) | Explicitly not an enforcement point |
| Static assets | Standard | |

### 6.2 On Supabase

| Runs on Supabase | Why | Requirement |
|---|---|---|
| Identity, credentials, sessions, password reset | Single source of truth for who a user is | §3.1 Trust, FR-AUTH-* |
| All persistent data — auctions, bids, profiles | Single source of truth for auction state | BR-13, BR-18 |
| **Authorization (RLS)** | Enforced at the data, so it cannot be bypassed by any client | FR-SEC-02, SEC-Z9 |
| **Bid acceptance (the trust boundary)** | Must be atomic with the price update; must be serialized | BR-11, BR-12 |
| **Auction finalization** | Must run without anyone present | FR-END-02 |
| **The scheduler that triggers finalization** | Vercel has no always-on process | §15 |
| Realtime broadcast of committed changes | Server push to many viewers | FR-RT-03 |
| Product image storage and public delivery | Object storage | FR-CREATE-15 → 21 |
| **The authoritative clock** | One time source for all decisions | BR-19 |

### 6.3 What runs nowhere — deliberately absent

| Not built | Why |
|---|---|
| A custom backend server or container | Nothing requires it; Supabase covers every backend need (§8) |
| A WebSocket server of our own | Supabase Realtime provides it, and Vercel cannot host one |
| An in-memory cache, queue, or job runner | No requirement; would add a second source of truth |
| A separate admin service | No Admin role exists (PRD §4.3) |
| **A native mobile application, or any device build** | Dalal is a website (§4.4). Mobile users are served by the same responsive web application in their mobile browser |
| Payment, messaging, or notification infrastructure | Out of scope (PRD §19.0, §16) |

### 6.4 How the frontend communicates with Supabase

Three distinct paths, each with a different trust posture:

| # | Path | Used for | Identity | Trust |
|---|---|---|---|---|
| **P1** | Browser or Vercel → Supabase, **reads** | Listing, auction detail, bid history, profile | Anonymous or the signed-in user | Constrained by RLS. Safe — reads only expose what the policy allows |
| **P2** | Browser or Vercel → Supabase, **the bid operation** | Placing a bid | The signed-in user, verified server-side | **The trust boundary.** A single callable operation; direct writes to bids are denied |
| **P3** | Browser ⇄ Supabase Realtime, **subscribe** | Live price, bids, status | Anonymous or signed-in | Read-only projection of committed state. Never a write path |

**No fourth path exists.** In particular, there is no path by which a client writes an auction's current price, status, or winner (BR-07, SEC-Z5, SEC-Z6).

### 6.5 How server-side operations are handled

"Server-side" in Dalal means **inside PostgreSQL**, not inside a Vercel function. This is a deliberate decision (ADR-3, §20).

| Operation | Where it executes | Why there |
|---|---|---|
| Bid validation and acceptance | Database, one transaction | Atomicity with the price update is the requirement; moving it out adds a network hop and a lost-update window |
| Auction finalization and winner determination | Database, one transaction | Same reason; also must run with no client present |
| Authorization | Database, RLS | Cannot be bypassed by any caller |
| Creation validation | Database constraints + the application form | Server-side enforcement required (SEC-V2); the form mirrors it for UX |
| Image type and size validation | Storage policy + server-side check | FR-CREATE-18 forbids trusting the extension |
| Session verification | Supabase Auth, consumed by both Vercel and the database | One identity source |

---

## 7. The trust boundary model

Every operation in Dalal is classified into exactly one of four tiers. **The classification is the architecture** — it is what makes "the client cannot bypass the rules" a checkable property rather than an aspiration.

```text
┌─────────────────────────────────────────────────────────────┐
│  TIER 1 — CLIENT (untrusted)                                │
│  Display, input, fast feedback. Assume absent (SEC-V6).     │
└─────────────────────────────────────────────────────────────┘
                            │  every request crosses here
════════════════════════════╪══════ TRUST BOUNDARY ═══════════
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2 — DATABASE-ENFORCED (RLS + constraints)             │
│  Who may read/write what. Structural invariants.            │
├─────────────────────────────────────────────────────────────┤
│  TIER 3 — SERVER-SIDE TRANSACTIONAL LOGIC                   │
│  Bid acceptance. Finalization. Serialized, atomic, one path.│
├─────────────────────────────────────────────────────────────┤
│  TIER 4 — REALTIME PROJECTION (read-only, never authority)  │
│  Broadcasts what Tiers 2–3 already committed.               │
└─────────────────────────────────────────────────────────────┘
```

### 7.1 Operation classification

| Operation | Tier 1 Client | Tier 2 DB-enforced | Tier 3 Server-side | Tier 4 Realtime |
|---|---|---|---|---|
| Show current price | ✅ display | — | — | ✅ push updates |
| Countdown timer | ✅ ticks locally from server-supplied end time | — | — | — |
| Validate bid format before submit | ✅ **UX only** | — | — | — |
| **Bidder is authenticated** | prompt only | ✅ | ✅ **authoritative** | — |
| **Auction is still Active by server time** | display only | — | ✅ **authoritative** | — |
| **Bidder is not the auction owner** | hide control | ✅ | ✅ **authoritative** | — |
| **Bid ≥ starting price (first) / > current (subsequent)** | hint only | — | ✅ **authoritative** | — |
| **Ordering of concurrent bids** | — | — | ✅ **authoritative** | — |
| **Current price update** | — | ✅ no user write permitted | ✅ derived here | ✅ pushed |
| **Bid history append** | — | ✅ insert-only, no update/delete | ✅ written here | ✅ pushed |
| Auction creation field validation | ✅ mirror | ✅ constraints | — | — |
| **Auction ownership assignment** | — | ✅ from session, not payload | — | — |
| **Auction immutability after publish** | no edit UI | ✅ **no update permitted** | — | — |
| **Auction close at end time** | — | — | ✅ scheduled + idempotent | ✅ pushed |
| **Winner determination** | — | ✅ no user write permitted | ✅ **authoritative** | ✅ pushed |
| Image upload | ✅ initiates | ✅ owner-scoped policy | ✅ type/size check | — |
| Read listing / detail / history | ✅ | ✅ public read policy | — | — |
| Password reset | ✅ initiates | — | ✅ Supabase Auth | — |

### 7.2 The rule that makes this enforceable

> **If a rule appears in PRD §9 (Business Rules), its authoritative enforcement is in Tier 2 or Tier 3. Tier 1 may mirror it for user experience and must be assumed absent when reasoning about correctness.**

This is directly testable: PRD SC-43 requires that every bidding rule holds when the UI is bypassed entirely. The architecture satisfies it because Tier 1 has no enforcement role to bypass.

### 7.3 What "the client cannot bypass this" means concretely

A hostile client holding a valid session can issue any request the platform accepts. Under this architecture:

| Attack | Why it fails |
|---|---|
| Insert a bid row directly | No insert permission on bids for any user role — the only path is the Tier 3 operation |
| Update an auction's current price | No update permission on that field for any user role |
| Set themselves as winner | Same — winner fields are not user-writable |
| Bid on their own auction via a crafted request | Ownership is compared server-side against the session identity |
| Bid after the end time using a manipulated clock | The comparison uses the database clock; the client's clock is never transmitted as authority |
| Bid with a forged user identifier | Identity comes from the verified session, never from the request payload |
| Edit or delete a bid | No update or delete permission exists on bids for anyone |
| Edit or cancel their published auction | No update permission on auction fields after creation |
| Attach an image to someone else's auction | Storage write policy is scoped to the owner's path |

---

## 8. Supabase service evaluation

Each service is assessed against the mandate: **why it is needed, which requirement it satisfies, which invariant it must uphold, and how the rest of the system consumes it.** A service that could not answer all four would not be included.

### 8.1 Supabase Auth — **INCLUDED**

| | |
|---|---|
| **Why needed** | Every bid must be attributable to a real, verified account (BR-01). Building credential storage, session issuance, and password reset by hand would be both slower and less safe than using the platform's. |
| **Requirements satisfied** | FR-AUTH-01 → 31 (registration, login, logout, session, identity, **password reset**), BR-01, SEC-A1 → A5, M1, M2, M3, M24 |
| **Primary owner** | **Abdulrahman** (TEAM.md §3) |
| **How Mohammed consumes it** | Obtains the authenticated user's identifier to set auction ownership (FR-CREATE-02) and to decide which controls the viewer sees. Never reads session state directly — uses Abdulrahman's identity contract (TEAM.md §10.1) |
| **How Rayan consumes it** | Obtains the bidder's identifier, verified server-side, for every bid (FR-BID-01) and the display name for bid history (FR-BID-23). Uses the **server-side authoritative** identity path, never the client-side convenience (TEAM.md §10.2) |
| **Architectural note** | Auth is the identity source. It is **not** the profile source — see §9.2. Password reset requires email delivery, which is the MVP's only outbound message (PRD §16.5) |

### 8.2 Supabase PostgreSQL — **INCLUDED**

| | |
|---|---|
| **Why needed** | The system's core requirement is transactional correctness under concurrent writes (BR-11, BR-12). A relational database with real transactions and row-level locking is the natural and correct fit; nothing else in the stack can provide serialized bid ordering. |
| **Requirements satisfied** | BR-05 → BR-18, BR-28 → BR-32, NFR-DAT-01 → 08, SEC-I1 → I6, plus every FR that stores or reads auction, bid, or profile data |
| **Primary owner** | **Shared, by entity** (TEAM.md §11): profiles = Abdulrahman · auctions = Mohammed · bids = Rayan |
| **How consumed** | Each entity has **one** definition and **one** access path. Cross-entity reads go through the agreed contract, never an ad-hoc query — TEAM.md §10.3 |
| **Architectural note** | PostgreSQL is doing three jobs here: storage, **authorization** (§11), and **server-side transactional logic** (§13, §15). That concentration is deliberate — it puts the trust boundary where the data is |

### 8.3 Supabase Storage — **INCLUDED**

| | |
|---|---|
| **Why needed** | Auctions require a product image (FR-CREATE-01, M6), publicly readable by unauthenticated visitors (FR-CREATE-20). Binary objects do not belong in a relational table. |
| **Requirements satisfied** | FR-CREATE-15 → 21, M6, SC-04 |
| **Primary owner** | **Mohammed** (TEAM.md §4) |
| **How consumed** | Abdulrahman does not consume it. Rayan does not consume it — his components render inside Mohammed's page, which supplies the image. Read access is public, so no coordination is needed for display |
| **Architectural note** | Write access must be owner-scoped so a user cannot attach an image to another user's auction (FR-CREATE-21, SEC-Z8). Upload/record ordering matters for the no-partial-state rule — §16 |

### 8.4 Supabase Realtime — **INCLUDED**

| | |
|---|---|
| **Why needed** | The product's defining characteristic (PRD §3, Principle 3): price, history, and status must reach all current viewers within 2 seconds with no refresh. Polling cannot meet a 2-second target at 20 concurrent viewers without wasteful load, and Vercel cannot host a socket server. |
| **Requirements satisfied** | M13, M14, M15, FR-RT-01 → 16, NFR-RT-01 → 06, SC-20 → 24 |
| **Primary owner** | **Rayan** (TEAM.md §5) |
| **How Mohammed consumes it** | His auction detail page hosts the live regions and tells Rayan's components which auction is being viewed. He must not add a second, competing update mechanism (TEAM.md §10.4) |
| **How Abdulrahman consumes it** | Not at all |
| **Architectural note** | Realtime is **Tier 4** — a projection, never an authority (BR-22). Payloads must carry only publicly visible data; never email addresses (RT-S2) — §14.4 |

### 8.5 Supabase Edge Functions — **NOT INCLUDED for the MVP**

This is the one service where the honest answer is no, and the reasoning matters.

| | |
|---|---|
| **Considered for** | Bid acceptance, auction finalization, image validation |
| **Decision** | **Not used.** All three needs are better served elsewhere |
| **Why not for bid acceptance** | The requirement is atomicity between validation, the history append, and the price update, plus serialized ordering under concurrency (BR-11, BR-12). An Edge Function would still have to open a database transaction to achieve that — it would be a network hop wrapped around the operation that actually provides the guarantee. Worse, it creates a **second** path into bidding that must also be locked down, weakening the "one trust boundary" property in §7. Placing the operation in the database keeps exactly one path |
| **Why not for finalization** | Finalization must be transactional and idempotent against the same data (BR-17). Same reasoning |
| **Why not for image validation** | Storage policies plus a server-side type check cover FR-CREATE-18 without adding a service |
| **When it would become justified** | If Dalal later needs to call an external system — a payment provider, an email service beyond Auth's, a webhook receiver, or a third-party API. **None of those exists in the MVP** (PRD §19.0, §16). It would also become justified if finalization needed logic unnatural to express in the database |
| **Consequence of this decision** | One fewer deployable artifact, one fewer place for auction rules to live, and one fewer thing for three developers to keep in sync. Recorded as ADR-3 (§20) with its reversal conditions |

### 8.6 Summary

| Service | Included | Owner | Primary justification |
|---|---|---|---|
| Auth | ✅ | Abdulrahman | Attributable identity for every bid (BR-01) |
| PostgreSQL | ✅ | Shared by entity | Transactional correctness under concurrency (BR-11, BR-12) |
| Storage | ✅ | Mohammed | Product images, publicly readable (FR-CREATE-20) |
| Realtime | ✅ | Rayan | 2-second live updates to all viewers (FR-RT-03) |
| Edge Functions | ❌ | — | No requirement it uniquely satisfies; would add a second trust path |

**Four services, each traceable to a Must Have.** No service is present because it was available.

---

## 9. Conceptual data architecture

**This is a conceptual model, not a schema.** No SQL, no types, no migrations — those belong to the implementation phase. What is defined here is *what data exists, which component is authoritative for it, and which parts are system-authored versus user-supplied*, because those determine the authorization model.

### 9.1 Entities and authoritative sources

| Entity | Authoritative source | Entity owner (TEAM.md) | Exists because |
|---|---|---|---|
| **Identity / credentials** | Supabase Auth | Abdulrahman | BR-01 — bids must be attributable |
| **Profile** | PostgreSQL | Abdulrahman | FR-PROF-01 — public display name, separable from the private auth record |
| **Auction** | PostgreSQL | Mohammed | The product being sold and its terms |
| **Bid** | PostgreSQL | Rayan | BR-18 — the permanent, append-only record |
| **Product image** | Supabase Storage | Mohammed | FR-CREATE-15 |
| **Auction outcome** | PostgreSQL, on the auction | Rayan writes, Mohammed's views read | FR-END-08 |

**One rule governs all of it:** each fact has exactly one authoritative home. The current price lives with the auction but is *derived from* bids and written only by the bid operation (§13). Nothing is stored in two places.

### 9.2 Why profile is separate from Auth

Supabase Auth holds the email address. PRD SEC-P1 and SC-42 require that email addresses are **never** visible to any other user, anywhere, including in realtime payloads. Bid history, by contrast, must publicly display the bidder's name (FR-BID-23) to anonymous visitors (FR-BID-22).

Keeping a **profile record separate from the auth record** makes this structural rather than careful: the publicly-readable table simply does not contain an email address, so no policy mistake, join, or realtime payload can leak one. The alternative — reading names from the auth record and filtering carefully everywhere — makes privacy a discipline problem instead of an architectural one.

### 9.3 Field categories — who may write what

This categorization drives the entire authorization model (§11).

**Auction**

| Category | Fields | Writable by |
|---|---|---|
| User-supplied at creation, then **immutable** | product name, description, starting price, end time, image reference | The owner, **once**, at creation only (BR-31) |
| System-assigned at creation | owner identity, created timestamp, initial status | The system, from the verified session (FR-CREATE-02) |
| **Derived — never user-writable** | current price | Only the bid operation (BR-07, BR-13) |
| **Outcome — never user-writable** | status, final price, winner identity, close timestamp | Only the finalization operation (BR-06, SEC-Z6, SEC-Z7) |

**Bid**

| Category | Fields | Writable by |
|---|---|---|
| Recorded at acceptance | auction, bidder identity, amount, timestamp | **Only** the bid operation |
| Anything else | — | Nothing. Bids are append-only; no field is ever updated or deleted (BR-05, SEC-I1) |

**Profile**

| Category | Fields | Writable by |
|---|---|---|
| Public | display name | The user themselves (edit is Should Have, FR-PROF-05) |
| Private | email | Supabase Auth only; never exposed |
| System | identifier, created timestamp | The system |

### 9.4 The current-price question — resolved

TEAM.md §6 flags this as the project's most contested piece of state — derived in one place, displayed on two pages. Architecturally:

- The current price **lives on the auction record** — one read, no aggregation, fast listing and detail pages (NFR-PERF-01/02).
- It is **written only by the bid operation**, in the same transaction as the bid it derives from (§13). No user, and no other code path, may write it.
- It must **always equal the highest accepted bid, or the starting price when there are none** (NFR-DAT-01, zero tolerance). Because both writes happen in one transaction, they cannot diverge.
- **Verification:** the invariant is independently recomputable from bid history at any time — which is exactly what SC-29 and NFR-DAT-04 require for the winner, and the same check applies to the price.

**Mohammed's pages read the field. Rayan's operation writes it. Neither computes it independently.** This resolves the ownership ambiguity without splitting the data.

### 9.5 Relationships

```text
Identity (Supabase Auth)
    │ 1:1
    ▼
Profile ──────┬──────────────── 1:N ──────► Auction ──── 1:1 ──► Image (Storage)
              │                                 │
              │                                 │ 1:N
              └──────── 1:N ──────► Bid ◄───────┘
                                     │
                                     └── the winning bid is the highest;
                                         the outcome is recorded on the Auction
```

Constraints implied by the PRD, to be enforced structurally: an auction has exactly one owner, permanently (BR-10); a bid belongs to exactly one auction and one bidder; a bidder is never the auction's owner (BR-02); accepted bid amounts on an auction are strictly increasing in recorded order (NFR-DAT-03); **display names are unique across all profiles** (BR-39).

### 9.6 Listing scope — active only

PRD FR-LIST-05 restricts the main listing to Active auctions, while FR-END-12 keeps ended auctions viewable indefinitely. These are **not** in tension, and the distinction is a read-path concern only:

| Surface | Shows | Requirement |
|---|---|---|
| Main listing | **Active auctions only**, ordered soonest-ending first | FR-LIST-05, FR-LIST-06 |
| Auction detail, by direct link | **Any auction**, Active or Ended, with full history and outcome | FR-DETAIL-01, FR-END-12 |
| My Auctions / My Bids *(Should Have)* | The user's own auctions and bids, whatever their status | S1, S2 |

**Architectural consequence: none on the data model.** Ended auctions are not archived, moved, hidden, or deleted — they remain ordinary rows, readable by anyone (§11.2). Only the listing's read filters by status. **Nothing in the authorization model changes**, which matters: an ended auction must stay publicly readable, so a policy that restricted reads by status would break FR-END-12.

---

## 10. Authentication architecture

**Steward: Abdulrahman** (review, not permission — `CLAUDE.md` §1). Satisfies PRD §8.1, §8.2, M1–M4, M24.

### 10.1 Model

Supabase Auth is the sole identity authority. Vercel neither issues nor validates credentials; it reads the session Supabase issued and passes the caller's identity through to the database, where authorization is enforced.

```text
Browser ──credentials──► Supabase Auth ──session──► Browser
                                                       │
                                    session travels with every request
                                                       │
   Vercel (reads session, renders) ────────────────────┼──► PostgreSQL
                                                       │    (RLS evaluates
   Browser ───────────────────────────────────────────►┘     the identity)
```

**The identity travels to the database.** Authorization is not decided in the application layer — the database sees who is asking and applies policy (§11). This is what makes bypassing the UI useless (SC-43).

### 10.2 Capabilities and their requirements

| Capability | Requirement | Architectural note |
|---|---|---|
| Registration | FR-AUTH-01 → 06 | Email + password. Server-side validated. Auto sign-in on success |
| Login | FR-AUTH-08 → 10 | Generic failure message — must not disclose account existence (SEC-A5) |
| Logout | FR-AUTH-12 → 14 | Session terminated; subsequent requests are anonymous |
| Session persistence | FR-AUTH-16 | Survives reload, navigation, browser restart |
| Session expiry | FR-AUTH-17, FR-AUTH-18, EC-12 | **Public viewing must keep working** when a session expires — only bidding requires re-authentication. Architecturally: expiry degrades the caller to anonymous, and anonymous already has full read access (§11) |
| Identity | FR-AUTH-19 → 21 | Stable internal identifier; public display name that is never the email |
| **Unique display names** | BR-39, FR-PROF-03, SC-69 | A uniqueness constraint enforced at the data, plus a clear "name taken" failure path at registration. Enforced structurally so a race between two simultaneous registrations cannot produce a duplicate |
| **No email verification** | BR-37, FR-AUTH-07 → 07b, SC-70 | **No verification step, no verification email, no unverified account state.** A user registers and can immediately create and bid. A valid, unique email is still required — it is the login identifier and the sole reset channel |
| **Password reset** | FR-AUTH-25 → 31, M24 | §10.3 |

### 10.3 Password reset

The MVP's only outbound email (PRD §16.5). Architecturally significant because it introduces the system's one external delivery dependency.

| Requirement | Architectural consequence |
|---|---|
| Startable without being authenticated (FR-AUTH-25) | An anonymous-accessible entry point |
| Same response for registered and unregistered addresses (FR-AUTH-27) | The response must not branch on existence — no timing or content difference. This is an enumeration defence, and it is easy to break accidentally |
| Requires mailbox possession (FR-AUTH-28) | Knowing the address must be insufficient. Delivery to the registered address is the second factor |
| Single-use and time-limited (FR-AUTH-29) | Reset tokens are consumed on use and expire |
| New password meets registration strength rule (FR-AUTH-30) | Same validation path as registration |
| Old password stops working (FR-AUTH-30, SC-64) | Credential replacement, not addition |
| Does not create or modify any other account (FR-AUTH-31) | Access recovery only — not an account-management surface |

**Dependency introduced:** email delivery must work in every environment where reset is exercised, including preview deployments (§18.4). Supabase Auth provides reset natively; the architecture uses it rather than building a parallel flow.

**Interaction with the no-verification decision (BR-37).** These two decisions pull in opposite directions and the team should understand the combination:

- Registration does **not** confirm the email address is reachable.
- Password reset is the **only** account-recovery path, and it delivers to that unconfirmed address.
- There is **no Admin role** (PRD §4.3), so nobody can recover an account manually.

A user who mistypes their address at registration is therefore permanently locked out if they later forget their password. **The PRD records this as an accepted consequence** (§21.2, A-T2) and requires the registration form to make the recovery role of the email clear (FR-AUTH-07b). **This is a settled product decision, not an architectural gap** — the architecture implements it as specified and does not add verification.

**Ownership:** password reset is owned by **Abdulrahman**, recorded in TEAM.md v2.0 §3, §6 (ownership matrix), and §13.1 (tasks A-20 → A-25). Conflict C-2 is resolved.

### 10.4 The identity contract — the team's first dependency

TEAM.md §10.1, §10.2 and §14 identify this as the single highest-priority unblocking item: both Mohammed and Rayan are blocked without it. Architecturally it must define **two distinct things**, and conflating them is the most likely early mistake:

| # | What | Used for | Trust |
|---|---|---|---|
| **1** | **Client-side session state** — is someone signed in, and what is their display name? | Rendering: show the bid control or a sign-in prompt; show the signed-in indicator | **UX only.** Never an authorization decision |
| **2** | **Server-side verified identity** — the authenticated user identifier, as the database sees it | Auction ownership assignment; bid attribution; every RLS policy | **Authoritative** |

**Abdulrahman must publish both and mark clearly which is which.** Rayan's bid validation must use (2) — PRD FR-BID-01 requires server-side verification on every bid. If (1) is used anywhere in an enforcement path, the trust boundary is broken.

---

## 11. Authorization architecture

**Enforced in PostgreSQL via Row Level Security.** Satisfies PRD §14.2, M21, SC-38 → SC-43.

### 11.1 Principle

> **Every table denies everything by default. Access is granted only by explicit policy. The application layer is never an authorization decision point.**

This is what makes PRD SEC-Z9 — "authorization must be enforced for every access route to a resource, including realtime channels" — true structurally rather than by review. Supabase Realtime respects RLS, so a client cannot subscribe its way to data it could not read directly.

### 11.2 Access model by entity

Expressed as intent, not policy code.

**Profiles**

| Actor | Read | Write |
|---|---|---|
| Anonymous | Public fields only (display name) | ✗ |
| Any signed-in user | Public fields only | ✗ (others') |
| The user themselves | Own record | Own display name only (Should Have, FR-PROF-05) — **must preserve uniqueness (BR-39)** |
| Anyone | **Email: never readable by anyone but its owner** (SEC-P1) | — |

**Auctions**

| Actor | Read | Create | Update | Delete |
|---|---|---|---|---|
| Anonymous | ✅ all (FR-LIST-01, FR-DETAIL-01) | ✗ | ✗ | ✗ |
| Signed-in user | ✅ all | ✅ owned by themselves, from the session (FR-CREATE-02) | ✗ | ✗ |
| **The owner** | ✅ | — | **✗ — immutable (BR-31)** | **✗ — no cancellation (BR-30)** |
| Bid operation | — | — | ✅ current price **only** | — |
| Finalization | — | — | ✅ outcome fields **only** | — |

The owner having **no** update rights is the structural expression of Q1 and Q3's resolution. There is no edit path to secure because there is no edit path.

**Bids**

| Actor | Read | Insert | Update | Delete |
|---|---|---|---|---|
| Anonymous | ✅ all (FR-BID-22) | ✗ | ✗ | ✗ |
| Signed-in user | ✅ all | **✗ — direct insert denied** | ✗ | ✗ |
| The bidder | ✅ | ✗ | **✗ (BR-05)** | **✗ (BR-05)** |
| **The bid operation** | — | ✅ **the only insert path** | ✗ | ✗ |

**Denying direct insert on bids to every user role is the load-bearing decision of this architecture.** It is what forces every bid through the single validated operation in §13. Without it, a client could insert a bid row that skipped every rule.

**Storage — product images**

| Actor | Read | Write |
|---|---|---|
| Anyone, including anonymous | ✅ (FR-CREATE-20) | ✗ |
| Signed-in user | ✅ | ✅ **only within their own scope** (FR-CREATE-21, SEC-Z8) |

### 11.3 Mapping to PRD security requirements

| Requirement | How this model satisfies it |
|---|---|
| SEC-Z1 — authorization from server-held state, never client input | RLS evaluates the verified session identity; request payloads carry no authority |
| SEC-Z2 — cannot create an auction attributed to another user | Owner is taken from the session, not the payload |
| SEC-Z3 — cannot modify or delete any auction | No update or delete policy exists for users |
| SEC-Z4 — cannot create/modify/delete a bid outside the normal path | No insert, update, or delete policy for users; one operation holds the only path |
| SEC-Z5 — cannot set the current price | Not user-writable |
| SEC-Z6 — cannot set or claim a winner | Not user-writable |
| SEC-Z7 — cannot change status or end time | Not user-writable |
| SEC-Z8 — cannot attach an image to another's auction | Owner-scoped storage write policy |
| SEC-Z9 — enforced on every route including realtime | RLS applies to realtime subscriptions identically |

### 11.4 The elevated-privilege path — and its containment

The bid operation and finalization must write fields that no user may write. They therefore run with elevated privilege inside the database.

**This is the only elevated-privilege surface in the system, and it must be treated as such:**

| Containment rule | Why |
|---|---|
| Exactly two elevated operations exist: bid acceptance and finalization | Anything more is a new trust boundary to audit |
| Each performs its own complete authorization check internally | Elevated privilege bypasses RLS, so the operation must re-verify identity and ownership itself |
| Neither accepts a caller-supplied user identifier | Identity comes from the verified session, always (SEC-Z1) |
| Neither exposes a general-purpose write capability | They do one thing each |
| Any addition to this list is an architectural change | Requires a decision recorded here, not a pull request |

**This is where a security review should spend its time.** Everything else is denied by default.

---

## 12. Auction creation and immutability

**Steward: Mohammed** (review, not permission — `CLAUDE.md` §1). Satisfies PRD §8.3, M5, M6.

### 12.1 Flow

```text
1. Client-side validation          Tier 1 — fast feedback only
        ↓
2. Image uploaded to Storage       owner-scoped; type and size verified server-side
        ↓
3. Auction record created          owner from session; validated by DB constraints;
                                   status Active; current price = starting price
        ↓
4. Auction is immutable            no update path exists from here (BR-31)
```

### 12.2 Ordering, and the no-partial-state requirement

FR-CREATE-19 and SEC-I6 require that a failed creation leaves **no partial auction and no orphaned image**. Two orderings are possible and they fail differently:

| Ordering | If it fails midway | Verdict |
|---|---|---|
| **Image first, then record** | An orphaned image with no auction. The user sees a clean failure and can retry (FR-CREATE-19 satisfied for the user) | ✅ **Chosen.** The residue is invisible to users and cheap |
| Record first, then image | An auction visible in the listing with no image — a broken listing anyone can see and bid on | ❌ Rejected. Violates FR-CREATE-01 |

**Decision: image first.** Orphaned objects are an internal housekeeping concern, not a user-visible defect. Recorded as ADR-6 (§20). A cleanup mechanism is **not** MVP — at demonstration scale the residue is negligible, and this is noted as accepted debt (§23).

### 12.3 Immutability

There is no update path on auction fields for any user (§11.2). This is not a UI decision that could be circumvented; the permission does not exist. Consequences the architecture must handle:

| Consequence | Requirement | Handling |
|---|---|---|
| A mistake cannot be corrected | EC-26 | Accepted product outcome. Nothing to build |
| Double submission creates a permanent duplicate | EC-21 | **Duplicate prevention becomes a correctness requirement.** Must be prevented at submission, since nothing can remove the duplicate afterwards |
| The creation form is the only chance to get it right | FR-CREATE-26a | Validation feedback quality matters more than in a product with editing |

### 12.4 Validation placement

| Rule | Enforced where |
|---|---|
| Field lengths, price > 0, two decimals | Database constraints (authoritative) + form (mirror) |
| **Duration: end time between 5 minutes and 7 days ahead, inclusive** | Database constraint, using **server** time (BR-38, FR-CREATE-09/10/10a, SC-68) |
| End time compared against **server** time | Database (FR-CREATE-11, BR-19) |
| Owner identity | From the session at insert time (FR-CREATE-02) |
| Image type and size | Storage policy + server-side type check, not the file extension (FR-CREATE-18) |
| **No maximum starting price** | **Nothing to enforce.** No ceiling exists (FR-CREATE-07). Implementers must not add one (PRD SD-05) |
| **No reserve price** | **Nothing to enforce.** The field does not exist (BR-35, FR-CREATE-03) |

---

## 13. Bidding architecture and concurrency

**Steward: Rayan** (review, not permission — `CLAUDE.md` §1). The hardest and most important part of the system. Satisfies PRD §8.6, BR-01 → BR-04, BR-11, BR-12, BR-28 → BR-32, M9, M10, M11, M12, SC-08 → SC-19.

### 13.1 The problem

A naive implementation reads the current price, compares it to the incoming bid, and writes if higher. Under concurrency this loses bids:

```text
Time    Bidder B                     Bidder C
  1     read price = 100
  2                                  read price = 100
  3     101 > 100 → accept, write
  4                                  101 > 100 → accept, write   ← WRONG
        Result: two accepted bids at 101. BR-12 violated.
```

PRD BR-12 requires **at most one** accepted bid per price level, and NFR-DAT-03 requires strictly increasing amounts. Any read-then-write design fails this.

### 13.2 The design — one serialized atomic operation

**Every bid passes through a single database operation that is the only path capable of inserting a bid.** Within one transaction, it:

```text
┌────────────────────────────────────────────────────────────┐
│  BID ACCEPTANCE — one transaction, serialized per auction   │
├────────────────────────────────────────────────────────────┤
│  1. Verify the caller is authenticated        BR-01         │
│     — identity from the session, never the payload          │
│                                                             │
│  2. Acquire an exclusive lock on THIS auction row           │
│     — concurrent bids on the same auction queue here.       │
│       This is what creates the one definitive ordering.     │
│       Bids on DIFFERENT auctions never block each other.    │
│                                                             │
│  3. Re-read auction state INSIDE the lock                   │
│     — owner, status, end time, current price, bid count.    │
│       Anything read before the lock is already stale.       │
│                                                             │
│  4. Auction exists and end time has not passed  BR-04       │
│     — compared against the DATABASE clock       BR-19       │
│                                                             │
│  5. Caller is not the auction owner             BR-02       │
│                                                             │
│  6. Amount is well-formed: numeric, > 0,        BR-21       │
│     at most two decimals. No maximum check —                │
│     no ceiling exists.                                      │
│                                                             │
│  7. Amount meets the MINIMUM ACCEPTABLE BID     BR-28       │
│     — no bids yet    → amount >= starting price   BR-29     │
│     — has bids       → amount >  current price    BR-03     │
│     — no increment check: none exists             BR-32     │
│     — no leading-bidder check: leading is never   BR-24     │
│       grounds for rejection. Only the amount              │
│       matters, so this step needs NO extra logic.          │
│     — no reserve check: no reserve exists         BR-35     │
│                                                             │
│  8. Append the bid to history                   BR-18       │
│  9. Update the auction's current price          BR-13       │
│     — steps 8 and 9 are inseparable                         │
│                                                             │
│ 10. Commit → lock releases → next bid proceeds              │
│     against the state this one produced         BR-11       │
└────────────────────────────────────────────────────────────┘
```

**Why this satisfies the concurrency requirements:**

| Requirement | Satisfied because |
|---|---|
| BR-11 — one definitive ordering | The row lock serializes bids on the same auction; the order in which they acquire it *is* the order |
| BR-12 — at most one bid per price level | The second bidder re-reads the price *after* the first committed, so their amount no longer qualifies |
| FR-BID-14 — none lost or duplicated | Every bid gets exactly one accept-or-reject decision from one atomic evaluation |
| FR-BID-15 — strictly increasing history | The threshold only ever moves up, inside the lock |
| NFR-DAT-01 — price never diverges from history | Both writes are in the same transaction; they cannot partially apply |
| BR-23 — a rejection changes nothing | Rejection aborts before any write |

The earlier failure scenario now resolves correctly: C acquires the lock after B commits, re-reads price = 101, finds 101 is not > 101, and is rejected with "someone bid before you — the current price is now 101 SAR" (FR-BID-13, EC-01).

### 13.2a What the operation deliberately does *not* check

Four finalized product decisions each **remove** a check that a conventional auction system would have. Recording them here prevents an implementer from adding one back as an apparent improvement (PRD SD-05):

| Not checked | Why | Rule |
|---|---|---|
| **Bid increment** | No increment exists. A 0.01 SAR raise is exactly as valid as a 1,000 SAR raise | BR-32 |
| **Maximum amount** | No ceiling exists. Large values are handled correctly, never rejected for size | BR-21, SEC-R3 |
| **Whether the bidder is already leading** | Leading is never grounds for rejection — only the amount matters. A leading bidder raising their own bid is a valid bid | BR-24, FR-BID-04 |
| **Reserve price** | No reserve exists. The highest valid bid wins whatever its amount | BR-35 |

**The whole amount rule is BR-28**, and it has exactly two branches: `>= starting price` when there are no bids, `> current price` when there are. Anything else is not a rule of this product.

### 13.3 Why the lock is per-auction

Locking the auction row — not a table, not a global lock — means **contention is scoped to the auction being contested**. Twenty auctions receiving bids simultaneously do not queue behind one another. This is what lets the design meet NFR-SCA-01 (100 concurrent auctions) and NFR-SCA-04 (10 bids/minute on one contested auction) while still serializing where serialization is actually required.

### 13.4 Why this operation lives in the database

Considered and rejected: an Edge Function or a Vercel function performing validation then writing.

| Concern | Database operation | Application-layer operation |
|---|---|---|
| Atomicity of validate → append → update price | Native — one transaction | Needs a database transaction anyway; the app is a wrapper around it |
| Serialization under concurrency | Native row locking | Requires either database locking (same thing) or an external lock (a new failure mode) |
| Number of paths into bidding | **One** | Two, unless the direct path is also denied — and if it is denied, the app path must call the database operation regardless |
| Vercel execution model | Unaffected | Cold starts add latency to the most latency-sensitive operation (NFR-PERF-03: 1 s at p95) |
| Bypassability | Impossible — no other insert path exists | Depends on also locking the direct path |

**The database operation is not merely equivalent; it is strictly fewer moving parts for the same guarantee.** Recorded as ADR-2 (§20).

### 13.5 Rejection reasons

BR-27 requires every rejection to carry a specific, actionable reason. The operation must distinguish these, because the UI messages differ materially (FR-BID-13, EC-01, EC-06):

| Reason | User-facing meaning |
|---|---|
| Not authenticated | Prompt to sign in |
| Auction not found | Not-found message |
| Auction has ended | "This auction has ended" + page moves to ended presentation |
| Caller is the owner | "You cannot bid on your own auction" |
| Malformed amount | Specific format message |
| Below starting price (no bids yet) | "Bidding starts at *X* SAR" |
| Not above current price (has bids) | "Your bid must be higher than *X* SAR" |
| **Lost a concurrent race** | **"Someone bid before you — the current price is now *X* SAR"** — must be distinguishable from a plain too-low bid, because the user did nothing wrong |

The last row matters: EC-01 requires a non-alarming, explanatory message. The operation must return enough information for the UI to say it.

### 13.6 What the client does

| Client responsibility | Tier |
|---|---|
| Show the current price and the minimum acceptable bid, with the inclusive/exclusive distinction (FR-BID-10, NFR-USA-11) | 1 |
| Pre-check the amount for fast feedback | 1 — **not a decision** |
| Submit the bid | crosses the boundary |
| Render accept or reject with the returned reason | 1 |
| Never adjust and resubmit automatically (FR-BID-17) | 1 |

---

## 14. Realtime architecture

**Steward: Rayan** (review, not permission — `CLAUDE.md` §1). Satisfies PRD §8.7, §13, M13, M14, M15, SC-20 → SC-24.

### 14.1 Model

Clients subscribe **directly to Supabase Realtime**, per auction. Vercel is not in this path — it cannot be, given its execution model, and it does not need to be.

```text
Bid committed in PostgreSQL
        │
        ▼
AFTER UPDATE trigger on auctions calls realtime.send — one content-free event
        │
        ├──► Viewer A  ─┐
        ├──► Viewer B   ├─ all within 2 s (NFR-RT-01)
        └──► Viewer C  ─┘   RLS applied per subscriber, on realtime.messages
        │
        ▼
Each viewer RE-READS authoritative state (RT-R6) — the event is the signal, not the data
```

**Realtime carries only what was already committed.** It is a projection of database state (Tier 4, §7). It never carries a decision, and a bid the server accepted is valid whether or not its broadcast arrived (BR-22, RT-R1).

**The delivery mechanism is Broadcast from database, not `postgres_changes`** *(decided and implemented 2026-08-14, BID-08)*. The two were measured against each other before choosing; `docs/BID-08-realtime-verification.md` is the record. `postgres_changes` streams **whole rows** — it ignores a publication column list, and it serialises `numeric` through a float (issue #103). Both are structural problems for this product rather than avoidable ones, which is why §14.4 below reads the way it does. Nothing may add `public.auctions` or `public.bids` to the `supabase_realtime` publication.

### 14.2 Subscription scope

| Scope | Content | Requirement |
|---|---|---|
| **Per auction** | New bids on that auction; that auction's price and status changes | FR-RT-01, FR-RT-04, FR-RT-08 |
| Not global | A viewer receives only the auction they are watching | Avoids broadcasting all activity to all clients; keeps within NFR-SCA-03 |
| Listing page | **Not subscribed.** Countdowns tick client-side; prices are current as of load | FR-LIST-10 makes live listing prices Should Have, not Must Have |

Scoping per auction is what makes 20 concurrent viewers (NFR-RT-02) inexpensive: a bid fans out to the viewers of one auction, not to everyone on the platform.

### 14.3 What must be delivered

**Read the Source column as "what wakes the client up", not "what arrives".** Since BID-08 every row below is woken by the **same** event — one `auctions` UPDATE — and every value is then read from the database, never taken from the payload (RT-R6). The column names the change that fires the trigger.

| Element | Live? | What fires the event |
|---|---|---|
| Current price | **Must** | The auction UPDATE that STEP 9 makes in the same transaction as the bid insert |
| New bid in history | **Must** | The same auction UPDATE — **not** a separate subscription to `bids`. Every accepted bid writes `current_price` unconditionally (BID-05), so the auction row is a complete signal for a new bid |
| Status → Ended | **Must** | Auction record change at finalization — including the multi-row sweep, which fires once **per auction closed** |
| Outcome (winner, final price) | **Must** | Same change |
| End time moved (BR-36 extension) | **Must** | The extension's own UPDATE. A late bid therefore fires twice — extension, then price — and duplicates are required to be harmless anyway (FR-RT-09, RT-R5) |
| Minimum acceptable bid | **Must** | Recomputed client-side from the re-read price |
| Time remaining | **Must**, but client-driven | Ticks locally from the server-supplied end time — no push needed (FR-RT-02). The end time it ticks from is the **current** one, which the row above keeps fresh |

### 14.4 Privacy in payloads

RT-S1 and RT-S2 require that realtime payloads carry only data the recipient may already see, and **never** email addresses.

This is satisfied **structurally**, not by filtering — but *(amended 2026-08-14, BID-08)* **for a different reason than this section originally gave**. The payload is **authored by the trigger in `20260814140000`** and contains one auction id: an identifier the subscriber already had, because it is in the page URL and in the topic name. There is no money in it, no `bidder_id`, no `winner_id`, no display name. The guarantee is not *"RLS keeps the private column out of the stream"* — it is *"the private column is never in the stream"*. There is nothing to filter and nothing a later session can forget to filter.

Emails remain a **second, narrower** guarantee, and the original sentence still holds on its own terms: emails live in the auth record rather than in any publicly-readable table (§9.2), so no read path exposes one either.

> **What this section used to say, and why it was not enough.** It read: *"because RLS applies to realtime subscriptions, and because emails live in the auth record …, there is no path by which an email can reach a subscriber. A policy mistake would have to grant read access to a table that does not contain the data."* The conclusion was right; the reasoning covered only emails. `RT-S2` is wider — "internal account identifiers beyond what public display requires" — and `bidder_id` is exactly that, lives in `public.bids`, and `public.bids` **is** publicly readable by design (`bids_public_read`, `using (true)`). So under `postgres_changes` no policy mistake was needed: the correct, deliberately permissive policy was enough, and an unpublished column was measured arriving at an anonymous browser client. Raised in `docs/BID-08-realtime-verification.md` §6 and amended here with the project owner's approval.

**Two things follow that are not optional.** The event must never become a display source (RT-R6) — it carries nothing displayable, which is what makes the rule unforgettable rather than merely documented. And nothing may be added to the payload later: a price would have to travel as text to survive JSON (S0-12 §6), a bidder would breach RT-S2, and an end time would hand the client a second source of truth to disagree with the read.

### 14.5 Degradation

| Situation | Behavior | Requirement |
|---|---|---|
| Connection lost | UI states that live updating is unavailable; loaded data stays readable; bid control disabled or marked stale | FR-RT-11, FR-RT-13, RT-R2 |
| Reconnected | **Resynchronize to authoritative current state** — re-read price, history, status. Do not resume from the last-seen event | FR-RT-12, RT-R3 |
| Duplicate delivery | No visible effect — no duplicate history row, no wrong price | FR-RT-09, RT-R5 |
| Out-of-order delivery | The later, higher state wins. **Price must never appear to move down** | FR-RT-10, RT-X5 |
| Realtime entirely unavailable | **Bidding still works.** The bid path is independent of the broadcast path | RT-R7 |
| Page refresh | Always yields correct current state | RT-R6, EC-09 |

**The design property that makes all of this safe:** the page can always reconstruct correct state from a plain read. Realtime is an optimization over refreshing, never a substitute for the authoritative read.

### 14.6 The page split — by file, not by permission

TEAM.md §11 requires the auction detail page to be split into separate files. **The reason is
merge conflicts, not permission** — any contributor may work in any of these
(`CLAUDE.md` §1). Architecturally:

| Component | Realtime role | What it must not stop doing |
|---|---|---|
| Page shell, product content, image, seller name | None — static per page load | pass **only the auction id** downward; never expose an email |
| Status label and countdown | Countdown ticks locally; the status change arrives on the subscription | tick from the **server-supplied** end time, never the browser's clock |
| Current price display region | Subscribed | **read** the value as a string; never recompute or coerce it to a `Number` |
| Bid control, history, outcome banner | Subscribed | keep §13.2a's three absent checks absent; order history by `bids.id` |

The right-hand column is the boundary that matters. Restyling any row is free; changing what a
row *does* — validation, submission, recorded order, outcome semantics — needs a decision
behind it, not a permission.

The page tells the bidding components which auction is being viewed. **Do not add a competing
update mechanism**: one subscription per auction, established once (TEAM.md §10.4).

---

## 15. Auction closing and winner determination

**Steward: Rayan** (review, not permission — `CLAUDE.md` §1). Satisfies PRD §8.8, M17, M18, M19, SC-25 → SC-34. **This is where Vercel's execution model has real architectural consequences.**

### 15.1 The constraint

PRD FR-END-01 → 03 require that an auction is marked Ended **within 30 seconds** of its end time, **automatically**, **with no human action**, and **whether or not anyone is viewing it** (FR-END-02, SC-26).

**Vercel provides no permanently running process.** There is no daemon to hold a timer. Something outside the request/response cycle must trigger finalization.

### 15.2 What makes this tractable

The saving grace is PRD **LC-03**:

> Bidding eligibility is determined by server time against the end time, **not by the stored status flag**. From the end time onward, bids are rejected even if the record still says Active.

This is already how §13 step 4 works. **Therefore a delay in flipping the status flag cannot corrupt the outcome** — no bid can sneak in after the end time regardless of when finalization runs. The 30-second window governs only *how quickly the ended presentation appears*, not correctness.

That separation is what allows a scheduled sweep rather than a per-auction timer.

**One finalized decision makes this simpler than it could have been. The other was reversed:**

| Decision | Effect on closing |
|---|---|
| ~~**No anti-sniping — the end time is fixed** (BR-36)~~ **REVERSED 2026-08-13** | This paragraph used to read *"the sweep is never chasing a moving target."* It is now. The end time moves — 30 seconds per accepted bid inside the final 15, capped at 20 extensions (BR-36 as amended). What makes that survivable is that **no component ever caches a deadline**: the sweep re-reads `end_time` inside the row lock on every pass, and `place_bid` step 4 was already comparing `clock_timestamp()` against the freshly-locked row rather than anything remembered. The costs the original decision was avoiding are real and are now paid: the countdown moves, and realtime must carry `end_time` changes. The **20-extension cap** is what keeps the moving target bounded — the sweep is chasing something that provably stops |
| **No reserve price** (BR-35) | Winner determination has exactly two outcomes — a winner, or no bids — rather than three. There is no "ended, reserve not met, no winner despite bids" case to record, display, or explain to three different viewers |

### 15.3 Design — three triggers, one idempotent operation

```text
        ┌──────────────────────────────────────────────┐
        │   FINALIZATION — idempotent, transactional    │
        │   1. Lock the auction row                     │
        │   2. If already Ended → return unchanged      │  ← BR-17, SC-32
        │   3. If end time not yet passed → do nothing  │
        │   4. Determine highest valid bid   BR-06      │
        │   5. Record: status Ended, final price,       │
        │      winner (or explicitly none), close time  │  ← FR-END-08
        │   6. Commit → Realtime broadcasts the change  │
        └──────────────────────────────────────────────┘
                    ▲            ▲            ▲
                    │            │            │
         ┌──────────┘            │            └──────────┐
    T1: SCHEDULED SWEEP     T2: ON READ           T3: ON BID ATTEMPT
    Periodic job finds      A viewer opens an     A bid arrives after
    auctions past their     auction whose time    the end time; the bid
    end time and not yet    has passed → finalize is rejected and
    finalized → finalize    before rendering      finalization triggered
    Covers: nobody          Covers: the viewer    Covers: the racing
    watching (SC-26)        sees it immediately   bidder (EC-02)
```

**Because the operation is idempotent, all three triggers can fire for the same auction with no ill effect** — the second and third find it already Ended and return unchanged. This directly satisfies BR-17 and SC-32, and it is why three triggers are safe rather than reckless.

### 15.4 The triggers, and what each is for

| Trigger | Purpose | Without it |
|---|---|---|
| **T1 — scheduled sweep** | The only trigger that satisfies FR-END-02 / SC-26: auctions must close when nobody is watching | Auctions with no viewers would stay Active indefinitely |
| **T2 — on read** | Makes the ended state appear instantly to whoever opens an expired auction, regardless of sweep timing | EC-04 would show a stale Active auction until the next sweep |
| **T3 — on bid attempt** | Closes the auction the instant someone discovers it has expired | Correct anyway (the bid is rejected), but the auction would linger Active |

T2 and T3 are **latency optimizations**; T1 is the **correctness guarantee**. If T1 fails, auctions still close as soon as anyone interacts with them — but SC-26 would fail. T1 must be monitored.

### 15.5 Where the scheduler runs

| Option | Assessment |
|---|---|
| **Supabase scheduled job** (in-database) | **Recommended.** Runs where the data and the operation live. No network hop, no function invocation, no secret to manage, no Vercel dependency. Survives independently of the application deployment |
| Vercel Cron | Would require an authenticated endpoint reachable from the scheduler, elevated credentials held in the application, and would couple auction closing to application availability. Adds a second trust surface for no benefit |
| External scheduler | Adds a third-party dependency for a trivial need |

**Decision: schedule inside Supabase.** Recorded as ADR-4 (§20).

### 15.6 The 30-second requirement — a TECHNICAL verification item

> **FR-END-03 stands as written: auctions close within 30 seconds of their end time.** This section does not weaken, reinterpret, or negotiate that requirement. It records a **technical platform question** that must be answered, and states plainly what happens in each case.

**The question:** can the platform's scheduler be configured at sub-minute frequency? Many cron implementations have a one-minute floor. This is a fact about infrastructure, not a question about what Dalal should do.

**Correctness is not at stake, and this must not be misread as a correctness risk.** Per PRD LC-03 and §13 step 4, **bid rejection is driven by the auction's actual end timestamp compared against the database clock — never by the stored status flag.** No bid can be accepted after the end time regardless of when the sweep runs. Sweep latency affects only how quickly the *ended presentation* appears to a viewer who is not otherwise interacting with the auction — and triggers T2 and T3 close that gap the instant anyone does.

Three outcomes, defined in advance so nobody improvises:

| If sub-minute scheduling... | Then | Who decides |
|---|---|---|
| **is available** | Configure a ~30-second sweep. **FR-END-03 met exactly as written.** No further discussion | Nobody — it just works |
| **has a one-minute floor** | Two mitigations remain technical: **(a)** run two sweeps offset by 30 seconds, achieving 30-second effective granularity within a one-minute scheduler; or **(b)** reduce reliance on the sweep by strengthening T2/T3 coverage. **Only if neither is workable** does a product conversation arise, and it is the product owner's call — never a developer's | Team, then product owner **only if (a) and (b) both fail** |
| **is unreliable or unavailable** | **Escalate immediately.** T1 is the SC-26 guarantee — auctions must close with nobody watching — and cannot be dropped | Architecture + team |

**Note that option (a) most likely satisfies FR-END-03 as written even against a one-minute floor**, which is why this is recorded as a technical item to resolve rather than a requirement in jeopardy.

**This is technical verification spike V-2 (§22).** It must be resolved before Rayan builds R-17. It is recorded here rather than assumed away because FR-END-03 is a stated numeric requirement, and **this document must not silently weaken a product requirement to fit a platform limitation** (PRD §21.3).

> **V-2 is resolved. The answer is the first row: sub-minute scheduling is available.**
> Measured 2026-08-13 on `dallal-dev` — `pg_cron` 1.6.4 accepts a schedule written in
> seconds, and a `'30 seconds'` job fired 16 times with a mean interval of 30.034 s
> (min 30.010, max 30.276, σ 0.067) and no failures. A `'10 seconds'` job held
> 10.014 s. **FR-END-03 is met as written, with no offset sweeps** — mitigation (a)
> is not needed and should not be built. Full record and method:
> `docs/V-2-scheduling-verification.md`.
>
> **The sweep period is 15 s, not 30 s.** An auction's end time falls at an arbitrary
> point between two fires, so the period *is* the worst-case latency: a 30 s sweep
> spends the whole FR-END-03 budget on scheduling and overruns it on jitter alone
> (~30.3 s measured). 15 s costs nothing at this granularity and leaves headroom for
> the sweep's own runtime. That is a technical choice made **inside** the 30 s
> requirement, not a change to it.

### 15.7 Winner determination

| Requirement | Design |
|---|---|
| Highest valid bid wins (BR-06) | Read from the recorded bid history inside the finalization transaction |
| **No reserve price** (BR-35) | **No threshold check.** The highest bid wins whatever its amount. There are exactly two outcomes — a winner, or no bids — never a third |
| **End time may have been extended** (BR-36 as amended 2026-08-13) | The deadline evaluated at close is the **current** `end_time`, read inside the finalization lock — not the one written at creation. Extension logic exists: an accepted bid in the final 15 s adds 30 s, capped at 20 (SC-74/74a/74b/74c). Finalization does not implement it; it only must never assume the value is the original |
| Ties (FR-END-06) | Earlier-ordered bid wins. In practice unreachable — §13 prevents equal accepted bids — but defined so the outcome is total |
| Zero bids (BR-09, EC-05) | Ends with **no winner and no final price**. A normal path, not an error. Must not block or delay finalization |
| Exactly once, idempotent (BR-17) | The already-Ended check in step 2 |
| Independently verifiable (NFR-DAT-04, SC-29) | The recorded winner must always equal the highest bid in history — recomputable at any time. This is the strongest available check that the whole bidding pipeline is correct, and it should be exercised in testing |
| Terminal (BR-15, FR-END-18) | No transition out of Ended exists; outcome fields are not user-writable |

---

## 16. Storage architecture

**Steward: Mohammed** (review, not permission — `CLAUDE.md` §1). Satisfies PRD FR-CREATE-15 → 21, M6, SC-04.

### 16.1 Design

| Aspect | Decision | Requirement |
|---|---|---|
| What is stored | Exactly one product image per auction | FR-CREATE-15 |
| Read access | **Public**, including unauthenticated visitors | FR-CREATE-20 |
| Write access | Authenticated users, **scoped to their own path only** | FR-CREATE-21, SEC-Z8 |
| Accepted types | JPEG, PNG, WebP | FR-CREATE-16 |
| Size limit | 5 MB | FR-CREATE-17 |
| Type validation | **Server-side, by content — not by file extension** | FR-CREATE-18 |
| Modify / delete | Not offered to users; auctions are immutable | BR-31 |

### 16.2 Path scoping

Objects are organized so that a user's write permission can be expressed as "within your own scope". This makes SEC-Z8 a policy rule rather than an application check, so a crafted request cannot attach an image to another user's auction.

### 16.3 Delivery and performance

NFR-PERF-05 requires that a listing thumbnail not download the full-resolution original. The listing shows up to 100 auctions (FR-LIST-09); serving 100 full-size images would breach NFR-PERF-01's 3-second target.

**Options, to be decided in implementation:** platform-side image transformation if available, or generating a smaller derivative at upload. **Not decided here** — it is an implementation choice within Mohammed's ownership, constrained by NFR-PERF-05. Flagged as verification spike V-4 (§22).

### 16.4 Failure handling

| Failure | Behavior | Requirement |
|---|---|---|
| Upload fails | **No auction is created.** Clear message; retry without re-entering other fields | FR-CREATE-19, EC-08 |
| Rejected type or oversize | Named specifically, with accepted formats and the limit | EC-08 |
| Image fails to load for a viewer later | Placeholder; the auction stays fully functional and biddable | FR-DETAIL-04, EC-18 |
| Orphaned object after a failed creation | Accepted residue (§12.2). No cleanup mechanism in MVP | Accepted debt, §23 |

---

## 17. Environment variables and secrets

### 17.1 Classification

Two categories, and confusing them is the most common way a project of this shape leaks credentials.

| Class | Reaches the browser? | Contains | Governing rule |
|---|---|---|---|
| **Public configuration** | **Yes** | The Supabase project URL and the public client key | Safe to expose **only because RLS is the actual protection** (§11). If RLS were incomplete, this key would be an open door |
| **Server-only secrets** | **Never** | Any elevated-privilege credential | Must never be referenced in client-reachable code. Exposure would bypass every policy in §11 |

**The dependency worth stating plainly:** the public key is safe *because* the authorization model is complete. This is why §11's default-deny posture is not optional hygiene — it is the thing that makes the deployment model safe.

### 17.2 Management

| Concern | Approach |
|---|---|
| Where values live | Vercel's environment configuration, per environment. Never in the repository |
| Repository contents | An example file listing **variable names only**, never values (TEAM.md §11) |
| Committing secrets | Prohibited (TEAM.md Rules 9, 10). A leaked key requires rotation, not deletion of the commit |
| Adding a variable | Announce to the team, add the name to the example file, set it in every environment (TEAM.md Rule 14) |
| Local development | Each developer holds their own untracked local file |
| Naming | Public and server-only variables must be **visibly distinguishable by name**, so a mistake is obvious in review |

### 17.3 Does the MVP need a server-only secret?

**Ideally not.** Under this architecture:

- Reads and the bid operation run with the **user's** identity — the public key suffices.
- Elevated writes happen **inside the database**, invoked by the user's own call — no elevated credential travels to the application.
- The scheduler runs **inside Supabase** (§15.5) — no external caller, no credential.

**If the design holds, the application never holds an elevated credential.** That is a meaningful security property and the team should protect it: **the appearance of a service-level key in application configuration is a signal that something has drifted from this architecture** and should trigger a review, not a shrug.

---

## 18. Deployment architecture

### 18.1 Model

```text
GitHub (one shared repository — TEAM.md §8)
    │
    ├── main ─────────────────────► Vercel PRODUCTION
    │                               points at the production Supabase project
    │
    ├── feature/abdulrahman-auth ──┐
    ├── feature/mohammed-auctions ─┼─► Vercel PREVIEW (one per branch/PR)
    └── feature/rayan-bidding ─────┘   points at a non-production Supabase project
```

This maps directly onto TEAM.md §8 and §15: no direct pushes to `main`, everything arrives by reviewed Pull Request, `main` stays usable at all times.

### 18.2 Branch-to-deployment mapping

| Git ref | Deployment | Supabase target | Purpose |
|---|---|---|---|
| `main` | **Production** | Production project | The live application. Only reviewed, approved, merged work |
| Any feature branch with an open PR | **Preview**, unique URL | **Non-production** project | Reviewers exercise the change in a running app before approving |
| Feature branch, no PR | Preview (if enabled) | Non-production | Developer's own checking |
| Local | None | Local or shared non-production | Day-to-day development |

**Why preview deployments matter to this team specifically:** TEAM.md §20 asks reviewers to verify behavior, and §14's checkpoint CP-2 requires a **two-browser realtime test**. That test is impossible to perform on a diff. A running preview URL is what makes it reviewable.

### 18.3 Production deployment flow

```text
PR approved (TEAM.md §15)
    ↓
Merge to main
    ↓
Vercel builds from main
    ↓
Build succeeds → promoted to the production URL
Build fails    → previous deployment stays live; main is broken and
                 fixing it is the team's top priority (TEAM.md Rule 17)
```

A failed build does not take production down — the previous deployment remains. This is worth the team knowing, because it changes the urgency calculus of a broken `main`: it is a *blocked pipeline*, not an *outage*.

### 18.4 The preview-environment question — needs a decision

Previews are straightforward for the application. **Which Supabase project a preview points at is a real decision with no free option**, and it must be made before Sprint 0 ends.

| Option | Pros | Cons |
|---|---|---|
| **A. One shared non-production project for all previews** | Simple. One place to seed test data. Everyone tests against the same shape | Three developers share mutable state — Rayan's concurrency tests and Mohammed's listing tests interfere. Schema changes from one branch break the other two's previews |
| **B. Per-branch isolated database** (if platform branching is available) | True isolation. A schema change in one branch cannot break another's preview | More moving parts; needs verification that the platform supports it and how it handles seeding, storage, and auth state |
| **C. Previews point at production** | Zero setup | **Rejected.** Preview code could write to production data. Not acceptable |

**Recommendation: start with A, evaluate B.** For a three-person team with a short MVP, one shared non-production project is proportionate, and the interference risk is manageable if the team coordinates schema changes (which TEAM.md §11 already requires). Option B is better if the platform makes it cheap.

**Do not choose C.** This is verification spike **V-3** (§22).

**Note on password reset in previews:** reset delivers email (§10.3). Whether it functions in preview environments must be confirmed, or Abdulrahman cannot exercise US-23 before merging.

### 18.5 What Vercel does not do

Stated explicitly because the execution model constrains the design:

| Vercel does **not** | Consequence |
|---|---|
| Run a permanently running backend process | Auction closing is scheduled in Supabase (§15.5) |
| Hold long-lived connections | Realtime goes browser → Supabase directly (§14) |
| Hold in-memory state between requests | No caches, queues, locks, or timers in the application layer |
| Enforce auction rules | Every rule is in Tier 2 or Tier 3 (§7) |
| Store data | PostgreSQL and Storage are the only persistence |

**A useful test of any future design change:** if it requires Vercel to remember something between two requests, or to stay running, it does not fit this architecture.

---

## 19. Architectural stewardship and the invariants

> **Amended 2026-08-15 — this section used to be titled "Architectural ownership".** Under
> the current governance model (`CLAUDE.md` §1) **no developer, account, or Claude session
> permanently owns a component.** Any available contributor may claim any ready ticket, and a
> steward's absence must not block one. What follows is therefore two things: **who to tag for
> review**, and — the part that is actually binding — **what each component must not stop
> doing.**

### 19.1 Components, their stewards, and their invariants

| Component | Tag for review | The invariant a change must keep |
|---|---|---|
| Supabase Auth integration, session handling | Abdulrahman | Identity is server-verified; never taken from client input |
| Identity contract (client state + server-verified identity) | Abdulrahman | The server-side path is the authoritative one; the client copy is a convenience |
| Profile record and its access policy | Abdulrahman | Email is readable only by its owner; display name is the only public identity |
| **Password reset** | Abdulrahman | The MVP's only outbound email (PRD M24) |
| Auction record definition and its access policy | Mohammed (shape), Rayan (bidding fields) | Money columns are the `sar_amount` domain — never bare `numeric`, never a typmod |
| Auction creation validation | Mohammed | Amounts are strings; >2 decimals is **rejected, never rounded**; no ceiling |
| Supabase Storage integration | Mohammed | — |
| Listing page, detail page shell, page-level data loading | Mohammed | Every `sar_amount` read carries `::text`, per column, every time |
| Bid record definition and its access policy | Rayan | Insert is possible **only** through the acceptance operation (ADR-2) |
| **The bid acceptance operation** (the trust boundary) | Rayan | Serialized and atomic; eligibility from `clock_timestamp()` vs `end_time`, never `status` |
| Current price value and its derivation | Rayan | Derived from bid history, server-side. Never set directly, never recomputed in a client |
| Supabase Realtime integration | Rayan | **One** subscription per auction; **no email in any payload** |
| Finalization operation and its scheduling | Rayan | `end_time` forward-only; the extension cap is a `CHECK`, not an `if` (`CLAUDE.md` §5) |
| Bidding components inside the detail page | Rayan (behaviour), Mohammed (presentation) | The three checks that must not exist; history ordered by `bids.id` |

**The right-hand column is the boundary.** A steward can be away; an invariant cannot. If your
change would break one, you need a **decision** — not a permission.

### 19.2 Shared architectural surfaces

These belong to no one in particular, which is now the normal case rather than the exception.
What makes them *shared* is that two tickets will collide in them — so **the foundation
ticket merges first** (`CLAUDE.md` §1, step 5).

| Surface | Rule | Why it is shared |
|---|---|---|
| **Money representation in SAR** | **One representation and one formatter** — `lib/money.ts`, Sprint 0 item **S0-12**, `docs/contracts/S0-12-money.md`. `tests/guards/run.sh` fails the build on a second formatter or a float | Exact decimal, two places, never floating point, **no ceiling**, one display format (BR-21, BR-33, NFR-DAT-05, NFR-DAT-08). **Gap G-1 resolved** |
| **Time handling** | One canonical zone stored; **server clock authoritative**; local display only (BR-19, FR-CREATE-14) | Every timestamp in the product |
| Authorization posture (default deny) | Every entity carries its own complete policies — and a `GRANT`, which RLS does not imply | A gap in one entity weakens the whole model |
| Environment variable naming and the example file | Announce before adding. **Never `NEXT_PUBLIC_*SERVICE_ROLE*`** — a guard asserts this | Config drift and secret exposure |
| Project scaffold, entry point, routing, shared UI | Sprint 0. `dir="rtl"` is declared here **exactly once** | Unchanged by this architecture |

### 19.3 Architectural dependencies — between *work*, not between people

| Dependency | Nature under this architecture |
|---|---|
| **Identity → auction creation** | The seller is the verified session user. The create path must not read session state ad hoc; it calls the identity contract |
| **Identity → bidding** | Bid attribution uses the **server-side** verified path, not the client convenience |
| **Auction record → bidding** | The bid operation reads: seller, status, end time, starting price, current price. **This is the classic step-5 case** — the schema ticket merges before the tickets that read it |
| **Bidding → the pages** | The price value and the outcome are **read** by the pages and written only by the server. Neither side recomputes (§9.4) |

Direction of flow is unchanged: **Auth → Auctions → Bidding**, with price and outcome flowing
back for display. No cycles. Note that this is a dependency graph over **tickets**, and it is
exactly what workflow step 1 tells you to check before claiming one.

---

## 20. Architecture Decision Records

Each records the decision, the alternatives, and — importantly — what would reverse it.

### ADR-1 — Vercel hosts the application; Supabase holds all state and all rules

**Status:** Accepted (given by the brief) · **Consequence:** Vercel is stateless and rule-free; every guarantee lives in Supabase.
**Reversal condition:** a requirement appears that needs a long-running process or in-memory state.

### ADR-2 — Bid acceptance is a single serialized atomic database operation, and the only path that can insert a bid

**Status:** Accepted · **Drivers:** BR-11, BR-12, NFR-DAT-01, NFR-DAT-03.
**Alternatives rejected:** application-layer read-then-write (loses bids under concurrency); Edge Function wrapper (needs the database transaction anyway, adds a second path and a cold start on the most latency-sensitive operation, NFR-PERF-03); optimistic retry loops (livelock risk under contention, no ordering guarantee).
**Consequences:** direct insert on bids is denied to every user role; the operation is elevated-privilege and must self-authorize (§11.4); it becomes the single most important thing to test (SC-16 → SC-19).
**Reversal condition:** none foreseen. Any alternative must still provide atomic serialized ordering, which reduces to this.

### ADR-3 — Supabase Edge Functions are not used in the MVP

**Status:** Accepted · **Rationale:** §8.5. Every candidate use is better served in the database, and adding one would create a second trust path.
**Reversal condition:** an outbound integration appears — payments, an external API, a webhook receiver — or finalization needs logic unnatural in the database. **None exists in the MVP** (PRD §19.0).

### ADR-4 — Auction closing is triggered by a Supabase-side scheduled sweep, plus on-read and on-bid triggers, against one idempotent operation

**Status:** **Accepted — V-2 resolved 2026-08-13** (§22, §15.6) · **Driver:** Vercel has no always-on process; FR-END-02 and SC-26 require closure with nobody watching.
**Alternatives rejected:** Vercel Cron (couples closing to application availability, needs an elevated credential in the application, adds a trust surface); per-auction timers (impossible without a daemon); close-on-read only (fails SC-26).
**Resolved:** sub-minute scheduling **is** achievable — `pg_cron` 1.6.4 schedules in seconds and was measured firing at 30.034 s mean and 10.014 s mean on `dallal-dev` (`docs/V-2-scheduling-verification.md`). The sweep is a single 15-second job; no offset pair. FR-END-03's 30 s stands as written and was never in jeopardy.

### ADR-5 — Authorization is Row Level Security, default deny

**Status:** Accepted · **Driver:** SEC-Z9 requires enforcement on every route including realtime; SC-43 requires rules to hold when the UI is bypassed.
**Consequence:** the public client key is safe **because** policies are complete (§17.1) — this makes RLS completeness a security-critical property, not a convenience.
**Reversal condition:** none. Moving authorization into the application would break SC-43 by construction.

### ADR-6 — Image is uploaded before the auction record is created

**Status:** Accepted · **Rationale:** §12.2. The failure residue is an invisible orphaned object rather than a user-visible broken listing.
**Consequence:** orphaned objects accumulate on failed creations; no cleanup in MVP (accepted debt, §23).

### ADR-7 — Profile data is stored separately from the authentication record

**Status:** Accepted · **Driver:** SEC-P1, SC-42, RT-S2 — emails must never reach another user, while display names must be public to anonymous visitors.
**Consequence:** privacy becomes structural (the public table has no email) rather than a filtering discipline. Requires a profile record to exist for every account before that user can bid.

### ADR-8 — Money is an exact decimal with two places and no maximum; never floating point

**Status:** Accepted · **Drivers:** BR-21, BR-33, NFR-DAT-05, SEC-R3.
**Consequence:** large values must be handled correctly rather than rejected (SEC-R3) — implementers must not introduce a ceiling to dodge a display or precision problem (PRD SD-05).

### ADR-9 — Realtime is a projection, never an authority

**Status:** Accepted · **Driver:** BR-22, RT-R1, RT-R7.
**Consequence:** every page can reconstruct correct state from a plain read; realtime failure degrades liveness but never correctness; reconnection resynchronizes rather than resuming (RT-R3).

---

## 21. Cross-cutting concerns

### 21.1 Time — one clock

| Rule | Requirement |
|---|---|
| **The database clock is the only authority** for bid validity and auction closing | BR-19, SEC-V3 |
| Client clocks are display-only; a wrong client clock cannot affect any outcome | EC-17 |
| Timestamps stored in one canonical zone, displayed in the viewer's local zone | FR-CREATE-14, NFR-DAT-06, NFR-USA-07 |
| Countdowns tick locally from the **server-supplied** end time | FR-RT-02, RT-P3 |
| No application-server timestamp participates in a decision | Vercel functions have their own clocks — they must not be used |

### 21.2 Money — one representation

**This needs a joint decision in Sprint 0 and is currently absent from TEAM.md (gap G-1, §2).**

| Rule | Requirement |
|---|---|
| Exact decimal, two places. **Never floating point** | NFR-DAT-05 |
| **No maximum.** Large values handled correctly, not rejected | BR-21, SEC-R3 |
| Currency is SAR, everywhere, one display format | BR-33, NFR-DAT-08 |
| Values are **simulated** — no payment path exists anywhere | PRD §19.0, SC-67 |
| The term "Demo Points" is prohibited | PRD §19.0 |

Three developers will otherwise pick three representations: Mohammed for the starting price, Rayan for bids and the current price, and both for display. **One decision, made once.**

### 21.3 Error handling

| Rule | Requirement |
|---|---|
| Rejections state a product-level reason the user can act on | BR-27, NFR-USA-03 |
| Errors never leak internal detail, stack traces, or infrastructure information | SEC-T3, FR-SEC-16 |
| Authentication failures never disclose whether an account exists | SEC-A5, FR-AUTH-09, FR-AUTH-27 |
| A rejected bid leaves state entirely unchanged | BR-23, SEC-I5 |
| Concurrency rejection is distinguishable from a too-low bid | EC-01, §13.5 |

### 21.4 Testability

The architecture must support the PRD's testing requirements, and two of them constrain the design:

| Requirement | Architectural support |
|---|---|
| NFR-MNT-02 — automated concurrent-bid test | The bid operation is directly invocable without the UI, so simultaneous calls can be issued and the single-acceptance invariant asserted |
| NFR-MNT-03 — trigger closing without waiting real time | Finalization is a callable operation, not a hidden timer. **A test must be able to invoke it directly** |
| NFR-MNT-01 — every business rule testable in isolation from the UI | Rules live in Tier 2/3, reachable without a browser |
| SC-43 — rules hold when the UI is bypassed | Direct calls are the normal path for tests, which is the same path an attacker would use |
| NFR-MNT-04 — full lifecycle runs locally | Requires local Supabase, or a shared non-production project. **Verification spike V-5** |

**Design consequence:** finalization must be invocable, not merely scheduled. A design where closing can only happen on a timer would fail NFR-MNT-03.

---

## 22. Verification spikes required before implementation

> ### These are TECHNICAL verifications, not product questions
>
> | | **Technical verification** | **Product decision** |
> |---|---|---|
> | Asks | *Can the platform do X?* | *What should Dalal do?* |
> | Answered by | Testing the platform | The product owner, recorded in `PRD.md` |
> | Lives in | This section | `PRD.md` §21 |
> | Status | **Five open** (below) | **Zero open** — all fifteen closed (PRD §21.1) |
>
> **A technical finding never rewrites a product requirement.** If a spike shows the platform cannot do what a requirement needs, the requirement stands and the finding is escalated — it is not quietly relaxed to fit. §15.6 is the worked example.
>
> None of the items below is an unresolved product question, and none should be labelled or treated as one. Issues depending on them use the `verify` label (TEAM.md §19), never `needs-decision` — which no longer exists.

Five platform assumptions in this document must be **confirmed against the actual platforms** before the affected work starts. They are stated as spikes rather than asserted as fact, because getting one wrong would require rework in exactly the areas that matter most.

**Four of the five are now executed.** All four came back favourable, and each has a written record of the method and the numbers rather than a verdict — so a later reader can disagree with the conclusion without having to re-run it. **V-4 and V-5 came back favourable with a named limit**, which is the more useful shape: V-4 rules a paid-tier feature out on grounds that do not depend on whether it is enabled, and V-5 meets the lifecycle criterion in full while stating exactly where local isolation stops.

| # | Spike | Blocks | Owner | Status | If the answer is unfavourable |
|---|---|---|---|---|---|
| **V-1** | Confirm the database supports the row-locking and transactional semantics assumed in §13, and measure behavior under genuinely concurrent bids | **R-05, R-03** — the whole bidding design | Rayan | ✅ **Executed 2026-08-12** — `docs/contracts/BID-02-verification.md` | Escalate immediately. This is the architecture's foundation |
| **V-2** | Determine the minimum scheduling frequency available in Supabase. Can a sweep run every ~30 s — directly, or via two offset sweeps? | **R-17** — auction closing, FR-END-03 | Rayan | ✅ **Executed 2026-08-13 — directly, no offset sweeps** — `docs/V-2-scheduling-verification.md` | §15.6 defines the outcomes. **FR-END-03 stands as written**; offset sweeps most likely satisfy it even against a one-minute floor. Correctness is unaffected either way (LC-03) |
| **V-3** | Decide the preview-environment Supabase target (§18.4, option A or B). Confirm whether password-reset email works in previews | Preview deployments; Abdulrahman's ability to exercise US-23 pre-merge | Whole team | ⬜ Open | Option A is the safe default. **Never option C** |
| **V-4** | Confirm image transformation/thumbnail capability, or plan a derivative at upload | **M-05, M-10** — NFR-PERF-05, NFR-PERF-01 | Mohammed | ✅ **Executed 2026-08-14 — Supabase transformation ruled out; `next/image` chosen, derivative-at-upload the fallback** — `docs/V-4-image-transformation.md` | Generate a smaller derivative at upload time — retained as the fallback, measured at 18 ms |
| **V-5** | Confirm the full lifecycle — including realtime and scheduled closing — can be exercised in a local or isolated environment | NFR-MNT-03, NFR-MNT-04; the whole team's inner loop | Whole team | ✅ **Executed 2026-08-14 — the lifecycle runs on Docker alone in 5.0 s; realtime *delivery* cannot and is measured on a deployment instead** — `docs/V-5-lifecycle-isolation.md` | Fall back to a shared non-production project with coordinated use — **not needed for the lifecycle; still the path for delivery**, and `#84` measured it at max 793 ms |

**V-1 and V-2 were the two that could change the architecture.** They were run first, in Sprint 0, before Rayan committed to R-03 or R-17 — which is what this section asked for. **Neither changed a product requirement, and neither needed to.** **V-3 is the only one still open**, and it is the team's.

---

## 23. Architectural risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| **1** | **RLS completeness is load-bearing.** The public client key is only safe because policies are complete (§17.1). One table left permissive is a full data exposure | Critical | Default deny everywhere. Each developer owns their entity's policies (§19.2). A policy review before launch, testing SC-38 → SC-43 explicitly |
| **2** | **The bid operation is a single point of correctness.** Every concurrency guarantee depends on it | Critical | Isolate it, keep it small, and cover it with the automated concurrent test NFR-MNT-02 requires. **This is where review effort should concentrate** |
| **3** | ~~**FR-END-03's 30 s may exceed platform scheduling granularity**~~ (§15.6) — **RESOLVED 2026-08-13, the risk did not materialise.** `pg_cron` schedules in seconds; measured at 30.034 s and 10.014 s mean on `dallal-dev` | Was Low–Medium — **presentation only, never correctness** (LC-03) | V-2 executed: `docs/V-2-scheduling-verification.md`. A single 15 s sweep, no offset pair. **The requirement stood as written and was never relaxed** |
| **4** | **Rayan's workstream carries almost all architectural risk** — the bid operation, concurrency, realtime, closing, and winner determination | High, and already flagged in TEAM.md §25 Risk 1 | Unchanged from TEAM.md: when Abdulrahman finishes authentication, he should support Rayan. This architecture reinforces rather than relieves that imbalance |
| **5** | **Orphaned storage objects** accumulate on failed creations (ADR-6) | Low | Accepted debt at demonstration scale. Recorded so it is a decision, not a surprise |
| **6** | **Elevated-privilege operations bypass RLS** and must self-authorize (§11.4) | High if mishandled | Exactly two exist. Each re-verifies identity internally. Adding a third is an architectural change |
| **7** | **Password reset introduces the only external delivery dependency**, and it is in the critical path for account recovery | Medium | Confirm delivery works in every environment where it is exercised (V-3) |
| **8** | **Shared preview database causes cross-branch interference** (§18.4 option A) | Medium | Coordinate schema changes as TEAM.md §11 already requires; evaluate option B if it becomes painful |
| **9** | ~~TEAM.md is stale relative to the PRD~~ — **RESOLVED.** TEAM.md v2.0 and PRD v3.0 are synchronized; all six conflicts and gap G-1 are closed (§2) | — | Keep the three documents in step. A change to one may require a change to the others |
| **10** | **A developer re-adds a check the product deliberately removed** — a bid increment, a price ceiling, a leading-bidder block, a reserve, an email-verification step. **Or the mirror image, now that BR-36 is amended: a developer *removes* the anti-sniping extension** because a document they read still says the end time is fixed | Medium — would silently contradict a finalized product decision | §13.2a lists exactly what the bid operation must **not** check. PRD SD-05 and TEAM.md §26 list what nobody may build. **`CLAUDE.md` §5 carries the BR-36 amendment and governs any document that still disagrees.** Worth an explicit check at code review |

---

## 24. Explicitly out of architectural scope

Not designed here, deliberately:

| Not covered | Why |
|---|---|
| Database schema, DDL, migrations, SQL | Excluded by this phase's restrictions. §9 is a conceptual model only |
| Application code, components, functions | Excluded |
| API specifications | Excluded |
| CI/CD pipeline configuration | Excluded |
| GitHub Issues or task assignment | Excluded — §19 maps existing ownership only |
| Frontend framework choice, libraries, styling approach | An implementation decision within the team's discretion, constrained by the Vercel execution model (§18.5) |
| Payment, messaging, notification, admin, or fulfillment infrastructure | Out of product scope (PRD §19.0, §16, §4.3) |
| Scaling beyond the PRD's stated targets | NFR-SCA-01 → 06 define the envelope |
| Monitoring, alerting, and observability tooling | Not an MVP requirement. **Worth noting:** T1's scheduled sweep (§15.4) is the one component whose silent failure would be invisible — the team should at least know how to check it |

---

## Summary — the architecture in nine sentences

1. **Vercel hosts the application; Supabase holds all state and all rules.** Vercel is stateless and enforces nothing.
2. **Four Supabase services**, each traceable to a Must Have: Auth, PostgreSQL, Storage, Realtime. **Edge Functions are not used** — every candidate use is better served in the database, and adding one would create a second trust path.
3. **Every operation is classified into one of four trust tiers**, and every business rule is enforced in Tier 2 or Tier 3 — never in the client.
4. **Authorization is Row Level Security, default deny.** This is what makes the public client key safe and what makes "the UI cannot be bypassed" structurally true.
5. **Bid acceptance is one serialized atomic database operation and the only path that can insert a bid** — direct insert is denied to every user role. This is how concurrent bids get one definitive ordering.
6. **The current price is written only by that operation, in the same transaction as the bid it derives from**, which resolves TEAM.md's most contested ownership boundary.
7. **Auction closing is an idempotent operation with three triggers** — a Supabase-side scheduled sweep for correctness, plus on-read and on-bid for latency — because Vercel has no always-on process.
8. **Realtime is a projection, never an authority.** Clients subscribe directly to Supabase; a page can always reconstruct correct state from a plain read.
9. **`main` deploys to production, feature branches deploy to previews**, matching TEAM.md's branch strategy — with the preview database target still to be decided (V-3).

**Document conflicts:** all resolved (§2). `PRD.md` v3.0, `TEAM.md` v2.0, and this document are synchronized.

**Before implementation begins:** run **technical** verification spikes V-1 (row-locking semantics) and V-2 (scheduling granularity). Both are platform questions. **There are zero unresolved product questions** — `PRD.md` §21.1 closes all fifteen.

> **Both are now run, and both came back favourable.** V-1 on 2026-08-12 (`docs/contracts/BID-02-verification.md`) and V-2 on 2026-08-13 (`docs/V-2-scheduling-verification.md`). The two spikes that could have changed the architecture did not. V-3, V-4 and V-5 remain open (§22).
