"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, type AuthFormState } from "@/app/(auth)/actions";

const initial: AuthFormState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="hairline rounded-[22px] bg-surface p-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}

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

      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-[13.5px] font-semibold" htmlFor="password">
          كلمة المرور
        </label>
        <Link href="/reset-password" className="text-[12.5px] text-ink3 hover:text-gold">
          نسيتها؟
        </Link>
      </div>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        dir="ltr"
        className="field text-start"
      />

      {state.error ? (
        <p className="mt-4 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-gold mt-6 h-12 w-full text-[15px]">
        {pending ? "جارٍ الدخول…" : "دخول"}
      </button>

      <p className="mt-5 text-center text-sm text-ink2">
        ما عندك حساب؟{" "}
        <Link href="/register" className="font-semibold text-gold">
          أنشئ حسابًا
        </Link>
      </p>
    </form>
  );
}
