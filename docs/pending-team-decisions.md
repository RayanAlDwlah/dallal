# Pending Team Decisions

**Dalal — decision analysis. Nothing here is approved.**

| Field | Value |
|---|---|
| Author | Mohammed — [`@m7ya505`](https://github.com/m7ya505) |
| Branch | `feature/mohammed-auctions` |
| Date | 2026-08-12 |
| Status | ⏸ **Analysis only — awaiting team sign-off** |
| Blocks | `lib/money.ts` · `Money` · `PriceBlock` · `Amount input` · all price UI |

> **This document decides nothing.** It states three open questions, what each source document currently requires, the technical consequences of each option, and a labelled recommendation. **No implementation has been written for any of them.**
>
> Written in English because it quotes and must be diffed against two English contracts (`design/STACK.md`, `docs/contracts/S0-12-money.md`), and `design/DESIGN_SYSTEM.md` §2 keeps repository documents English.

---

## Contents

- **A** — [S0-12 money representation](#a--s0-12-money-representation) ← the blocker
- **B** — [Final Next.js stack approval](#b--final-nextjs-stack-approval)
- **C** — [Arabic/RTL as a formal PRD requirement](#c--arabicrtl-as-a-formal-prd-requirement)
- [Decision order](#decision-order-c-gates-part-of-a)

---

# A — S0-12 money representation

## A.1 The exact conflict

Two artifacts describe how a SAR amount is held and rendered. They disagree, and **both are unratified**.

| | `docs/contracts/S0-12-money.md`<br>*(Rayan — `feature/rayan-bidding`)* | `design/lib/money.ts`<br>*(Mohammed — `feature/mohammed-auctions`)* |
|---|---|---|
| Storage | PostgreSQL unconstrained `numeric` in a `sar_amount` DOMAIN | *(not specified — client module only)* |
| Client arithmetic | Decimal **string**, split on `.`, pad fraction | **`bigint` minor units** (halalas) |
| Transport | **String** at every boundary, both directions | *(assumes string in, converts to bigint)* |
| Thousands separators | **Banned** | **Present** — `Intl.NumberFormat` grouping |
| Suffix | **`SAR`** | **`ر.س`** |
| Rendered example | `1250.00 SAR` | `1,250.00 ر.س` |
| Identifiers | `formatSAR` · `SarAmount` | `formatSar` · `Sar` |

**The single most important finding: this is not one conflict, it is two — and they have very different weights.**

| | Question | Status |
|---|---|---|
| **A-1** | Storage and arithmetic representation | **Effectively settled by evidence.** See A.3 |
| **A-2** | Display format — grouping, suffix | **Genuinely open, and gated by decision C.** See A.4 |

## A.2 What each document currently requires

### `docs/contracts/S0-12-money.md` (Rayan)

| § | Requirement |
|---|---|
| §1 | `numeric` + `sar_amount` DOMAIN · no precision typmod · **no minor-units conversion** · no ceiling · string transport both directions |
| §2 | *"One DOMAIN, three columns, one write path, one formatter. **Nothing else may hold, transport, or render a SAR amount.**"* |
| §4 | Authoritative comparison happens **in SQL, inside the per-auction row lock**. No epsilon, ever |
| §7 | Canonical format `<digits>.<exactly two decimals> SAR` — Western digits, **no separators**, one space, `SAR`. Client mirror must be **byte-identical**, asserted by a golden test over a 40-digit fixture |
| §9.7 | **No amounts as JSON numbers** — strings in, text out, typegen overridden to `string` |
| §9.8 | **No second formatter**, no raw `::text` on a display surface |
| §9.10 | No "Demo Points", no currency other than SAR |

### `design/DESIGN_SYSTEM.md` §5.2 (Mohammed)

Proposes `1,250.00 ر.س` — grouped, always two decimals, Arabic suffix. **And marks itself provisional:**

> *"### 5.2 The SAR format — **PROPOSED, confirm in S0-12**"*
> *"**Both need Rayan's agreement as part of S0-12** — he owns bid amounts and current-price correctness; this document proposes only the display half."*

### `PRD.md` — the product-level constraints

| ID | Text | Bearing |
|---|---|---|
| **FR-CREATE-13** (line 493) | *"…displayed with a consistent `SAR` indicator, for example `100 SAR`, `250 SAR`, `400 SAR`"* | Uses **Latin `SAR`**, and shows **no separators** |
| **NFR-DAT-05** | Exact two-decimal precision, no rounding drift, **never floating point** | Both options satisfy |
| **NFR-DAT-08** | One consistent format; the same amount never appears two ways | Requires exactly one formatter |
| **BR-21 / SEC-R3** | **No maximum.** Large values handled correctly, never rejected for size | Decisive against any ceiling |
| **BR-33** | Currency is SAR; values simulated; "Demo Points" prohibited | Both satisfy |

### `GITHUB_PLAN.md` — ownership

**S0-12 primary owner: Rayan**, with Mohammed as required reviewer. Rationale recorded there: the correctness-critical half is exact comparison inside the bid operation.

## A.3 A-1 — storage and arithmetic: technical consequences

| Consequence | `numeric` + string *(Rayan)* | `bigint` halalas |
|---|---|---|
| **DB ceiling** | None chosen. ~131,072 digits physical | **PostgreSQL `BIGINT` caps at 2⁶³−1 halalas ≈ 9.2×10¹⁶ SAR** → SQLSTATE 22003, *a rejection for size*, which BR-21/SEC-R3/EC-25 forbid and ARCHITECTURE §13.5's eight reasons cannot even report |
| **Conversion sites** | **Zero.** No ×100 anywhere | One per boundary — each a place three developers can diverge, producing a silent 100× error that type-checks |
| **Comparison** | Exact, value-based, scale-insensitive in SQL under the lock (`100 = 100.00`, `100.01 > 100.00`, 0.01 delta detected at 40 digits) | Exact in integers — but only after every input is converted correctly |
| **Serialization** | String throughout; typegen forced to `string` | Needs the same string transport anyway, plus conversion at each end |
| **Floating point** | Never touched | Never touched |

**An honest correction to my earlier framing.** Rayan's §8.2 rejects halalas as *"fatally flawed as packaged."* That verdict is about **PostgreSQL `BIGINT`**, whose 2⁶³ ceiling is real and disqualifying. It is **not** a valid objection to JavaScript `bigint`, which is arbitrary-precision and would hold a 40-digit value without loss.

So the client-side halalas approach is **not** technically broken. What actually rules it out is narrower and still sufficient:

1. **§2 and §9.8** permit exactly one module to hold, transport or render an amount. A second representation is prohibited by the contract regardless of whether it works.
2. **The unit-mix hazard is real at the boundary.** With a decimal string on the wire and bigint in the client, every read and write is a conversion site. §7 additionally demands the client formatter be *byte-identical* to the server's — trivially provable with string arithmetic, an extra proof obligation with a conversion in between.

**Conclusion on A-1: the `numeric` + string-transport model stands, and `design/lib/money.ts`'s bigint core should not be carried into `lib/`.** Not because bigint is wrong in JS, but because a second representation is forbidden and buys nothing.

## A.4 A-2 — display format: genuinely open

**Rayan's contract already anticipated this and deliberately left the door open.** §7, verbatim:

> *"**No thousands separators in the MVP.** Grouping is a presentation nicety that would need a second, width-unbounded implementation on both tiers and **interacts with the pending Arabic-RTL decision** (digit set, indicator placement — **currently unresolved against PRD's English-only statements**). If the team later wants grouping or Arabic-Indic digits, it is **one edit to the two mirrored formatter functions and a revision of this contract**."*

So the display half is not a standoff — it is **an open question with a named change path, explicitly blocked on decision C.**

| Sub-question | Rayan §7 | Mohammed §5.2 | Bearing evidence |
|---|---|---|---|
| Thousands separators | No — `1250.00` | Yes — `1,250.00` | FR-CREATE-13's examples show none. Grouping needs a second width-unbounded implementation on both tiers |
| Suffix | `SAR` | `ر.س` | **FR-CREATE-13 literally writes `100 SAR`.** DESIGN_SYSTEM §5.2 concedes `ر.س` is a *reinterpretation* "that needs recording" |
| Always two decimals | Yes, ratified | Yes | **Agreed.** Not in dispute |
| Digit set | Western | Western | **Agreed** (DESIGN_SYSTEM §2.2). Not in dispute |

**Two of the four sub-questions are already agreed.** The dispute is separators and suffix only.

## A.5 Impact by surface

| Surface | Owner | What A blocks today |
|---|---|---|
| **Database storage** | Rayan | Nothing — `sar_amount` DOMAIN is his to create; A-1 does not contest it |
| **Comparisons** | Rayan | Nothing — SQL, under the lock. Client comparison is Tier-1 UX only |
| **Bid validation** | Rayan | Nothing structurally. `minimumAcceptableBid` (BR-28/BR-29) is expressed identically in both artifacts — genuine agreement |
| **Serialization** | Both | Settled in principle: strings both directions, typegen `string` |
| **Formatting** | **Rayan owns the module; Mohammed consumes** | **Blocked.** One formatter cannot be written until the separator/suffix question is answered |
| **Price UI** | Mohammed | **Blocked** — `Money`, `PriceBlock` stay in `design/`. Also unbuilt: **`Amount input`** (DESIGN_SYSTEM §8.1), whose affix and tabular figures depend on the formatter |
| **SAR display** | Both | **Blocked** on A-2 alone |

**Not blocked, and already delivered:** every other S0-09 primitive, the `.num` LTR-isolate utility, the money type scale (`--text-money-*`), and the CSS obligation for very wide values (EC-25) — which §7 correctly assigns to Mohammed's surfaces independently of the format.

## A.6 The minimum decision the team must make

Not "which representation." Two narrow rulings:

| # | Ruling required | Options |
|---|---|---|
| **1** | Where does the one client money module live, and does it use string arithmetic? | **(a)** `lib/money.ts`, string arithmetic, mirroring S0-12 §7 · **(b)** something else — requires revising §2 and §9.8 |
| **2** | The canonical rendered string | **(a)** `1250.00 SAR` — §7 as written · **(b)** `1,250.00 SAR` — grouping added, suffix kept · **(c)** `1250.00 ر.س` — Arabic suffix, no grouping · **(d)** `1,250.00 ر.س` — DESIGN_SYSTEM §5.2 as written |

Anything chosen for #2 other than (a) requires **a revision to `S0-12-money.md` §7 by its owner**, per its own change path. **Ruling #2 cannot be made responsibly before decision C** — the suffix question *is* the Arabic question.

## A.7 Recommendation — ⚠️ NOT AN APPROVED DECISION

> **This is my recommendation as design-system owner. It carries no authority. Rayan owns S0-12; only the team can close it.**

**Ruling #1 → option (a).** One module at `lib/money.ts`, decimal-string arithmetic, mirroring §7, with the golden byte-identity test §7 requires. Reasons: §2/§9.8 forbid a second representation; string arithmetic makes byte-identity trivially provable; it removes every ×100 conversion site. I withdraw the bigint core of `design/lib/money.ts`.

**Ruling #2 → option (a) — `1250.00 SAR` — for the MVP.** Reasons, in order of weight:

1. **`FR-CREATE-13` writes `100 SAR` literally.** It is a finalized PRD requirement (formerly Q12). `ر.س` is a reinterpretation, and DESIGN_SYSTEM §5.2 itself concedes it "needs recording" — i.e. it needs a PRD amendment that does not exist yet.
2. **Grouping costs a second width-unbounded implementation on both tiers**, and every added implementation is somewhere NFR-DAT-08's one-format guarantee can break.
3. **It is reversible in one edit.** §7 names the path: change two mirrored functions plus a contract revision. Choosing (a) now is not a permanent aesthetic verdict.
4. **It unblocks the price UI immediately**, which is currently the largest stalled surface.

**What I am giving up by recommending this, stated plainly:** `1250.00 SAR` reads less naturally in an Arabic interface than `1,250.00 ر.س`, and grouping genuinely aids scanning a bid history — the exact scannability FR-BID-15 cares about. I judge that a fair trade for one formatter now, **reversible the moment C is decided.** If the team decides C in favour of formally recording Arabic, I would expect to revisit #2 and would support `ر.س`.

---

# B — Final Next.js stack approval

## B.1 The gap

`design/STACK.md` header reads:

> *"Version | 0.1 — **proposed, needs whole-team sign-off**"*

and §7 item 1:

> *"**Whole-team sign-off** on Next.js as the framework — TEAM.md Rule 14."*

**The stack is already built on.** `S0-07` (`38f2ff3`) and `S0-08`/`S0-09` (`bf0e8ea`) are both implemented against it. Approval is retrospective, which is exactly the situation TEAM.md Rule 14 exists to prevent.

`ARCHITECTURE.md` §24 deliberately left framework choice to the team, so **no architecture change is needed — only a recorded decision.**

## B.2 The proposed stack — unchanged, stated for the record

| Layer | Choice | Installed version |
|---|---|---|
| Framework | **Next.js, App Router** | `16.3.0` |
| UI | React | `19.2.8` |
| Language | TypeScript, `strict`, `noUncheckedIndexedAccess` | `6.0.3` |
| Styling | Tailwind CSS v4, CSS-first, **no `tailwind.config.js`** | `4.3.3` |
| Variants | CVA + `tailwind-merge` + `clsx` | installed |
| Data | `@supabase/ssr` | **not yet installed** — Abdulrahman, `AUTH-01` |
| Forms | React Hook Form + Zod | **not yet installed** |
| Tests | Vitest · Playwright · Testing Library | **not yet installed** |
| Lint | ESLint 9 flat config + the RTL guard | `9.39.5` |

**Deviation to note:** `STACK.md` §4.3 supplies the RTL ESLint rule via `FlatCompat`. `eslint-config-next@16` crashes under `FlatCompat` on ESLint 9 (`Converting circular structure to JSON`); it was composed from its **native flat configs** instead. Same rule, same strictness, different wiring. Recorded in `docs/scaffold-notes.md` §6.1.

## B.3 What needs approval

| # | Item | Who |
|---|---|---|
| 1 | Next.js App Router as **the** framework — Rule 14 sign-off | All three |
| 2 | Vite's role is **Vitest only**, never an app bundler (§7 item 2) | All three |
| 3 | Version pinning recorded (§7 item 4) — done in `docs/scaffold-notes.md` §1 | Acknowledge |
| 4 | Font `tnum` verification (§7 item 3) — **still unverified.** IBM Plex loads; tabular figures in the shipped subset were not visually confirmed | Mohammed |
| 5 | Promote `STACK.md` `0.1 → 1.0` once 1–4 are closed | Mohammed |

**No stack change is proposed here.** Only that the existing proposal be ratified or amended.

---

# C — Arabic/RTL as a formal PRD requirement

## C.1 The gap — a documentation contradiction, not a new behaviour

`design/DESIGN_SYSTEM.md` §2 records the team as having already agreed:

> *"## 2. Direction and language — **AGREED by the team, 2026-08-12**"*
> *"**Action still outstanding:** the team has agreed, so per TEAM.md Rule 16 and PRD §21.3 the decision must be **recorded in `PRD.md`** — §4.2 and §19.7 reworded, and a line added to the decision register (§21.1). **Until that edit lands, this file is the only place the decision exists.**"*

Meanwhile `PRD.md` still says the opposite in four places:

| Location | Current text |
|---|---|
| **§4.2**, line 191 | *"Non-English-speaking users as a served segment \| Multi-language support is out of scope"* |
| **§20.1 A-U10**, line 1904 | *"English is sufficient for all users in the MVP period."* |
| **§19.7**, line 1860 | *"Multi-language support \| Adds translation to every string and message; no identified need"* |
| **§7.3**, line 382 | *"multi-language and multi-currency"* listed as Future |

**The shipped code is Arabic-first** — `<html lang="ar" dir="rtl">`, Arabic UI strings, an RTL ESLint guard, Arabic-tuned line-heights.

This is a live contradiction between the product source of truth and the implementation.

## C.2 Why it is not merely cosmetic

Two consequences beyond tidiness:

1. **It gates ruling A-2.** Rayan's §7 declines grouping and Arabic-Indic digits partly because the Arabic decision is *"currently unresolved against PRD's English-only statements."* The suffix question (`SAR` vs `ر.س`) cannot be settled while the PRD says English is sufficient.
2. **`PRD.md` §21.3 forbids exactly this state.** It requires that anything not covered be *raised and recorded in the PRD*, never encoded in code first. The Arabic decision was made and built, but not recorded — the process the PRD mandates ran backwards.

## C.3 Proposed recording location — no new behaviour invented

**I am proposing where to write down a decision the team has already taken. I am not proposing a product change, and I have made no PRD edit.**

| # | Location | Proposed nature of edit |
|---|---|---|
| 1 | **§1.1 Platform statement** | Add one line: the interface language is Arabic, right-to-left, single-locale |
| 2 | **§4.2** "not target users" | Reword so that *not supporting multiple languages* no longer reads as *English-only*. A single-locale Arabic product is compatible with excluding translation infrastructure |
| 3 | **§20.1 A-U10** | Replace "English is sufficient" with the Arabic single-locale statement, marked Resolved |
| 4 | **§19.7 / §7.3** | Keep **multi-language** excluded — unchanged and correct. Clarify that excluding *multiple* languages is not a statement about *which* single language |
| 5 | **§21.1 decision register** | Add a row: interface language Arabic/RTL, agreed 2026-08-12, recorded in `DESIGN_SYSTEM.md` §2 |
| 6 | **NFR-USA-06 / §1.1** | Note that RTL correctness is part of the responsive obligation, alongside the 375px requirement |

**Deliberately unchanged:** multi-language stays out of scope · multi-currency stays out of scope · SAR stays the currency · no translation infrastructure · no second locale.

## C.4 Who makes this edit

`PRD.md` is the product owner's document. **Neither Mohammed nor any developer should edit product behaviour unilaterally** — that is the rule this gap already breached once. The team should confirm the decision, then the product owner records it.

---

# Decision order — C gates part of A

```text
C  Arabic/RTL recorded in PRD.md
   └─ unblocks ─► A-2  suffix: SAR or ر.س
                   └─ with A-1 (settled) ─► lib/money.ts
                                              └─ unblocks ─► Money · PriceBlock
                                                             Amount input
                                                             all price UI

B  Next.js sign-off — independent, but already being built on
```

| Order | Item | Why |
|---|---|---|
| **1st** | **C** | Cheapest to decide, gates A-2, and closes a live PRD contradiction |
| **2nd** | **A** | A-1 needs only confirmation; A-2 follows directly from C |
| **3rd** | **B** | Independent — but retrospective already, so sooner is better |

## Nothing was implemented

No `lib/money.ts` · no `price-block.tsx` · no `Money` · no `Amount input` · no `AUC-*` work · no change to Rayan's contract · no change to Abdulrahman's files · **no `PRD.md` edit.**

The three money-dependent files remain in `design/` exactly as they were, and the `design/**` exclusion in `tsconfig.json` and `eslint.config.mjs` remains in place for them — see `docs/design-system-notes.md` §3.
