import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const alert = cva("rounded-md border p-3 text-sm sm:p-4", {
  variants: {
    tone: {
      info: "bg-calm-weak border-calm-line text-calm-text",
      success: "bg-brand-weak border-brand-line text-brand-text",
      error: "bg-stop-weak border-stop-line text-stop-text",
      /**
       * The concurrency-loss variant — DESIGN_SYSTEM.md §8.1.
       *
       * Brass, deliberately NOT red: losing a race is not the bidder's
       * mistake, and EC-01 requires the message be clear without being
       * alarming. Reserve red for actual errors.
       */
      race: "bg-urge-weak border-urge-line text-urge-text",
    },
  },
  defaultVariants: { tone: "info" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alert> {
  title?: string;
}

export function Alert({ className, tone, title, children, ...props }: AlertProps) {
  const assertive = tone === "error" || tone === "race";
  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      className={cn(alert({ tone }), className)}
      {...props}
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}
