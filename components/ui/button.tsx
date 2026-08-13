import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-md border font-semibold leading-none",
    "cursor-pointer select-none",
    "transition-colors duration-[120ms] ease-out-soft",
    "disabled:cursor-not-allowed disabled:opacity-45",
    // Buttons go full width on phones. NFR-USA-06 / 375px is the base layer.
    "w-full sm:w-auto",
  ],
  {
    variants: {
      tone: {
        primary: "bg-brand text-on-brand border-brand hover:bg-brand-hover hover:border-brand-hover",
        secondary: "bg-surface text-ink border-rule-strong hover:bg-sunk hover:border-ink-3",
        ghost: "bg-transparent text-brand-text border-transparent hover:bg-brand-weak",
        danger: "bg-stop text-on-stop border-stop hover:bg-stop-hover hover:border-stop-hover",
      },
      size: {
        // min-h-tap is the 44px hit target from NFR-USA-08.
        sm: "min-h-9 px-3 text-sm",
        md: "min-h-tap px-5 text-base",
        lg: "min-h-13 px-6 text-md",
      },
    },
    defaultVariants: { tone: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /**
   * Keeps the label, shows a spinner and disables the control.
   *
   * This is load-bearing, not polish: with no cancellation (BR-30) and no
   * editing (BR-31), a double-submitted auction can never be removed by
   * anyone, so preventing it is a correctness requirement (EC-21).
   */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, tone, size, loading = false, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(button({ tone, size }), className)}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
