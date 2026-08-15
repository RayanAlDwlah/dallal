import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "كلمة مرور جديدة" };

export default async function UpdatePasswordPage() {
  /* Reaching this page means the recovery link already established a session
     in /auth/callback. Without one there is nothing to change, and saying so
     here is kinder than a form that fails on submit. */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto mt-14 w-full max-w-[420px]">
        <div className="hairline rounded-[22px] bg-surface p-6 text-center">
          <h1 className="m-0 mb-1.5 font-display text-[20px] font-semibold">
            الرابط غير صالح أو انتهت صلاحيته
          </h1>
          <p className="m-0 mb-6 text-sm text-ink2">
            روابط الاستعادة تنتهي بعد فترة قصيرة، وتُستخدم مرة وحدة. اطلب رابطًا جديدًا.
          </p>
          <Link href="/reset-password" className="btn-gold h-11 px-6 text-sm">
            اطلب رابطًا جديدًا
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-14 w-full max-w-[420px]">
      <h1 className="mb-1 font-display text-[28px] font-semibold">كلمة مرور جديدة</h1>
      <p className="mb-7 text-[15px] text-ink2">اختر كلمة مرور جديدة لحسابك.</p>
      <UpdatePasswordForm />
    </div>
  );
}
