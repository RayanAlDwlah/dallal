"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { updatePasswordAction, type AuthFormState } from "../actions";

/** AUTH-13 — FR-AUTH-30. */
export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    updatePasswordAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field
        label="كلمة المرور الجديدة"
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
        حفظ كلمة المرور
      </Button>
    </form>
  );
}
