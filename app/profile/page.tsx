import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Route placeholder only — this screen belongs to Abdulrahman (@Dem4t).
 *
 * The minimal profile is AUTH-08 (FR-PROF-04). No profile data is read or
 * invented here.
 */
export default function ProfilePage() {
  return (
    <Page title="حسابي" description="بياناتك الأساسية." width="narrow">
      <NotImplemented issue="AUTH-08" owner="عبدالرحمن" />
    </Page>
  );
}
