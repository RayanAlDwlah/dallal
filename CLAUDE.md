# CLAUDE.md — binding instructions for every AI-assisted session on Dalal

All three developers build this project with Claude, in separate sessions that cannot see
each other. This file is the only mechanism that constrains all three at once. **Read it
before writing code.**

---

## 0. Status note — V2 shipped 2026-08-15 (read before "fixing" anything)

The tree now carries the **V2 product**: the app built from `design-system/previews/*.html`
(Rayan's approved designs, implemented in `Dem4t/dallal-v2`, merged here), running on
Supabase project `dymmjhtuoxmrzssofjgl` with the self-contained schema in
`supabase/migrations/20260815100000_core_schema.sql`. Decided by Rayan (bidding steward)
with the owner's ship directive; reviews were waived for the ship window.

Where this file and V2 diverge, **V2 as shipped governs**, and the diffs are these:

- **§5's "no bid increment" bullet is superseded.** V2 auctions carry a seller-chosen
  `bid_increment` (D-01 taken to its conclusion: the bidder presses a button, the server
  enforces `current_price + increment` inside `place_bid`'s row lock). Everything else in
  §5 — the anti-snipe shape, forward-only `end_time`, the `CHECK`-capped 20 extensions,
  server-clock eligibility, history ordered by `bids.id` — is intact in the V2 schema.
- **File references in §5/§9 describe the V1 tree.** V1 migrations live under
  `supabase/archive-v1/` (including the uncommitted `20260815090000_sec_*` recovered from
  the last V1 session). The V1 test suites and `design/` experiments were removed on the
  ship branch — git history and the pre-V2 branches keep them.
- **§4 (money), §6 (security/privacy), §3 (Arabic RTL) are unchanged** and the V2 code
  complies: amounts are strings end-to-end, `::text` on every money select, one formatter,
  `sar_amount` with no typmod, email never leaves the auth schema.
- **The AI layer** (`lib/ai/`, `app/api/ai/*`) is input/display-path only, per
  `design-system/previews/ai.html`: it never bids, never accepts/rejects/ends anything,
  never sees an email or internal id, and a model never produces an amount — the price
  suggestion is SQL over ended auctions. Unconfigured, it hides itself.

---

## 1. What Dalal is

A live auction platform: sellers list items, buyers bid, the highest bid at the end time
wins. Supabase (PostgreSQL 17) + Next.js on Vercel. It is a **demonstration** — SAR
amounts are simulated and **no money changes hands**. There is no payment, no purchase, no
shipping, no messaging, no admin interface.

### Ownership is split by **responsibility, not by file**

The line is **presentation vs. behaviour**, not feature area. A single component routinely
contains both, and each half has a different owner.

| Responsibility | Owner | GitHub |
|---|---|---|
| **All presentation** — every screen, layout, component, visual state, the design system | Mohammed | `@m7ya505` |
| **Bidding behaviour** — validation, submission, the atomic operation, concurrency, current-price correctness, realtime bidding behaviour, closing, winner determination, bid recording and order | Rayan | `@RayanAlDwlah` |
| **Authentication and identity behaviour and data** — auth logic, session, authorization, identity data | Abdulrahman | `@Dem4t` |

Mohammed's presentation ownership is total: auction screens, the bid panel, bid history,
the outcome and winner views, and the login / registration / password-reset / profile
screens. Layout, typography, spacing, colour, motion, responsive behaviour, loading, empty
and error states, and the presentation side of accessibility are all his.

### What this means in practice

- **Mohammed may restyle a component that contains Rayan's bidding logic**, or
  Abdulrahman's auth logic, as long as **behaviour and contracts are unchanged**.
- **Mohammed must not** change bid validation, bid calculation, concurrency behaviour,
  realtime behaviour, closing logic, winner determination, or bid-recording semantics —
  nor any authentication behaviour or identity data logic.
- **Rayan may implement bidding behaviour inside a component Mohammed presents**, but must
  not redesign that presentation without coordinating with Mohammed first.

### The rule for an AI session — read this before you stop

**Do not write code you do not own.** That rule is unchanged; the boundary it points at
has moved.

Before refusing a task, decide which half it touches:

- **Presentation-only change on Mohammed's task** → he owns it. **Do not block it merely
  because the file also contains someone else's business logic.** Implement the visual
  change, preserve the existing behaviour exactly, rewrite no business rule, alter no
  contract, move no data ownership.
- **The change requires altering another owner's behaviour or data** → **stop and ask that
  owner.** Say so plainly; do not implement it helpfully.

File-level ownership statements elsewhere in the repository do not override this model.

> **Status of this amendment.** Recorded here by the project owner in `5b5e698`. It was
> propagated into `TEAM.md`, `GITHUB_PLAN.md`, `ARCHITECTURE.md` and `README.md` in
> `ea0d861` — including the per-issue behaviour/presentation split for the bidding UI
> issues (`BID-06`, `BID-07`, `BID-10`, `BID-18`), whose presentation half is Mohammed's
> and whose behaviour half stays with Rayan. Should any document still disagree with this
> section on **ownership**, this section governs; they remain authoritative on everything
> else, per §2.

---

## 2. Sources of truth, in order

1. **`PRD.md`** — what the product must do. Product decisions live here and **nowhere else**.
2. **`ARCHITECTURE.md`** — how it is built.
3. **`TEAM.md`** — who owns what, and the collaboration rules.
4. **`GITHUB_PLAN.md`** — the issue breakdown.
5. **`docs/contracts/*.md`** — agreed interface contracts between two owners. **Where a
   contract and an older document disagree, the contract wins** — that is what it is for.

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
- `end_time` moves **forward only, in 30-second quanta, only inside `place_bid`**, and only
  together with `extension_count + 1`. Every other shape raises
- a **rejected** bid never extends — otherwise an ineligible bidder holds an auction open
  forever with bids that never count
- **at the cap a late bid is still accepted.** The cap ends the extending, not the bidding

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
