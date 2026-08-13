/**
 * Registration and password rules — FR-AUTH-03, FR-AUTH-04, FR-PROF-03.
 *
 * These run on the server. Client-side checking is a convenience only and
 * must never be the sole gate (FR-AUTH-05), so the same functions are the ones
 * the server actions call — there is no second, laxer copy.
 *
 * Nothing here is stricter than the PRD. In particular there is NO password
 * composition rule: FR-AUTH-04 specifies length and nothing else, and adding
 * symbols-or-mixed-case would be an unrecorded product decision rather than
 * hardening (TEAM.md rule 16). The same reasoning was applied to the Supabase
 * Auth settings in AUTH-01 and must not be quietly reversed here.
 */

/** FR-AUTH-04 — stated on the form before submission, not only on failure. */
export const PASSWORD_MIN_LENGTH = 8;

/** FR-PROF-03 — mirrored by the profiles_display_name_length check constraint. */
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 50;

/*
 * Deliberately permissive: the authoritative check is the auth service, and a
 * clever regex rejects valid addresses far more often than it catches invalid
 * ones. This exists to give a useful message before the round trip, not to be
 * the arbiter of RFC 5322.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return "أدخل بريدك الإلكتروني.";
  if (!EMAIL_SHAPE.test(email)) return "صيغة البريد الإلكتروني غير صحيحة.";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "أدخل كلمة المرور.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`;
  }
  return undefined;
}

export function validateDisplayName(raw: string): string | undefined {
  const name = raw.trim();

  if (!name) return "أدخل الاسم الظاهر.";

  if (name.length < DISPLAY_NAME_MIN_LENGTH || name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `الاسم الظاهر يجب أن يكون بين ${DISPLAY_NAME_MIN_LENGTH} و${DISPLAY_NAME_MAX_LENGTH} محرفًا.`;
  }

  /*
   * FR-AUTH-21 — the display name appears in public bid history, so an email
   * address used as one publishes contact details to every visitor. Checked
   * by shape rather than by exact match against the account's own address,
   * because *any* address here is a leak, not just the user's own.
   */
  if (EMAIL_SHAPE.test(name)) {
    return "لا يمكن أن يكون الاسم الظاهر بريدًا إلكترونيًا — الاسم الظاهر يظهر للجميع في سجل المزايدات.";
  }

  return undefined;
}

/** Trimmed to what is actually stored, so the DB check sees the same string. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim();
}

/**
 * FR-AUTH-10, FR-AUTH-11 — where to send the user after signing in.
 *
 * Anything that is not a same-site absolute path is discarded. Without this,
 * `?next=https://evil.example` turns the login screen into an open redirect
 * that arrives wearing our own domain. `//host` is rejected too: the browser
 * reads it as protocol-relative and leaves the site.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

/**
 * Why the login screen is being shown — FR-AUTH-17.
 *
 * `expired` means a session existed and no longer does. `required` means a
 * guard sent the user here from a page they cannot see signed out. Neither is
 * an error state, and the screen must not read like one.
 */
export type LoginReason = "expired" | "required";

const LOGIN_REASONS: readonly string[] = ["expired", "required"];

/** Discards anything not one of the two known reasons — it comes from the URL. */
export function safeLoginReason(raw: string | null | undefined): LoginReason | null {
  return raw && LOGIN_REASONS.includes(raw) ? (raw as LoginReason) : null;
}

/**
 * The login URL that will return the user to `next` once they are signed in.
 *
 * `reason` is what turns FR-AUTH-17's "told clearly" into something the login
 * screen can actually say. Without it the screen cannot distinguish a user who
 * clicked "sign in" from one whose session died underneath them, and both get
 * the same blank form.
 */
export function loginPath(next?: string | null, reason?: LoginReason): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(next);
  if (safe) params.set("next", safe);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}
