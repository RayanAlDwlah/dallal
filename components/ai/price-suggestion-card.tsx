"use client";

import { useEffect, useState } from "react";

import { Sparkle } from "@/components/ai/sparkle";
import { formatMoney } from "@/lib/money";

interface Suggestion {
  ok: boolean;
  low?: string;
  high?: string;
  suggested?: string;
  lowLabel?: string;
  highLabel?: string;
  count?: number;
  days?: number;
}

/**
 * «اقتراح سعر البداية» — step 3 of the create wizard, seller-only (ai.html
 * touchpoint 5). The range comes from ended auctions (SQL), never a model.
 * It fills a field and nothing else; with too few comparables it renders
 * nothing at all.
 */
export function PriceSuggestionCard({
  categoryId,
  title,
  onUse,
}: {
  categoryId: number | null;
  title: string;
  onUse: (formatted: string) => void;
}) {
  /*
   * The answer is stored WITH the question it answers, and staleness is
   * DERIVED: when the category/title change, `current` is null on the very
   * same render — no synchronous setState-in-effect to clear it (the lint
   * rule this used to break), and no frame where an old range shows against
   * a new title.
   */
  const [s, setS] = useState<{ key: string; data: Suggestion } | null>(null);
  const key = `${categoryId ?? ""}:${title}`;
  const current = s?.key === key ? s.data : null;

  useEffect(() => {
    let cancelled = false;
    if (!categoryId) return;
    fetch("/api/price-suggestion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId, title }),
    })
      .then((r) => (r.ok ? r.json() : { ok: false }))
      .then((j: Suggestion) => {
        if (!cancelled) setS({ key, data: j });
      })
      .catch(() => {
        if (!cancelled) setS({ key, data: { ok: false } });
      });
    return () => {
      cancelled = true;
    };
    // `key` is derived from exactly these two deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, title]);

  if (!current?.ok || !current.suggested) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-4 rounded-[18px] bg-[linear-gradient(135deg,rgba(124,58,237,.12),rgba(45,212,191,.06))] px-4 py-3.5 [box-shadow:inset_0_0_0_1px_rgba(124,58,237,.28)]">
      <Sparkle />
      <div className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-ink3">اقتراح سعر البداية</span>
        <span className="block font-display text-[20px] font-bold text-[#C4A6FF]">
          <bdi className="num">{current.lowLabel}</bdi> – <bdi className="num">{current.highLabel}</bdi>
          <span className="sar ms-1.5 text-[rgba(196,166,255,.6)]">SAR</span>
        </span>
        <span className="num block text-[12.5px] text-ink2">
          من {current.count} مزادًا منتهيًا في نفس التصنيف آخر {current.days} يومًا — اقتراح لحقل، مو حدًّا
          أدنى.
        </span>
      </div>
      <button
        type="button"
        onClick={() => onUse(formatMoney(current.suggested!))}
        className="h-[38px] cursor-pointer rounded-[10px] border-0 bg-[rgba(124,58,237,.85)] px-4 text-[13.5px] font-semibold text-white"
      >
        استخدم <bdi className="num">{formatMoney(current.suggested)}</bdi>
      </button>
    </div>
  );
}
