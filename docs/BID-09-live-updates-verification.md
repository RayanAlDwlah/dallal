# BID-09 — live price and history updates, verified

| Field | Value |
|---|---|
| Issue | **BID-09** (#70) — realtime price and history updates |
| Owner | Rayan — [`@RayanAlDwlah`](https://github.com/RayanAlDwlah) |
| Ran against | `dallal-dev` (`cjrnakdigcwnsrvtyqhy`), the deployed BID-08 trigger |
| Date | 2026-08-14 |
| Builds on | `docs/BID-08-realtime-verification.md` — the transport under this layer |

BID-08 proved a content-free cue arrives. This issue is the other half: **the read
the cue triggers**, and the criteria are about what viewers *see* — SC-20 (every
current viewer, within 2 seconds, no refresh), SC-21 (the history entry arrives in
the same update as the price), NFR-RT-02 (holds at 20 simultaneous viewers).

---

## 1. What was built

| Piece | File | What it is |
|---|---|---|
| The read | `lib/bidding/live-snapshot.ts` | auction row (`::text` on every money column) + `bid_history`, in parallel, mapped into **one snapshot** |
| The store | same file | one store per auction id, reference-counted like the channel registry under it: one read per cue **however many components subscribe**, one committed snapshot, a sequence guard so only the latest issued read may publish |
| The hook | `lib/bidding/use-live-auction.ts` | `useSyncExternalStore` over the store — N components, one source, no tearing |
| First consumer | `components/bidding/bid-history.tsx` | BID-07's behaviour half: lock-order list, display names only, `<bdi>`-isolated amounts, live via the store |

Three design decisions worth stating as decisions:

1. **One store per auction, not one fetch per component.** §14.6 mounts price, bid
   panel, history and outcome as separate components with only `auctionId` (S0-13).
   Independent per-component reads would not just cost 4× — they could *interleave*
   with a second bid and disagree on one screen. The store makes convergence
   structural: every consumer repaints from the same object. That is what SC-21's
   "same update" means here.
2. **The sequence guard is the convergence argument.** Two cues close together (the
   BR-36 endgame guarantees a pair) mean two racing reads; only the latest issued
   read commits. Viewers end on the last read's state regardless of response
   interleaving — the price can never appear to move backwards from a stale response
   (the data half of RT-X5; the visual half is BID-10).
3. **`bid_history` is never `.order()`ed by the client.** The projection exposes no
   `id`, so the only orderable column is `created_at` — transaction start, which
   disagrees with lock order under contention and renders a decreasing history
   (measured, S0-11 §6). The view's own `order by auction_id, id desc` is the
   definitive order, and the *absence* of an `.order()` call is load-bearing.

## 2. #103, closed through this issue

- The **§3b trailing comment** in `20260812120000_bid02_bid_acceptance.sql` used to
  prescribe the publication route BID-08 measured broken, and named a plain
  `auctions` select "the text path". Corrected — in the migration **and**
  byte-identically in `docs/contracts/BID-02-bid-operation.md`, because
  `contract-sync.awk` diffs them and fails the suite on drift. Comment-only: the
  migration's SQL is untouched and already applied everywhere.
- **`CLAUDE.md` §4 gained rule 7**: the money rule is not satisfied by not writing
  `Number()` — PostgREST + `JSON.parse` produce the float with no project code on
  the stack, so every direct `sar_amount` read casts `::text` per column.
- The re-read here uses `::text` on `current_price` and `final_price`, and
  `bid_history`'s `sar_text()` for every history amount — the third read #103
  predicted would hit the defect, now unable to.

## 3. The measurement — 20 real viewers, one clock

One Node process. Twenty anon clients subscribe exactly as `auction-channel.ts`
subscribes; on every event each performs **the same two reads
`live-snapshot.ts` performs**. A separate authenticated account places real bids
through `place_bid`. All timestamps from one `Date.now()` — the cross-clock method
BID-08 §7.7 discarded stays discarded.

Per bid: `t0` immediately before the RPC leaves; per viewer, `t_seen` when its
re-read **returned the new amount** — not when the event arrived, because SC-20's
"reaches" means the viewer can see it. Reported per bid: the **worst** of the 20
(SC-20 says *all*). SC-21 asserted inside every single read: `history[0].amount`
must equal `current_price` in the same response pair.

### Results

Run of 20 viewers × 5 bids, twice (worst-of-20 per bid, ms):

| | bid 1 | bid 2 | bid 3 | bid 4 | bid 5 | SC-21 violations |
|---|---|---|---|---|---|---|
| run A | 1271 | 623 | 657 | 634 | 608 | 0 of 100 reads |
| run B | 973 | 678 | 668 | 735 | 720 | 0 of 100 reads |

**Worst viewer on the worst bid: 1271 ms against a 2000 ms budget. Every one of
200 viewer-convergences arrived; price and history never disagreed within a
read.** The first bid of each run is the slowest — twenty REST connections warming
simultaneously — and still inside budget with 36 % headroom.

### One run is not in that table, and why it is still recorded

The very first 20-viewer attempt, before the probe carried diagnostics, aborted:
one viewer's convergence did not land within its 10-second arming window. It did
not reproduce — a 5-viewer run and both instrumented 20-viewer runs above were
fully clean — and the un-instrumented probe recorded nothing that can distinguish
a hung REST read from a dropped socket. It is recorded here rather than dropped
because "the failing run didn't count" is how measurement stops being
measurement; the instrumentation that would diagnose a recurrence is now part of
the probe. If it recurs in the field, the symptom would be one viewer catching up
one event late — which the next cue or a refresh corrects (EC-09), and which
BID-11's staleness surfacing is designed to make visible.

### What this does not claim

- One machine, one network, twenty sockets from one process. It is a fan-out and
  convergence measurement, not a load test of Supabase.
- The probe replicates the module's *reads*; the module's store/hook themselves run
  in a browser and are exercised by typecheck, lint, and use — this repo still has
  **no JS test harness** (raised on #107, a team decision).
- SC-22 (focus, typed-amount preservation) is BID-10, deliberately absent here.

## 4. Footprint left on dev

All on `dallal-dev`; `dallal-prod` untouched. Auctions close themselves via
`pg_cron` at their end time; bids are append-only (BR-05) and stay.

| What | Count |
|---|---|
| `bid09-*@dallal.test` accounts | 8 (4 runs × seller+bidder) |
| Probe auctions (`BID-09 fan-out probe`) | 4 — incl. one from the aborted run, 1 bid on it |
| Bids | 1 + 2 + 5 + 5 = 13 |
| Schema changes | 0 |

The probe script was throwaway and is deleted; its full text is reproduced in the
PR discussion.
