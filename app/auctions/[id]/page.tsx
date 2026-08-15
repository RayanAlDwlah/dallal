import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AskPanel } from "@/components/ai/ask-panel";
import { Gallery } from "@/components/auction/gallery";
import { LiveAuction } from "@/components/bidding/live-auction";
import { aiEnabled } from "@/lib/ai/config";
import { fetchAuction, fetchBids } from "@/lib/auctions/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeAr, hasExpired } from "@/lib/time";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "مزاد" };
  const supabase = await createClient();
  const { data } = await supabase.from("auctions").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "مزاد" };
}

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let auction = await fetchAuction(supabase, id);
  if (!auction) notFound();

  /* The server settles an expired-but-unflipped auction on sight. */
  if (auction.status === "active" && hasExpired(auction.end_time)) {
    await supabase.rpc("finalize_auction", { p_auction_id: id });
    auction = (await fetchAuction(supabase, id)) ?? auction;
  }

  const isOwner = user?.id === auction.seller_id;

  if (auction.status === "draft") {
    if (isOwner) redirect(`/create/auction?draft=${auction.id}`);
    notFound();
  }

  const bids = await fetchBids(supabase, id, 20);

  let winnerName: string | null = null;
  if (auction.status === "ended" && auction.winner_id && (isOwner || user?.id === auction.winner_id)) {
    const { data: w } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", auction.winner_id)
      .maybeSingle();
    winnerName = w?.display_name ?? null;
  }

  let bidderCount = 0;
  if (isOwner) {
    const { data: ids } = await supabase.from("bids").select("bidder_id").eq("auction_id", id);
    bidderCount = new Set((ids ?? []).map((r) => r.bidder_id as string)).size;
  }

  /* breadcrumb: main › sub */
  let crumb = auction.category?.name_ar ?? "";
  if (auction.category?.parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("name_ar, slug")
      .eq("id", auction.category.parent_id)
      .maybeSingle();
    if (parent) crumb = `${parent.name_ar} › ${auction.category.name_ar}`;
  }

  const attributes = Object.entries(auction.attributes ?? {}).filter(
    ([, v]) => typeof v === "string" && v.trim() !== "",
  );

  return (
    <div className="pt-6">
      <div className="mb-5">
        <p className="m-0 mb-1 text-[13px] text-ink3">
          <Link href="/" className="hover:text-ink2">
            المزادات
          </Link>{" "}
          · {crumb}
        </p>
        <h1 className="m-0 font-display text-[26px] font-semibold leading-snug sm:text-[32px]">
          {auction.title}
        </h1>
        <p className="m-0 mt-2 flex items-center gap-2.5 text-sm text-ink2">
          <span
            className="hairline grid size-[28px] place-items-center rounded-full text-[12px]"
            style={{ background: "linear-gradient(140deg,#2A3140,#171C26)" }}
          >
            {auction.seller?.display_name?.trim().charAt(0) ?? "؟"}
          </span>
          البائع <bdi>{auction.seller?.display_name ?? "بائع"}</bdi>
          {auction.start_time ? (
            <span className="num text-[12.5px] text-ink3">
              · نُشر {formatDateTimeAr(auction.start_time)}
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_384px] lg:items-start">
        <div className="min-w-0">
          <Gallery images={auction.images} title={auction.title} />

          <section className="hairline mt-6 rounded-[20px] bg-surface p-5 sm:p-6">
            <h2 className="m-0 mb-2 text-[13px] font-medium text-ink3">الوصف</h2>
            <p className="m-0 whitespace-pre-line text-[15.5px] leading-relaxed">
              {auction.description}
            </p>
          </section>

          {attributes.length > 0 ? (
            <section className="hairline mt-4 rounded-[20px] bg-surface p-5 sm:p-6">
              <h2 className="m-0 mb-2 text-[13px] font-medium text-ink3">المواصفات</h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {attributes.map(([k, v]) => (
                    <tr key={k} className="border-t border-[var(--color-hair)] first:border-0">
                      <td className="w-[170px] py-2.5 text-[13px] text-ink3">{k}</td>
                      <td className="py-2.5">
                        <bdi>{v}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {aiEnabled() ? <AskPanel auctionId={auction.id} /> : null}
        </div>

        <div className="lg:sticky lg:top-24">
          <LiveAuction
            auction={auction}
            initialBids={bids}
            viewerId={user?.id ?? null}
            isOwner={isOwner}
            initialBidderCount={bidderCount}
            winnerName={winnerName}
            loginHref={`/login?next=/auctions/${auction.id}`}
          />
        </div>
      </div>
    </div>
  );
}
