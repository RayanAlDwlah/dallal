/**
 * lib/money.ts — the ONE place a SAR amount is validated, compared or formatted.
 *
 * Authoritative representation, per docs/contracts/S0-12-money.md §1 and §6:
 * an amount is an **exact decimal string**. Never a `number`, never minor
 * units. There is no conversion factor anywhere in the system, so there is no
 * ×100 site for three developers to diverge on, and no ceiling.
 *
 *   NFR-DAT-05  exact two-decimal precision, and **never floating point**.
 *               `0.1 + 0.2 !== 0.3` is not an acceptable property of a price.
 *   NFR-DAT-08  one display format. Nothing outside this file formats a price.
 *   BR-21       there is no maximum. Arithmetic here is width-unbounded, so a
 *   SEC-R3      40-digit amount formats correctly instead of being rejected or
 *               truncated. Do not add a ceiling to solve a layout problem.
 *   BR-43       canonical format `1,250.00 SAR` — grouped, exactly two
 *               decimals, one space, Latin `SAR`.
 *
 * The server remains the authority for every rule expressed here (BR-08,
 * SEC-V6). These helpers are for display and fast client-side feedback only.
 */

/** An exact SAR decimal string, e.g. `"1250.00"`. Never a `number`. */
export type Sar = string & { readonly __sar: unique symbol };

/** Non-negative, at most two decimal places. No upper bound (BR-21). */
const SAR_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/** The currency indicator. Latin `SAR`, never `ر.س` — BR-43, FR-CREATE-13. */
export const SAR_SUFFIX = "SAR";

export function isSar(value: string): boolean {
  return SAR_PATTERN.test(value);
}

/** Parses a server- or user-supplied string. Throws on anything malformed. */
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

/* -------------------------------------------------------------------------
   Internal — exact decimal handling, width-unbounded
   ------------------------------------------------------------------------- */

/** Splits into integer and exactly-two-digit fraction. Pure string work. */
function parts(amount: Sar): { whole: string; frac: string } {
  const dot = amount.indexOf(".");
  if (dot === -1) return { whole: amount, frac: "00" };
  return {
    whole: amount.slice(0, dot),
    frac: amount.slice(dot + 1).padEnd(2, "0"),
  };
}

/** Strips leading zeros without emptying the string. `"007"` → `"7"`. */
function trimLeadingZeros(digits: string): string {
  const trimmed = digits.replace(/^0+/, "");
  return trimmed === "" ? "0" : trimmed;
}

/**
 * Groups a digit run in threes from the right: `"1234567"` → `"1,234,567"`.
 *
 * Deliberately NOT `Intl.NumberFormat`: that takes a `number` or a `bigint`,
 * and routing an amount through either reintroduces the float and
 * minor-unit hazards this module exists to remove. String work is exact at
 * any width, which is what keeps a 40-digit amount correct (SC-57, EC-25).
 */
function group(whole: string): string {
  const digits = trimLeadingZeros(whole);
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return out;
}

/* -------------------------------------------------------------------------
   Comparison — exact, no epsilon, no tolerance
   ------------------------------------------------------------------------- */

/**
 * `-1 | 0 | 1`, exact at any magnitude.
 *
 * Compares the integer parts by length then lexically — correct because both
 * sides are digit-only after zero-trimming — then the two fraction digits.
 * No subtraction, so no float and no overflow.
 *
 * Client-side only. The authoritative comparison happens in SQL inside the
 * per-auction row lock (S0-12 §4, ARCHITECTURE §13.2).
 */
export function compareSar(a: Sar, b: Sar): -1 | 0 | 1 {
  const left = parts(a);
  const right = parts(b);

  const lw = trimLeadingZeros(left.whole);
  const rw = trimLeadingZeros(right.whole);

  if (lw.length !== rw.length) return lw.length < rw.length ? -1 : 1;
  if (lw !== rw) return lw < rw ? -1 : 1;
  if (left.frac !== right.frac) return left.frac < right.frac ? -1 : 1;
  return 0;
}

/* -------------------------------------------------------------------------
   Formatting — the single rendering path (NFR-DAT-08)
   ------------------------------------------------------------------------- */

/**
 * `"1250"` → `"1,250.00"`. Grouped, always exactly two decimals, no suffix.
 *
 * The suffix is returned separately by `formatSarWithSuffix` and rendered
 * outside the bidi isolate, which is what keeps `1,250.00 SAR` in that order
 * inside RTL text (BR-42, DESIGN_SYSTEM.md §2.1).
 */
export function formatSar(amount: Sar): string {
  const { whole, frac } = parts(amount);
  return `${group(whole)}.${frac}`;
}

/** The full canonical string, `"1,250.00 SAR"` — BR-43. */
export function formatSarWithSuffix(amount: Sar): string {
  return `${formatSar(amount)} ${SAR_SUFFIX}`;
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
 * Do not add one — ARCHITECTURE.md §13.2a, S0-12 §9.5.
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
    ? `المزايدة تبدأ من ${formatSarWithSuffix(minimum.amount)}`
    : `أدخل مبلغاً أكبر من ${formatSarWithSuffix(minimum.amount)}`;
}
