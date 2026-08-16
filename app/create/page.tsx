import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "أنشئ" };

/** «وش تنشئ؟» — the approved chooser (create-auction.html). */
export default async function CreateChooserPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create");

  return (
    <div className="mx-auto max-w-[720px] pt-10">
      <h1 className="m-0 mb-1 font-display text-[28px] font-semibold">وش تنشئ؟</h1>
      <p className="m-0 mb-7 text-[15px] text-ink2">
        مزاد لقطعة وحدة، أو جلسة لعدة قطع بالتتابع.
      </p>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Link
          href="/create/auction"
          className="card-glow block rounded-[20px] bg-surface p-[22px] [box-shadow:inset_0_0_0_1.5px_var(--color-gold),0_0_30px_rgba(245,185,66,.12)]"
        >
          <span className="mb-3 inline-block rounded-[7px] bg-white/5 px-2.5 py-0.5 text-[11.5px] text-ink3">
            الأكثر استخدامًا
          </span>
          <h3 className="m-0 mb-1.5 font-display text-[19px] font-semibold">مزاد مفرد</h3>
          <p className="m-0 text-sm text-ink2">
            قطعة وحدة، وقت انتهاء محدّد، وأعلى مزايد يفوز. أي أحد يقدر ينشئه — فرد أو شركة.
          </p>
        </Link>

        <Link
          href="/create/session"
          className="hairline card-glow block rounded-[20px] bg-surface p-[22px]"
        >
          <span className="mb-3 inline-block rounded-[7px] bg-white/5 px-2.5 py-0.5 text-[11.5px] text-ink3">
            للكمّيات
          </span>
          <h3 className="m-0 mb-1.5 font-display text-[19px] font-semibold">جلسة مزاد</h3>
          <p className="m-0 text-sm text-ink2">
            عدّة قطع بالتتابع في موعد واحد، مع عربون دخول تحدّده أنت. للمعارض واللي عنده كمية.
          </p>
        </Link>
      </div>
    </div>
  );
}
