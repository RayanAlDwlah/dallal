"use client";

import { useRef, useState } from "react";

import { WriteListingCard } from "@/components/ai/write-listing-card";
import { CategoryPicker, type PickedCategory } from "@/components/categories/category-picker";
import { IncrementAmount, Money } from "@/components/ui/money";
import type { CategoryTree } from "@/lib/auctions/queries";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/images";
import { formatMoney, parseMoneyInput } from "@/lib/money";

export interface DraftLot {
  key: string;
  title: string;
  category: PickedCategory | null;
  startingPrice: string;
  increment: string;
  /** null = open-ended («بدون مدة») — the host closes it manually. */
  durationMinutes: number | null;
  file: File | null;
  preview: string | null;
  /** set once uploaded / when editing an already-saved lot */
  imagePath: string | null;
  id?: string;
}

const INCREMENTS = ["10", "50", "100", "500", "1000", "5000"] as const;
const DURATIONS = [2, 3, 5, 6, 10] as const;

/** «أضف قطعة» — each lot is a complete auction: category, price, increment, duration. */
export function LotEditor({
  categories,
  initial,
  onSave,
  onClose,
  aiEnabled = false,
}: {
  categories: CategoryTree[];
  initial: DraftLot | null;
  onSave: (lot: DraftLot) => void;
  onClose: () => void;
  aiEnabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<PickedCategory | null>(initial?.category ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startingPrice, setStartingPrice] = useState(
    initial?.startingPrice ? formatMoney(initial.startingPrice) : "",
  );
  const [increment, setIncrement] = useState(initial?.increment ?? "500");
  const [customIncrement, setCustomIncrement] = useState(
    initial ? !INCREMENTS.includes(initial.increment as never) : false,
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    initial ? initial.durationMinutes : 5,
  );
  const [customDuration, setCustomDuration] = useState(
    initial?.durationMinutes != null && !DURATIONS.includes(initial.durationMinutes as never),
  );
  const [file, setFile] = useState<File | null>(initial?.file ?? null);
  const [preview, setPreview] = useState<string | null>(initial?.preview ?? null);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
      setError("الصيغ المقبولة: JPG أو PNG أو WebP");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setError("حجم الصورة الأقصى 5 ميجابايت");
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function save() {
    const price = parseMoneyInput(startingPrice);
    if (title.trim().length < 3) return setError("اسم القطعة من 3 محارف على الأقل");
    if (!category) return setError("اختر تصنيف القطعة");
    if (!price) return setError("أدخل سعر بداية صحيحًا");
    if (!/^\d+$/.test(increment) || BigInt(increment) <= 0n || BigInt(increment) % 10n !== 0n) {
      return setError("مقدار الزيادة من مضاعفات العشرة");
    }
    /* الصورة اختيارية — قطع الـ CSV تجي بدونها ويكمّلها المضيف لاحقًا */

    onSave({
      key: initial?.key ?? crypto.randomUUID(),
      id: initial?.id,
      title: title.trim(),
      category,
      startingPrice: price,
      increment,
      durationMinutes,
      file,
      preview,
      imagePath: initial?.imagePath ?? null,
    });
  }

  const price = parseMoneyInput(startingPrice);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[rgba(4,6,10,.72)] p-4 py-10"
      onClick={onClose}
    >
      <div
        className="hairline w-full max-w-[560px] rounded-[22px] bg-raised p-6 shadow-[0_24px_60px_rgba(0,0,0,.55)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="قطعة"
      >
        <h3 className="m-0 mb-5 font-display text-[19px] font-semibold">
          {initial ? "تعديل القطعة" : "أضف قطعة"}
        </h3>

        {aiEnabled && (file || preview) ? (
          <WriteListingCard
            images={file ? [file] : preview ? [preview] : []}
            hint={title}
            onApply={(s) => {
              if (s.title) setTitle(s.title);
              if (s.category && !category) {
                setCategory({ id: s.category.id, label: s.category.label, mainId: s.category.id });
              }
            }}
          />
        ) : null}

        <div className="mb-5 flex items-start gap-3.5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="hairline relative size-[92px] flex-none overflow-hidden rounded-[14px]"
            style={{ background: "linear-gradient(140deg,#232B39,#141922)" }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-2xl font-light text-ink3">+</span>
            )}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-[13.5px] font-semibold">اسم القطعة</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="field"
              placeholder="مثال: تويوتا لاندكروزر GXR 2022"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-[13.5px] font-semibold">التصنيف</label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="hairline flex h-[46px] w-full items-center gap-2.5 rounded-[12px] bg-surface px-3.5 text-[15px]"
          >
            {category ? (
              <span className="truncate text-gold">{category.label}</span>
            ) : (
              <span className="text-ink3">اختر التصنيف</span>
            )}
            <span className="ms-auto text-ink3">{category ? "تغيير" : "‹"}</span>
          </button>
        </div>

        <div className="mb-5 grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13.5px] font-semibold">سعر البداية</label>
            <input
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              onBlur={() => {
                const p = parseMoneyInput(startingPrice);
                if (p) setStartingPrice(formatMoney(p));
              }}
              inputMode="decimal"
              dir="ltr"
              className="field num text-start font-display font-semibold"
              placeholder="180,000.00"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13.5px] font-semibold">مدة القطعة</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setDurationMinutes(m);
                    setCustomDuration(false);
                  }}
                  className={`num grid h-[46px] min-w-[52px] place-items-center rounded-[12px] px-3 font-display text-sm font-semibold ${
                    !customDuration && durationMinutes === m
                      ? "bg-gold text-gold-ink"
                      : "hairline bg-surface text-ink2 hover:text-ink"
                  }`}
                >
                  {m} د
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCustomDuration(true);
                  if (durationMinutes == null) setDurationMinutes(15);
                }}
                className={`grid h-[46px] place-items-center rounded-[12px] px-3 text-sm ${
                  customDuration && durationMinutes != null
                    ? "bg-gold font-semibold text-gold-ink"
                    : "hairline bg-surface text-ink2 hover:text-ink"
                }`}
              >
                مخصصة
              </button>
              <button
                type="button"
                onClick={() => {
                  setDurationMinutes(null);
                  setCustomDuration(false);
                }}
                title="القطعة تظل مفتوحة لين تقفلها بنفسك من غرفة التحكم"
                className={`grid h-[46px] place-items-center rounded-[12px] px-3 text-sm ${
                  durationMinutes == null
                    ? "bg-gold font-semibold text-gold-ink"
                    : "hairline bg-surface text-ink2 hover:text-ink"
                }`}
              >
                بدون مدة
              </button>
            </div>
            {customDuration && durationMinutes != null ? (
              <input
                value={String(durationMinutes)}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
                  setDurationMinutes(Number.isFinite(n) ? Math.min(1440, Math.max(1, n)) : 15);
                }}
                inputMode="numeric"
                dir="ltr"
                className="field num mt-2.5 max-w-[120px] text-start font-display font-semibold"
                placeholder="15"
              />
            ) : null}
            {durationMinutes == null ? (
              <p className="m-0 mt-1.5 text-[12px] text-ink3">
                ما لها وقت انتهاء — تبدأ وتظل مفتوحة، وأنت تقفلها من غرفة التحكّم متى شئت.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-[13.5px] font-semibold">مقدار الزيادة</label>
          <div className="flex flex-wrap gap-2">
            {INCREMENTS.map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => {
                  setIncrement(inc);
                  setCustomIncrement(false);
                }}
                className={`grid h-11 min-w-[72px] place-items-center rounded-[12px] px-4 font-display text-[15px] font-semibold ${
                  !customIncrement && increment === inc
                    ? "bg-gold text-gold-ink"
                    : "hairline bg-surface text-ink2 hover:text-ink"
                }`}
              >
                <IncrementAmount amount={inc} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomIncrement(true)}
              className={`grid h-11 place-items-center rounded-[12px] px-4 text-sm ${
                customIncrement
                  ? "bg-gold font-semibold text-gold-ink"
                  : "hairline bg-surface text-ink2 hover:text-ink"
              }`}
            >
              مبلغ آخر
            </button>
          </div>
          {customIncrement ? (
            <input
              value={increment}
              onChange={(e) => setIncrement(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              dir="ltr"
              className="field num mt-2.5 max-w-[180px] text-start font-display font-semibold"
              placeholder="2000"
            />
          ) : null}
        </div>

        {price ? (
          <p className="m-0 mb-4 text-[13px] text-ink3">
            أول مزايدة تصير <Money amount={price} />، والزر يقول «زايد بـ{" "}
            <IncrementAmount amount={/^\d+0$/.test(increment) ? increment : "0"} />».
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2.5">
          <button type="button" onClick={save} className="btn-gold h-12 flex-1 text-[15px]">
            {initial ? "حفظ" : "أضف القطعة"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost h-12 px-6 text-[15px]">
            إلغاء
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <CategoryPicker
          categories={categories}
          initialMainId={category?.mainId}
          onDone={(p) => {
            setCategory(p);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
