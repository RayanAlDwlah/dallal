import Link from "next/link";

import { ActiveListing } from "@/components/auction/active-listing";
import { CategoryRail } from "@/components/category/category-rail";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveAuctions } from "@/lib/auctions/listing";
import { listMainCategories } from "@/lib/categories/catalog";
import { getVerifiedUserId } from "@/lib/auth/identity";

/**
 * The marketplace home — AUC-09, restyled to the approved V2 layout language
 * (the hero, the icon rail, the glowing grid). FR-LIST-01: public, no auth
 * guard, and there must not be one.
 *
 * V2 adds ?q= — the topbar search lands here and the SERVER filters
 * (lib/auctions/listing.ts). The hero steps aside for search results: a
 * person mid-search asked a question, and the answer goes first.
 */
export default async function ListingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searching = Boolean(q?.trim());

  const [{ entries, serverNow, failed }, viewerId, categories] = await Promise.all([
    listActiveAuctions(undefined, q),
    getVerifiedUserId(),
    listMainCategories(),
  ]);

  return (
    <Container as="main" className="flex flex-col gap-6 py-6 sm:py-8">
      {!searching ? (
        /* The hero (previews/colors.html) — the ONE gradient in the product. */
        <section className="bg-surface relative overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--c-rule)]">
          <div className="hero-glow" aria-hidden="true" />
          <div className="relative px-6 py-10 sm:px-9 sm:py-12">
            <h1 className="m-0 text-[32px] leading-tight font-bold sm:text-[40px]">
              مزاد مباشر الآن
            </h1>
            <p className="text-ink-2 mt-2 mb-6 max-w-[52ch] text-[15px]">
              زايد لحظيًا على سيارات وعقارات وساعات ولوحات مميزة — أعلى مزايد
              يفوز، والسعر يتحدّث قدامك ثانية بثانية.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={viewerId ? "/auctions/new" : "/register"}
                className="btn-gold h-12 px-7 text-[15px]"
              >
                أنشئ مزادك
              </Link>
              <a href="#auctions" className="btn-ghost h-12 px-6 text-[15px]">
                تصفّح المزادات
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <section id="auctions" className="flex scroll-mt-24 flex-col gap-4">
        <CategoryRail categories={categories} activeSlug={null} />

        {searching ? (
          <p className="text-ink-2 m-0 text-sm">
            نتائج البحث عن «<bdi>{q}</bdi>» — <span className="num">{entries.length}</span>{" "}
            مزاد.{" "}
            <Link href="/" className="text-brand-text underline">
              امسح البحث
            </Link>
          </p>
        ) : null}

        {failed ? (
          <Alert tone="error">
            تعذّر تحميل المزادات. حدِّث الصفحة، وإن تكرّر الأمر فالمشكلة عندنا لا عندك.
          </Alert>
        ) : (
          <ActiveListing
            entries={entries}
            serverNow={serverNow}
            empty={
              searching ? (
                <EmptyState
                  title="لا نتائج لهذا البحث"
                  description="جرّب كلمة أعم، أو تصفّح الأقسام أعلاه."
                  action={
                    <Link
                      href="/"
                      className="bg-brand text-on-brand border-brand min-h-tap inline-flex w-full items-center justify-center rounded-md border px-5 font-semibold sm:w-auto"
                    >
                      كل المزادات
                    </Link>
                  }
                />
              ) : (
                <EmptyState
                  title="لا توجد مزادات نشطة الآن"
                  description={
                    viewerId
                      ? "كن أول من ينشر مزادًا — يظهر هنا فور نشره."
                      : "سجّل الدخول أو أنشئ حسابًا لتنشر أول مزاد."
                  }
                  action={
                    <Link
                      href={viewerId ? "/auctions/new" : "/register"}
                      className="bg-brand text-on-brand border-brand min-h-tap inline-flex w-full items-center justify-center rounded-md border px-5 font-semibold sm:w-auto"
                    >
                      {viewerId ? "أنشئ مزادًا" : "أنشئ حسابًا"}
                    </Link>
                  }
                />
              )
            }
          />
        )}
      </section>
    </Container>
  );
}
