"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetRequestSchema,
} from "@/lib/validations/auth";

export interface AuthFormState {
  error: string | null;
  sent?: boolean;
}

/**
 * The origin this request actually arrived on, so emailed links point back at
 * the same host the user is standing on — production, a preview deployment or
 * localhost — instead of a hardcoded one. Every value used here must also be
 * in the project's Redirect URLs allow-list; Supabase refuses the rest.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول المطلوبة" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.message.includes("already registered")) {
      return { error: "هذا البريد مسجّل من قبل — جرّب تسجيل الدخول" };
    }
    if (error.code === "weak_password") {
      return { error: "كلمة المرور ضعيفة — 8 محارف على الأقل" };
    }
    return { error: "تعذّر إنشاء الحساب — حاول مرة أخرى" };
  }

  if (!data.session) {
    /* Email confirmation is enabled on this environment. */
    return { error: "أرسلنا رابط تأكيد إلى بريدك — أكّد بريدك ثم سجّل الدخول" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول المطلوبة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "بريدك غير مؤكد بعد — افتح رابط التأكيد المرسل إليك" };
    }
    return { error: "بيانات الدخول غير صحيحة" };
  }

  const next = formData.get("next");
  revalidatePath("/", "layout");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Sends the recovery link. The answer is the SAME whether or not the address
 * has an account: a form that says "no such user" is a way to find out who is
 * registered here, one address at a time.
 */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "أدخل بريدًا إلكترونيًا صحيحًا" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await requestOrigin()}/auth/callback?next=/update-password`,
  });

  /* A rate limit is the one thing worth saying out loud — otherwise the user
     waits for an email that was never going to arrive. */
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "أرسلنا رسائل كثيرة الآن — انتظر شوي وحاول مرة ثانية" };
  }

  return { error: null, sent: true };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "تحقق من كلمة المرور" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "انتهت صلاحية الرابط — اطلب رابطًا جديدًا" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "هذي نفس كلمة المرور الحالية — اختر وحدة جديدة" };
    }
    if (error.code === "weak_password") {
      return { error: "كلمة المرور ضعيفة — 8 محارف على الأقل" };
    }
    return { error: "تعذّر تغيير كلمة المرور — حاول مرة أخرى" };
  }

  revalidatePath("/", "layout");
  redirect("/?password=updated");
}
