import { redirect } from "next/navigation";

import { Page } from "@/components/layout/container";
import { Card, CardBody } from "@/components/ui/card";
import { getVerifiedUserId } from "@/lib/auth/identity";
import { safeNextPath } from "@/lib/auth/validation";

import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول — دلال" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);

  /* Already signed in — send them on rather than showing a form they do not need. */
  if (await getVerifiedUserId()) {
    redirect(safeNext ?? "/");
  }

  return (
    <Page title="تسجيل الدخول" description="ادخل إلى حسابك." width="narrow">
      <Card>
        <CardBody>
          <LoginForm next={safeNext ?? undefined} />
        </CardBody>
      </Card>
    </Page>
  );
}
