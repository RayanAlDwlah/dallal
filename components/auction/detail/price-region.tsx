import { Alert } from "@/components/ui/alert";

/**
 * MOHAMMED'S FILE — `@m7ya505`. Created empty by S0-13 (#22); filled by
 * AUC-14 (#56). The current-price display region.
 *
 * The split here is the sharpest on the page, and TEAM.md §11 states it in one
 * line: **Mohammed builds the region — Rayan supplies the value and its
 * updates.** Mohammed NEVER computes the price. It is the highest accepted bid,
 * or the starting price when there are none, written only by the bid operation
 * (BR-13, SEC-Z5, ARCHITECTURE §9.4).
 *
 * Most of this region already exists: components/auction/price-block.tsx
 * exports StartingPrice and CurrentBid. AUC-14 composes them at detail-page
 * prominence rather than writing new markup — the current price must be the
 * most visually prominent element on the page (NFR-USA-04, FR-DETAIL-05).
 *
 * ── The distinction this region exists to make ─────────────────────────────
 *
 * `Starting price: 100 SAR (no bids yet)` and `Current bid: 250 SAR` are two
 * different statements, not one label with two values (FR-DETAIL-06):
 *
 *   - no bids  → the starting price is INCLUSIVE. A first bid of exactly that
 *     amount is accepted, and the region must make that clear (BR-29, SC-55).
 *   - has bids → the current price is EXCLUSIVE. The next bid must be strictly
 *     greater (BR-03, BR-28).
 *
 * It CANNOT be derived by comparing the two prices. BR-29 lets the first bid
 * equal the starting price, so `current_price === starting_price` is true both
 * before any bid and immediately after the first one. The fact comes from the
 * bid count, read — never inferred (S0-11 §3, lib/money.ts minimumAcceptableBid).
 *
 * ── Money rules that reject a PR on sight (CLAUDE.md §4) ───────────────────
 *
 *   - amounts are STRINGS. No Number(), no parseFloat, no arithmetic on them.
 *   - one formatter, lib/money.ts, byte-identical everywhere: `1,250.00 SAR`.
 *     Never `ر.س`, never a second formatter here.
 *   - no ceiling and no length cap. A 40-digit amount must render, not be
 *     truncated or rejected for size (BR-21, SEC-R3).
 */
export function PriceRegion() {
  return (
    <Alert tone="info" title="السعر الحالي">
      <p>
        منطقة عرض فارغة من <span className="num">S0-13</span>. عرض السعر ضمن{" "}
        <span className="num">AUC-14</span>، والقيمة وتحديثاتها من ريان.
      </p>
    </Alert>
  );
}
