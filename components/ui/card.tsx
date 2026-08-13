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
        "bg-surface border-rule rounded-lg border",
        interactive &&
          "hover:border-rule-strong hover:shadow-e2 transition-[border-color,box-shadow] duration-[120ms]",
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
