import { redirect } from "next/navigation";

import { Page } from "@/components/layout/container";
import { Card, CardBody } from "@/components/ui/card";
import { getVerifiedUserId } from "@/lib/auth/identity";

import { RegisterForm } from "./register-form";

export const metadata = { title: "إنشاء حساب — دلال" };

export default async function RegisterPage() {
  if (await getVerifiedUserId()) {
    redirect("/");
  }

  return (
    <Page
      title="إنشاء حساب"
      description="سجّل واستخدم المنصة فورًا — لا خطوة تحقق بريد (BR-37)."
      width="narrow"
    >
      <Card>
        <CardBody>
          <RegisterForm />
        </CardBody>
      </Card>
    </Page>
  );
}
