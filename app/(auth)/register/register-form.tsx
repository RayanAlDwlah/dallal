"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUp, type AuthFormState } from "@/app/(auth)/actions";

const initial: AuthFormState = { error: null };

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, initial);

  return (
    <form action={action} className="hairline rounded-[22px] bg-surface p-6">
      <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="displayName">
        الاسم المعروض
      </label>
      <input
        id="displayName"
        name="displayName"
        type="text"
        required
        minLength={2}
        maxLength={40}
        autoComplete="nickname"
        className="field mb-1.5"
        placeholder="مثال: أبو فهد"
      />
      <p className="mb-5 text-[12.5px] text-ink3">من محرفين إلى 40 محرفًا. يظهر في مزايداتك ومزاداتك.</p>

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
        className="field mb-5 text-start"
        placeholder="you@example.com"
      />

      <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="password">
        كلمة المرور
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        dir="ltr"
        className="field mb-1.5 text-start"
      />
      <p className="text-[12.5px] text-ink3">8 محارف على الأقل.</p>

      {state.error ? (
        <p className="mt-4 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-gold mt-6 h-12 w-full text-[15px]">
        {pending ? "جارٍ إنشاء الحساب…" : "إنشاء حساب"}
      </button>

      <p className="mt-5 text-center text-sm text-ink2">
        عندك حساب؟{" "}
        <Link href="/login" className="font-semibold text-gold">
          سجّل الدخول
        </Link>
      </p>
    </form>
  );
}
