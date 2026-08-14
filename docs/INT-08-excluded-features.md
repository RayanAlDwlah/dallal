# INT-08 — Excluded-features audit · تدقيق الميزات المستبعدة

| Field | Value |
|---|---|
| Issue | **INT-08** (`#90`) |
| Owner | Mohammed (`@m7ya505`) |
| Traceability | `SC-67` · `PRD` §19.0, `SD-05` · `TEAM` §26 |
| Date | 2026-08-14 |
| Result | **17 of 17 checks pass** — no excluded feature was built |
| Re-runnable as | `./tests/integration/excluded-features.check.sh` |
| Status | ✅ **for everything a static audit can decide.** Two limits are named in §4, and one acceptance criterion is **stale** — see §3 |

---

## 1. Why this is a script and not a walkthrough

`SC-67` says *"Full walkthrough of every screen"*, and the issue says *"Walk every screen and confirm **none** of the following was built."*

A walkthrough answers that question **once**, on the day it is done, and produces a sentence that the next person has to take on trust. The features here are excluded **permanently** — `PRD` §19.0 is not a milestone — so the audit that matters is the one that can be run again after every merge.

There is also a second reason, particular to this repository. The obvious implementation is to grep the tree for `reserve price`, and here that is **worse than useless**: this codebase documents its absences obsessively and on purpose. A plain search returns

```
lib/auctions/detail.ts   "There is no Cancelled and no Draft (BR-30, BR-14)"
design/DESIGN_SYSTEM.md  "no reserve-price field · no bid-increment stepper"
…auc18_auction_authorization.sql   "NO 'cancelled' status — the CHECK admits exactly…"
```

Every one of those is **the guarantee working**, quoted back as a violation. A check that cannot tell *"we did not build this"* from *"we built this"* reports the healthiest files as the worst offenders, and the first person to run it adds an ignore list until it goes quiet.

So the script strips comments before matching, and looks only at implementation surfaces: routes under `app/`, `package.json`, comment-stripped `.ts`/`.tsx`/`.sql`, rendered strings, and `supabase/config.toml`.

## 2. Result — 17 of 17

| # | Check | Measured |
|---|---|---|
| 1 | no payment/checkout/cart/shipping **route** | 0 |
| 2 | no payment **SDK** in dependencies | 0 |
| 3 | no payment **identifier** in code | 0 |
| 4 | no messaging or contact **route** | 0 |
| 5 | no contact-the-seller identifier | 0 |
| 6 | no `'cancelled'` or `'draft'` status value in SQL | 0 |
| 7 | the status `CHECK` still admits **exactly two** values | 1 |
| 8 | no edit or cancel route | 0 |
| 9 | no `auctions` update/delete call in code | 0 |
| 10 | no reserve price | 0 |
| 11 | no bid increment / minimum raise | 0 |
| 12 | no price ceiling or max-bid identifier | 0 |
| 13 | no `numeric(P,S)` typmod on any column | 0 |
| 14 | email confirmation off — no verification step | 2 (both flows) |
| 15 | no admin role or admin surface | 0 |
| 16 | the term **"Demo Points"** in no rendered string | 0 |
| 17 | no native mobile artifact or toolchain | 0 |

Check 7 is stated **positively** on purpose. The other absence checks pass just as well when the thing they inspect has been deleted entirely; asserting that the two-value `CHECK` is still *present* is what stops "no `Cancelled` state" from being satisfied by a schema that has stopped constraining `status` at all.

Checks 11–13 are `CLAUDE.md` §5's three, plus the money typmod from §4 rule 2 — the four the project itself names as the most likely to arrive while someone is being helpful.

## 3. 🔴 One acceptance criterion is stale — `anti-sniping`

The issue lists, among the features to confirm were **not** built:

> … reserve field · bid increment · price ceiling · **anti-sniping** · email-verification step …

**Anti-sniping exists.** `BR-36` was reversed on 2026-08-13 by the project owner with both other developers agreeing, and `CLAUDE.md` §5 is explicit:

> A bid **accepted** in the **final 15 seconds** extends `end_time` by **exactly 30 seconds**, repeating, to a **hard cap of 20 extensions**. … If a document you are reading says the end time is fixed and never extended, **it is stale — this section governs**.

So this criterion cannot be satisfied, and **must not be**: `tests/bidding/closing.sql` asserts the extension, the cap is a `CHECK` constraint, and removing any of it is classified as a bug rather than a cleanup. The audit therefore **does not check for anti-sniping's absence**, and says so here rather than reporting a pass it did not earn or, worse, "fixing" the product to match the criterion.

**This is the fourth document found carrying the pre-reversal claim.** The others:

| Where | Text | Status |
|---|---|---|
| issue **#55** (`AUC-13`, **closed**) | *"the end time never changes — there is no anti-sniping extension"* | ⬜ not mine to edit — raised on **#140** |
| `design/DESIGN_SYSTEM.md:242` | *"The end time never changes … so **the countdown never jumps**"* | ✅ **corrected in this change** |
| `design/DESIGN_SYSTEM.md:317` | *"no anti-sniping 'time extended' treatment"* in the excluded list | ✅ **corrected in this change** |
| this issue's own criteria | *"anti-sniping"* among the excluded | ⬜ needs the issue text amended |

The design-system line matters more than its length suggests: it is **the reason #140 went unseen.** Every session that read the design system was told the countdown never jumps, so a countdown frozen on a stale end time read as correct behaviour rather than as a defect.

## 4. What this audit does **not** decide

Named rather than left to be discovered.

1. **A visual affordance with no distinctive identifier.** The script would not catch a bid-increment stepper built as three unnamed buttons that write `"+5"` into the amount field. It catches names, routes, dependencies and schema — not pixels. `SC-67`'s "full walkthrough" half needs a browser, and that is **INT-06 (#88)** at 375 px and **INT-09 (#91)** end to end. This audit narrows what those have to look for; it does not replace them.
2. **Comment stripping is textual.** Block comments and whole-line comments go. A `--` inside a SQL string literal truncates its line early, so an identifier hidden after one would be missed. No such literal exists today, and the alternative is a SQL parser.

## 5. The controls — every check was made to fail

A check that only ever passes is indistinguishable from a check that cannot fail, which is the defect this project has now met three times (`#104`, `#117`, `#121`). Each load-bearing check was therefore run against a deliberate violation, one at a time:

| Probe | Expected | Observed |
|---|---|---|
| a file of **comments** naming `reserve_price`, `bidIncrement`, `maxPrice` | **PASS** — prose must not trip it | `INT-08: PASS` |
| `export const reservePrice = "100.00"` | fail check 10 | `FAIL no reserve price anywhere got=1` |
| `export const bidIncrement = 5` | fail check 11 | `FAIL no bid increment / minimum raise got=1` |
| `add column x numeric(12,2)` | fail check 13 | `FAIL no numeric(P,S) typmod got=1` |
| `app/auctions/[id]/cancel/page.tsx` | fail check 8 | `FAIL no edit or cancel route exists got=1` |
| clean tree restored | **PASS** | `INT-08: PASS` |

The first row is the one worth keeping: it is the property that separates this from a word search, and it is the only assertion here whose failure would make every other row meaningless.

---

*Measured 2026-08-14 on `main`. Everything above was executed; nothing in §2 or §5 is reasoned.*
