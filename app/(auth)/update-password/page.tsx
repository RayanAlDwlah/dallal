import Link from "next/link";

import { Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { getVerifiedUserId } from "@/lib/auth/identity";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata = { title: "كلمة مرور جديدة — دلال" };

export default async function UpdatePasswordPage() {
  /*
   * Reaching this screen without a session means the recovery link was never
   * exchanged — expired, already used, or opened directly. FR-AUTH-29 requires
   * a clear message and a way to request a new one, not an empty form that
   * fails on submit.
   */
  const userId = await getVerifiedUserId();

  if (!userId) {
    return (
      <Page title="كلمة مرور جديدة" width="narrow">
        <div className="flex flex-col gap-4">
          <Alert tone="error" title="الرابط لم يعد صالحًا">
            افتح رابط إعادة التعيين من بريدك، أو اطلب رابطًا جديدًا.
          </Alert>
          <Link href="/reset-password" className="text-brand-text text-sm font-semibold">
            اطلب رابطًا جديدًا
          </Link>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="كلمة مرور جديدة"
      description="اختر كلمة مرور جديدة لحسابك."
      width="narrow"
    >
      <Card>
        <CardBody>
          <UpdatePasswordForm />
        </CardBody>
      </Card>
    </Page>
  );
}
