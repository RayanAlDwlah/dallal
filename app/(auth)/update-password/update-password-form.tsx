"use client";

import { useActionState } from "react";

import { updatePassword, type AuthFormState } from "@/app/(auth)/actions";

const initial: AuthFormState = { error: null };

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);

  return (
    <form action={action} className="hairline rounded-[22px] bg-surface p-6">
      <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="password">
        كلمة المرور الجديدة
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
      <p className="mb-5 text-[12.5px] text-ink3">8 محارف على الأقل.</p>

      <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="confirm">
        تأكيد كلمة المرور
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        dir="ltr"
        className="field text-start"
      />

      {state.error ? (
        <p className="mt-4 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-gold mt-6 h-12 w-full text-[15px]">
        {pending ? "جارٍ الحفظ…" : "احفظ كلمة المرور"}
      </button>
    </form>
  );
}
