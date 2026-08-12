# DESIGN_SYSTEM.md — Dalal

**The shared visual and interaction system for the Dalal web application.**

| Field | Value |
|---|---|
| Document | Dalal Design System |
| Version | **0.2 — proposed, not yet agreed. RTL-first** |
| Date | 2026-08-12 |
| Author | Mohammed (`m7ya505`) — shared UI primitives are his under [TEAM.md](../TEAM.md) §11 |
| Status | **Draft for Sprint 0.** Needs review by Abdulrahman and Rayan before it becomes binding |
| **Direction** | **Right-to-left. The product interface is Arabic** — see §2 |
| Delivers | `S0-09` (shared responsive UI primitives) · input to `S0-12` (SAR display format) · input to `S0-13` (detail page component split) |
| Sources of truth | [PRD.md](../PRD.md) v3.0 · [TEAM.md](../TEAM.md) v2.0 · [ARCHITECTURE.md](../ARCHITECTURE.md) v1.1 |
| Files | `design/tokens.css` — the tokens · `design/styleguide.html` — the living style guide |

> **This document does not decide product behaviour.** Where it appears to, it is restating a PRD requirement and citing its ID. Anything genuinely new here is marked **PROPOSED** and needs a team decision ([TEAM.md](../TEAM.md) Rule 16).
>
> This file stays in English to match the other four repository documents. **The product UI is Arabic.**

---

## 1. Why this exists

`TEAM.md` §12 (S0-5) and `GITHUB_PLAN.md` S0-09 both require shared UI primitives to be built **once, before feature work**, so the product does not end up with three visual languages. Three developers each inventing a button, an input, an error state and a price format is the failure mode this file prevents.

It also carries requirements no primitive library gets for free:

| Requirement | What it forces on the design |
|---|---|
| **NFR-USA-04** — the current price is the most visually prominent element on the detail page | Money has its own type scale, separate from the text scale, so prominence is structural rather than a per-page judgement |
| **NFR-USA-11** — the inclusive/exclusive distinction in the minimum bid must be unmistakable | "سعر البداية" and "المزايدة الحالية" are **two different components**, not one component with two labels |
| **RT-X1 / RT-X2** — a live update must be perceptible but must never disrupt | A defined update treatment: flash + direction arrow + label, never a dialog, never a focus change |
| **NFR-USA-10** — changes must be perceivable without colour | Every state carries a shape or a word as well as a hue |
| **NFR-USA-06 / SC-49** — fully usable at 375 px | Mobile is the base layer of every component, not a breakpoint bolted on |
| **NFR-DAT-08** — one price format everywhere | A single money component; no ad-hoc formatting anywhere in the codebase |
| **SC-67** — no payment, contact or shipping surface anywhere | An explicit "never build" list in §11 that the excluded-features audit (INT-08) can be run against |

---

## 2. Direction and language — **AGREED by the team, 2026-08-12**

> **Dalal's interface is Arabic and right-to-left.** `dir="rtl"` is set once on `<html>` and is never overridden per component.

**Relationship to the PRD.** `PRD.md` §4.2 lists "non-English-speaking users as a served segment" as not targeted, and §19.7 excludes **multi-language support**. Neither forbids Arabic — they forbid *translation infrastructure* and a second locale. A single-language Arabic product is fully compatible with both, and matches a Saudi platform named دلّال pricing in SAR.

**✅ Recorded 2026-08-12.** The decision now lives in `PRD.md` as **BR-41** (Arabic RTL), **BR-42** (Western digits, LTR isolation) and **§1.2**, with **Q16** in the decision register. §4.2, §19.7 and A-U10 were reconciled. `PRD.md` is the source of truth; this file describes how the decision is rendered.

**What stays English:** the four repository documents, code, identifiers, commit messages, and this file.

### 2.1 The RTL rules that are not optional

| Rule | Why |
|---|---|
| **Use CSS logical properties everywhere** — `margin-inline-start`, `padding-inline`, `border-inline-start`, `inset-inline-end`, `text-align: start` | Physical `left`/`right` silently break the mirror. Logical properties make the layout direction-agnostic, so a component is written once |
| **Never apply `letter-spacing` to Arabic** | Arabic letters join. Tracking breaks the joins and the word renders as loose disconnected glyphs. There is deliberately no `--tracking-*` token in `tokens.css` |
| **Never rely on `text-transform: uppercase`** | Arabic has no case. Eyebrow labels are differentiated by weight, size and colour instead |
| **More leading than a Latin scale** | Arabic ascenders, descenders and optional diacritics need roughly 15% more line-height. The `--lh-*` tokens are already set for Arabic |
| **Isolate every numeric run** with `<bdi>` or `dir="ltr"` | Numerals are Western Arabic (0–9) and therefore LTR islands inside RTL text. Without isolation `250.00 SAR` and `2د 04:11:38` reorder their punctuation. The `.num` class in `tokens.css` does this |
| **Mirror directional icons only** | Back arrows, chevrons, progress arrows mirror. A clock, a checkmark, and the **price-rise `▲`** do not — `▲` is vertical and mirroring it would be a bug |

### 2.2 Numerals — **PROPOSED**

Use **Western Arabic numerals (0 1 2 3)**, not Arabic-Indic (٠ ١ ٢ ٣).

Reason: prices must align in a column in bid history and must be scannable as a strictly increasing sequence (FR-BID-15). Western digits have reliable tabular figures in every system font; Arabic-Indic digits do not, and mixed digit systems across a page would breach the one-format rule (NFR-DAT-08). This matches how Saudi digital products overwhelmingly render money.

---

## 3. Design principles

Four, derived from the product rather than invented for it.

**1. The price is the page.** On the auction detail page the current price outranks the product name, the image, and the seller. Everything else composes around it. This is NFR-USA-04, and it is the reason money has a dedicated type scale.

**2. State is legible before it is read.** نشط and منتهي, leading and outbid, accepted and rejected must be distinguishable at a glance and without colour vision — by shape, weight, position and wording together. Ended auctions are deliberately de-energised: slate, not green.

**3. A live update never takes control.** The signature moment of Dalal is someone else's bid landing on your screen. It must be impossible to miss and impossible to be hurt by: it never clears a typed amount, never moves focus, never scrolls, never opens anything (FR-RT-06, RT-X2). The user always decides what to bid next.

**4. Rejection is information, not failure.** Eight distinct rejection reasons exist (ARCHITECTURE §13.5). Each gets specific wording that says what happened and what to do. Losing a concurrency race is styled differently from a too-low bid, because the user did nothing wrong (EC-01, SC-18).

---

## 4. Colour

Six named values carry the whole system. Full token list in `tokens.css`.

| Role | Light | Dark | Means |
|---|---|---|---|
| **Paper** | `#F4F6F4` | `#0D1210` | Ground. A neutral biased toward the brand green, not a default grey |
| **Ink** | `#131A16` | `#E7ECE9` | Text |
| **Dalal green** | `#0F6B4F` | `#35A87C` | Brand, primary action, live, bid accepted, you won |
| **Brass** | `#B4611A` | `#D98A3E` | Attention: you are outbid, ending soon, connection degraded |
| **Reject** | `#B3261E` | `#D9544A` | Rejected bids and errors — **nothing else** |
| **Slate** | `#5A6570` | `#8B96A0` | Ended, terminal, no-bid outcomes |

### 4.1 Why green does double duty

Dalal green is both the brand and the success signal. In an auction those are the same register: *the price is live* and *your bid was accepted* are the same good news. Collapsing them keeps the palette to four semantic hues instead of five, and it means the primary button and the accepted-bid confirmation reinforce each other rather than competing.

Brass then carries **all** urgency — outbid, ending soon, stale connection — so the single question "does this need me right now?" has one colour. Reject red is reserved strictly for a rejected bid or a system error, which keeps it meaningful.

### 4.2 Rules

- **Never use colour alone** to carry state (NFR-USA-10). Every pill has a word, every price change has an arrow, every error has an icon and a sentence.
- **Text on tinted grounds uses the `-text` token, not the fill token.** `--c-urge` fills a button; `--c-urge-text` writes on a light ground. Only the `-text` variants are verified for AA.
- **Ended is not an error.** It is slate. An auction ending is the normal, expected outcome, including with zero bids (BR-09).
- All pairs used for text meet **WCAG 2.1 AA** (NFR-USA-09). The style guide renders a contrast table; re-check it if any value changes.

---

## 5. Typography

Two roles plus a documentation-only mono. No webfonts — the CSP environment blocks font CDNs, and a silent fallback is worse than a considered system stack. The stacks resolve to a real Arabic face on every target platform: **SF Arabic** on Apple, **Segoe UI** / Tahoma on Windows, **Noto Naskh/Sans Arabic** on Android.

| Role | Used for |
|---|---|
| **`--f-ui`** | Everything: headings, labels, buttons, body copy |
| **`--f-num`** | Prices, countdowns, timestamps, amounts — same family, always with `tabular-nums lining-nums` and LTR isolation |
| **`--f-mono`** | Token names and values in documentation. **Never in product UI** |

There is no serif role. A Latin serif has no Arabic coverage, and there is no dependable system Arabic serif; faking one produces a different fallback on every machine. Hierarchy comes from weight, size and colour instead, which is also what the no-uppercase constraint forces.

### 5.1 The money scale is separate

| Token | Size | Where |
|---|---|---|
| `--money-hero` | 44 px | Current price, auction detail page |
| `--money-lg` | 26 px | Final bid in the outcome banner |
| `--money-md` | 19 px | Price on a listing card |
| `--money-sm` | 15 px | Bid history row |

Money is never sized from `--t-*`. Keeping the scales separate is what makes NFR-USA-04 true by construction rather than by eyeballing each page.

**Every price uses `tabular-nums` and is wrapped in `<bdi class="num">`.** In bid history the amounts sit in a column and must align on the decimal; a proportional `1` against a `0` breaks the column and makes a rising sequence hard to scan. The `bdi` is what keeps the currency suffix and the decimal point on the correct side inside RTL text.

### 5.2 The SAR format — **FINAL, approved 2026-08-12**

> **Format: `1,250.00 SAR`** — grouped thousands, **always two decimals**, a normal space, then the Latin indicator `SAR`. Written in markup as `<bdi class="num">1,250.00</bdi> SAR`.
>
> Produced by **one formatter only**: `formatSar()` in `lib/money.ts`. No component formats a price itself.

Two decisions inside that:

1. **Always two decimals.** NFR-DAT-08 requires that the same amount never appears formatted two ways. Since bids of `100.01 SAR` are valid (BR-32, no increment), showing `100 SAR` elsewhere would be two formats for one currency. Always-two-decimals is the only self-consistent choice. The PRD's prose examples (`Starting Price: 100 SAR`) illustrate the label, not the format.
2. **The Latin `SAR`, not `SAR`.** This document originally proposed `SAR`. The team **decided against it on 2026-08-12**: `FR-CREATE-13` writes the indicator as `SAR` literally, and one Latin indicator keeps the client formatter byte-identical to the server's across a mixed-script interface. Recorded as **BR-43**. `SAR` must not appear as a price indicator anywhere.

**Agreed with Rayan as part of S0-12 on 2026-08-12.** He owns bid amounts and current-price correctness; the display half is settled here and mirrored in `docs/contracts/S0-12-money.md` §7. Grouping was added to that contract by the same decision — see its amendment block.

The term **"Demo Points" is prohibited** (PRD §19.0). Prices are SAR.

---

## 6. Space, radius, elevation, motion

- **Space** — 4 px base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. Lay groups out with flex/grid `gap`, not per-element margins — `gap` is direction-agnostic, which matters more in RTL than it does in LTR.
- **Radius** — `6` inputs and pills-in-rows · `10` buttons and cards · `14` panels and sheets · `999` status pills. Asymmetric radii must use logical corners (`border-start-start-radius`), not physical ones.
- **Elevation** — three levels. `--e-1` cards at rest, `--e-2` a raised panel, `--e-3` an overlay. Shadows stay vertical (no horizontal offset) so they need no mirroring. The auction detail page uses `--e-1` only; nothing on it should compete with the price.
- **Motion** — `120ms` press/hover, `200ms` enter/leave, `320ms` the price flash. Anything that slides in must slide from the **inline-end** (the right, in RTL) — use logical transforms, not a hard-coded `translateX(-…)`. Under `prefers-reduced-motion` all durations collapse to `0ms` and the price flash falls back to its arrow and label, which is why those are never optional.

## 7. Focus and hit targets

- Every interactive element takes a visible two-ring focus state (`--focus-ring`): a surface-coloured inner ring so it reads on any background, then the focus colour. Never `outline: none` without a replacement (NFR-USA-08).
- Minimum hit target **44 × 44 px** (`--tap-min`), enforced at 375 px.
- Focus order follows visual order, which in RTL means right-to-left then down. The bid input is the first focusable element inside the bid panel.
- **A realtime update must never move focus** (RT-X2). Live regions announce politely; they do not steal.

---

## 8. Component inventory

Ownership follows [TEAM.md](../TEAM.md) §11's split of the auction detail page. **Neither developer edits the other's component files.**

### 8.1 Primitives — Mohammed, built in S0-09

| Component | Variants / states | Notes |
|---|---|---|
| **Button** | primary · secondary · ghost · danger; `sm` `md` `lg`; hover, active, focus, disabled, loading | Full width below 480 px. Loading state keeps the label and disables submit — it must be impossible to double-submit a bid or an auction (EC-21) |
| **Text input** | rest, focus, error, disabled | Error state pairs a red border **and** a message; never border alone |
| **Amount input** | as above, plus a `SAR` affix on the inline-end and tabular figures | Numeric keypad on mobile. The input's own content is LTR while the label is RTL. Never auto-corrects or rounds the user's entry (FR-BID-17) |
| **Form field** | label, optional hint, error | Reports **every** failing field at once and preserves entered values (FR-CREATE-12) |
| **Card** | rest, hover, link | The listing card is built on it |
| **Alert** | info · success · error · **race** | `race` is the concurrency-loss variant — brass, not red |
| **Image frame** | loaded, loading, failed | Failure shows a placeholder and the auction stays fully usable (EC-18, FR-DETAIL-04) |
| **Skeleton** | line, block, card | Used while the detail page loads |
| **Empty state** | listing, history, profile | Listing empty state prompts creation when signed in (FR-LIST-08) |

### 8.2 Auction components

| Component | Owner | Satisfies |
|---|---|---|
| **Status pill** — `نشط` / `منتهي` | Mohammed | FR-DETAIL-07, FR-LIST-02, NFR-USA-05 |
| **Price block** — سعر البداية vs المزايدة الحالية | Mohammed builds the region; **Rayan supplies the value** | FR-DETAIL-05, FR-DETAIL-06, BR-13, ARCH §9.4 |
| **Countdown** — normal / ending soon / final minute / ended | Mohammed | FR-DETAIL-08, FR-LIST-04, RT-P3 |
| **Auction card** (listing) | Mohammed | FR-LIST-02, FR-LIST-03 |
| **Minimum-bid hint** | Rayan | FR-BID-10, **NFR-USA-11** |
| **Bid panel** — 4 viewer states | Rayan (mounted in Mohammed's shell) | FR-DETAIL-14 → 17, SC-07 |
| **Bid history** | Rayan | FR-DETAIL-10 → 12, FR-BID-23, BR-40 |
| **Outcome banner** — won / winner is X / no bids | Rayan | FR-END-14, FR-END-16, FR-DETAIL-18 → 21a |
| **Live connection indicator** | Rayan | FR-RT-11, RT-R2, NFR-RT-06 |

### 8.3 The two price blocks

This is the component most likely to be got wrong, so it is specified tightly.

**No bids yet** — the amount is an *invitation*, and a first bid may equal it (BR-29):

```text
سعر البداية
100.00 SAR
لا توجد مزايدات · أول مزايدة بمبلغ 100.00 SAR بالضبط مقبولة
```

**One or more bids** — the amount is a *threshold*, and the next bid must beat it (BR-28):

```text
المزايدة الحالية
250.00 SAR
4 مزايدات · المتصدر: عمر
```

They are visually distinct, not just differently labelled: the starting-price block is quieter (a rule, a muted eyebrow), the current-bid block carries the brand green and the bid count. A user must never have to read carefully to know which rule applies to them.

The matching hint in the bid panel:

| State | Hint | Boundary |
|---|---|---|
| No bids | **المزايدة تبدأ من 100.00 SAR** | inclusive |
| Has bids | **أدخل مبلغاً أكبر من 250.00 SAR** | exclusive |

The two hints use different verbs — تبدأ من versus أكبر من — so the inclusive/exclusive difference survives even when the numbers happen to look similar (NFR-USA-11).

### 8.4 Countdown states

| Remaining | Treatment |
|---|---|
| > 1 hour | Ink, tabular, `2د 04:11:38` |
| ≤ 10 minutes | Brass |
| ≤ 60 seconds | Brass, with a slow 1 s pulse on the seconds only — and the word `ينتهي الآن` |
| Ended | Slate, replaced by the absolute close time |

The countdown ticks client-side from the **server-supplied** end time (RT-P3, BR-19). It is display only; it never decides anything. The end time never changes — there is no anti-sniping extension (BR-36), so the countdown never jumps.

The whole `2د 04:11:38` run is LTR-isolated; only the unit letters are Arabic.

### 8.5 Bid panel — the four viewer states

`SC-07` is a matrix test, so the component is built as an explicit four-way switch, not a pile of conditionals:

| Viewer | Renders |
|---|---|
| Not signed in, auction Active | Sign-in prompt in place of the control (FR-DETAIL-15). The bid amount is **not** carried through sign-in (FR-AUTH-11) |
| Signed in, not the owner, Active | Amount input + minimum-bid hint + submit |
| The owner, Active | No usable control, plus a plain statement that owners cannot bid on their own auction (FR-DETAIL-16, BR-02) |
| Anyone, Ended | No control at all. The outcome banner takes its place (FR-DETAIL-17) |

---

## 9. The realtime update treatment

The one interaction spec that cannot be conveyed by a static component sheet. Demonstrated live in `styleguide.html`.

When another user's accepted bid arrives (within 2 s — FR-RT-03):

1. The price value **cross-fades to the new amount** over 320 ms.
2. A **`▲` arrow and the delta** appear beside it for 4 s, then fade. The arrow is the non-colour channel (NFR-USA-10). **It is vertical and never mirrors.**
3. The block's background flashes brand-weak and settles back.
4. The new row **slides into the top of bid history from the inline-end**; the previous highest loses its marker (RT-X4).
5. The minimum-bid hint recalculates.

And, without exception:

- The user's typed amount is **not cleared or changed** (FR-RT-06).
- Focus is **not moved**. Scroll position is **not changed**.
- If the new price now exceeds what they typed, an inline note says so — **their entry is left alone** (FR-RT-07, RT-X3).
- The price **never animates downward.** A later, higher state always wins over an out-of-order arrival (FR-RT-10, RT-X5).
- A duplicate delivery has no visible effect (FR-RT-09, RT-R5).

Under `prefers-reduced-motion` steps 1 and 3 become instant swaps. Steps 2, 4 and 5 are unchanged — which is exactly why the meaning was never carried by the animation.

### 9.1 Connection states

| State | Treatment |
|---|---|
| Live | A small brand-green dot and the word `مباشر` |
| Reconnecting | Brass dot, `جارٍ إعادة الاتصال…`, surfaced within 10 s of detection (NFR-RT-06) |
| Offline | Slate dot, `التحديث المباشر غير متاح`. Loaded data stays readable; the bid control is marked stale but a submitted bid is still validated server-side (FR-RT-13, RT-R2) |

Wording is informative, never alarming (FR-RT-11). `التحديث المباشر غير متاح` — not `انقطع الاتصال!`.

---

## 10. Responsive

375 px is the **base layer**, not a breakpoint (NFR-USA-06, SC-49, INT-06).

| Width | Layout |
|---|---|
| **375–639** | Single column. Buttons full width. Listing is a one-column stack. On the detail page the order is: image → status + countdown → **price** → bid panel → product content → history |
| **640–1023** | Listing becomes two columns. Detail page stays single column; the price and bid panel stay above the fold |
| **≥ 1024** | Listing three columns. Detail page splits: image and product content on the **inline-start** side, a sticky **inline-end** rail holding price, countdown, bid panel and history |

Rules that hold at every width:

- No horizontal page scrolling, ever. Wide content (a long bid history, a very large amount) scrolls inside its own container.
- **A very large bid must not break the layout** (EC-25, SEC-R3). Money blocks clamp their font size and allow the value to wrap rather than overflow. No ceiling may be introduced to avoid a layout problem — handle the value.
- Long product names and descriptions wrap; they never truncate the price out of view (EC-20).
- The price and the bid control are reachable without scrolling past the fold on a 375 × 812 viewport.
- Every grid and stack uses logical properties, so the mirror is automatic and there is no second RTL stylesheet to maintain.

---

## 11. Never build

Design-side companion to PRD SD-05 and TEAM.md §26. `INT-08` audits every screen against this list; **if a component for any of these exists, the audit has already failed.**

No edit-auction screen or control · no cancel control or `Cancelled` state styling · no reserve-price field · no bid-increment stepper (`+5 / +10 / +50`) · no maximum-price or bid-ceiling validation · no anti-sniping "time extended" treatment · no email-verification screen or "unverified" badge · no admin surface · **no payment, checkout, card, wallet, refund, shipping, or fulfilment UI** · no message, chat, or contact-the-seller control · no ended auctions in the main listing · the term **"Demo Points"**.

The winner and seller result views in particular must present **no next step** — no button, label, or hint suggesting payment, collection, contact or delivery (FR-DETAIL-21a, FR-END-17a, SC-67). The result is the end of the flow.

---

## 12. Accessibility checklist

Run before any UI pull request is opened.

- [ ] `dir="rtl"` on `<html>`, `lang="ar"` set, and no physical `left`/`right` CSS anywhere
- [ ] Every numeric run is wrapped in `<bdi class="num">` — no reordered punctuation
- [ ] No `letter-spacing` applied to any Arabic text
- [ ] Text and controls meet WCAG 2.1 AA contrast (NFR-USA-09)
- [ ] Every state is carried by shape or wording as well as colour (NFR-USA-10)
- [ ] Every control is keyboard reachable with a visible focus state (NFR-USA-08)
- [ ] Hit targets ≥ 44 px at 375 px width
- [ ] The price region is a polite live region; updates announce without stealing focus
- [ ] The countdown updates visually at 1 Hz but announces at coarse intervals only
- [ ] `prefers-reduced-motion` is honoured and no meaning is lost when it is
- [ ] Form errors are associated with their fields and all reported at once
- [ ] Verified at desktop **and** 375 px (GITHUB_PLAN §12.1)

---

## 13. Files and handoff

```text
design/
├── tokens.css         the tokens + RTL base — imported once, read by every component
├── styleguide.html    the living style guide, self-contained, RTL
└── DESIGN_SYSTEM.md   this document
```

**How to use it.** Import `tokens.css` once at the application entry point (S0-07). Build the S0-09 primitives against the tokens only — no hex, px or ms literals, and no physical direction properties, in component CSS. When a component is built, add it to `styleguide.html` so the guide stays the reference rather than becoming stale.

**Open items before this is binding:**

1. **Arabic RTL** (§2) — **agreed.** Remaining work is documentary: reword `PRD.md` §4.2 and §19.7 and add the decision to the register (§21.1).
2. ~~SAR display format needs agreement~~ — ✅ **FINAL: `1,250.00 SAR`**, always two decimals, grouped, Latin indicator (§5.2, PRD BR-43). Agreed in **S0-12** on 2026-08-12.
3. **Western vs Arabic-Indic numerals** (§2.2) — proposed Western.
4. **Colour direction** — the green/brass pairing is a proposal. Retuning it means editing `tokens.css` and nothing else.
5. **Detail page component split** — §8.2's ownership column must match what Mohammed and Rayan actually agree in **S0-13**.
6. **Framework** — this system is framework-neutral CSS. It survives whatever S0-07 chooses.

Update this file whenever a primitive changes. An inaccurate design system is worse than none — the same rule `TEAM.md` applies to itself.
