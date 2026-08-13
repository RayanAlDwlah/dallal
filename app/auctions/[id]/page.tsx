import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Auction detail.
 *
 * TEAM.md §11, amended 2026-08-12: Mohammed owns this whole page, including
 * the bid control, bid history and outcome banner. Rayan owns what those
 * components *do* — submission, validation, accept/reject semantics, the
 * current-price value and its realtime updates — which arrive as typed props.
 * The page renders Rayan's semantics; it never re-derives them.
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
