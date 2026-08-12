# STACK.md — Dalal front-end stack

**The technology decision for `S0-07` (web application scaffold), and how the design system lands in it.**

| Field | Value |
|---|---|
| Document | Front-end stack decision |
| Version | **1.0 — APPROVED / FINAL** (whole-team sign-off 2026-08-12) |
| Date | 2026-08-12 |
| Author | Mohammed (`m7ya505`) — owns `S0-07`, `S0-08`, `S0-09` |
| Constrains | [ARCHITECTURE.md](../ARCHITECTURE.md) §6.1, §18.5 · [PRD.md](../PRD.md) NFR-PERF-01/02, NFR-USA-06 |
| Related | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [tokens.css](tokens.css) |

> **APPROVED by the whole team on 2026-08-12** under TEAM.md Rule 14. Next.js (App Router) is the framework, React 19 the UI library, TypeScript strict the language, Tailwind CSS v4 the styling layer, deployed on Vercel against Supabase. **No framework change may be made without a new team decision recorded here.**
>
> Installed versions are pinned and recorded in `docs/scaffold-notes.md` §1.

---

## 1. The one real conflict: Next.js **or** Vite, not both

The request was "Tailwind + Next.js + Vite + React". Three of those four compose. Two of them are alternatives to each other.

| | Next.js | Vite |
|---|---|---|
| What it is | A React **framework** — routing, server rendering, server actions, its own bundler | A **bundler / dev server** for a client-side app |
| Server-side rendering | Built in | Not without adding a framework on top (TanStack Start, React Router v7 framework mode) |
| Vercel | The reference deployment target | Deploys fine, but as a static SPA |

**They are not layered.** Next.js already contains the job Vite does. A project cannot meaningfully run both as its app bundler.

### 1.1 Decision — **Next.js (App Router)**

Not preference. The architecture already ruled on the requirement Vite-as-SPA cannot meet:

> **ARCHITECTURE §6.1** — *"Server-side page rendering and initial data fetch — fast first paint; PRD NFR-PERF-01/02 require usable content in 3 s"*, and *"Session handling at the edge of the app"*.

A Vite SPA ships an empty shell, then fetches. On the listing page with up to 100 auctions (FR-LIST-09) that is the wrong side of a 3-second budget, and the auction detail page would render its price after a round trip — on a page whose entire premise is that the price is immediate.

Next.js also matches the rest of the architecture without adaptation: stateless functions (§18.5), no long-running process, the browser talking to Supabase Realtime directly rather than through the app (§14.1).

### 1.2 Where Vite still earns its place — **Vitest**

Vite is not dropped; it is used for what it is genuinely best at here.

| Tool | Role | Why it matters to this project |
|---|---|---|
| **Vitest** (Vite-powered) | Unit and integration tests | Every business rule must be testable in isolation from the UI (NFR-MNT-01) |
| **Playwright** | End-to-end and **two-browser realtime** tests | `SC-20`–`SC-24` and checkpoint `CP-2` cannot be verified from a diff — they need two real browsers on one auction |
| **Node test script** | The **concurrent-bid** test | `NFR-MNT-02` / `BID-20` — genuinely simultaneous bids asserting exactly one acceptance. This calls the database operation directly, no browser involved |

So: **Vite powers the test runner, Next.js powers the app.** Both are in the project; neither is bundling the other.

---

## 2. The stack

| Layer | Choice | Note |
|---|---|---|
| Framework | **Next.js, App Router** | Server Components by default; Client Components only where interactivity or realtime needs them |
| UI | **React 19** | `useOptimistic` is deliberately **not** used for bids — see §6 |
| Language | **TypeScript, `strict: true`** | With `noUncheckedIndexedAccess` |
| Styling | **Tailwind CSS v4** | CSS-first `@theme`. **No `tailwind.config.js`** — v4 does not use one |
| Variants | **CVA** + **tailwind-merge** | Typed component variants; `cn()` resolves class conflicts |
| Data | **`@supabase/ssr`** | Server client for RSC and route handlers, browser client for realtime |
| Forms | **React Hook Form** + **Zod** | The Zod schema is the *client mirror* only — the server is the authority (SEC-V6) |
| Tests | **Vitest** · **Playwright** · **Testing Library** | §1.2 |
| Lint | **ESLint** + the RTL guard in §4.3 | |

Pin exact versions at install time and record them in the `S0-07` issue — do not copy version numbers out of this document.

**No GitHub Actions** (GITHUB_PLAN §11.2). Vercel's own integration provides preview and production builds; tests run locally and are asserted in PR review.

---

## 3. Project shape

```text
app/
├── layout.tsx                 <html lang="ar" dir="rtl"> — set once, never overridden
├── globals.css                Tailwind + @theme + the token layer
├── page.tsx                   auction listing        (Mohammed)
├── auctions/[id]/page.tsx     auction detail shell   (Mohammed)
├── auctions/new/page.tsx      create auction         (Mohammed)
├── (auth)/…                   register · login · reset · profile (Abdulrahman)
components/
├── ui/                        S0-09 primitives       (Mohammed)
│   button.tsx · field.tsx · amount-input.tsx · alert.tsx · card.tsx
│   status-pill.tsx · skeleton.tsx · empty-state.tsx
├── auction/                   (Mohammed)
│   auction-card.tsx · price-block.tsx · countdown.tsx · product-content.tsx
└── bidding/                   (Rayan — Mohammed does not edit these)
    bid-panel.tsx · bid-history.tsx · outcome-banner.tsx · connection-indicator.tsx
lib/
├── cn.ts                      class merge
├── money.ts                   the ONLY place SAR is formatted or compared
└── supabase/                  server.ts · client.ts   (Abdulrahman)
```

The `components/auction` ÷ `components/bidding` split is `S0-13` made concrete: **create these files empty on day one** so both developers have somewhere of their own to start (TEAM.md §11).

---

## 4. RTL in this stack

### 4.1 Set it once

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="bg-ground text-ink font-ui antialiased">{children}</body>
    </html>
  );
}
```

Never set `dir` again anywhere else.

### 4.2 Tailwind is already logical — use that

Tailwind's logical utilities do the mirroring for free. The rule is simply to use them and never their physical siblings:

| Use | Never |
|---|---|
| `ms-4` `me-4` `ps-4` `pe-4` | `ml-4` `mr-4` `pl-4` `pr-4` |
| `start-0` `end-0` | `left-0` `right-0` |
| `text-start` `text-end` | `text-left` `text-right` |
| `border-s` `border-e` | `border-l` `border-r` |
| `rounded-s-lg` `rounded-e-lg` | `rounded-l-lg` `rounded-r-lg` |

Prefer `gap` over margins for sibling spacing — it is direction-agnostic by construction.

### 4.3 Make the rule mechanical, not a review habit

Add to `eslint.config.mjs`:

```js
{
  rules: {
    'no-restricted-syntax': ['error', {
      selector: 'JSXAttribute[name.name="className"] Literal[value=/\\b(ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r)-|\\b(left|right)-[0-9]|\\btext-(left|right)\\b|\\btracking-/]',
      message:
        'RTL: use logical utilities (ms/me, ps/pe, start/end, text-start/end, border-s/e, rounded-s/e). ' +
        'And never tracking-* on Arabic — letter-spacing breaks Arabic letter joining. See DESIGN_SYSTEM.md §2.1.',
    }],
  },
}
```

That single rule catches both classes of mistake — physical direction, and letter-spacing on Arabic — at the point of writing rather than at review.

### 4.4 Numerals are LTR islands

Every price, countdown and timestamp is a Latin-digit run inside Arabic text. Without isolation the decimal point and currency suffix reorder. The `<Money>` component in `lib/money.ts` wraps every amount in `<bdi>` so this cannot be forgotten.

---

## 5. Fonts — an upgrade over the style guide

`DESIGN_SYSTEM.md` §5 specifies system font stacks. That constraint came from the **artifact/CSP environment**, which blocks font CDNs. **The real application has no such constraint** and should self-host proper faces through `next/font`, which subsets them and serves them from the same origin with zero layout shift.

**Two faces, one superfamily:**

| Role | Face | Why |
|---|---|---|
| Arabic UI | **IBM Plex Sans Arabic** | Designed alongside the Latin family, so the two harmonise rather than clash |
| Latin numerals | **IBM Plex Sans** | Money is Latin digits only, and it has genuine tabular figures |

Giving money its own family is not decoration — it **guarantees column alignment** in bid history (FR-BID-15's strictly-increasing sequence has to be scannable), and it removes the risk of the Arabic face's digits lacking `tnum`.

```ts
// app/fonts.ts
import { IBM_Plex_Sans_Arabic, IBM_Plex_Sans } from 'next/font/google';

export const ui = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

export const num = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-num',
  display: 'swap',
});
```

**Verify before committing:** confirm the numeral face actually exposes `tnum` in the shipped subset. If it does not, fall back to a face that does. This is a small technical check of the same kind as ARCHITECTURE §22's spikes.

---

## 6. Two places to be careful with "advanced"

**`useOptimistic` must not be used for bid submission.** An optimistic update paints the bid as accepted before the server has ruled. Under concurrency the server rejects roughly half of contested bids (BR-12), so an optimistic UI would routinely show a bid landing and then snatch it back — and PRD FR-BID-16 requires the user to be told **definitively** whether their bid was accepted. Submit, wait for the decision, then render it. The bid button's loading state covers the gap.

**Realtime belongs in a Client Component that owns exactly one subscription.** The page shell stays a Server Component and renders the authoritative first paint from a server read; a single client component subscribes per auction and pushes updates in. Do not subscribe in more than one component on the same page — duplicate subscriptions are how a price appears to move backwards (RT-X5), and Mohammed must not add a second update mechanism alongside Rayan's (TEAM.md §10.4).

---

## 7. Open items — closed 2026-08-12

1. ~~Whole-team sign-off on Next.js~~ — ✅ **APPROVED 2026-08-12.**
2. ~~Vite's role~~ — ✅ **Confirmed: Vitest only.** Vite is never the app bundler.
3. **Font licence and `tnum` verification** (§5).
4. ~~Version pinning~~ — ✅ **Recorded** in `docs/scaffold-notes.md` §1.
5. Record the outcome in `S0-07`; `ARCHITECTURE.md` §24 deliberately left framework choice to the team, so no architecture change is needed — only a note that the choice was made.
