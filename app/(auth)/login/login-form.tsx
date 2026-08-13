"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginAction, type AuthFormState } from "../actions";

/**
 * AUTH-04 — FR-AUTH-08 → FR-AUTH-11.
 *
 * Presentation is composed entirely from Mohammed's primitives (CLAUDE.md §1);
 * this file adds behaviour and no visual language of its own.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/*
        FR-AUTH-09 — the failure message is form-level, never attached to the
        email field: a message under "email" would itself say which half was
        wrong, which is the disclosure the requirement forbids.
      */}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {/* Carries the return destination through the POST (FR-AUTH-10). */}
      <input type="hidden" name="next" value={next ?? ""} />

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

      <Field label="كلمة المرور" error={state.fieldErrors?.password} required>
        {(props) => (
          <Input
            {...props}
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className="text-start"
          />
        )}
      </Field>

      <Button type="submit" loading={pending}>
        تسجيل الدخول
      </Button>

      <div className="text-ink-2 flex flex-col gap-2 text-sm">
        {/* FR-AUTH-25 — reset starts from the login screen, unauthenticated. */}
        <Link href="/reset-password" className="text-brand-text font-semibold">
          نسيت كلمة المرور؟
        </Link>
        <p>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="text-brand-text font-semibold">
            أنشئ حسابًا
          </Link>
        </p>
      </div>
    </form>
  );
}
