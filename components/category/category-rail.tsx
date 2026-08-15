import Link from "next/link";

import { cn } from "@/lib/cn";
import type { Category } from "@/lib/categories/catalog";

/**
 * V2 — the browse rail: «الكل» pinned first, then the 13 mains, as one
 * horizontally scrollable chip row (categories.html). Pure presentation; the
 * filtering itself happens in the server read the target page performs.
 *
 * Logical properties only — the row mirrors under dir="rtl" with no
 * left/right anywhere, and the scroll container hides its scrollbar the way
 * the prototype does without stopping wheel/drag/keyboard scrolling.
 */
export interface CategoryRailProps {
  categories: Category[];
  /** The active main's slug, or null when «الكل» is the active chip. */
  activeSlug: string | null;
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "min-h-tap inline-flex shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap",
        active
          ? "bg-brand text-on-brand border-brand"
          : "border-rule bg-surface text-ink-2",
      )}
    >
      {children}
    </Link>
  );
}

export function CategoryRail({ categories, activeSlug }: CategoryRailProps) {
  /* A failed catalog read arrives as an empty array; a rail of one «الكل»
   * chip is noise, so the row degrades to nothing (the listing still works). */
  if (categories.length === 0) return null;

  return (
    <nav aria-label="تصفّح حسب القسم" className="-mx-4 overflow-x-auto px-4">
      <div className="flex items-center gap-2 pb-1">
        <Chip href="/" active={activeSlug === null}>
          الكل
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} href={`/c/${c.slug}`} active={activeSlug === c.slug}>
            {c.nameAr}
          </Chip>
        ))}
      </div>
    </nav>
  );
}
