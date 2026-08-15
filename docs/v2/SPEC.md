# Dalal V2 — the spec

**What this is:** the delta between what is deployed today and what the approved prototype
shows. Not a second PRD (`CLAUDE.md` §2 — product decisions live in `PRD.md`). This
document says *what is being built and in what order*; the decisions it builds on are in
`docs/decisions/D-01` … `D-06`, each of which quotes the owner and names its own gaps.

| | |
|---|---|
| Date | 2026-08-15 |
| Source | `design-system/previews/*.html` — **the prototype is the spec** |
| Feasibility | measured, not assumed — [`docs/ai/local-model.md`](../ai/local-model.md) |
| Tickets | [`TICKETS.md`](TICKETS.md) |

---

## 1. The one-paragraph version

V1 is a working single-item auction: create, bid, close, winner, realtime, Arabic RTL,
money that never touches a float. V2 keeps every one of those rules and adds four things —
**a taxonomy** (13 categories), **a real create flow** (images first, up to ten, four
steps), **an assistant** (three features, not five — measurement killed two), and **sessions**
(a room of lots opened one at a time by a live host). The bid control becomes a **button**
carrying a seller-set amount. The design system stops being a folder of HTML previews and
becomes components.

## 2. What does NOT change — read this first

Everything in `CLAUDE.md` survives V2 unchanged. The four that a V2-sized diff is most
likely to break, and where each is anchored:

| rule | anchored in |
|---|---|
| **No floating point on an amount, no ceiling, one formatter, `::text` on every read** | `tests/guards/run.sh`, `docs/contracts/S0-12-money.md` |
| **No bid increment, no reserve, no leading-bidder rejection on the server** | `tests/integration/excluded-features.check.sh`, and D-01 §2 |
| **Anti-sniping: 15 s → +30 s, cap 20, the cap is a `CHECK`** | `tests/bidding/closing.sql` |
| **Email never public; identity from the verified server session** | `CLAUDE.md` §6 |

Three of the new features press directly on these, and each is called out where it does:

- the **bid button** (D-01) looks like a minimum raise and is not — §2 of that record
- the **deposit** (D-05) adds a *new rejection reason*, and a rejected bid must not extend
- the **AI** (D-04) is kept away from money by measurement as much as by rule — the model
  got the amount wrong ten times out of ten

## 3. The four things being added

### 3.1 Categories — [D-02](../decisions/D-02-categories.md)
Thirteen main sections, 110 sub-sections, sourced from حراج and four Gulf auction platforms
read directly, with everything that is a classified ad rather than an auction removed.
`misc` («منقولات متنوعة») exists on purpose: a closed taxonomy turns a legitimate seller
away. **The category changes which extra fields the form asks for**, and those fields are
optional and never block publishing.

### 3.2 The create flow — [D-06](../decisions/D-06-images-and-create-flow.md)
Four steps: **الصور · التفاصيل · المزايدة · المراجعة**. Up to 10 images, JPG/PNG/WebP,
5 MB each, drag to reorder, **first is the cover**. Images are step 1 for two stated reasons
and the second one is structural: **the assistant cannot help before it has seen the thing.**
The review step renders the *real card component*, not a text summary.

### 3.3 The assistant — [D-04](../decisions/D-04-ai-product-surface.md)
Five features were approved. **Three are being built:**

| | | |
|---|---|---|
| ✅ | **يكتب الإعلان** | images → title, description, category. Vision + `json_schema`, ~11 s |
| ✅ | **يفهم البحث** | Arabic → editable filter chips. **Category and city from the model; the price band from a deterministic parser** |
| ✅ | **يجاوب عن القطعة** | from the seller's description only. «ما أعرف» must be easy |
| ❌ | **يصلّح الصور** | not an LLM task at all — needs image processing. **Owner decision pending** (D-04 §5.1) |
| ❌ | **يقترح سعر البداية** | not the LLM's job — it is a `percentile_cont` query. Exact, instant, free, and it cannot hallucinate an amount |

Connection: LM Studio already speaks the OpenAI API. Three env vars —
`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, **never `NEXT_PUBLIC_`** — are the whole
integration, and swapping the free local model for a hosted one changes only those three
values. The open question is *where the model runs in production*, because **Vercel cannot
reach `127.0.0.1`** — three options in [`local-model.md`](../ai/local-model.md) §4.

### 3.4 Sessions — [D-03](../decisions/D-03-sessions.md), and the deposit — [D-05](../decisions/D-05-deposit.md)
A room of lots opened one at a time, built before the date and run live from a host control
room. **A session is a kind of auction, not a kind of account** — any individual or company
can create one. Each lot is a complete auction with a **duration, not an absolute end time**.
The deposit is **simulated** — no payment gateway, no card field, no amount that moves,
anywhere — and it unlocks **bidding, not watching**.

Sequenced **last**, by the owner: *«داخلة، بس آخر شي»*.

## 4. The six questions that must be answered before the code they block

Each of these is a place where `CLAUDE.md` §8's failure mode is waiting — *a confident
session filling a gap with something reasonable*. None of them should be answered by
whoever picks up the ticket.

| # | question | in | blocks |
|---|---|---|---|
| Q1 | **How are category-specific fields stored?** columns / `jsonb` / side table | D-02 §4.1 | V2-A1, and every later migration |
| Q2 | **Is «أوقف مؤقتًا» allowed to freeze a lot's clock?** `CLAUDE.md` §5 says `end_time` moves forward only, in 30 s quanta, only inside `place_bid`. **A pause as drawn contradicts a rule that has a test** | D-03 §4.1 | V2-A11, V2-B11 |
| Q3 | **Is image editing (AI point 2) in scope now that it is known not to be an LLM?** | D-04 §5.1 | V2-B7 scope |
| Q4 | **Where does the model run in production?** dev-only / tunnel / hosted | `local-model.md` §4 | V2-A6 deployment, not its code |
| Q5 | **What happens to a deposit when the session ends?** | D-05 §4.1 | V2-A13, V2-B10 |
| Q6 | **Is at least one image required?** AI point 1 cannot run with zero | D-06 §5.1 | V2-A2, V2-B7 |

**Q1 and Q2 are the expensive ones.** Q1 is a migration that is painful to reverse; Q2 is a
contradiction with an existing asserted invariant, and the wrong answer makes
`tests/bidding/closing.sql` a liar.

## 5. How the work is split across two accounts

Two Claude sessions that cannot see each other, working the same repository — which is
exactly the condition `CLAUDE.md` was written for. The split is **by file surface**, so the
two tracks can run at full speed without touching the same files:

| | **Track A — the spine** | **Track B — the surface** |
|---|---|---|
| owns | `supabase/migrations/`, `lib/`, `tests/`, `app/api/` | `app/(routes)`, `components/`, `design-system/`, `styles/` |
| builds | schema, server functions, RLS, the AI adapter, guards, tests | tokens, components, screens, RTL, states |
| proves | a SQL suite or a `.check.mjs` | a preview that matches the prototype, INT-06 at 375 px |

**Where they meet, a contract goes first.** `docs/contracts/` already exists for exactly
this. Track A writes the contract — it owns the data shape — and Track B builds against the
contract rather than against Track A's half-finished code. A ticket whose contract is not
merged is not startable; the table in `TICKETS.md` marks these.

The tracks are **not** "backend and frontend" as job titles. They are two disjoint sets of
files, chosen so that two sessions never resolve the same conflict — `CLAUDE.md` §7:
*whoever resolves a conflict is making a decision.*

## 6. The order

```
  PHASE 0   unblock            #155 lands, main is green            both tracks blocked
  PHASE 1   foundations        A: categories, images, increment     ── parallel ──
                               B: tokens, card, topbar, picker
  PHASE 2   the create flow    A: server action   B: the wizard     needs Q1, Q6
  PHASE 3   the assistant      A: adapter + 3 tasks  B: surfaces    needs Q3, Q4
  PHASE 4   sessions           the largest, and last                needs Q2, Q5
```

Phase 1 is fully parallel and is where the two accounts pay off most. Phases 2–4 have one
Track A ticket that Track B waits on, and the contract is what shortens that wait to
roughly zero.

## 7. What "done" means for a V2 ticket

Unchanged from V1, and non-negotiable:

1. **CI green** — `static` and `database`, both jobs (`CLAUDE.md` §9)
2. **A new rule ships with the thing that enforces it.** A `CHECK`, a guard check, or a
   test whose *name is the rule*. Not a follow-up issue — D-01 §3: *a follow-up issue is a
   promise, and promises are not mechanisms*
3. **A guard that goes red is answered in a PR, never with an ignore** (`CLAUDE.md` §9)
4. **PR, one approval, `main` protected** (§7)
5. **Every gap the ticket did not fill is written into its decision record's "Still open"**
   — that list is the mechanism, and a ticket that quietly answers one has broken it
