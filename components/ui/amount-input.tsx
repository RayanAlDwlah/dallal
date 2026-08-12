"use client";

import * as React from "react";

import { cn } from "@/lib/cn";
import { SAR_SUFFIX, trySar } from "@/lib/money";

export interface AmountInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * The SAR amount field — DESIGN_SYSTEM.md §8.1.
 *
 * Presentation only. It holds a **string** and never a `number`: routing an
 * amount through JS numeric types reintroduces the float and precision
 * hazards lib/money.ts exists to remove (NFR-DAT-05, S0-12 §6, §9.1).
 *
 * Three properties that are requirements, not styling:
 *
 *  - **Never auto-corrects, rounds or reformats the user's entry** (FR-BID-17).
 *    The raw string is passed straight back out. Grouping is applied to
 *    *displayed* prices, never inside this field, so what is typed is what is
 *    submitted.
 *  - **No length cap and no maximum.** A very large amount must be typable —
 *    adding a cap here would be the ceiling BR-21/SEC-R3/SD-05 forbid.
 *  - The field's content is an **LTR island** inside RTL text, so the decimal
 *    point and the indicator do not reorder (BR-42).
 *
 * Validation shown here is Tier-1 fast feedback only. The server decides
 * (BR-08, SEC-V6).
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput({ className, value, onValueChange, ...props }, ref) {
    const malformed = value !== "" && trySar(value) === null;
    const invalid = props["aria-invalid"] === true || malformed;

    return (
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded-md border bg-surface",
          "transition-colors duration-[120ms]",
          invalid ? "border-stop" : "border-rule-strong hover:border-ink-3",
          className,
        )}
      >
        <input
          ref={ref}
          type="text"
          /* Numeric keypad on mobile without the spinner and rounding that
             type="number" brings. */
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={invalid || undefined}
          className="num min-h-tap w-full min-w-0 bg-transparent px-3 text-start text-money-md outline-none placeholder:text-ink-3"
          {...props}
        />
        {/* The indicator sits OUTSIDE the input's LTR island, on the inline
            end, so `1250.00 SAR` keeps that order in an RTL layout. */}
        <span
          aria-hidden="true"
          className="border-rule text-ink-2 flex shrink-0 items-center border-s bg-sunk px-3 text-sm font-semibold"
        >
          {SAR_SUFFIX}
        </span>
      </div>
    );
  },
);
