import Link from "next/link";

import { AuctionCard } from "@/components/auction/auction-card";
import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveAuctions, serverNow } from "@/lib/auctions/repository";

export const metadata = { title: "المزادات النشطة" };

/**
 * AUC-09 — the auction listing.
 *
 * Public: no authentication required (FR-LIST-01). A Server Component, so the
 * first paint carries real content rather than an empty shell waiting on a
 * fetch — which is what the 3-second budget with up to 100 auctions needs
 * (NFR-PERF-01) and why the stack is Next.js rather than a client-only SPA.
 *
 * **Active auctions only** (FR-LIST-05, SC-71). An ended auction leaves this
 * page but stays reachable by direct link (FR-LIST-05a, FR-END-12).
 */
export default async function ListingPage() {
  const auctions = await listActiveAuctions();
  const now = serverNow().toISOString();

  return (
    <Container as="main" className="py-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-1 sm:mb-8">
        <h1 className="text-xl font-bold sm:text-2xl">المزادات النشطة</h1>
        <p className="text-ink-2 text-sm">مرتّبة حسب الأقرب انتهاءً.</p>
      </header>

      {auctions.length === 0 ? (
        <EmptyState
          title="لا توجد مزادات نشطة الآن"
          description="كن أول من ينشر مزاداً."
          action={
            <Link
              href="/auctions/new"
              className="bg-brand text-on-brand min-h-tap inline-flex items-center rounded-md px-5 font-semibold"
            >
              أنشئ مزاداً
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <li key={auction.id}>
              <AuctionCard auction={auction} serverNow={now} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
