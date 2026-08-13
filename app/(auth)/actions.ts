"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  normalizeDisplayName,
  safeNextPath,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";

/**
 * Every authentication write path — AUTH-02 → AUTH-05, AUTH-12, AUTH-13.
 *
 * These are server actions, so validation runs on the server whatever the
 * browser did or did not do (FR-AUTH-05). The forms re-use the same functions
 * purely to answer faster.
 */

export interface AuthFormState {
  /** Form-level failure, shown above the fields. */
  error?: string;
  /** FR-CREATE-12's principle: every failing field reported at once. */
  fieldErrors?: {
    email?: string;
    password?: string;
    displayName?: string;
  };
  /** A confirmation that keeps the user on the page instead of navigating. */
  notice?: string;
}

/** Read a form field as a string without letting a File through. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Is this display name already taken? — FR-PROF-03.
 *
 * Matched exactly, because the authority is the `unique` constraint on
 * profiles.display_name and PostgreSQL compares text case-sensitively. A
 * case-insensitive check here would reject names the database would have
 * accepted, which is a stricter rule than BR-39 states and therefore a
 * product decision nobody recorded.
 */
async function isDisplayNameTaken(displayName: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("display_name", displayName)
    .maybeSingle<{ id: string }>();
  return data !== null;
}

const DISPLAY_NAME_TAKEN = "هذا الاسم الظاهر مستخدم بالفعل. اختر اسمًا آخر.";

/**
 * AUTH-02, AUTH-03 — create an account and sign in immediately.
 *
 * FR-AUTH-07: there is no email verification step and there must not be one.
 * The Supabase project has "Confirm email" switched off (AUTH-01), which is
 * what makes signUp return a live session here rather than a pending user.
 */
export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const displayName = normalizeDisplayName(field(formData, "displayName"));

  const fieldErrors: AuthFormState["fieldErrors"] = {
    email: validateEmail(email),
    password: validatePassword(password),
    displayName: validateDisplayName(displayName),
  };

  if (fieldErrors.email || fieldErrors.password || fieldErrors.displayName) {
    return { fieldErrors };
  }

  /*
   * Checked before signUp so the user gets the specific message FR-PROF-03
   * requires. It is NOT the enforcement — the unique constraint is, and the
   * race between this read and the insert is handled below.
   */
  if (await isDisplayNameTaken(displayName)) {
    return { fieldErrors: { displayName: DISPLAY_NAME_TAKEN } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      /*
       * Carried into raw_user_meta_data, where the signup trigger reads it to
       * build the profile row in the same transaction as the account. That is
       * what makes "every account has a display name" structural rather than
       * hopeful (FR-PROF-02).
       */
      data: { display_name: displayName },
    },
  });

  if (error) {
    /*
     * FR-AUTH-02 — say the address is taken, and nothing further about the
     * account behind it. This is deliberately NOT the non-enumerating
     * treatment login gets (FR-AUTH-09): registration has to tell you the
     * address is unusable or you cannot proceed.
     */
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return {
        fieldErrors: { email: "هذا البريد الإلكتروني مسجّل بالفعل. سجّل الدخول أو استعد كلمة المرور." },
      };
    }

    /*
     * The trigger failing surfaces as an opaque database error, so ask what
     * actually happened instead of guessing: if the name is taken now, the
     * pre-check above lost a race with another registration. If it is not,
     * the cause is something else and must not be mislabelled.
     */
    if (await isDisplayNameTaken(displayName)) {
      return { fieldErrors: { displayName: DISPLAY_NAME_TAKEN } };
    }

    return { error: "تعذّر إنشاء الحساب. حاول مرة أخرى." };
  }

  /*
   * No session on a successful signUp means the project has "Confirm email"
   * switched back on — GoTrue returns a pending user instead of a session.
   * That is a direct violation of BR-37 / FR-AUTH-07, and the visible symptom
   * would otherwise be a user silently landing on the listing signed out,
   * which reads as a bug in this form rather than as a settings change.
   */
  if (!data.session) {
    return {
      error:
        "تم إنشاء الحساب لكن لم تُفتح الجلسة. هذا يعني أن خيار تأكيد البريد أُعيد تفعيله في Supabase، وهو مخالف لـ BR-37 — أبلغ الفريق.",
    };
  }

  revalidatePath("/", "layout");
  /*
   * FR-AUTH-06 names the destination explicitly: the auction listing. A `next`
   * parameter is deliberately not honoured here — login carries the user back
   * to where they were (FR-AUTH-11), registration does not.
   */
  redirect("/");
}

/** AUTH-04 — sign in and return to the page the user was trying to use. */
export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const next = safeNextPath(field(formData, "next"));

  if (!email || !password) {
    return {
      fieldErrors: {
        email: email ? undefined : "أدخل بريدك الإلكتروني.",
        password: password ? undefined : "أدخل كلمة المرور.",
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    /*
     * FR-AUTH-09, SEC-A5 — one message for every failure mode. Wrong password,
     * unknown address and malformed address must be indistinguishable, so
     * this must never be split into more specific cases and must never be
     * attached to a single field: a message under "email" alone would say the
     * address was the problem.
     */
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  }

  revalidatePath("/", "layout");
  redirect(next ?? "/");
}

/** AUTH-05 — FR-AUTH-13, FR-AUTH-14. */
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * AUTH-12 — start a password reset.
 *
 * FR-AUTH-27 / EC-27: the response is identical whether or not the address is
 * registered. The function therefore returns the same notice on every path,
 * including when Supabase reports an error, and the result of the call is
 * deliberately not branched on.
 */
export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email").trim();

  const emailError = validateEmail(email);
  if (emailError) return { fieldErrors: { email: emailError } };

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/update-password")}`,
  });

  return {
    notice:
      "إذا كان هذا البريد مسجّلًا لدينا، فسيصلك رابط لإعادة تعيين كلمة المرور. تحقّق من بريدك، وراجع مجلد الرسائل غير المرغوب فيها.",
  };
}

/**
 * AUTH-13 — set the new password.
 *
 * Reaching this action at all requires the recovery session the callback
 * established, which is what makes possession of the mailbox necessary
 * (FR-AUTH-28). Single use and expiry are enforced by the auth service when
 * the link is exchanged, not here.
 */
export async function updatePasswordAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = field(formData, "password");

  /* FR-AUTH-30 — the same strength rule as registration, not a relaxed one. */
  const passwordError = validatePassword(password);
  if (passwordError) return { fieldErrors: { password: passwordError } };

  const supabase = await createClient();

  /*
   * FR-AUTH-29 / EC-28 — an expired or already-used link leaves no session, so
   * this is where a consumed reset is refused. updateUser would otherwise fail
   * with a less useful message.
   */
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      error:
        "انتهت صلاحية رابط إعادة التعيين أو سبق استخدامه. اطلب رابطًا جديدًا من صفحة استعادة كلمة المرور.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "تعذّر تحديث كلمة المرور. حاول مرة أخرى." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
