import { Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "استعادة كلمة المرور — دلال" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  return (
    <Page title="استعادة كلمة المرور" description="أعد ضبط كلمة مرورك." width="narrow">
      <div className="flex flex-col gap-4">
        {/* FR-AUTH-29 — a clear message, and the option to request a new one. */}
        {expired ? (
          <Alert tone="error" title="الرابط لم يعد صالحًا">
            انتهت صلاحية رابط إعادة التعيين أو سبق استخدامه. اطلب رابطًا جديدًا
            من هنا.
          </Alert>
        ) : null}

        <Card>
          <CardBody>
            <ResetPasswordForm />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
