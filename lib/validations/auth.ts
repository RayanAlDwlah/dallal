import { z } from "zod";

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "الاسم المعروض من محرفين إلى 40 محرفًا")
    .max(40, "الاسم المعروض من محرفين إلى 40 محرفًا"),
  email: z.string().trim().toLowerCase().email("أدخل بريدًا إلكترونيًا صحيحًا"),
  password: z.string().min(8, "كلمة المرور 8 محارف على الأقل").max(72, "كلمة المرور طويلة جدًا"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("أدخل بريدًا إلكترونيًا صحيحًا"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

export const resetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("أدخل بريدًا إلكترونيًا صحيحًا"),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "كلمة المرور 8 محارف على الأقل").max(72, "كلمة المرور طويلة جدًا"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "كلمتا المرور ما تطابقتا",
    path: ["confirm"],
  });
