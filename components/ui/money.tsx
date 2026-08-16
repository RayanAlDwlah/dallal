import { formatIncrement, formatMoney } from "@/lib/money";

/**
 * The one money rendering. The number sits inside a <bdi> bidi isolate;
 * the SAR indicator stays OUTSIDE the isolate (otherwise the decimal point
 * and the indicator reorder in RTL text).
 *
 * ── Two properties restored from `main` in the merge, 2026-08-16 ───────────
 *
 * V2 rewrote this component from the design previews and dropped two fixes
 * that had each been made against a MEASURED defect on V1. Neither loss was
 * visible: the component renders correctly at every amount anyone has typed
 * into it, which is exactly why both are written down here rather than
 * silently re-applied. They came back through a REWRITE, not through an edit —
 * no guard was watching for that, and none is now.
 *
 * 1. THE LITERAL SPACE (#156). V2 separated the digits from `SAR` with
 *    `.sar { margin-inline-start: 5px }`. That is a layout gap, and a layout
 *    gap contributes NOTHING to text — `textContent` reads `1,250.00SAR`.
 *    CLAUDE.md §4 rule 6 fixes the canonical form as `1,250.00 SAR`, "one
 *    space", and `lib/money.ts` produces exactly that for every non-rendered
 *    use. So the rendered path was the single place in the product that
 *    disagreed with the single formatter — precisely what rule 6 forbids. It
 *    costs anyone who copies a price, and any assertion reading `innerText`.
 *
 *    Note what the guard suite could and could not see: `tests/guards/run.sh`
 *    checks there is no SECOND formatter, and that was true here. There is one
 *    formatter; the markup disagreed with it. Identical symptom, invisible to
 *    the check that exists.
 *
 *    THE WRAPPER IS `inline-flex` FOR THIS REASON AND NO OTHER, so do not
 *    relayout it back to a plain inline span. Per CSS Flexible Box Layout §4, a
 *    child text sequence between flex items is wrapped in an anonymous flex
 *    item "unless the entire sequence contains only white space, in which case
 *    it is not rendered". So inside a flex container the node exists in the DOM
 *    — `textContent` gets its space — and generates NO box: no wrap
 *    opportunity, no visible gap. In plain inline flow it would render as a
 *    real space ON TOP OF `.sar`'s 5px margin, and the fix for a text defect
 *    would become a visible layout defect. `items-baseline` keeps `SAR` sitting
 *    on the digits' baseline exactly as it did before this change; the rendered
 *    spacing is still the margin's 5px and nothing about V2's appearance moves.
 *
 * 2. CONTAINMENT ON THE ISOLATE (#110, #120). There is no maximum price
 *    (BR-21, SEC-R3), so a 30- or 40-digit amount is a LEGAL value that must
 *    render in full. V2's `<bdi className="num">` carried no width or overflow
 *    constraint at all, so such an amount widens the document and gives every
 *    viewport a horizontal scrollbar — NFR-USA-06, SC-49. On V1 that was
 *    measured at a 1871px document inside a 375px viewport. That figure is
 *    V1's; what is claimed about V2 here is only the structural fact that the
 *    constraint was absent, which is read off the markup, not measured.
 *
 *    The scroll container is the DIGIT ISLAND, not the wrapper, and the
 *    placement is load-bearing: `.num` renders LTR digits, so the island opens
 *    on the MOST significant ones. On the RTL wrapper it would rest at the
 *    other end, opening on "…,890.99" and hiding the magnitude — the one part
 *    of a price nobody may have to scroll to find. `inline-block` is required
 *    because `overflow` does not apply to an inline box and `<bdi>` is inline;
 *    `max-w-full` is required because an inline-block otherwise shrink-wraps to
 *    its content and grows back to full width. Both, or neither works.
 *    `overflow-y-hidden` suppresses the parasitic vertical scrollbar that
 *    `overflow-x: auto` implies — digits have no descenders to clip.
 *
 *    The fix is containment, NEVER truncation: no ellipsis, no length-
 *    conditional font size, no `max` on the value. CLAUDE.md §4 rule 2 — a
 *    hidden display ceiling is the same defect as a stored one and harder to
 *    find. The complete amount is always in the DOM and always reachable.
 */
export function Money({ amount, className }: { amount: string; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 max-w-full items-baseline ${className ?? ""}`}>
      <bdi className="num inline-block max-w-full min-w-0 overflow-x-auto overflow-y-hidden">
        {formatMoney(amount)}
      </bdi>{" "}
      <span className="sar">SAR</span>
    </span>
  );
}

/** Increment amounts render without decimals: «زايد بـ 500». */
export function IncrementAmount({ amount }: { amount: string }) {
  return <bdi className="num">{formatIncrement(amount)}</bdi>;
}
