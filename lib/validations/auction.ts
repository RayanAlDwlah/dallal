import { z } from "zod";

import { isMoneyString } from "@/lib/money";

/**
 * UX-side validation for the create wizard. The database constraints and the
 * auctions_guard trigger are the authority — this exists so the seller gets
 * a friendly Arabic message before the row is ever attempted.
 */
export const auctionDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "اسم المنتج من 3 إلى 120 محرفًا")
    .max(120, "اسم المنتج من 3 إلى 120 محرفًا"),
  description: z
    .string()
    .trim()
    .min(20, "الوصف من 20 إلى 2000 محرف")
    .max(2000, "الوصف من 20 إلى 2000 محرف"),
  categoryId: z.number({ error: "اختر التصنيف" }).int().positive("اختر التصنيف"),
});

export const auctionBiddingSchema = z.object({
  startingPrice: z
    .string()
    .refine((v) => isMoneyString(v), "أدخل سعر بداية صحيحًا — مثال: 45000.00"),
  bidIncrement: z
    .string()
    .regex(/^\d+$/, "مقدار الزيادة رقم صحيح")
    .refine((v) => BigInt(v) > 0n && BigInt(v) % 10n === 0n, "مقدار الزيادة من مضاعفات العشرة"),
  endTime: z
    .string()
    .min(1, "حدّد وقت الانتهاء")
    .refine((v) => {
      const t = new Date(v).getTime();
      return Number.isFinite(t) && t >= Date.now() + 5 * 60_000;
    }, "وقت الانتهاء لازم يكون بعد 5 دقائق على الأقل"),
});
