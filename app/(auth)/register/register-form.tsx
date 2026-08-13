"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/validation";
import { registerAction, type AuthFormState } from "../actions";

/** AUTH-02, AUTH-03 — FR-AUTH-01 → FR-AUTH-07, FR-PROF-02, FR-PROF-03. */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    registerAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="البريد الإلكتروني" error={state.fieldErrors?.email} required>
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

      <Field
        label="الاسم الظاهر"
        /*
         * FR-PROF-03a — saying *why* it is public matters more than saying it
         * must be unique: this is the name that names the winner.
         */
        hint={`يظهر للجميع في سجل المزايدات وكاسم البائع والفائز. من ${DISPLAY_NAME_MIN_LENGTH} إلى ${DISPLAY_NAME_MAX_LENGTH} محرفًا، ولا يتكرر بين الحسابات.`}
        error={state.fieldErrors?.displayName}
        required
      >
        {(props) => (
          <Input
            {...props}
            name="displayName"
            type="text"
            autoComplete="nickname"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
          />
        )}
      </Field>

      <Field
        label="كلمة المرور"
        /* FR-AUTH-04 — the rule is stated before submission, not only on failure. */
        hint={`${PASSWORD_MIN_LENGTH} أحرف على الأقل.`}
        error={state.fieldErrors?.password}
        required
      >
        {(props) => (
          <Input
            {...props}
            name="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className="text-start"
          />
        )}
      </Field>

      <Button type="submit" loading={pending}>
        أنشئ الحساب
      </Button>

      <p className="text-ink-2 text-sm">
        لديك حساب؟{" "}
        <Link href="/login" className="text-brand-text font-semibold">
          سجّل الدخول
        </Link>
      </p>
    </form>
  );
}
