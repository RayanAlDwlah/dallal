/**
 * lib/money.ts — the ONLY place SAR is parsed, compared or formatted.
 *
 * NFR-DAT-05: exact two-decimal precision, no rounding drift, and
 * **never floating point**. `0.1 + 0.2 !== 0.3` is not an acceptable
 * property of a price, so every amount travels as an exact decimal string
 * and every calculation happens in bigint halalas (minor units).
 *
 * NFR-DAT-08: one display format everywhere. The same amount never appears
 * formatted two ways, which is why nothing outside this file may call
 * `toLocaleString` on a price.
 *
 * BR-21 / SEC-R3: there is no maximum. bigint has no upper bound, so a very
 * large bid is handled correctly rather than rejected. Do not add a ceiling.
 *
 * The server remains the authority for every rule expressed here (BR-08,
 * SEC-V6). These helpers exist for display and fast feedback only.
 */

/** An exact SAR decimal string, e.g. `"1250.00"`. Never a `number`. */
export type Sar = string & { readonly __sar: unique symbol };

/** Non-negative, at most two decimal places. */
const SAR_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/** The currency suffix. Arabic UI, so `ر.س` — see DESIGN_SYSTEM.md §5.2. */
export const SAR_SUFFIX = "ر.س";

export function isSar(value: string): boolean {
  return SAR_PATTERN.test(value);
}

/** Parses a user- or server-supplied string. Throws on anything malformed. */
export function sar(value: string): Sar {
  if (!isSar(value)) {
    throw new TypeError(`Not a valid SAR amount: ${JSON.stringify(value)}`);
  }
  return value as Sar;
}

/** Parses without throwing — for validating a field as the user types. */
export function trySar(value: string): Sar | null {
  return isSar(value) ? (value as Sar) : null;
}

/** Exact minor units. `"1250.5"` → `125050n`. */
export function toHalalas(amount: Sar): bigint {
  const dot = amount.indexOf(".");
  if (dot === -1) return BigInt(amount) * 100n;
  const whole = amount.slice(0, dot);
  const frac = amount.slice(dot + 1).padEnd(2, "0");
  return BigInt(whole) * 100n + BigInt(frac);
}

export function fromHalalas(halalas: bigint): Sar {
  const negative = halalas < 0n;
  const absolute = negative ? -halalas : halalas;
  const whole = absolute / 100n;
  const frac = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}` as Sar;
}

/** `-1 | 0 | 1`. Exact — never a float subtraction. */
export function compareSar(a: Sar, b: Sar): -1 | 0 | 1 {
  const left = toHalalas(a);
  const right = toHalalas(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function addSar(a: Sar, b: Sar): Sar {
  return fromHalalas(toHalalas(a) + toHalalas(b));
}

export function subtractSar(a: Sar, b: Sar): Sar {
  return fromHalalas(toHalalas(a) - toHalalas(b));
}

/** The smallest permitted raise: 0.01 SAR. There is no increment (BR-32). */
export const SMALLEST_RAISE = "0.01" as Sar;

/* -------------------------------------------------------------------------
   Formatting
   ------------------------------------------------------------------------- */

/** Grouping only — the fraction is produced exactly, never by the formatter. */
const GROUPING = new Intl.NumberFormat("en-US", {
  useGrouping: true,
  maximumFractionDigits: 0,
});

/**
 * `"1250"` → `"1,250.00"`. Always two decimals, always grouped, no suffix.
 * The suffix is rendered separately so it stays outside the number's
 * bidi isolate — see `<Money>`.
 */
export function formatSar(amount: Sar): string {
  const halalas = toHalalas(amount);
  const negative = halalas < 0n;
  const absolute = negative ? -halalas : halalas;
  const whole = GROUPING.format(absolute / 100n);
  const frac = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/* -------------------------------------------------------------------------
   The minimum acceptable bid — BR-28 and BR-29, in one place
   ------------------------------------------------------------------------- */

export interface AuctionPrice {
  /** Fixed at creation, immutable thereafter (BR-31). */
  readonly startingPrice: Sar;
  /** Highest accepted bid, or the starting price when there are none (BR-13). */
  readonly currentPrice: Sar;
  readonly bidCount: number;
}

export interface MinimumBid {
  readonly amount: Sar;
  /**
   * `true`  → a bid **equal to** `amount` is accepted. Only ever the first
   *           bid against the starting price (BR-29).
   * `false` → the bid must be **strictly greater** (BR-03, BR-28).
   */
  readonly inclusive: boolean;
}

/**
 * The whole amount rule, and it has exactly two branches.
 *
 * There is deliberately NO increment check (BR-32), NO maximum check
 * (BR-21), NO leading-bidder check (BR-24) and NO reserve (BR-35).
 * Do not add one — see ARCHITECTURE.md §13.2a.
 */
export function minimumAcceptableBid(auction: AuctionPrice): MinimumBid {
  return auction.bidCount === 0
    ? { amount: auction.startingPrice, inclusive: true }
    : { amount: auction.currentPrice, inclusive: false };
}

/** Client-side fast feedback only. The server decides (BR-08, SEC-V6). */
export function meetsMinimum(amount: Sar, minimum: MinimumBid): boolean {
  const c = compareSar(amount, minimum.amount);
  return minimum.inclusive ? c >= 0 : c > 0;
}

/**
 * The two hints, worded with **different verbs** so the inclusive/exclusive
 * difference survives even when the two numbers look alike (NFR-USA-11).
 */
export function minimumBidHint(minimum: MinimumBid): string {
  return minimum.inclusive
    ? `المزايدة تبدأ من ${formatSar(minimum.amount)} ${SAR_SUFFIX}`
    : `أدخل مبلغاً أكبر من ${formatSar(minimum.amount)} ${SAR_SUFFIX}`;
}
