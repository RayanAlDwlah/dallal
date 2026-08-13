import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Create auction.
 *
 * Structure only. AUC-01 → AUC-08 build the form, its validation (duration
 * 5 minutes to 7 days, BR-38), image upload and publication. Nothing is
 * validated or submitted here.
 */
export default function CreateAuctionPage() {
  return (
    <Page
      title="أنشئ مزادًا"
      description="انشر منتجك للمزايدة."
      width="narrow"
    >
      <NotImplemented issue="AUC-01 → AUC-08" owner="محمد" />
    </Page>
  );
}
