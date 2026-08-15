import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const pill = cva(
  /*
   * V2 (auction-card.html `.pill`): fully round, blurred so it can sit over an
   * image, and the border became an inset ring — on #07090D an outer border
   * reads as a gap, an inset ring reads as an edge.
   */
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm",
  {
    variants: {
      tone: {
        /*
         * Live and accepting bids — TEAL, not gold. V2 gives each hue one
         * meaning ("teal = live, active, realtime"; gold is money and the
         * primary action), and this pill is where the product says "live".
         * The ring colours are the palette literals because a box-shadow
         * layer cannot carry a token with its own alpha; one grep away.
         */
        active: "bg-urge-weak text-urge-text shadow-[inset_0_0_0_1px_rgba(45,212,191,0.3)]",
        /** Close to the end time. V2's red — «الثواني الأخيرة». */
        soon: "bg-stop-weak text-stop-text shadow-[inset_0_0_0_1px_rgba(255,77,94,0.3)]",
        /** Terminal. No bidding (BR-15). Neutral, quiet. */
        ended: "bg-calm-weak text-calm-text shadow-[inset_0_0_0_1px_var(--c-rule-strong)]",
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
