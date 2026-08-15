import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuctionCard } from "@/components/auction/auction-card";
import { DraftRow } from "@/components/profile/draft-row";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Money } from "@/components/ui/money";
import { createClient } from "@/lib/supabase/server";
import { relativeTimeAr } from "@/lib/time";
import { AUCTION_WITH_RELATIONS, type Auction, type AuctionListItem } from "@/types/db";

export const metadata: Metadata = { title: "ملفي" };

interface MyBidRow {
  id: number;
  amount: string;
  created_at: string;
  auction: AuctionListItem | null;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const [{ data: profile }, { data: myAuctions }, { data: myBids }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase
      .from("auctions")
      .select(AUCTION_WITH_RELATIONS)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("bids")
      .select(`id, amount::text, created_at, auction:auctions(${AUCTION_WITH_RELATIONS})`)
      .eq("bidder_id", user.id)
      .order("id", { ascending: false })
      .limit(60),
  ]);

  const auctions = (myAuctions as unknown as AuctionListItem[]) ?? [];
  const drafts = auctions.filter((a) => a.status === "draft");
  const published = auctions.filter((a) => a.status !== "draft");

  /* one row per auction — my latest bid on it */
  const seen = new Set<string>();
  const bidRows: MyBidRow[] = [];
  for (const b of (myBids as unknown as MyBidRow[]) ?? []) {
    if (!b.auction || seen.has(b.auction.id)) continue;
    seen.add(b.auction.id);
    bidRows.push(b);
  }

  return (
    <div className="pt-6">
      <h1 className="m-0 mb-5 font-display text-[28px] font-semibold">ملفي</h1>

      <ProfileEditor
        displayName={profile?.display_name ?? "مستخدم"}
        avatarUrl={profile?.avatar_url ?? null}
      />

      {drafts.length > 0 ? (
        <section className="mt-8">
          <h2 className="m-0 mb-3 text-[13px] font-medium text-ink3">مسوداتي</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {drafts.map((d) => (
              <DraftRow key={d.id} draft={d as Auction} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[13px] font-medium text-ink3">مزاداتي</h2>
          <Link href="/create/auction" className="text-sm font-semibold text-gold">
            + مزاد جديد
          </Link>
        </div>
        {published.length === 0 ? (
          <div className="hairline rounded-[20px] bg-surface px-6 py-10 text-center">
            <p className="m-0 text-[15px] text-ink2">ما نشرت أي مزاد بعد.</p>
            <Link href="/create/auction" className="btn-gold mt-4 h-11 px-6 text-sm">
              أنشئ مزادك الأول
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {published.map((a) => (
              <AuctionCard key={a.id} auction={a} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="m-0 mb-3 text-[13px] font-medium text-ink3">مزايداتي</h2>
        {bidRows.length === 0 ? (
          <div className="hairline rounded-[20px] bg-surface px-6 py-10 text-center">
            <p className="m-0 text-[15px] text-ink2">ما زايدت على شيء بعد.</p>
            <Link href="/" className="btn-gold mt-4 h-11 px-6 text-sm">
              تصفّح المزادات
            </Link>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {bidRows.map((b) => {
              const a = b.auction!;
              const leading = a.status === "active" && a.current_price === b.amount;
              const won = a.status === "ended" && a.winner_id === user.id;
              return (
                <li key={b.id}>
                  <Link
                    href={`/auctions/${a.id}`}
                    className="hairline flex items-center gap-3.5 rounded-[14px] bg-raised px-3.5 py-3 transition hover:bg-white/[.06]"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm font-semibold">{a.title}</b>
                      <span className="num text-[12px] text-ink3">
                        مزايدتي <Money amount={b.amount} /> · {relativeTimeAr(b.created_at)}
                      </span>
                    </span>
                    {won ? (
                      <span className="text-[13px] font-semibold text-green">فزت 🎉</span>
                    ) : a.status === "ended" ? (
                      <span className="text-[13px] text-ink3">انتهى</span>
                    ) : leading ? (
                      <span className="text-[13px] font-semibold text-green">أنت الأعلى</span>
                    ) : (
                      <span className="text-[13px] text-ink2">
                        الحالي{" "}
                        {a.current_price ? (
                          <Money amount={a.current_price} className="font-semibold text-gold" />
                        ) : null}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
