import { cn } from "@/lib/cn";

export interface SkeletonProps {
  /** DESIGN_SYSTEM.md §8.1 — line, block, card. */
  shape?: "line" | "block" | "card";
  className?: string;
}

/**
 * Loading placeholder. Purely presentational and always `aria-hidden`; the
 * surrounding region announces its own busy state so a screen reader is not
 * read a wall of meaningless boxes.
 */
export function Skeleton({ shape = "line", className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-sunk animate-pulse",
        shape === "line" && "h-4 w-full rounded-sm",
        shape === "block" && "h-24 w-full rounded-md",
        shape === "card" && "h-56 w-full rounded-lg",
        className,
      )}
    />
  );
}
