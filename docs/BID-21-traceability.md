# BID-21 Traceability — Bidding and Realtime Testing

Produced by the BID-21 sweep. Maps each PRD success criterion in the
assigned range to its existing assertion, marks gaps that are SQL-reachable,
and marks items that require a browser (OUT-OF-SQL-SCOPE).

**Contradiction surfaced (CLAUDE.md §2):** GitHub issue #82's body contains
the sentence "a late bid does not extend the end time (SC-74)". That sentence
is stale. BR-36 was reversed on 2026-08-13. SC-74 was rewritten in PRD v3.0:
a bid **accepted** in the final 15 seconds extends `end_time` by exactly 30
seconds, repeating, to a hard cap of 20 extensions; a **rejected** bid never
extends (SC-74c). `tests/bidding/closing.sql` already asserts the amended
behaviour (sections E, G, H, I, L). The issue body must not be implemented;
this report records the contradiction in place of acting on it.

---

## Traceability Table

Legend:
- **COVERED** — an existing assertion in one of the named files
- **GAP** — SQL-reachable; a new assertion in `sweep.sql` fills this
- **OUT-OF-SQL-SCOPE** — requires a browser, two-browser setup, or live
  network; cannot be asserted in a pure-PostgreSQL container

| SC | PRD text (short) | Status | Location |
|---|---|---|---|
| SC-08 | Authenticated non-owner can place a valid bid and receives confirmation | COVERED | `acceptance.sql` — "SC-55 first bid == starting price" (same path; SC-08 is the general case, SC-55 is the specific first-bid assertion that proves it) |
| SC-09 | Bid at or below current price rejected with current price named; state unchanged | COVERED | `acceptance.sql` — "SC-56a equal second bid rejected", "state unchanged after rejections", "history holds only accepted bids" |
| SC-10 | Unauthenticated bid attempt rejected, including crafted request | COVERED | `acceptance.sql` — "unauthenticated rejected" |
| SC-11 | Owner's bid on their own auction rejected, including crafted request | COVERED | `acceptance.sql` — "owner cannot bid" |
| SC-12 | Malformed bid (non-numeric, zero, negative, >2 decimals) rejected server-side | COVERED | `acceptance.sql` — "abc rejected", "100.005 rejected not rounded", "zero rejected", "negative rejected", "NaN rejected", "Infinity rejected", "-Infinity rejected", "whitespace inf rejected" |
| SC-13 | Every rejection gives a specific, actionable reason | COVERED | `acceptance.sql` — all rejection paths return a named `reason` field; asserted by checking the specific reason string |
| SC-14 | Accepted bid appears in history, updates current price | COVERED | `acceptance.sql` — "state unchanged after rejections" verifies count and price; acceptance assertions verify `accepted = true` plus current_price update |
| SC-15 | No mechanism to edit or delete a bid | COVERED | `closing.sql` — "SC-33 closing does not touch bid history"; `acceptance.sql` — bids_are_append_only trigger test (the `bids_no_update_or_delete` trigger is asserted in acceptance via the insert-gate test structure) |
| SC-16 | Two simultaneous bids at same price: exactly one accepted | COVERED | `concurrency.sh` — the BID-20 concurrency harness |
| SC-17 | Under concurrent bidding, history has every accepted bid exactly once, strictly increasing | COVERED | `concurrency.sh` — verified by the concurrency harness |
| SC-18 | Concurrency rejection names the new price | COVERED | `acceptance.sql` — "state unchanged after rejections" checks `not_above_current`; the `outbid_race` reason and its `current_price` field are tested in the concurrency harness |
| SC-19 | After concurrent bidding, close determines exactly one winner matching the highest bid | COVERED | `closing.sql` — "BR-06 winner is the highest bidder", "BR-06 final_price is the highest amount" |
| SC-20 | Two browsers see new price within 2 seconds, no refresh | OUT-OF-SQL-SCOPE | INT-02; requires two browser clients and the Supabase Realtime service |
| SC-21 | New bid appears in both viewers' history in the same update | OUT-OF-SQL-SCOPE | INT-02; same two-browser test |
| SC-22 | Live update does not clear a partially typed bid amount, steal focus, or scroll | OUT-OF-SQL-SCOPE | Requires a browser and user interaction |
| SC-23 | Auction close propagates to all current viewers without refresh | OUT-OF-SQL-SCOPE | Requires browser clients; the trigger-fires assertion is in `realtime.sql` (BID-08, pending merge) |
| SC-24 | Loss of live connection is surfaced; reconnect resynchronizes | OUT-OF-SQL-SCOPE | BID-11; requires a browser and controllable network |
| SC-25 | Every auction marked Ended within 30 seconds, no human action | COVERED | `closing.sql` — "T1 the sweep closes every due auction in one call"; NFR-MNT-03 met by `close_ended_auctions()` being callable directly |
| SC-26 | Auctions close correctly when nobody is viewing | COVERED | `closing.sql` section D — the sweep test uses no connected clients |
| SC-27 | Bids at or after the end time are always rejected, even before status is Ended | COVERED | `acceptance.sql` — "LC-03 past end_time, status still active" (status reads 'active', bid is rejected) |
| SC-28 | A bid accepted just before the end time counts toward winner determination | GAP | `sweep.sql` — new assertion: place a bid with end_time a fraction in the future, expire, close; verify that bid is the winner |
| SC-29 | Winner is the highest bidder in history for 100% of closed auctions | COVERED | `closing.sql` — "BR-06 winner is the highest bidder"; verified by independent recomputation in the closing block |
| SC-30 | Final price equals the winning bid amount | COVERED | `closing.sql` — "BR-06 final_price is the highest amount" |
| SC-31 | Auction closing with zero bids ends with no winner, no error | COVERED | `closing.sql` section B — "SC-31 it ends with no final price", "SC-31 its status is ended, not stuck active" |
| SC-32 | Re-running close does not change a recorded result | COVERED | `closing.sql` — "SC-32 a second close returns 0", "SC-32 the outcome is unchanged by the second call" |
| SC-33 | Bid history is preserved unchanged after close | COVERED | `closing.sql` — "SC-33 closing does not touch bid history" |
| SC-55 | First bid exactly equal to starting price is accepted (BR-29) | COVERED | `acceptance.sql` — "SC-55 first bid == starting price" |
| SC-56 | Second bid at exactly current price rejected; 100.01 SAR above accepted (BR-28, BR-32) | COVERED | `acceptance.sql` — "SC-56a equal second bid rejected", "SC-56b +0.01 SAR accepted" |
| SC-57 | Bid never rejected for insufficient increase or being too large; no increment, no ceiling (BR-21, BR-32) | GAP (partial) | `acceptance.sql` has "BR-21 40-digit bid accepted" for no-ceiling. GAP: no explicit assertion for the no-increment side (a +0.01 after a non-minimal bid, and a very wide amount together). `sweep.sql` adds: (a) +0.01 raise above a non-first bid accepted; (b) 30-digit amount accepted and stored without drift |
| SC-72 | Current leading bidder can place a further bid strictly greater than current price, accepted (BR-24) | GAP | `sweep.sql` — new assertion: b1 bids, then b1 bids again above their own price, accepted |
| SC-73 | No reserve-price outcome; highest valid bid always wins regardless of amount (BR-35) | GAP | `sweep.sql` — new assertion: close an auction with one low bid (e.g. 0.01 SAR above starting price); verify that bidder is winner with no "reserve not met" outcome |
| SC-74 | **AMENDED 2026-08-13.** Accepted bid in final 15s extends end_time by exactly 30s; bid before window does not move it | COVERED | `closing.sql` sections E and F — "BR-36 a bid in the final 15s adds exactly 30s", "a bid outside the final 15s leaves end_time alone" |
| SC-74a | Extension repeats: each further accepted bid inside the moved window adds 30s | COVERED | `closing.sql` section G — "BR-36 extending is not once-only: 5 becomes 6" |
| SC-74b | Extension stops at 20; at the cap late bid still accepted, end_time does not move | COVERED | `closing.sql` sections H and I — "at the cap the bid is still accepted", "at the cap end_time does not move", "at the cap the counter stays at 20", "the 20th extension is permitted, not off by one" |
| SC-74c | Rejected bid in final 15s never extends the auction | COVERED | `closing.sql` section L — "a too-low bid in the window is rejected ... and does not extend the auction", "an owner bid in the window is rejected ... and does not extend the auction either" |
| SC-75 | Bid history visible to unauthenticated visitor; shows display names and amounts in SAR; never an email address (BR-40, FR-BID-22a) | GAP (partial) | `acceptance.sql` has "anon can select bid_history" (privilege check only). GAP: no content-level assertion that anon can actually read rows from bid_history, that display_name appears, and that no email address appears. `sweep.sql` fills the content side. |

---

## Open Questions

**OQ-1 (SC-28 precision):** The PRD text is "a bid accepted just before the end time
counts toward winner determination." The `expire()` fixture in `closing.sql` moves
`end_time` backwards by a configurable number of seconds AFTER a bid is placed, which
is how it proves the bid already accepted counts. That approach is used in `sweep.sql`.
No team decision is needed — the pattern is already established and is the only path
available without a clock-injection point.

**OQ-2 (SC-73 scope):** SC-73 is described in the PRD as "Review + automated winner
test." The review half (no reserve-price field or control in the UI) is not SQL-testable.
`sweep.sql` covers the automated winner test half only: a single-bid auction closes with
that bidder as winner regardless of bid amount.

**OQ-3 (SC-57 very-wide amount):** The issue brief says to use `123456789012345678901234567890.99`
(30 digits + 2 decimals). acceptance.sql uses 40 nines. Both exercise the no-ceiling
property. `sweep.sql` uses the issue-specified amount so the two files together exercise
a distinct value. Both are valid; neither contradicts the other.

**OQ-4 (issue #82 body vs CLAUDE.md §5):** The issue body says "a late bid does not
extend the end time (SC-74)." CLAUDE.md §5 (the amendment recorded 2026-08-13) and
PRD SC-74/74a/74b/74c say the opposite. The stale sentence in the issue body is NOT
implemented. `closing.sql` already asserts the correct (amended) behaviour. This
contradiction is surfaced here per CLAUDE.md §2 and the task brief.
