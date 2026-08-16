import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "إنشاء حساب" };

export default async function RegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto mt-14 w-full max-w-[420px]">
      <h1 className="mb-1 font-display text-[28px] font-semibold">إنشاء حساب</h1>
      <p className="mb-7 text-[15px] text-ink2">
        اسمك المعروض هو هويتك الوحيدة أمام الآخرين — بريدك ما يظهر لأحد.
      </p>
      <RegisterForm />
    </div>
  );
}
