import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const pill = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        /** Live and accepting bids. */
        active: "bg-brand-weak border-brand-line text-brand-text",
        /** Close to the end time. Urgency, not alarm. */
        soon: "bg-urge-weak border-urge-line text-urge-text",
        /** Terminal. No bidding (BR-15). */
        ended: "bg-calm-weak border-calm-line text-calm-text",
      },
    },
    defaultVariants: { tone: "active" },
  },
);

export interface StatusPillProps extends VariantProps<typeof pill> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Auction status, as presentation only.
 *
 * The caller decides which tone applies — this component contains no
 * lifecycle logic. Whether an auction is Active or Ended is decided by the
 * server against the recorded end time (PRD LC-03), never in the UI.
 *
 * Status is carried by text as well as colour, so it survives for a
 * colour-blind reader (NFR-USA-10).
 */
export function StatusPill({ tone, children, className }: StatusPillProps) {
  return <span className={cn(pill({ tone }), className)}>{children}</span>;
}
