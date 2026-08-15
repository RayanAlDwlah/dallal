import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActiveListing } from "@/components/auction/active-listing";
import { CategoryRail } from "@/components/category/category-rail";
import { Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveAuctions } from "@/lib/auctions/listing";
import { categoryFamily, listMainCategories } from "@/lib/categories/catalog";
import { getVerifiedUserId } from "@/lib/auth/identity";

/**
 * V2 — one main category's marketplace: the same listing as the home page,
 * restricted to the category family (the main plus its subs). Public, like
 * the home listing (FR-LIST-01); an unknown slug is a not-found, never an
 * error page.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const family = await categoryFamily(slug);
  return { title: family ? family.main.nameAr : "الأقسام" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const family = await categoryFamily(slug);
  if (!family) notFound();

  const [{ entries, serverNow, failed }, viewerId, categories] = await Promise.all([
    listActiveAuctions(family.ids),
    getVerifiedUserId(),
    listMainCategories(),
  ]);

  return (
    <Page
      title={family.main.nameAr}
      description="المزادات المفتوحة في هذا القسم، الأقرب انتهاءً أولاً."
    >
      <CategoryRail categories={categories} activeSlug={slug} />

      {failed ? (
        <Alert tone="error">
          تعذّر تحميل المزادات. حدِّث الصفحة، وإن تكرّر الأمر فالمشكلة عندنا لا عندك.
        </Alert>
      ) : (
        <ActiveListing
          entries={entries}
          serverNow={serverNow}
          empty={
            <EmptyState
              title="لا توجد مزادات نشطة في هذا القسم"
              description={
                viewerId
                  ? "كن أول من ينشر مزادًا هنا — يظهر فور نشره."
                  : "تصفّح الأقسام الأخرى، أو سجّل الدخول لتنشر أول مزاد."
              }
              action={
                <Link
                  href={viewerId ? "/auctions/new" : "/"}
                  className="bg-brand text-on-brand border-brand min-h-tap inline-flex w-full items-center justify-center rounded-md border px-5 font-semibold sm:w-auto"
                >
                  {viewerId ? "أنشئ مزادًا" : "كل المزادات"}
                </Link>
              }
            />
          }
        />
      )}
    </Page>
  );
}
