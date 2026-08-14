/**
 * Auction creation rules — AUC-01, AUC-02.
 *
 * FR-CREATE-04, 05, 06, 08, 09, 10, 10a, 11, 15, 16, 17.
 *
 * These run on the SERVER. The form imports the same functions so the message
 * a user sees before submitting is the message the server would produce — there
 * is no second, laxer copy. FR-CREATE-11 puts the authority on server time, so
 * the client-side end-time check is fast feedback only and is never the gate
 * (SEC-V6, BR-08).
 *
 * Nothing here is stricter than the PRD. In particular:
 *
 *   - NO maximum starting price. FR-CREATE-07 and BR-21 forbid a ceiling, and
 *     forbid a developer inventing one during implementation. There is no
 *     length cap on the amount field either — that is a ceiling wearing a
 *     different hat (S0-12 §4.2).
 *   - NO reserve price field. BR-35, FR-CREATE-03.
 *   - NO optional fields. FR-CREATE-03: every field is required.
 *
 * Amounts are STRINGS throughout (S0-12 §6). Nothing here calls Number(),
 * parseFloat, or does arithmetic on an amount.
 */

import { isSar } from "@/lib/money";

/* -------------------------------------------------------------------------
   Bounds — mirrored by CHECK constraints in
   supabase/migrations/20260814120000_auc01_auction_product_fields.sql.
   Change one and you must change the other; the database is the authority.
   ------------------------------------------------------------------------- */

/** FR-CREATE-04 — after trimming. */
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 100;

/** FR-CREATE-05 — after trimming. */
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;

/** FR-CREATE-09 / FR-CREATE-10 / FR-CREATE-10a — inclusive, from creation time. */
export const MIN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** FR-CREATE-16 — mirrored by the bucket's allowed_mime_types. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** FR-CREATE-17 — mirrored by the bucket's file_size_limit. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_MB = 5;

/** The one bucket. FR-CREATE-15: exactly one image per auction. */
export const IMAGE_BUCKET = "auction-images";

/* -------------------------------------------------------------------------
   Field validators. Each returns an Arabic message, or undefined when valid.
   ------------------------------------------------------------------------- */

export function validateName(raw: string): string | undefined {
  const name = raw.trim();
  if (!name) return "أدخل اسم المنتج.";
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return `اسم المنتج من ${NAME_MIN_LENGTH} إلى ${NAME_MAX_LENGTH} محرفًا.`;
  }
  return undefined;
}

export function validateDescription(raw: string): string | undefined {
  const description = raw.trim();
  if (!description) return "أدخل وصف المنتج.";
  if (
    description.length < DESCRIPTION_MIN_LENGTH ||
    description.length > DESCRIPTION_MAX_LENGTH
  ) {
    return `الوصف من ${DESCRIPTION_MIN_LENGTH} إلى ${DESCRIPTION_MAX_LENGTH} محرفًا.`;
  }
  return undefined;
}

/**
 * FR-CREATE-06 — required, numeric, strictly greater than zero, at most two
 * decimals, in SAR.
 *
 * "Strictly greater than zero" is tested by string inspection rather than by
 * comparing a parsed number: isSar() has already established the shape, so a
 * value is zero exactly when every digit in it is '0'. That keeps the check
 * width-unbounded and float-free, which a `parseFloat(x) > 0` would not
 * (S0-12 §1: no JS arithmetic on an amount, ever).
 *
 * MORE THAN TWO DECIMALS IS REJECTED, NEVER ROUNDED — S0-12 §5. Rounding here
 * would silently change the seller's stated price.
 */
export function validateStartingPrice(raw: string): string | undefined {
  const price = raw.trim();
  if (!price) return "أدخل سعر البداية.";
  if (!isSar(price)) {
    return "سعر البداية يجب أن يكون رقمًا موجبًا بمنزلتين عشريتين على الأكثر.";
  }
  if (!/[1-9]/.test(price)) return "سعر البداية يجب أن يكون أكبر من صفر.";
  return undefined;
}

/**
 * FR-CREATE-08, 09, 10, 10a — a future timestamp between 5 minutes and 7 days
 * ahead, inclusive, and the message must name the permitted range (BR-38).
 *
 * `now` is passed in rather than read here so the server can supply server time
 * (FR-CREATE-11) and the form can supply browser time for preview feedback,
 * without two copies of the rule.
 */
export function validateEndTime(raw: string, now: number): string | undefined {
  const value = raw.trim();
  if (!value) return "أدخل وقت انتهاء المزاد.";

  const endsAt = Date.parse(value);
  if (Number.isNaN(endsAt)) return "صيغة وقت الانتهاء غير صحيحة.";

  const ahead = endsAt - now;
  if (ahead < MIN_DURATION_MS || ahead > MAX_DURATION_MS) {
    return "مدة المزاد يجب أن تكون بين 5 دقائق و7 أيام من الآن.";
  }
  return undefined;
}

/**
 * FR-CREATE-16, 17 — type and size.
 *
 * This is the CLIENT-SIDE mirror and is explicitly not the authority
 * (FR-CREATE-18, SEC-V5): a browser-reported MIME type is attacker-controlled.
 * The bucket's own allowed_mime_types and file_size_limit reject the upload
 * server-side regardless of what this says.
 */
export function validateImage(file: File | null): string | undefined {
  if (!file || file.size === 0) return "اختر صورة للمنتج.";
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "الصيغ المقبولة: JPEG أو PNG أو WebP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `حجم الصورة يجب ألا يتجاوز ${MAX_IMAGE_MB} ميجابايت.`;
  }
  return undefined;
}

/** The file extension for a validated image type. Never trusted from the name. */
export function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}
