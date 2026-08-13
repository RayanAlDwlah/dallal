import { NotImplemented } from "@/components/layout/not-implemented";
import { Page } from "@/components/layout/container";

/**
 * Route placeholder only — this screen belongs to Abdulrahman (@Dem4t).
 *
 * S0-08 creates the route so navigation resolves instead of 404ing. No
 * authentication logic, no form, no Supabase call is implemented here.
 * Abdulrahman replaces this file wholesale in AUTH-12 → AUTH-13.
 */
export default function ResetPasswordPage() {
  return (
    <Page title="استعادة كلمة المرور" description="أعد ضبط كلمة مرورك." width="narrow">
      <NotImplemented issue="AUTH-12 → AUTH-13" owner="عبدالرحمن" />
    </Page>
  );
}
