"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Money } from "@/components/ui/money";
import { createClient } from "@/lib/supabase/client";
import type { Auction } from "@/types/db";

export function DraftRow({ draft }: { draft: Auction }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await supabase.from("auctions").delete().eq("id", draft.id);
    router.refresh();
  }

  return (
    <li className="hairline flex items-center gap-3.5 rounded-[14px] bg-raised px-3.5 py-3">
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm font-semibold">{draft.title}</b>
        <span className="text-[12px] text-ink3">مسودة — ما نُشرت</span>
      </span>
      <Money amount={draft.starting_price} className="num font-display text-[15px] font-semibold text-gold" />
      <Link
        href={`/create/auction?draft=${draft.id}`}
        className="btn-gold h-9 px-4 text-[13px]"
      >
        أكمل
      </Link>
      <button
        onClick={remove}
        disabled={busy}
        className="grid size-8 cursor-pointer place-items-center rounded-[8px] text-ink3 transition hover:bg-[rgba(255,77,94,.13)] hover:text-red"
        aria-label="حذف المسودة"
      >
        ×
      </button>
    </li>
  );
}
