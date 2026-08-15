import * as React from "react";

import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover affordance. Use only when the whole card is a link. */
  interactive?: boolean;
  as?: "div" | "article" | "section";
}

/**
 * The surface every panel is built on — DESIGN_SYSTEM.md §8.1.
 * The listing card (AUC-09) is built on this, not on its own markup.
 */
export function Card({
  className,
  interactive = false,
  as: Tag = "div",
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        /*
         * V2 (design-system/previews/auction-card.html): the surface carries an
         * INSET hairline (`shadow-e1`) instead of a border. On #07090D an
         * outer border reads as a gap; the inset ring reads as an edge. Same
         * box, so no layout shifts against the border version.
         */
        "bg-surface rounded-lg shadow-e1",
        interactive && [
          /*
           * His `.card:hover` — "الحدّ يتوهّج عند المرور، ما يتغيّر سُمكه":
           * the hairline turns gold and glows, its thickness never changes,
           * and the card lifts 2px. Colours are the palette's gold literal
           * because a box-shadow cannot read a Tailwind colour token with
           * per-layer alpha; if --c-brand moves, this moves with the PR that
           * moves it (one grep: 245,185,66).
           */
          "transition-[box-shadow,transform] duration-[150ms] ease-out-soft",
          "hover:-translate-y-0.5",
          "hover:shadow-[inset_0_0_0_1px_rgba(245,185,66,0.35),0_0_28px_rgba(245,185,66,0.14)]",
        ],
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-3 p-4 sm:p-5", className)} {...props} />;
}
