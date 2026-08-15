import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * V2 — the category catalog read. Reference data: 13 mains, seeded by
 * migration, publicly readable, changed only by migration. Cached per request;
 * the catalog cannot change under a render.
 */

export interface Category {
  id: number;
  slug: string;
  nameAr: string;
  parentId: number | null;
  icon: string | null;
}

interface CategoryRow {
  id: number;
  slug: string;
  name_ar: string;
  parent_id: number | null;
  icon: string | null;
}

/** All categories, mains ordered by sort, then subs. Empty on a failed read —
 *  a missing rail degrades the page, it must not take it down. */
export const listCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name_ar, parent_id, icon")
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort", { ascending: true })
    .returns<CategoryRow[]>();

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    parentId: row.parent_id,
    icon: row.icon,
  }));
});

export async function listMainCategories(): Promise<Category[]> {
  return (await listCategories()).filter((c) => c.parentId === null);
}

/** A main category and every id under it — the filter set for /c/[slug]. */
export async function categoryFamily(
  slug: string,
): Promise<{ main: Category; ids: number[] } | null> {
  const all = await listCategories();
  const main = all.find((c) => c.slug === slug && c.parentId === null) ?? null;
  if (!main) return null;
  const ids = [main.id, ...all.filter((c) => c.parentId === main.id).map((c) => c.id)];
  return { main, ids };
}
