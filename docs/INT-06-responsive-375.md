# INT-06 — Responsive validation at 375 px

| Field | Value |
|---|---|
| Issue | **INT-06** (`#88`) |
| Owner | Mohammed (`@m7ya505`) |
| Traceability | `PRD` §1.1 · `NFR-USA-06` · `SC-49` |
| Date | 2026-08-14 |
| Static half | ✅ **6 of 6 pass** — `./tests/integration/responsive-375.check.sh` |
| Rendered half | ⬜ **NOT SHOWN — no browser available.** See §3 |
| **#88** | **stays open.** This does not close it |

---

## 1. What INT-06 asks, and what could actually be done

> **Every** MVP surface fully usable in a **mobile web browser** at 375 px … **no horizontal scrolling, no inaccessible controls**

That is a question about rendered layout, and only a browser answers it. **There is no browser in this environment**: `chromium-browser` is a snap stub that exits with *"requires the chromium snap to be installed"*, and `firefox` is a snap that fails to launch under WSL (*"cannot preserve mount namespace"*). Neither `playwright` nor `puppeteer` is a dependency, and adding one — plus a ~300 MB browser download — is not a decision to take sideways inside a validation task.

So the rendered half is **not shown**, and `#88` is not closed by this work.

What *was* done is the part that is decidable from source: the enumerable causes of horizontal overflow at 375 px, pinned as a re-runnable check. That is worth having on its own terms, because **three of those causes were live in the tree** when the check was written.

## 2. What the audit found — three hand-rolled amount islands

`components/ui/money.tsx` is the only element that carries `max-w-full min-w-0 overflow-x-auto` on the digit isolate. That combination is what lets a **width-unbounded** amount scroll *inside its own island* instead of widening its row and the page with it. `#120` established it for the detail page.

`BR-21` and `SEC-R3` make "width-unbounded" literal, not theoretical: there is no price ceiling, and `tests/auction/creation.sql` asserts that a **40-digit** starting price is accepted.

Three places rendered an amount without going through it.

### 2.1 🔴 `components/bidding/bid-history.tsx` — a guaranteed overflow

```tsx
<span className="flex shrink-0 items-center gap-2">   ← may not yield
  …
  <span className="num text-sm font-bold text-ink">
    <bdi>{formatSar(entry.amount)}</bdi> {SAR_SUFFIX}
  </span>
```

Two facts together, and the combination is what makes this the worst of the three: `shrink-0` tells the flex row that this side **may not give way**, and the inner span carries none of `Money`'s containment. A wide price therefore *had* to widen the `<li>` — the row had no other degree of freedom. The name on the other side has `min-w-0 truncate` and yields, which does not help, because the side that cannot yield is the one holding the unbounded value.

**Fixed:** the row may shrink (`min-w-0`), the badge and timestamp keep `shrink-0` because they are short and fixed, and the amount is the one part that yields — through `<Money>`.

### 2.2 🔴 `components/bidding/bid-panel.tsx` — `nowrap` with no escape

```tsx
/** One amount, rendered the only way amounts render (§3/§4: bdi + suffix out). */
function Price({ amount }: { amount: Sar }) {
  return <span className="num font-bold whitespace-nowrap">…</span>
}
```

The docblock asserted it rendered amounts "the only way amounts render". It did not: it added a `whitespace-nowrap` that `Money` deliberately does not have, and carried none of `Money`'s containment. The amount could neither wrap nor scroll, so it had to push its `<p>` past the viewport.

Its three call sites are the `below_starting_price`, `not_above_current` and `outbid_race` rejection messages — each quotes the current or starting price, so a contested wide-priced auction renders one.

**Fixed:** `Price` now returns `<Money amount={amount} size="sm" />`.

### 2.3 🟡 `components/auction/price-block.tsx` — latent, and fixed anyway

The `lastRaise` delta was a fourth bare `<bdi className="num">{formatSar(…)}</bdi>`. **Milder, and stated as such:** its parent is `flex-wrap`, so a wide delta wraps to its own line rather than dragging the hero price with it — and `lastRaise` is not passed by any caller yet (`#138` leaves the delta for a SQL-side value, because computing it client-side would be arithmetic on money). So this was latent rather than live. Fixed at the same time because the fix is identical and the next caller would activate it.

### 2.4 The pattern, not the three incidents

`#120` fixed exactly this defect on the detail page's amount island. The siblings survived because they were not the file under review.

That is the **third** time this shape has appeared in two days — `#143` (`ImageFrame` handled a missing image, not a failing one), `#136` (the type gate), and now this. Each time the copy under review was corrected and its sibling stayed. It is why check 1 below is a check and not a review note: a rule that has been broken three times is not enforced by anyone remembering it.

## 3. The check — and every probe made to fail

`./tests/integration/responsive-375.check.sh`, six checks, no browser or Docker needed.

| # | Check | Probe | Result |
|---|---|---|---|
| 1 | every rendered amount goes through `<Money>` | reintroduce the bid-history island | **FAIL, got=1** |
| 2 | no physical left/right spacing or alignment | add `ml-4` to `Card` | **FAIL, got=1** |
| 3 | no fixed width ≥ 375 px, no viewport units | add `w-[420px]` / `w-screen` | **FAIL, got=1** (both) |
| 4 | `Button`/`Input`/`AmountInput` set `min-h-tap` | — | passes |
| 5 | listing grid is single-column first | `grid-cols-1` → `grid-cols-2` | **FAIL, got=0** |
| 6 | the review panel's user-content cell can break | — | passes |

**A first attempt at probes 2 and 3 did not trip anything, and the check was not at fault** — the `sed` targeted `"rounded-lg` while the real class string is `border-rule rounded-lg`, so the probe never modified the file. Recorded because "the probe passed" and "the probe never ran" look identical from the outside, which is the same failure the `EXPECTED` guards in this repository exist to catch.

`money.tsx` is omitted from check 1's scan: it **is** the implementation of the rule, and flagging it would make the check unsatisfiable.

## 4. What is still not known

1. **Rendered layout at 375 px.** No browser. Nothing here measures a real box, and `document.documentElement.scrollWidth` was never read. This is the substance of `#88` and it is untouched.
2. **Inaccessible controls.** Check 4 asserts the four primitives set a 44 px target; it does not prove no control is overlapped, clipped, off-screen, or unreachable by keyboard on a real page.
3. **The surfaces INT-06 names individually** — register, login, password reset, profile, listing, detail, bid control, history, results — were not each walked. The check is codebase-wide, not per-surface.

**Who can close `#88`:** anyone with a browser at 375 px, or `INT-10` (`#92`) against the deployed app. The value of this document is that it shortens what they have to find by eye — three overflow sources that a walkthrough would have had to notice, and would only have noticed on an auction whose price happened to be wide.

---

*Measured 2026-08-14 on `main`. The check output and all five probes were executed. The browser absence was verified by launching both binaries, not assumed.*
