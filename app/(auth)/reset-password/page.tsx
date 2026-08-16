import type { Metadata } from "next";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "استعادة كلمة المرور" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto mt-14 w-full max-w-[420px]">
      <h1 className="mb-1 font-display text-[28px] font-semibold">نسيت كلمة المرور؟</h1>
      <p className="mb-7 text-[15px] text-ink2">
        اكتب بريدك ونرسل لك رابطًا تختار منه كلمة مرور جديدة.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
