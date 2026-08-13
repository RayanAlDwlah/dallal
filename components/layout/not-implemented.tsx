import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";

export interface NotImplementedProps {
  /** The GitHub plan issue that will replace this placeholder. */
  issue: string;
  /** Who owns that issue, so the route's owner is never ambiguous. */
  owner: string;
  children?: ReactNode;
}

/**
 * Marks a route that exists structurally but has no feature behind it yet.
 *
 * S0-08 establishes the routing skeleton; the features are separate issues.
 * This states plainly that nothing is implemented, so a placeholder is never
 * mistaken for a broken or half-built feature.
 */
export function NotImplemented({ issue, owner, children }: NotImplementedProps) {
  return (
    <Alert tone="info" title="لم تُنفَّذ هذه الشاشة بعد">
      <p>
        هذا هيكل مسار فقط من <span className="num">S0-08</span>. الميزة نفسها
        ضمن <span className="num">{issue}</span> ومالكها {owner}.
      </p>
      {children ? <div className="mt-2">{children}</div> : null}
    </Alert>
  );
}
