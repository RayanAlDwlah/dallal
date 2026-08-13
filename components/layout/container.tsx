import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface ContainerProps {
  children: ReactNode;
  /** `wide` for the listing grid, `narrow` for forms and auth screens. */
  width?: "wide" | "narrow";
  as?: ElementType;
  className?: string;
}

/**
 * The one horizontal gutter in the product.
 *
 * 375px is the base layer, not a breakpoint (DESIGN_SYSTEM.md §10), so the
 * gutter starts small and grows — it is never a desktop value shrunk down.
 */
export function Container({
  children,
  width = "wide",
  as: Tag = "div",
  className,
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        width === "wide" ? "max-w-6xl" : "max-w-2xl",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export interface PageProps {
  title: string;
  description?: string;
  /** Sits opposite the title on wider screens; stacks beneath on mobile. */
  actions?: ReactNode;
  children: ReactNode;
  width?: "wide" | "narrow";
}

/** Standard page frame: heading block, then content. */
export function Page({ title, description, actions, children, width = "wide" }: PageProps) {
  return (
    <Container width={width} as="main" className="py-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {description ? <p className="text-ink-2 text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </Container>
  );
}
