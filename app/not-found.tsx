import Link from "next/link";

import { Page } from "@/components/layout/container";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Opening an auction that does not exist must show a clear message, not a raw
 * error page — FR-DETAIL-25, EC-13.
 */
export default function NotFound() {
  return (
    <Page title="الصفحة غير موجودة" width="narrow">
      <EmptyState
        title="لم نعثر على ما تبحث عنه"
        description="ربما حُذف الرابط أو كُتب بشكل غير صحيح."
        action={
          <Link
            href="/"
            className="bg-brand text-on-brand inline-flex min-h-tap w-full items-center justify-center rounded-md px-5 font-semibold sm:w-auto"
          >
            العودة إلى المزادات
          </Link>
        }
      />
    </Page>
  );
}
