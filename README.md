# Dalal — Live Auction Web Platform

**A responsive, browser-based real-time auction platform.**

Create an auction, watch bidders compete live, and see the system determine a winner the moment the clock runs out — with every rule enforced by the server.

---

## What Dalal is

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
| Desktop web browsers | Flutter, Android, or iOS applications |
| Mobile web browsers | App Store / Google Play distribution |
| Responsive web design | Native mobile architecture or device builds |

**"Mobile responsive" means the website works well in a mobile browser. It does not mean a mobile application is being built.**

---

## ⚠ Financial scope — read before contributing

Auction prices are displayed in **Saudi Riyal (SAR)** — for example `Starting Price: 100 SAR`, `Current Bid: 250 SAR`, `Winning Bid: 400 SAR`.

**All SAR values are simulated demonstration values. Dalal processes no real money.**

There is **no** payment processing, checkout, card handling, payment gateway, wallet, bank transfer, refund, financial settlement, shipping, or order fulfillment. The product ends at **winner determination and result display**.

SAR is used purely as a realistic unit of price representation. The term **"Demo Points" is prohibited** — prices are SAR.

---

## Documentation — read in this order

| Document | What it is | When to read it |
|---|---|---|
| **[PRD.md](PRD.md)** | Product requirements. **The product source of truth.** All fifteen product decisions are final; zero open questions | Before building anything |
| **[TEAM.md](TEAM.md)** | Branches, GitHub workflow, collaboration rules. **Its ownership matrix is superseded by `CLAUDE.md` §1** | Before your first commit |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Technical architecture — platform split, trust boundary, data ownership, deployment | Before implementing bidding, authorization, or closing |
| **[GITHUB_PLAN.md](GITHUB_PLAN.md)** | Milestones, Issues, dependencies, execution order | When picking up work |

**If implementation surfaces a genuinely new ambiguity, raise it with the team.** Do not invent an answer in code (`PRD.md` §21.3).

---

## Team, and how work is claimed

**Nobody owns a file.** Work is claimed per ticket, by whoever is available. A contributor
picks a ready ticket, claims it, branches `feature/<ticket-id>-<short-name>`, and ships it.
The full model and its seven-step workflow are in `CLAUDE.md` §1, which governs.

| Contributor | GitHub | Reviews changes in (steward, not gate) |
|---|---|---|
| **Rayan** | [`@RayanAlDwlah`](https://github.com/RayanAlDwlah) | Bidding, concurrency, closing, extension, current-price correctness |
| **Abdulrahman** | [`@Dem4t`](https://github.com/Dem4t) | Authentication, session, authorization, identity data |
| **Mohammed** | [`@m7ya505`](https://github.com/m7ya505) | Design system and presentation consistency |

A steward is someone to **request review from**, not someone to **wait for**. **A steward's
absence must not block a ready, well-specified ticket.** The question before you write code
is *"is this decided?"* — never *"is this mine?"*.

### The auction detail page — the one file split ahead of time (S0-13)

`/auctions/[id]` is where three workstreams render at once. Left as a single file it
conflicts on nearly every merge, so it is split into separate files **before** anyone builds
on it (`TEAM.md` §11, `ARCHITECTURE.md` §14.6). The split is about **merge conflicts, not
permission** — any contributor may fill any row below.

| File | Filled by | Contract it must not break |
|---|---|---|
| `app/auctions/[id]/page.tsx` | `AUC-11` — shell, layout, auction read | passes **only the auction id** downward |
| `components/auction/detail/product-content.tsx` | `AUC-12` | — |
| `components/auction/detail/status-countdown.tsx` | `AUC-13` | `end_time` is the server's, not the browser's |
| `components/auction/detail/price-region.tsx` | `AUC-14` | current price arrives as a **string**, never a `Number` |
| `components/bidding/bid-panel.tsx` | `BID-03`, `BID-04`, `BID-06` | the three checks that must not exist (`CLAUDE.md` §5) |
| `components/bidding/bid-history.tsx` | `BID-07` | ordered by `bids.id`, never `created_at` |
| `components/bidding/outcome-banner.tsx` | `BID-18`, `BID-17` | outcome comes from the server, not from a client comparison |

The page tells the bidding components **which auction is being viewed, and nothing else** —
the one prop S0-13 fixes. Restyle any row freely; the right-hand column is what a PR may not
change without a decision behind it.

**Do not add a second update mechanism.** One per-auction realtime subscription is
established in `BID-08`/`BID-09`; a competing one is a defect, not an optimization
(`TEAM.md` §10.4, `ARCHITECTURE.md` §14.6).

`design/components/bidding/bid-panel.tsx` is a styled, behaviour-free draft kept as a
**frozen reference**. Nothing imports it, and it is not the history of the file above.

---

## Branching

```text
main                              ← protected; no direct commits
├── feature/<ticket-id>-<short-name>      e.g. feature/V2-A3-bid-increment
├── feature/<ticket-id>-<short-name>
└── …
```

- **Nobody commits directly to `main`.**
- **One branch per ticket**, named for the ticket — not one long-lived branch per person.
- Changes reach `main` through a Pull Request.
- **At least one teammate reviews** before merge.
- Merge `main` into your branch before opening and before merging a PR.
- A PR states its **changed files, verification evidence, remaining risks, and handoff
  notes** (`CLAUDE.md` §1, step 6).

Full workflow: `TEAM.md` §15–§18 and `GITHUB_PLAN.md` §11.

---

## Getting started

```bash
git clone https://github.com/RayanAlDwlah/dallal.git
```

```bash
cd dallal
```

```bash
git checkout -b feature/<ticket-id>-<short-name>
```

Then read `CLAUDE.md` §1 (how work is claimed), `PRD.md`, and `ARCHITECTURE.md`, and claim a
**ready** Issue from `GITHUB_PLAN.md` — checking its dependencies first.

### Environment configuration

Copy the example file and fill in your own values:

```bash
cp .env.example .env.local
```

**Never commit a populated environment file.** `.env.example` contains placeholder names only. Real values are distributed out of band and set in Vercel per environment (`ARCHITECTURE.md` §17).

> **Never commit secrets, API keys, tokens, connection strings, or service-role credentials.** A leaked key requires rotation, not deleting the commit.

### Application setup

The web application scaffold does not exist yet — it is Sprint 0 Issue **S0-07**. Build, run, and test commands will be documented here once it lands.

---

## Project status

**Planning complete. Implementation has not started.**

| Phase | Status |
|---|---|
| Product requirements (`PRD.md` v3.0) | ✅ Final — zero open product questions |
| Team structure (`TEAM.md` v2.0) | ✅ Final |
| Architecture (`ARCHITECTURE.md` v1.1) | ✅ Final |
| GitHub plan (`GITHUB_PLAN.md` v1.1) | ✅ Final — 84 Issues across 5 milestones |
| Sprint 0 | ⏳ Not started |
| Implementation | ⏳ Not started |
