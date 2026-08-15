import { formatIncrement, formatMoney } from "@/lib/money";

/**
 * The one money rendering. The number sits inside a <bdi> bidi isolate;
 * the SAR indicator stays OUTSIDE the isolate (otherwise the decimal point
 * and the indicator reorder in RTL text).
 */
export function Money({ amount, className }: { amount: string; className?: string }) {
  return (
    <span className={className}>
      <bdi className="num">{formatMoney(amount)}</bdi>
      <span className="sar">SAR</span>
    </span>
  );
}

/** Increment amounts render without decimals: «زايد بـ 500». */
export function IncrementAmount({ amount }: { amount: string }) {
  return <bdi className="num">{formatIncrement(amount)}</bdi>;
}
