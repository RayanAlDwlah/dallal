# CLAUDE.md — binding instructions for every AI-assisted session on Dalal

All three developers build this project with Claude, in separate sessions that cannot see
each other. This file is the only mechanism that constrains all three at once. **Read it
before writing code.**

---

## 1. What Dalal is

A live auction platform: sellers list items, buyers bid, the highest bid at the end time
wins. Supabase (PostgreSQL 17) + Next.js on Vercel. It is a **demonstration** — SAR
amounts are simulated and **no money changes hands**. There is no payment, no purchase, no
shipping, no messaging, no admin interface.

| Area | Owner | GitHub |
|---|---|---|
| Auth, profiles, platform setup | Abdulrahman | `@Dem4t` |
| Auction records, creation, listing, detail, design system | Mohammed | `@m7ya505` |
| Bidding, current price, closing, winner, realtime | Rayan | `@RayanAlDwlah` |

**Do not write code you do not own.** If a task needs a change in someone else's area,
say so and stop — do not implement it helpfully.

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

---

## 5. Bidding — four checks that must NOT exist

`ARCHITECTURE §13.2a`. Adding any of these is **a bug**, not an improvement. They were
deliberately removed and their **absence is the requirement**:

- ❌ **no bid increment / minimum raise** — `+0.01` is as valid as `+1000` (`BR-32`)
- ❌ **no maximum / reserve price** (`BR-21`, `BR-35`)
- ❌ **no leading-bidder rejection** — being the current leader is never grounds to reject (`BR-24`)
- ❌ **no anti-sniping / time extension**

Also absent by design: no auction cancel, no auction edit, no draft state. `status` has
exactly two values — `active` and `ended`.

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
