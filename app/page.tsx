import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Auction listing — the marketplace home.
 *
 * Structure only. The real listing is AUC-09: active auctions ONLY
 * (FR-LIST-05), ordered soonest-ending first (FR-LIST-06). No auction data
 * is fetched or invented here.
 */
export default function ListingPage() {
  return (
    <Page
      title="المزادات النشطة"
      description="تصفّح المزادات المفتوحة، الأقرب انتهاءً أولاً."
    >
      <NotImplemented issue="AUC-09" owner="محمد" />
    </Page>
  );
}
