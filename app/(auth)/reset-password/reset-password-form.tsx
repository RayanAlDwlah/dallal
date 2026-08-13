"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction, type AuthFormState } from "../actions";

/** AUTH-12 — FR-AUTH-25 → FR-AUTH-27. */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordResetAction,
    {},
  );

  /*
   * FR-AUTH-27 / EC-27 — the confirmation is identical for a registered and an
   * unregistered address, so the form is replaced by it either way. Leaving
   * the form on screen for one case and not the other would leak by shape
   * what the wording is careful not to leak in words.
   */
  if (state.notice) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="تحقّق من بريدك">
          {state.notice}
        </Alert>
        <Link href="/login" className="text-brand-text text-sm font-semibold">
          العودة إلى تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field
        label="البريد الإلكتروني"
        hint="أدخل البريد المسجّل في حسابك."
        error={state.fieldErrors?.email}
        required
      >
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            className="text-start"
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Button type="submit" loading={pending}>
        أرسل رابط إعادة التعيين
      </Button>

      <Link href="/login" className="text-brand-text text-sm font-semibold">
        العودة إلى تسجيل الدخول
      </Link>
    </form>
  );
}
