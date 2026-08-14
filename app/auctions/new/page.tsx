import { redirect } from "next/navigation";

import { Page } from "@/components/layout/container";
import { Card, CardBody } from "@/components/ui/card";
import { getSessionState } from "@/lib/auth/identity";
import { loginPath } from "@/lib/auth/validation";

import { CreateAuctionForm } from "./create-auction-form";

export const metadata = { title: "أنشئ مزادًا — دلال" };

/**
 * Create auction — AUC-01.
 *
 * The form, its validation (5 minutes to 7 days, BR-38), image upload and
 * publication now live in ./create-auction-form.tsx and ./actions.ts. AUC-02 →
 * AUC-08 remain @m7ya505's: the review step FR-CREATE-26a asks for, richer
 * upload affordances, and the orphaned-image sweep (AUC-05, referenced by the
 * action's one known gap).
 *
 * The access guard below is Abdulrahman's — AUTH-09, extended by AUTH-06 (#97)
 * to carry *why* the login screen is being shown. It is behaviour, not
 * presentation, and it is reproduced here verbatim: this commit replaced the
 * body the guard wraps and nothing else. Resolving the rebase the other way
 * would have restored `getVerifiedUserId()` and dropped the reason, silently
 * undoing FR-AUTH-17 on this one route with no test to catch it.
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
      <Card>
        <CardBody>
          <CreateAuctionForm />
        </CardBody>
      </Card>
    </Page>
  );
}
