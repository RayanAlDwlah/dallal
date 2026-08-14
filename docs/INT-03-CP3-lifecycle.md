# INT-03 / CP-3 — full lifecycle, measured in real browsers

| Field | Value |
|---|---|
| Checkpoint | `TEAM.md` §14 **CP-3**, issue **#85** — *"An auction runs, takes bids, closes automatically, and shows the correct winner to seller, winner, and other viewers · the zero-bid auction closes cleanly with no winner · all three developers present"* |
| Traceability | **SC-25 → SC-37**, `FR-END-03/10/13/14/16`, `FR-RT-08`, `SC-23` |
| Status | **MEASURED 2026-08-14 ~20:32–20:48 UTC** against `dallal-dev` (`cjrnakdigcwnsrvtyqhy`) through the Vercel preview `dallal-4oragm1t8-rayan-saleh1.vercel.app`. **Nothing re-runs these numbers.** |
| Verdict | The **behaviour** half passes: auctions close unattended, the winner and final price are correct, the zero-bid case closes cleanly, and the outcome reaches every open viewer live. **Two Must-level presentation gaps were found** (§4, F-1 and F-2). |
| Honest limit | **The "all three developers present" criterion is NOT satisfied.** This was run solo by @RayanAlDwlah. That clause of #85 remains open regardless of everything below. |

---

## 1. The rig

Three synthetic identities, minted **programmatically** with `supabase.auth.signUp` in
Node and transplanted into the browser as an `sb-<ref>-auth-token` cookie. **No password
was typed into any form.** Same method as CP-2 (#84).

| Role | Display name | User id |
|---|---|---|
| Seller | `cp3_sell1` | `373244fb-5964-4956-9eab-9c49daf37225` |
| Winner | `cp3_winner` | `4b6c3347-5db3-4e2f-95e8-9beb41d1a6c4` |
| Other viewer | `cp3_other` | `536f54df-dbb7-4a33-b041-8946d36705d9` |

Two Chrome tabs, each carrying the server render produced by whichever identity's cookie
was in the jar at load time. The instrument in each tab is a **`MutationObserver`**, not a
polling loop — a `setInterval` reading `innerText` forces a reflow and inflates the
latency it reports (measured on CP-2). Each observer records the wall-clock instant an
outcome string first enters the DOM, together with the text of the status card at that
instant.

Three auctions were run:

| | id | starting | end_time (UTC) | outcome |
|---|---|---|---|---|
| **A** | `2976b00b-ab18-4ef9-a956-e107e854b4e9` | 100.00 | 20:37:39.000 | contested, 4 bids |
| **B** | `bf92bce7-dffa-4975-87e8-526a0330d78b` | 250.00 | 20:37:39.000 | zero bids |
| **C** | `c01abf55-2ef9-4df5-bb60-65a6aba8d6ea` | 75.00 | 20:47:46.310 | zero bids, **watched live** |

---

## 2. What the database did

### Closing, unattended — SC-25, SC-26, FR-END-03

| Auction | `end_time` | `closed_at` | delay |
|---|---|---|---|
| A | 20:37:39.000 | 20:37:41.209735 | **+2.21 s** |
| B | 20:37:39.000 | 20:37:41.207162 | **+2.21 s** |
| C | 20:47:46.310 | 20:47:57.176737 | **+10.87 s** |

All three inside the 30 s Must. The spread is the `pg_cron` sweep period (`'15 seconds'`,
`20260814000000_bid15_closing_and_extension.sql:424`) — a close lands somewhere in the
sweep window, and 10.87 s is a normal draw, not a slow one. **n = 3**; SC-25's "across many
auctions" is met by `tests/bidding/sweep.sql`, not by this run. B closed with **no client
of any kind connected to it** — SC-26.

### The winner is the highest bidder — SC-29, SC-30

Auction A's history, read back through `public.bid_history`:

| `seq` | `display_name` | `amount` |
|---|---|---|
| 4 | `cp3_winner` | `1250.75` |
| 3 | `cp3_other` | `200.00` |
| 2 | `cp3_winner` | `150.50` |
| 1 | `cp3_other` | `100.00` |

Recorded: `winner_id = 4b6c3347…` (`cp3_winner`), `final_price = "1250.75"`,
`extension_count = 0`. Independent recomputation over the history gives the same pair.
The first bid was **exactly** the starting price, 100.00, and was accepted (`BR-29`,
`SC-55`); every later bid was strictly greater (`BR-03`).

### Zero bids is a real outcome — SC-31

B and C both ended with `winner_id = null`, `final_price = null`, and **`closed_at` set**.
No error, no partial row. (`closed_at` is written unconditionally by
`close_ended_auctions()`; the zero-bid branch nulls only the winner and the price.)

### Amounts never became floats

Every money value crossed the wire as a **string**: `"1250.75"`, `"200.00"`, `"75.00"`.
`public.bid_history` exposes exactly `auction_id, display_name, amount, amount_sar,
created_at, seq` — **no email, no bidder id** (`CLAUDE.md` §6; the guarantee is structural,
and this run is a direct observation of the real payload, not a code reading). Ordering is
`seq`, derived from `bids.id`, not `created_at`.

---

## 3. What the three viewers actually saw

Latency below is **DOM-observation minus `closed_at`**. The browser clock and the Postgres
clock are not the same clock and the skew between them is **not measured** — treat the
sub-second figures as order-of-magnitude.

**One figure is skew-free and is the one that matters.** In run C, a direct database poll
running on this same machine first observed `status = 'ended'` at **20:47:57.963**. The
seller's browser had already painted the outcome at **20:47:57.802** and the other
viewer's at **20:47:57.557** — that is **161 ms and 406 ms _before_ a local database poll
returned the close.** Both clients learned of the close ahead of a direct query, on one
clock, with no refresh.

| Run | Viewer | Tab opened | Outcome in DOM | Δ from `closed_at` |
|---|---|---|---|---|
| A | seller `cp3_sell1` | ~5 min before close | 20:37:41.555 | ~346 ms |
| A | winner `cp3_winner` | 2.3 s before close | 20:37:41.789 | ~579 ms |
| C | seller `cp3_sell1` | ~5 min before close | 20:47:57.802 | ~626 ms |
| C | other `cp3_other` | ~5 min before close | 20:47:57.557 | ~380 ms |

**No refresh.** The JavaScript context survived every close: the same `window.__ev` array
and its `__t0` origin are still live afterwards, so the page that rendered the outcome is
the page that was loaded minutes earlier.

### The text, verbatim

Contested (seller, winner and other viewer all see the same block):

> نتيجة المزاد · انتهى المزاد · **الفائز** cp3_winner · **السعر النهائي** 1,250.75 SAR

Zero-bid:

> نتيجة المزاد · انتهى المزاد · انتهى المزاد دون أي مزايدة، فلا يوجد فائز ولا سعر نهائي.

The bid control **did** disappear live: the winner's tab carried `قدّم مزايدتك` /
`مبلغ المزايدة (SAR)` at 20:37:39.46 and carried neither at 20:37:55.

| | SC | Verdict |
|---|---|---|
| Seller sees winner name, final price, full history | **SC-35**, FR-END-13 | **PASS** — live, and again on reload |
| Winner sees an explicit statement **that they won** | **SC-36**, FR-END-14 | **FAIL** — see F-2 |
| Any other viewer sees it ended, and who won at what price | **SC-37**, FR-END-16 | **PASS** — live, and again on reload |
| Close propagates without refresh: status changes, control disappears, outcome appears | **SC-23**, FR-RT-08 | **PARTIAL** — 2 of 3 clauses; see F-1 |

---

## 4. Findings

### F-1 — the status pill does not change when the auction ends *(Must)*

`PRD.md:1295` — *"Auction status | **Must** | Active → Ended propagates to current viewers
(FR-RT-08)"*. `SC-23` names "status changes" first among the three clauses.

Measured, at the exact instant the outcome text entered the DOM, the status card read:

```
run C, seller : حالة المزاد نشط ينتهي الآن 00:00:18 …
run C, other  : حالة المزاد نشط انتهى في 14‏/08‏/2026، 11:47 م …
```

`نشط` — *active* — sitting directly above a line that already says the auction ended, on a
page that is simultaneously rendering its final outcome. **A fresh reload of the same URL
renders `منتهي` correctly**, so this is exclusively the live path.

Cause, read directly:
[`components/auction/detail/status-countdown.tsx:62`](components/auction/detail/status-countdown.tsx:62)
is `const ended = status === "ended";`, and `status` is a **prop** threaded from the server
render in [`app/auctions/[id]/page.tsx`](app/auctions/[id]/page.tsx). The file says so in
its own header comment, deliberately: *"There is no subscription in this file — one
per-auction subscription is owned by BID-08/BID-09, and a second would be a competing
update mechanism (TEAM.md §10.4)."* **That decision is right.** The gap is that nothing
delivers the live status *to* the prop.

The value exists and is already flowing: `snapshot.auction.status`, via `useLiveAuction`,
which `OutcomeBanner` reads to decide whether to render at all
([`components/bidding/outcome-banner.tsx:100`](components/bidding/outcome-banner.tsx:100)).

**This crosses two owners** — the presentation is @m7ya505's and the live status delivery
is @RayanAlDwlah's — so it is filed, not fixed here.

### F-2 — the winner is never told that *they* won *(Must)*

`PRD.md:724`, FR-END-14 — *"The winner **must** see an explicit statement that they won and
the final price they committed to."* `SC-36` repeats it.

What the winner saw is the block quoted in §3: the label `الفائز` followed by the display
name `cp3_winner`. Naming the winner is not telling the viewer they are the winner.
`OutcomeBanner` renders **identical content for every viewer** — it takes no viewer-relative
input. A repository-wide search for `فزت`, `مبروك`, `أنت الفائز` and `لم تفز` returns
**nothing**.

`PRD.md:1476` asserts the opposite as present tense: N2 *"You won this auction"* is
*"Currently surfaced in-page when the winner opens the auction (FR-END-14)."* **That
sentence is false as measured.**

The wording, the placement and whether non-winning bidders get a counterpart (FR-END-15 is
a *should*) are **product decisions and are not mine to invent** (`TEAM.md` rule 16). Filed
for the team.

### F-3 — an ended auction still advertises that a bid would be accepted *(minor, but it states a false rule)*

Both zero-bid auctions, **after closing**, still render:

> لا توجد مزايدات · أول مزايدة بمبلغ 75.00 SAR بالضبط **مقبولة**

A first bid of exactly the starting price is *accepted* — true while the auction is open
(`BR-29`), false once it has ended, where `place_bid` rejects on the server clock against
`end_time` (`LC-03`). [`components/auction/price-block.tsx:44`](components/auction/price-block.tsx:44)
branches on `bidCount === 0` alone and receives no status at all. Visible both live and on
a fresh reload.

### F-4 — the owner's note keeps its present tense after the end *(minor)*

The seller's tab still reads *"يظل السعر والسجل أمامك مباشرةً **حتى وقت الانتهاء**"* after
the end time has passed. Same family as F-1: the owner region is not status-live.

---

## 5. Disclosures

- **All tabs were `document.hidden === true` for the whole run.** Chrome throttles
  `setInterval` in a hidden tab, so the seller's countdown ticked roughly once a minute and
  read `00:00:18` on an auction that had already closed. **That is my instrument, not the
  product** — the other viewer's tab shows the countdown reaching `انتهى في` correctly, and
  the countdown derives from a client clock against `end_time`, not from the frozen status.
  No latency in §3 depends on a timer; every one is a `MutationObserver` callback stamped
  with `Date.now()`.
- **Clock skew between this machine and Postgres is unmeasured.** The HTTP `Date` header
  has one-second resolution and could not bound it. The skew-free statement in §3 — both
  clients painted the outcome before a local database poll returned it — does not depend
  on it. The *relative* gap between two viewers of the same close is also skew-free, since
  both tabs share one clock: **234 ms** in run A (41.789 − 41.555) and **245 ms** in run C
  (57.802 − 57.557).
- **n = 3 auctions, 4 bids.** This is a checkpoint, not a load test. SC-27, SC-28, SC-32,
  SC-33 and SC-34 are covered by `tests/bidding/closing.sql`, `sweep.sql` and `terminal.sql`
  and were **not** re-derived here; SC-33 is corroborated in passing — auction A's history
  reads back identically after close.
- **The dev database now holds three CP-3 auctions and four CP-3 bids.** They are left in
  place on purpose: they are the evidence, and auctions are immutable and undeletable by
  design (`BR-30`, `BR-31`).
- **Run solo.** #85's "all three developers present" is not met and no part of this
  document should be read as meeting it.
