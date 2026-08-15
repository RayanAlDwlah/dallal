import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Hall } from "@/components/sessions/hall";
import { fetchEntries, fetchLots, fetchSession } from "@/lib/sessions/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeAr } from "@/lib/time";
import { BID_COLUMNS, type Bid } from "@/types/db";
import { expectedMinutes } from "@/types/sessions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "جلسة" };
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "جلسة" };
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let session = await fetchSession(supabase, id);
  if (!session) notFound();

  /* Settle on sight: a room whose lots are past due catches up when anyone
     opens it, not only when a tab happened to be watching. */
  if (session.status === "scheduled" || session.status === "live") {
    await supabase.rpc("advance_session", { p_session_id: id });
    session = (await fetchSession(supabase, id)) ?? session;
  }

  const isHost = user?.id === session.host_id;
  const [lots, entries] = await Promise.all([fetchLots(supabase, id), fetchEntries(supabase, id)]);

  let bids: Bid[] = [];
  if (session.current_lot_id) {
    const { data } = await supabase
      .from("bids")
      .select(BID_COLUMNS)
      .eq("lot_id", session.current_lot_id)
      .order("id", { ascending: false })
      .limit(20);
    bids = (data as unknown as Bid[]) ?? [];
  }

  const myEntry = user ? (entries.find((e) => e.user_id === user.id) ?? null) : null;

  return (
    <div className="pt-6">
      <div className="mb-5">
        <p className="m-0 mb-1 text-[13px] text-ink3">
          <Link href="/sessions" className="hover:text-ink2">
            الجلسات
          </Link>
          {session.city ? ` · ${session.city}` : ""}
        </p>
        <h1 className="m-0 font-display text-[26px] font-semibold leading-snug sm:text-[32px]">
          {session.title}
        </h1>
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink2">
          <span
            className="hairline grid size-[28px] place-items-center rounded-[9px] font-display text-[12px] font-bold text-gold"
            style={{ background: "#0B0E14" }}
          >
            {(session.host?.display_name ?? "؟").trim().slice(0, 2)}
          </span>
          المضيف <bdi>{session.host?.display_name ?? "مضيف"}</bdi>
          <span className="num text-[12.5px] text-ink3">
            · {formatDateTimeAr(session.start_time)} · {lots.length} قطعة · مدة متوقعة{" "}
            {expectedMinutes(lots)} دقيقة
          </span>
        </p>
      </div>

      {session.description ? (
        <p className="hairline m-0 mb-4 whitespace-pre-line rounded-[16px] bg-surface p-4 text-[15px] leading-relaxed">
          {session.description}
        </p>
      ) : null}

      {session.status === "draft" && isHost ? (
        <div className="mb-4 rounded-[13px] bg-[rgba(245,185,66,.09)] px-4 py-3 text-[13.5px] text-gold [box-shadow:inset_0_0_0_1px_rgba(245,185,66,.22)]">
          هذي مسودة — ما أحد يشوفها غيرك.
        </div>
      ) : null}

      <Hall
        session={session}
        lots={lots}
        initialBids={bids}
        entries={entries}
        viewerId={user?.id ?? null}
        isHost={isHost}
        myEntry={myEntry}
        loginHref={`/login?next=/sessions/${session.id}`}
      />

      <p className="mt-6 text-[13px] text-ink3">
        العربون محاكاة — ما فيه دفع حقيقي ولا حقول بطاقة في أي مكان في المنتج.
      </p>
    </div>
  );
}
