/**
 * User-facing Arabic errors. Codes come from the database functions and
 * client validation; nothing here ever exposes SQL, stack traces or secrets.
 */

export const AR_ERRORS: Record<string, string> = {
  auth_required: "سجّل الدخول للمزايدة",
  not_found: "المزاد غير متاح",
  own_auction: "ما تقدر تزايد على مزادك",
  ended: "انتهى المزاد",
  too_low: "صار السعر أعلى من مزايدتك — جرّب من جديد",
  invalid_amount: "قيمة المزايدة غير صالحة",
  network: "تعذّر الاتصال — تأكد من الشبكة وحاول مرة أخرى",
  upload_failed: "تعذّر رفع الصورة — حاول مرة أخرى",
  invalid_input: "تحقق من الحقول المطلوبة",
  images_required: "أضف صورة واحدة على الأقل",
  end_time_too_soon: "وقت الانتهاء لازم يكون بعد 5 دقائق على الأقل",
  unknown: "صار خطأ غير متوقع — حاول مرة أخرى",
};

export function arError(code: string | null | undefined): string {
  return (code && AR_ERRORS[code]) || AR_ERRORS.unknown!;
}
