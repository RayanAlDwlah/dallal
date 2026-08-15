import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CreateSessionWizard, type SessionDraft } from "@/components/sessions/create-session-wizard";
import { aiEnabled } from "@/lib/ai/config";
import { fetchCategoryTree } from "@/lib/auctions/queries";
import { createClient } from "@/lib/supabase/server";
import { LOT_WITH_CATEGORY, SESSION_COLUMNS, type LotWithCategory, type AuctionSession } from "@/types/sessions";

export const metadata: Metadata = { title: "إنشاء جلسة" };

export default async function CreateSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create/session");

  const categories = await fetchCategoryTree(supabase);

  /* Resuming a draft: the host reopens it from ملفي and continues where they
     stopped. Only the host's own draft resolves — anything else 404s. */
  const { draft: draftId } = await searchParams;
  let draft: SessionDraft | null = null;
  if (draftId) {
    const { data: session } = await supabase
      .from("sessions")
      .select(SESSION_COLUMNS)
      .eq("id", draftId)
      .eq("host_id", user.id)
      .eq("status", "draft")
      .maybeSingle();
    if (!session) notFound();
    const { data: lots } = await supabase
      .from("session_lots")
      .select(LOT_WITH_CATEGORY)
      .eq("session_id", draftId)
      .order("position");
    draft = {
      session: session as unknown as AuctionSession,
      lots: (lots ?? []) as unknown as LotWithCategory[],
    };
  }

  return (
    <div className="mx-auto max-w-[760px] pt-8">
      <h1 className="m-0 mb-1 font-display text-[28px] font-semibold">
        {draft ? "إكمال الجلسة" : "إنشاء جلسة"}
      </h1>
      <p className="m-0 mb-6 max-w-[66ch] text-[15px] text-ink2">
        الجلسة عرض متتابع: قطعة تفتح، تنتهي، تفتح اللي بعدها — والحاضرين في نفس الغرفة طول الوقت.
        تبنيها قبل الموعد، وتقودها لحظتها من غرفة تحكّم.
      </p>
      <CreateSessionWizard
        userId={user.id}
        categories={categories}
        draft={draft}
        aiEnabled={aiEnabled()}
      />
    </div>
  );
}
