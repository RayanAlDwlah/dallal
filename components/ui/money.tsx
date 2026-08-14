import { cn } from "@/lib/cn";
import { formatSar, SAR_SUFFIX, type Sar } from "@/lib/money";

const SIZE = {
  hero: "text-money-hero",
  lg: "text-money-lg",
  md: "text-money-md",
  sm: "text-money-sm",
} as const;

const SUFFIX_SIZE = {
  hero: "text-lg",
  lg: "text-md",
  md: "text-sm",
  sm: "text-xs",
} as const;

export interface MoneyProps {
  amount: Sar;
  /** Money has its own scale, never the text scale — see globals.css. */
  size?: keyof typeof SIZE;
  /** Hide the suffix only where the currency is already stated once nearby. */
  suffix?: boolean;
  className?: string;
}

/**
 * The single rendering path for every price in the product (NFR-DAT-08).
 *
 * Two things it guarantees that a bare string cannot:
 *  - `num` gives tabular lining figures, so amounts align in a column and a
 *    strictly increasing history is scannable (FR-BID-15).
 *  - `<bdi>` isolates the Latin digits inside RTL text. Without it the decimal
 *    point and the suffix reorder (DESIGN_SYSTEM.md §2.1). The suffix sits
 *    OUTSIDE the isolate, which is what keeps `1,250.00 SAR` in that order.
 *
 * ── Extreme widths, and why the fix is NOT a cap ──────────────────────────
 *
 * There is no maximum price (BR-21, SEC-R3), so a 30- or 40-digit amount is a
 * legal value that must render in full. Measured: at `hero` size such an amount
 * is ~980px of unbreakable digits, which in a ~320px rail pushed the whole
 * DOCUMENT to 1871px and gave the page a horizontal scrollbar — breaking
 * NFR-USA-06 and SC-49 on every viewport, not only at 375px.
 *
 * The fix is containment, never truncation. The scroll container is the DIGIT
 * ISLAND itself, not the wrapper, and that placement is load-bearing twice
 * over:
 *
 *   - `.num` already sets `direction: ltr` (globals.css), so the island's
 *     initial scroll position is its left edge — the MOST significant digits.
 *     Put the same overflow on the RTL wrapper instead and it rests at the
 *     other end, opening on "…,890.99" and hiding the magnitude, which is the
 *     one part of a price nobody may have to scroll to find. Measured both ways.
 *   - the `SAR` indicator sits outside the scroll area and therefore never
 *     scrolls out of view, which keeps `1,250.00 SAR` whole (BR-43).
 *
 * `min-w-0` is what lets the island shrink inside a flex parent at all;
 * without it flexbox refuses to go below content width and the page overflows
 * again. `overflow-y-hidden` suppresses the parasitic vertical scrollbar that
 * `overflow-x: auto` would otherwise imply — digits have no descenders to clip.
 *
 * ── `inline-block max-w-full` — why the island states its own display ──────
 *
 * `overflow` does not apply to an inline box, and `<bdi>` is inline by default;
 * `.num` sets font, direction and unicode-bidi but not `display`. So the
 * overflow above only took effect because the wrapper is `inline-flex` and flex
 * items are blockified by the spec. @Dem4t found that on #110 — the containment
 * was correct, but only because of a word in the PARENT's class list, and
 * relayouting that wrapper is a pure presentation change any session may make
 * without asking (CLAUDE.md §1). Nothing would have caught the regression:
 * not tsc, not eslint, and no test — it is invisible until someone looks at a
 * thirty-digit amount.
 *
 * MEASURED, because his remedy was half of one and the missing half matters.
 * Forcing the wrapper to `display: block`:
 *
 *   bdi as-was (inline)                    → document 1059px, page overflows
 *   bdi `inline-block` alone               → document 1019px, page STILL overflows
 *   bdi `inline-block` + `max-width: 100%` → document 375px, contained
 *
 * `inline-block` alone is not enough because `max-w-full` sits on the WRAPPER:
 * an inline-block shrink-wraps to its content, and with nothing capping its
 * width it simply grows to the full 980px again. The island needs its own cap.
 * With both, containment survives a `block` wrapper and an `inline` one, and
 * inside the current flex wrapper it changes nothing at all — a flex item is
 * blockified either way. `inline-block` rather than `block` so the `SAR`
 * baseline still aligns if the wrapper ever stops being a flex container.
 *
 * What is deliberately NOT done here: no truncation, no ellipsis, no
 * length-conditional font size, no `max` on the value. CLAUDE.md §4 names
 * exactly this — "do not add a ceiling to solve a layout problem" — and a
 * hidden display ceiling is the same defect as a stored one, just harder to
 * find. The complete amount is always in the DOM and always reachable.
 */
export function Money({ amount, size = "md", suffix = true, className }: MoneyProps) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-baseline gap-1", className)}>
      <bdi
        className={cn(
          "num inline-block max-w-full min-w-0 overflow-x-auto overflow-y-hidden font-bold",
          SIZE[size],
        )}
      >
        {formatSar(amount)}
      </bdi>
      {suffix ? (
        <span className={cn("font-ui font-semibold text-ink-2", SUFFIX_SIZE[size])}>
          {SAR_SUFFIX}
        </span>
      ) : null}
    </span>
  );
}
