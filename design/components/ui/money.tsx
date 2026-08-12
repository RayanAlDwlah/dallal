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
 *    OUTSIDE the isolate, which is what keeps `1,250.00 ر.س` in that order.
 */
export function Money({ amount, size = "md", suffix = true, className }: MoneyProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <bdi className={cn("num font-bold", SIZE[size])}>{formatSar(amount)}</bdi>
      {suffix ? (
        <span className={cn("font-ui font-semibold text-ink-2", SUFFIX_SIZE[size])}>
          {SAR_SUFFIX}
        </span>
      ) : null}
    </span>
  );
}
