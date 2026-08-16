/**
 * The one money formatter. Amounts travel as STRINGS end-to-end (the database
 * returns them as text) and are never run through parseFloat/Number — string
 * arithmetic is done on integer cents via BigInt, so there is no ceiling and
 * no float rounding, no matter how large the amount.
 *
 * Canonical format everywhere: `1,250.00` + a separate SAR indicator, Western
 * digits, grouped thousands, exactly two decimals. Increments render without
 * decimals (`زايد بـ 500`) per the approved bid-button design.
 */

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

export function isMoneyString(value: string): boolean {
  return MONEY_RE.test(value);
}

/** "48500.5" → 4850050n (integer cents). Throws on malformed input. */
function toCents(value: string): bigint {
  const s = value.trim();
  if (!MONEY_RE.test(s)) throw new Error(`malformed amount: ${s}`);
  const dot = s.indexOf(".");
  const int = dot === -1 ? s : s.slice(0, dot);
  const frac = dot === -1 ? "" : s.slice(dot + 1);
  return BigInt(int) * 100n + BigInt((frac + "00").slice(0, 2));
}

function fromCents(cents: bigint): string {
  const s = cents.toString().padStart(3, "0");
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

function groupIntPart(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "48500" | "48500.5" → "48,500.00" — never abbreviated, never capped. */
export function formatMoney(value: string): string {
  const plain = fromCents(toCents(value));
  const [int, frac] = plain.split(".");
  return `${groupIntPart(int!)}.${frac}`;
}

/** Increments are whole multiples of 10 — grouped, no decimals: "1,000". */
export function formatIncrement(value: string): string {
  const cents = toCents(value);
  return groupIntPart((cents / 100n).toString());
}

/** current + increment, exact, as a plain amount string ("49000.00"). */
export function addMoney(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b));
}

/** -1 | 0 | 1 for a < b, a = b, a > b. */
export function compareMoney(a: string, b: string): number {
  const ca = toCents(a);
  const cb = toCents(b);
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

/** Loose user input ("45,000" / "45000.5") → canonical "45000.50" or null. */
export function parseMoneyInput(raw: string): string | null {
  const cleaned = raw.replace(/[,\s]/g, "").replace(/٫/g, ".");
  if (!MONEY_RE.test(cleaned)) return null;
  try {
    return fromCents(toCents(cleaned));
  } catch {
    return null;
  }
}

/** Increment input must be a positive whole multiple of 10. */
export function parseIncrementInput(raw: string): string | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = BigInt(cleaned);
  if (n <= 0n || n % 10n !== 0n) return null;
  return n.toString();
}
