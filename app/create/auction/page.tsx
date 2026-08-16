import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CreateAuctionWizard } from "@/components/auction/create-wizard";
import { aiEnabled } from "@/lib/ai/config";
import { fetchCategoryTree } from "@/lib/auctions/queries";
import { createClient } from "@/lib/supabase/server";
import { AUCTION_COLUMNS, type Auction } from "@/types/db";

export const metadata: Metadata = { title: "إنشاء مزاد" };

export default async function CreateAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create/auction");

  const categories = await fetchCategoryTree(supabase);

  const { draft } = await searchParams;
  let draftAuction: Auction | null = null;
  if (draft) {
    const { data } = await supabase
      .from("auctions")
      .select(AUCTION_COLUMNS)
      .eq("id", draft)
      .eq("status", "draft")
      .maybeSingle();
    if (!data) notFound();
    draftAuction = data as unknown as Auction;
  }

  return (
    <div className="mx-auto max-w-[720px] pt-8">
      <h1 className="m-0 mb-1 font-display text-[28px] font-semibold">إنشاء مزاد</h1>
      <p className="m-0 mb-6 text-[15px] text-ink2">
        أربع خطوات، وآخر خطوة تريك نفس البطاقة اللي بيشوفها المشترون.
      </p>
      <CreateAuctionWizard
        userId={user.id}
        categories={categories}
        draft={draftAuction}
        aiEnabled={aiEnabled()}
      />
    </div>
  );
}
