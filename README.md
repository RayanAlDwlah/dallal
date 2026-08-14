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
| **[TEAM.md](TEAM.md)** | Team ownership, branches, GitHub workflow, collaboration rules | Before your first commit |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Technical architecture — platform split, trust boundary, data ownership, deployment | Before implementing bidding, authorization, or closing |
| **[GITHUB_PLAN.md](GITHUB_PLAN.md)** | Milestones, Issues, dependencies, execution order | When picking up work |

**If implementation surfaces a genuinely new ambiguity, raise it with the team.** Do not invent an answer in code (`PRD.md` §21.3).

---

## Team and ownership

| Developer | GitHub | Owns | Branch |
|---|---|---|---|
| **Abdulrahman** | [`@Dem4t`](https://github.com/Dem4t) | Authentication & identity **behaviour and data** | `feature/abdulrahman-auth` |
| **Mohammed** | [`@m7ya505`](https://github.com/m7ya505) | Auction Management · **all presentation, product-wide** | `feature/mohammed-auctions` |
| **Rayan** | [`@RayanAlDwlah`](https://github.com/RayanAlDwlah) | Bidding & Realtime **behaviour** | `feature/rayan-bidding` |

Ownership does not mean exclusive access — it means **coordinate with the owner before changing their area** (`TEAM.md` §7).

**The axis is presentation vs. behaviour, not file.** A component routinely holds both, and
each half has a different owner: Mohammed owns how every screen looks — including the bid
panel, bid history, outcome views and the auth and profile screens — while Rayan owns what
bidding does and Abdulrahman owns what authentication does. Restyling someone's component
is fine; changing what it does without telling them is not. Full rules in `CLAUDE.md` §1
and `TEAM.md` §7.

### The auction detail page — the one file split by owner (S0-13)

`/auctions/[id]` is where all three workstreams render. Left as a single file it conflicts
on nearly every merge, so it is split into separately owned files **before** anyone builds
on it (`TEAM.md` §11, `ARCHITECTURE.md` §14.6). This table is the record the S0-13
acceptance criteria ask for; each file repeats it in its own header.

| File | Owner | Filled by |
|---|---|---|
| `app/auctions/[id]/page.tsx` | Mohammed | `AUC-11` — shell, layout, auction read |
| `components/auction/detail/product-content.tsx` | Mohammed | `AUC-12` |
| `components/auction/detail/status-countdown.tsx` | Mohammed | `AUC-13` |
| `components/auction/detail/price-region.tsx` | Mohammed builds it — **Rayan supplies the value and its updates** | `AUC-14` |
| `components/bidding/bid-panel.tsx` | Mohammed presents — **Rayan owns what it accepts and what submission does** | `BID-03`, `BID-04`, `BID-06` |
| `components/bidding/bid-history.tsx` | Mohammed presents — **Rayan owns what is recorded and its order** | `BID-07` |
| `components/bidding/outcome-banner.tsx` | Mohammed presents — **Rayan owns the outcome values and when they appear** | `BID-18`, `BID-17` |

The page tells Rayan's components **which auction is being viewed, and nothing else** — the
one prop S0-13 fixes. Everything they need beyond that is Rayan's to declare. The split is
by responsibility, not by file (`CLAUDE.md` §1): Mohammed may restyle any row above without
asking, provided behaviour and contracts are unchanged.

**Mohammed must not add a second update mechanism.** One per-auction realtime subscription
is owned upstream (`BID-08`/`BID-09`); a competing one is a defect, not an optimization
(`TEAM.md` §10.4, `ARCHITECTURE.md` §14.6).

`design/components/bidding/bid-panel.tsx` is a styled, behaviour-free draft kept as a
**frozen reference**. Nothing imports it, and it is not the history of the file above.

---

## Branching

```text
main                              ← protected; no direct commits
├── feature/abdulrahman-auth
├── feature/mohammed-auctions
└── feature/rayan-bidding
```

- **Nobody commits directly to `main`.**
- Work happens on your assigned feature branch.
- Changes reach `main` through a Pull Request.
- **At least one teammate reviews** before merge.
- Merge `main` into your branch before opening and before merging a PR.

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
git checkout feature/<your-branch>
```

Then read `PRD.md`, `TEAM.md`, and `ARCHITECTURE.md`, and pick up your first Issue from `GITHUB_PLAN.md`.

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
