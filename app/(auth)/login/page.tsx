import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; link?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { next, link } = await searchParams;

  return (
    <div className="mx-auto mt-14 w-full max-w-[420px]">
      <h1 className="mb-1 font-display text-[28px] font-semibold">تسجيل الدخول</h1>
      <p className="mb-7 text-[15px] text-ink2">ارجع لمزاداتك ومزايداتك.</p>
      {link === "invalid" ? (
        <p className="mb-4 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
          الرابط غير صالح أو انتهت صلاحيته — تُستخدم روابط البريد مرة وحدة فقط.
        </p>
      ) : null}
      <LoginForm next={next} />
    </div>
  );
}
