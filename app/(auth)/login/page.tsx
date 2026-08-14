import { redirect } from "next/navigation";

import { Page } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { getVerifiedUserId } from "@/lib/auth/identity";
import { safeLoginReason, safeNextPath } from "@/lib/auth/validation";

import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول — دلال" };

/**
 * FR-AUTH-17 — an expired session must leave the user told, not guessing.
 *
 * Deliberately `info` and not `error`: neither case is the user's mistake, and
 * `DESIGN_SYSTEM.md` §8.1 reserves red for actual errors. A session ending is
 * the product working as designed.
 */
const NOTICE: Record<"expired" | "required", { title: string; body: string }> = {
  expired: {
    title: "انتهت جلستك",
    body: "سجّل الدخول مرة أخرى للمتابعة من حيث توقّفت. تصفّح المزادات وسجل المزايدات يعمل بدون تسجيل دخول.",
  },
  required: {
    title: "هذه الصفحة تتطلب تسجيل الدخول",
    body: "سجّل الدخول للمتابعة. تصفّح المزادات وسجل المزايدات مفتوح للجميع بدون حساب.",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const safeNext = safeNextPath(next);
  const notice = safeLoginReason(reason);

  /* Already signed in — send them on rather than showing a form they do not need. */
  if (await getVerifiedUserId()) {
    redirect(safeNext ?? "/");
  }

  return (
    <Page title="تسجيل الدخول" description="ادخل إلى حسابك." width="narrow">
      <div className="flex flex-col gap-4">
        {notice ? (
          <Alert tone="info" title={NOTICE[notice].title}>
            {NOTICE[notice].body}
          </Alert>
        ) : null}

        <Card>
          <CardBody>
            <LoginForm next={safeNext ?? undefined} />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
