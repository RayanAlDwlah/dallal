import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Route placeholder only — this screen belongs to Abdulrahman (@Dem4t).
 *
 * S0-08 creates the route so navigation resolves instead of 404ing. No
 * authentication logic, no form, no Supabase call is implemented here.
 * Abdulrahman replaces this file wholesale in AUTH-04.
 */
export default function LoginPage() {
  return (
    <Page title="تسجيل الدخول" description="ادخل إلى حسابك." width="narrow">
      <NotImplemented issue="AUTH-04" owner="عبدالرحمن" />
    </Page>
  );
}
