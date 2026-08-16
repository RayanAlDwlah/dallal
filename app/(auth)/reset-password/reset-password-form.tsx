"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset, type AuthFormState } from "@/app/(auth)/actions";

const initial: AuthFormState = { error: null };

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  if (state.sent) {
    return (
      <div className="hairline rounded-[22px] bg-surface p-6 text-center">
        <p className="m-0 mb-1.5 font-display text-[19px] font-semibold text-teal">
          راجع بريدك
        </p>
        <p className="m-0 mb-6 text-sm text-ink2">
          إذا كان لهذا البريد حساب عندنا، وصله رابط لاختيار كلمة مرور جديدة. الرابط صالح لمدة
          محدودة — وإذا ما وصل، شوف مجلد الرسائل غير المرغوب فيها.
        </p>
        <Link href="/login" className="btn-ghost h-11 px-6 text-sm">
          رجوع لتسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="hairline rounded-[22px] bg-surface p-6">
      <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="email">
        البريد الإلكتروني
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        dir="ltr"
        className="field text-start"
        placeholder="you@example.com"
      />

      {state.error ? (
        <p className="mt-4 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-gold mt-6 h-12 w-full text-[15px]">
        {pending ? "جارٍ الإرسال…" : "أرسل الرابط"}
      </button>

      <p className="mt-5 text-center text-sm text-ink2">
        تذكّرتها؟{" "}
        <Link href="/login" className="font-semibold text-gold">
          سجّل الدخول
        </Link>
      </p>
    </form>
  );
}
