"use client";

import { useMemo, useState } from "react";

import { CategoryIcon } from "@/components/categories/category-icon";
import type { CategoryTree } from "@/lib/auctions/queries";
import type { Category } from "@/types/db";

export interface PickedCategory {
  id: number;
  label: string;
  mainId: number;
}

/**
 * The two-column picker (categories.html): mains on the right column, subs on
 * the left — the Arabic eye starts from the right.
 */
export function CategoryPicker({
  categories,
  initialMainId,
  onDone,
  onClose,
}: {
  categories: CategoryTree[];
  initialMainId?: number;
  onDone: (picked: PickedCategory) => void;
  onClose: () => void;
}) {
  const [mainId, setMainId] = useState<number | null>(initialMainId ?? null);
  const [subId, setSubId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const main = categories.find((c) => c.id === mainId) ?? null;
  const sub = main?.children.find((c) => c.id === subId) ?? null;

  const filteredMains = useMemo(() => {
    const needle = q.trim();
    if (!needle) return categories;
    return categories.filter(
      (c) =>
        c.name_ar.includes(needle) || c.children.some((s) => s.name_ar.includes(needle)),
    );
  }, [categories, q]);

  const subs: Category[] = useMemo(() => {
    if (!main) return [];
    const needle = q.trim();
    if (!needle || main.name_ar.includes(needle)) return main.children;
    const hit = main.children.filter((s) => s.name_ar.includes(needle));
    return hit.length > 0 ? hit : main.children;
  }, [main, q]);

  const canDone = main !== null && (main.children.length === 0 || sub !== null);

  function done() {
    if (!main) return;
    if (main.children.length > 0 && sub) {
      onDone({ id: sub.id, label: `${main.name_ar} › ${sub.name_ar}`, mainId: main.id });
    } else if (main.children.length === 0) {
      onDone({ id: main.id, label: main.name_ar, mainId: main.id });
    }
  }

  const opt = (on: boolean) =>
    `flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-sm transition ${
      on ? "bg-[rgba(245,185,66,.13)] font-semibold text-gold" : "text-ink2 hover:bg-white/5 hover:text-ink"
    }`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(4,6,10,.72)] p-4"
      onClick={onClose}
    >
      <div
        className="hairline w-full max-w-[620px] overflow-hidden rounded-[22px] bg-raised shadow-[0_24px_60px_rgba(0,0,0,.55)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="اختر التصنيف"
      >
        <div className="border-b border-[var(--color-hair)] p-4 pb-3">
          <h3 className="m-0 mb-2.5 font-display text-[17px] font-semibold">اختر التصنيف</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث… مثلاً: لوحة، إبل، رولكس"
            className="h-[38px] w-full rounded-[10px] border-0 bg-black/30 px-3 text-sm text-ink outline-none [box-shadow:inset_0_0_0_1px_var(--color-hair)] placeholder:text-ink3 focus:[box-shadow:inset_0_0_0_1px_var(--color-teal)]"
          />
        </div>

        <div className="grid h-[262px] grid-cols-2">
          <div className="overflow-y-auto p-2">
            <div className="px-2.5 pb-2 pt-1.5 text-[11px] text-ink3">القسم الرئيسي</div>
            {filteredMains.map((c) => (
              <button
                key={c.id}
                className={opt(c.id === mainId)}
                onClick={() => {
                  setMainId(c.id);
                  setSubId(null);
                }}
              >
                <CategoryIcon icon={c.icon} className="size-[17px] flex-none" />
                <span className="truncate">{c.name_ar}</span>
                {c.children.length > 0 ? <span className="ms-auto text-[13px] text-ink3">‹</span> : null}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto border-s border-[var(--color-hair)] p-2">
            <div className="px-2.5 pb-2 pt-1.5 text-[11px] text-ink3">
              {main ? `الفرعي — ${main.name_ar}` : "اختر قسمًا أولاً"}
            </div>
            {main && main.children.length === 0 ? (
              <p className="m-0 px-2.5 py-2 text-[13px] text-ink3">
                ما له أقسام فرعية — اضغط «تم».
              </p>
            ) : null}
            {subs.map((s) => (
              <button key={s.id} className={opt(s.id === subId)} onClick={() => setSubId(s.id)}>
                <span className="truncate">{s.name_ar}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-hair)] px-4 py-3">
          <span className="truncate text-[13px] text-ink2">
            {main ? (
              <>
                {main.name_ar}
                {sub ? (
                  <>
                    {" "}
                    › <b className="font-semibold text-gold">{sub.name_ar}</b>
                  </>
                ) : null}
              </>
            ) : (
              "—"
            )}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost h-[38px] px-4 text-sm">
              إلغاء
            </button>
            <button
              onClick={done}
              disabled={!canDone}
              className="btn-gold h-[38px] px-5 text-sm"
            >
              تم
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
