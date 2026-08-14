import { redirect } from "next/navigation";

import { Page } from "@/components/layout/container";
import { Card, CardBody } from "@/components/ui/card";
import { getOwnEmail, getSessionState, getViewer } from "@/lib/auth/identity";
import { loginPath } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "حسابي — دلال" };

/**
 * AUTH-08 — FR-PROF-04, the minimal profile.
 *
 * FR-PROF-01 fixes the contents exactly: internal identifier, email (private),
 * display name (public), creation timestamp. FR-PROF-07 rules out avatars,
 * bios, locations, phone numbers, payment details and ratings — their absence
 * is the requirement, so nothing may be added here to "fill out" the screen.
 *
 * Editing the display name is FR-PROF-05, a Should Have, and is not built:
 * public.profiles has no update policy, so the database refuses the write too.
 */
export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) {
    /*
     * FR-AUTH-17 — carry *why* across the redirect. Bouncing someone whose
     * session just expired to an unexplained login form is the silent breakage
     * the requirement names.
     */
    const state = await getSessionState();
    redirect(loginPath("/profile", state === "expired" ? "expired" : "required"));
  }

  /*
   * The email comes from the session, never from a table. That is ADR-7's
   * structural guarantee working as designed: there is no column to read, so
   * no query anywhere can accidentally publish it (FR-PROF-06, SEC-P1).
   */
  const email = await getOwnEmail();

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", viewer.id)
    .maybeSingle<{ created_at: string }>();

  // `ar-SA` alone renders Arabic-Indic digits; BR-42 requires Western (0-9).
  const memberSince = data
    ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", { dateStyle: "medium" }).format(
        new Date(data.created_at),
      )
    : null;

  return (
    <Page title="حسابي" description="بياناتك الأساسية." width="narrow">
      <Card>
        <CardBody>
          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <dt className="text-ink-2 text-sm font-semibold">الاسم الظاهر</dt>
              {/* bdi: a Latin display name must not flip the line (CLAUDE.md §3). */}
              <dd className="text-base font-semibold">
                <bdi>{viewer.displayName}</bdi>
              </dd>
              <p className="text-ink-3 text-xs">
                هذا هو اسمك العام الوحيد — يظهر في سجل المزايدات وكاسم البائع
                والفائز.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <dt className="text-ink-2 text-sm font-semibold">البريد الإلكتروني</dt>
              <dd className="text-base" dir="ltr">
                <bdi>{email ?? "—"}</bdi>
              </dd>
              <p className="text-ink-3 text-xs">
                خاص بك وحدك. لا يظهر لأي مستخدم آخر في أي مكان في المنصة.
              </p>
            </div>

            {memberSince ? (
              <div className="flex flex-col gap-1">
                <dt className="text-ink-2 text-sm font-semibold">تاريخ الإنشاء</dt>
                <dd className="text-base">
                  <bdi>{memberSince}</bdi>
                </dd>
              </div>
            ) : null}
          </dl>
        </CardBody>
      </Card>
    </Page>
  );
}
