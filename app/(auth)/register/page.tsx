import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Route placeholder only — this screen belongs to Abdulrahman (@Dem4t).
 *
 * S0-08 creates the route so navigation resolves instead of 404ing. No
 * authentication logic, no form, no Supabase call is implemented here.
 * Abdulrahman replaces this file wholesale in AUTH-02 → AUTH-03.
 */
export default function RegisterPage() {
  return (
    <Page title="إنشاء حساب" description="سجّل واستخدم المنصة فورًا — لا خطوة تحقق بريد (BR-37)." width="narrow">
      <NotImplemented issue="AUTH-02 → AUTH-03" owner="عبدالرحمن" />
    </Page>
  );
}
