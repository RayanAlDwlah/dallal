import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Auction detail.
 *
 * TEAM.md §11 splits this page by owner: Mohammed owns the shell, product
 * content, status and the price display region; Rayan owns the bid control,
 * bid history and the outcome banner. Those components mount here — they are
 * not written here.
 */
export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Page title="تفاصيل المزاد" description={`المعرّف: ${id}`}>
      <NotImplemented issue="AUC-11 → AUC-17" owner="محمد" />
    </Page>
  );
}
