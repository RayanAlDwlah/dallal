import Link from "next/link";

import { ActiveListing } from "@/components/auction/active-listing";
import { CategoryRail } from "@/components/category/category-rail";
import { Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveAuctions } from "@/lib/auctions/listing";
import { listMainCategories } from "@/lib/categories/catalog";
import { getVerifiedUserId } from "@/lib/auth/identity";

/**
 * Auction listing — the marketplace home. AUC-09.
 *
 * Mohammed's issue (#51); see the header of app/auctions/new/actions.ts for why
 * it is in this branch.
 *
 * FR-LIST-01 — public. There is no auth guard on this page and there must not
 * be one: a visitor is a supported user (S0-10 §6), and BR-40 makes auctions
 * anonymously readable at the database as well, so this is not a UI-only
 * courtesy.
 *
 * FR-LIST-05b — an auction leaving the listing as its countdown reaches zero —
 * is AUC-10 (#52) and now happens in place, in
 * components/auction/active-listing.tsx. This file still supplies the rows and
 * the empty state; what it no longer does is assume the set is static for the
 * life of the page.
 *
 * Not built here, and left to their own issues: live per-item price push is
 * Should Have (FR-LIST-10, FR-RT-16), and so are search, filter, sort and
 * pagination (FR-LIST-12, S6).
 */
export default async function ListingPage() {
  const [{ entries, serverNow, failed }, viewerId, categories] = await Promise.all([
    listActiveAuctions(),
    getVerifiedUserId(),
    listMainCategories(),
  ]);

  /*
   * No page-level "create" action: SiteHeader's MEMBER_NAV already carries
   * "أنشئ مزادًا" on every page for a signed-in user, and two controls with the
   * same label is a worse affordance than one. FR-LIST-08's create prompt is a
   * property of the EMPTY state specifically, and appears below.
   */
  return (
    <Page
      title="المزادات النشطة"
      description="تصفّح المزادات المفتوحة، الأقرب انتهاءً أولاً."
    >
      {/* V2 — the browse rail. Above the grid on every state including empty:
          an empty CATEGORY must still offer the way to the others. */}
      <CategoryRail categories={categories} activeSlug={null} />

      {failed ? (
        /*
         * A failed read is NOT an empty marketplace. Showing FR-LIST-08's
         * "be the first" invitation here would tell a seller their auctions had
         * disappeared — and, because nothing can be cancelled or edited
         * (BR-30, BR-31), that is a frightening thing to be told wrongly.
         */
        <Alert tone="error">
          تعذّر تحميل المزادات. حدِّث الصفحة، وإن تكرّر الأمر فالمشكلة عندنا لا عندك.
        </Alert>
      ) : (
        /*
         * AUC-10 (#52) — the grid, and the removal of a card whose countdown
         * reaches zero, happen in ActiveListing. The empty state is built HERE
         * and handed down, for two reasons: its create prompt depends on the
         * server-verified session, which a client component must not be given;
         * and a marketplace that empties while you watch must look exactly like
         * one that was empty when you arrived (FR-LIST-08, FR-LIST-05b).
         *
         * 375px is the base layer, not a breakpoint (DESIGN_SYSTEM.md §10).
         */
        <ActiveListing
          entries={entries}
          serverNow={serverNow}
          empty={
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
          }
        />
      )}
    </Page>
  );
}
