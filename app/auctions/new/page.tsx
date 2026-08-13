import { redirect } from "next/navigation";

import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";
import { getSessionState } from "@/lib/auth/identity";
import { loginPath } from "@/lib/auth/validation";

/**
 * Create auction.
 *
 * Structure only. AUC-01 → AUC-08 build the form, its validation (duration
 * 5 minutes to 7 days, BR-38), image upload and publication. Nothing is
 * validated or submitted here.
 *
 * The access guard below is AUTH-09 (Abdulrahman) — behaviour, not
 * presentation. The placeholder it wraps is untouched.
 */
export default async function CreateAuctionPage() {
  /*
   * FR-AUTH-22 — server-verified on every request, not once at sign-in.
   *
   * This redirect is a courtesy, not the enforcement: FR-AUTH-24 makes route
   * gating a UX affordance only. What actually stops an unauthenticated
   * insert is the auctions_owner_insert policy, whose WITH CHECK ties
   * owner_id to auth.uid() inside the database (SEC-Z2). Deleting this guard
   * would degrade the experience; it would not open a hole.
   */
  const state = await getSessionState();
  if (state !== "authenticated") {
    /* FR-AUTH-17 — the redirect carries why, so the login screen can say it. */
    redirect(loginPath("/auctions/new", state === "expired" ? "expired" : "required"));
  }

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
