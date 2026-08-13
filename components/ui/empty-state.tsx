import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** e.g. the create-auction prompt shown to a signed-in user (FR-LIST-08). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-rule bg-surface flex flex-col items-center gap-3 rounded-lg border border-dashed px-5 py-12 text-center",
        className,
      )}
    >
      <h2 className="text-md font-semibold">{title}</h2>
      {description ? <p className="text-ink-2 max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-1 w-full sm:w-auto">{action}</div> : null}
    </div>
  );
}
