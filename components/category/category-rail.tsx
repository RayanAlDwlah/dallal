import Link from "next/link";

import { CategoryIcon } from "@/components/category/category-icon";
import { cn } from "@/lib/cn";
import type { Category } from "@/lib/categories/catalog";

/**
 * V2 — the browse rail (categories.html): «الكل» pinned first, then the 13
 * mains, each with its approved icon, as one horizontally scrollable chip row
 * that hides its scrollbar (rail-scroll). Pure presentation; filtering happens
 * in the server read of the target page.
 */
export interface CategoryRailProps {
  categories: Category[];
  /** The active main's slug, or null when «الكل» is the active chip. */
  activeSlug: string | null;
}

function Chip({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 flex-none items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition",
        active
          ? "bg-brand text-on-brand font-semibold"
          : "bg-surface text-ink-2 hover:text-ink shadow-[inset_0_0_0_1px_var(--c-rule)]",
      )}
    >
      <CategoryIcon icon={icon} className="size-[17px]" />
      {children}
    </Link>
  );
}

export function CategoryRail({ categories, activeSlug }: CategoryRailProps) {
  /* A failed catalog read arrives as an empty array; a rail of one «الكل»
   * chip is noise, so the row degrades to nothing (the listing still works). */
  if (categories.length === 0) return null;

  return (
    <nav aria-label="تصفّح حسب القسم" className="rail-scroll -mx-4 px-4">
      <div className="flex items-center gap-2 pb-1.5">
        <Chip href="/" active={activeSlug === null} icon="all">
          الكل
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.id}
            href={`/c/${c.slug}`}
            active={activeSlug === c.slug}
            icon={c.icon ?? "box"}
          >
            {c.nameAr}
          </Chip>
        ))}
      </div>
    </nav>
  );
}
