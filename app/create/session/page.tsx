import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateSessionWizard } from "@/components/sessions/create-session-wizard";
import { fetchCategoryTree } from "@/lib/auctions/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "إنشاء جلسة" };

export default async function CreateSessionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create/session");

  const categories = await fetchCategoryTree(supabase);

  return (
    <div className="mx-auto max-w-[760px] pt-8">
      <h1 className="m-0 mb-1 font-display text-[28px] font-semibold">إنشاء جلسة</h1>
      <p className="m-0 mb-6 max-w-[66ch] text-[15px] text-ink2">
        الجلسة عرض متتابع: قطعة تفتح، تنتهي، تفتح اللي بعدها — والحاضرين في نفس الغرفة طول الوقت.
        تبنيها قبل الموعد، وتقودها لحظتها من غرفة تحكّم.
      </p>
      <CreateSessionWizard userId={user.id} categories={categories} />
    </div>
  );
}
