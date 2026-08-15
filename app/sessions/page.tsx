import type { Metadata } from "next";
import Link from "next/link";

import { SessionCard } from "@/components/sessions/session-card";
import { fetchSessions } from "@/lib/sessions/queries";
import { createClient } from "@/lib/supabase/server";
import type { LotWithCategory } from "@/types/sessions";

export const metadata: Metadata = { title: "الجلسات" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sessions = await fetchSessions(supabase, { statuses: ["live", "scheduled"], limit: 40 });

  /* One round trip for every lot on the page, then grouped locally. The
     attendee count is NOT fetched here — it is live presence, read on the
     client by each card (lib/sessions/use-presence.ts). */
  const ids = sessions.map((s) => s.id);
  let lotsBySession = new Map<string, LotWithCategory[]>();

  if (ids.length > 0) {
    const { data: lots } = await supabase
      .from("session_lots")
      .select("id, session_id, position, status, duration_seconds")
      .in("session_id", ids)
      .order("position", { ascending: true });

    lotsBySession = (lots ?? []).reduce((map, lot) => {
      const list = map.get(lot.session_id as string) ?? [];
      list.push(lot as unknown as LotWithCategory);
      map.set(lot.session_id as string, list);
      return map;
    }, new Map<string, LotWithCategory[]>());
  }

  const live = sessions.filter((s) => s.status === "live");
  const upcoming = sessions.filter((s) => s.status === "scheduled");

  return (
    <div className="pt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 font-display text-[28px] font-semibold">الجلسات</h1>
          <p className="m-0 max-w-[64ch] text-[15px] text-ink2">
            الجلسة عرض متتابع: قطعة تفتح، تنتهي، تفتح اللي بعدها — والحاضرين في نفس الغرفة طول
            الوقت.
          </p>
        </div>
        {user ? (
          <Link href="/create/session" className="btn-gold h-11 px-5 text-sm">
            أنشئ جلسة
          </Link>
        ) : null}
      </div>

      {sessions.length === 0 ? (
        <div className="hairline relative overflow-hidden rounded-[20px] bg-surface">
          <div className="hero-glow" />
          <div className="relative px-6 py-14 text-center">
            <p className="m-0 font-display text-[22px] font-semibold">ما فيه جلسات الآن</p>
            <p className="mx-auto mb-6 mt-1.5 max-w-[46ch] text-sm text-ink2">
              عندك كمية؟ افتح جلسة: عدّة قطع بالتتابع في موعد واحد، وعربون دخول تحدّده أنت.
            </p>
            <Link href={user ? "/create/session" : "/login?next=/create/session"} className="btn-gold h-11 px-6 text-sm">
              أنشئ جلسة
            </Link>
          </div>
        </div>
      ) : null}

      {live.length > 0 ? (
        <section className="mb-8">
          <h2 className="m-0 mb-3 text-[13px] font-medium text-ink3">مباشرة الآن</h2>
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
            {live.map((s, i) => (
              <SessionCard
                key={s.id}
                session={s}
                lots={lotsBySession.get(s.id) ?? []}
                featured={i === 0 && live.length > 1}
              />
            ))}
          </div>
        </section>
      ) : null}

      {upcoming.length > 0 ? (
        <section>
          <h2 className="m-0 mb-3 text-[13px] font-medium text-ink3">قادمة</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} lots={lotsBySession.get(s.id) ?? []} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-6 text-[13px] text-ink3">
        العربون محاكاة — ما فيه دفع حقيقي ولا حقول بطاقة في أي مكان في المنتج.
      </p>
    </div>
  );
}
