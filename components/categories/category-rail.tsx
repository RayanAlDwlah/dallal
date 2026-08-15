import Link from "next/link";

import { CategoryIcon } from "@/components/categories/category-icon";
import type { Category } from "@/types/db";

/**
 * The filter rail (categories.html): scrolls horizontally, starts from the
 * right, «الكل» is always first and always available.
 */
export function CategoryRail({
  categories,
  activeSlug,
  q,
}: {
  categories: Category[];
  activeSlug?: string;
  q?: string;
}) {
  const href = (slug?: string) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (slug) usp.set("cat", slug);
    const s = usp.toString();
    return s ? `/?${s}` : "/";
  };

  const chip = (on: boolean) =>
    `flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition ${
      on
        ? "bg-gold font-semibold text-gold-ink"
        : "hairline bg-surface text-ink2 hover:text-ink"
    }`;

  return (
    <div className="rail-scroll flex gap-2 pb-1.5">
      <Link href={href()} className={chip(!activeSlug)}>
        <CategoryIcon icon="all" className="size-[17px]" />
        الكل
      </Link>
      {categories.map((c) => (
        <Link key={c.id} href={href(c.slug)} className={chip(activeSlug === c.slug)}>
          <CategoryIcon icon={c.icon} className="size-[17px]" />
          {c.name_ar}
        </Link>
      ))}
    </div>
  );
}
