"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { PriceSuggestionCard } from "@/components/ai/price-suggestion-card";
import { WriteListingCard, type ListingSuggestion } from "@/components/ai/write-listing-card";
import { CategoryPicker, type PickedCategory } from "@/components/categories/category-picker";
import { IncrementAmount, Money } from "@/components/ui/money";
import type { CategoryTree } from "@/lib/auctions/queries";
import { arError } from "@/lib/errors";
import { ALLOWED_IMAGE_TYPES, MAX_AUCTION_IMAGES, MAX_IMAGE_BYTES, auctionImageUrl } from "@/lib/images";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeAr, isoFromNow, toDatetimeLocalValue } from "@/lib/time";
import { auctionBiddingSchema, auctionDetailsSchema } from "@/lib/validations/auction";
import type { Auction } from "@/types/db";

type WizardImage =
  | { key: string; kind: "file"; file: File; preview: string }
  | { key: string; kind: "path"; path: string };

const STEPS = ["الصور", "التفاصيل", "المزايدة", "المراجعة"] as const;
const INCREMENTS = ["10", "50", "100", "500", "1000", "5000"] as const;

function imageSrc(img: WizardImage): string {
  return img.kind === "file" ? img.preview : auctionImageUrl(img.path);
}

export function CreateAuctionWizard({
  userId,
  categories,
  draft,
  aiEnabled = false,
}: {
  userId: string;
  categories: CategoryTree[];
  draft: Auction | null;
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const findPicked = (categoryId: number | null): PickedCategory | null => {
    if (!categoryId) return null;
    for (const main of categories) {
      if (main.id === categoryId) return { id: main.id, label: main.name_ar, mainId: main.id };
      const sub = main.children.find((c) => c.id === categoryId);
      if (sub) return { id: sub.id, label: `${main.name_ar} › ${sub.name_ar}`, mainId: main.id };
    }
    return null;
  };

  const [step, setStep] = useState(0);
  const [images, setImages] = useState<WizardImage[]>(
    draft?.images.map((p) => ({ key: p, kind: "path" as const, path: p })) ?? [],
  );
  const [title, setTitle] = useState(draft?.title ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [picked, setPicked] = useState<PickedCategory | null>(findPicked(draft?.category_id ?? null));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attrs, setAttrs] = useState<Record<string, string>>(
    (draft?.attributes as Record<string, string>) ?? {},
  );
  const [startingPrice, setStartingPrice] = useState(
    draft ? formatMoney(draft.starting_price) : "",
  );
  const [increment, setIncrement] = useState<string>(draft?.bid_increment?.split(".")[0] ?? "500");
  const [customIncrement, setCustomIncrement] = useState(
    draft ? !INCREMENTS.includes((draft.bid_increment?.split(".")[0] ?? "") as never) : false,
  );
  const [endTime, setEndTime] = useState(() =>
    draft?.end_time && new Date(draft.end_time).getTime() > Date.now() + 6 * 60_000
      ? toDatetimeLocalValue(new Date(draft.end_time))
      : toDatetimeLocalValue(new Date(Date.now() + 24 * 3600_000)),
  );
  const [minEndTime] = useState(() => toDatetimeLocalValue(isoFromNow(10)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"publish" | "draft" | null>(null);

  const mainCategory = picked ? categories.find((c) => c.id === picked.mainId) : null;
  const attrFields: string[] = mainCategory?.fields ?? [];

  /* ---------- images ---------- */

  function addFiles(list: FileList | File[]) {
    setError(null);
    const incoming = Array.from(list);
    setImages((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        if (next.length >= MAX_AUCTION_IMAGES) break;
        if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
          setError("الصيغ المقبولة: JPG أو PNG أو WebP");
          continue;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          setError("حجم الصورة الأقصى 5 ميجابايت");
          continue;
        }
        next.push({
          key: crypto.randomUUID(),
          kind: "file",
          file: f,
          preview: URL.createObjectURL(f),
        });
      }
      return next;
    });
  }

  function removeImage(key: string) {
    setImages((prev) => {
      const img = prev.find((i) => i.key === key);
      if (img?.kind === "file") URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.key !== key);
    });
  }

  function reorder(from: number, to: number) {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  /* ---------- assistive fill (ai.html) — fills fields, publishes nothing --- */

  function applySuggestion(s: ListingSuggestion) {
    if (s.title) setTitle(s.title);
    if (s.description) setDescription(s.description);
    /* never stomp a category the seller already chose deliberately */
    if (s.category && !picked) {
      setPicked({ id: s.category.id, label: s.category.label, mainId: s.category.id });
    }
    setAttrs((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(s.attributes)) {
        if (!next[k]?.trim()) next[k] = v;
      }
      return next;
    });
  }

  /* ---------- step validation ---------- */

  function validateStep(target: number): boolean {
    setError(null);
    if (target >= 1 && images.length === 0) {
      setError(arError("images_required"));
      setStep(0);
      return false;
    }
    if (target >= 2) {
      const parsed = auctionDetailsSchema.safeParse({
        title,
        description,
        categoryId: picked?.id ?? null,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? arError("invalid_input"));
        setStep(1);
        return false;
      }
    }
    if (target >= 3) {
      const price = parseMoneyInput(startingPrice);
      if (!price) {
        setError("أدخل سعر بداية صحيحًا — مثال: 45,000");
        setStep(2);
        return false;
      }
      const parsed = auctionBiddingSchema.safeParse({
        startingPrice: price,
        bidIncrement: increment,
        endTime,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? arError("invalid_input"));
        setStep(2);
        return false;
      }
    }
    return true;
  }

  function goTo(target: number) {
    if (target > step && !validateStep(target)) return;
    setError(null);
    setStep(target);
  }

  /* ---------- persist ---------- */

  async function uploadPendingImages(): Promise<string[]> {
    const paths: string[] = [];
    const batch = crypto.randomUUID();
    for (let i = 0; i < images.length; i++) {
      const img = images[i]!;
      if (img.kind === "path") {
        paths.push(img.path);
        continue;
      }
      const ext =
        img.file.type === "image/png" ? "png" : img.file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${batch}/${i + 1}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("auction-images")
        .upload(path, img.file, { contentType: img.file.type, upsert: false });
      if (upErr) throw new Error("upload_failed");
      paths.push(path);
    }
    return paths;
  }

  async function persist(status: "active" | "draft") {
    if (!validateStep(3)) return;
    setBusy(status === "active" ? "publish" : "draft");
    setError(null);
    try {
      const paths = await uploadPendingImages();
      const cleanAttrs = Object.fromEntries(
        Object.entries(attrs).filter(([k, v]) => attrFields.includes(k) && v.trim() !== ""),
      );
      const row = {
        seller_id: userId,
        title: title.trim(),
        description: description.trim(),
        category_id: picked!.id,
        images: paths,
        attributes: cleanAttrs,
        starting_price: parseMoneyInput(startingPrice)!,
        bid_increment: increment,
        status,
        end_time: new Date(endTime).toISOString(),
      };

      let auctionId = draft?.id ?? null;
      if (auctionId) {
        const { error: upErr } = await supabase.from("auctions").update(row).eq("id", auctionId);
        if (upErr) throw upErr;
      } else {
        const { data, error: insErr } = await supabase
          .from("auctions")
          .insert(row)
          .select("id")
          .single();
        if (insErr) throw insErr;
        auctionId = data.id as string;
      }

      if (status === "active") {
        router.push(`/auctions/${auctionId}`);
      } else {
        router.push("/profile?tab=drafts");
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "upload_failed") setError(arError("upload_failed"));
      else if (msg.includes("end_time_too_soon")) setError(arError("end_time_too_soon"));
      else if (msg.includes("images_required")) setError(arError("images_required"));
      else setError(arError("unknown"));
      setBusy(null);
    }
  }

  /* ---------- render ---------- */

  const price = parseMoneyInput(startingPrice);
  const stepChip = (i: number) => (
    <div
      key={i}
      className={`flex items-center gap-2 whitespace-nowrap text-[13.5px] ${
        i === step ? "font-semibold text-ink" : i < step ? "text-ink2" : "text-ink3"
      }`}
    >
      <span
        className={`grid size-[26px] place-items-center rounded-full font-display text-[13px] font-semibold ${
          i < step
            ? "bg-[rgba(45,212,191,.15)] text-teal [box-shadow:inset_0_0_0_1px_rgba(45,212,191,.3)]"
            : i === step
              ? "bg-gold text-gold-ink"
              : "hairline bg-raised text-ink3"
        }`}
      >
        {i < step ? "✓" : i + 1}
      </span>
      {STEPS[i]}
    </div>
  );

  return (
    <div>
      {/* step rail */}
      <div className="mb-5 flex items-center">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
            {i > 0 ? <span className="mx-3 h-px min-w-[14px] flex-1 bg-[var(--color-hair)]" /> : null}
            {stepChip(i)}
          </div>
        ))}
      </div>

      <div className="hairline rounded-[22px] bg-surface p-5 sm:p-6">
        {/* ---- step 1: images ---- */}
        {step === 0 ? (
          <div>
            <label className="mb-2 block text-[13.5px] font-semibold">صور المنتج</label>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className="w-full cursor-pointer rounded-[16px] bg-white/[.02] px-6 py-7 text-center [box-shadow:inset_0_0_0_1.5px_rgba(255,255,255,.1)]"
            >
              <b className="mb-1 block text-[15px]">اسحب الصور هنا أو اضغط للاختيار</b>
              <span className="text-[13px] text-ink3">
                حتى 10 صور · JPG أو PNG أو WebP · 5 ميجابايت للصورة
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {images.length > 0 ? (
              <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5">
                {images.map((img, i) => (
                  <div
                    key={img.key}
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex.current !== null) reorder(dragIndex.current, i);
                      dragIndex.current = null;
                    }}
                    className="hairline relative aspect-square cursor-grab overflow-hidden rounded-[13px]"
                    style={{ background: "linear-gradient(140deg,#1D2430,#12161E)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(img)} alt="" className="size-full object-cover" />
                    {i === 0 ? (
                      <span className="absolute start-1.5 top-1.5 z-[2] rounded-[6px] bg-gold px-1.5 py-px text-[10.5px] font-semibold text-gold-ink">
                        الغلاف
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeImage(img.key)}
                      aria-label="حذف الصورة"
                      className="absolute end-1.5 top-1.5 z-[2] grid size-5 cursor-pointer place-items-center rounded-full bg-black/60 text-[13px] leading-none text-ink2"
                    >
                      ×
                    </button>
                    <span className="num absolute bottom-1.5 start-1.5 z-[2] text-[10.5px] text-ink2">
                      {i + 1}
                    </span>
                  </div>
                ))}
                {images.length < MAX_AUCTION_IMAGES ? (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="grid aspect-square cursor-pointer place-items-center rounded-[13px] text-2xl font-light text-ink3 [box-shadow:inset_0_0_0_1.5px_rgba(255,255,255,.09)]"
                  >
                    +
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="m-0 mt-2.5 text-[12.5px] text-ink3">
              اسحب الصورة لترتيبها. الأولى هي الغلاف — هي اللي تطلع في البطاقة وفي الإشعارات.
            </p>
          </div>
        ) : null}

        {/* ---- step 2: details ---- */}
        {step === 1 ? (
          <div>
            {aiEnabled && images.length > 0 ? (
              <WriteListingCard
                images={images.map((i) => (i.kind === "file" ? i.file : auctionImageUrl(i.path)))}
                hint={title}
                onApply={applySuggestion}
              />
            ) : null}
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="w-title">
                اسم المنتج
              </label>
              <input
                id="w-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="field"
                placeholder="مثال: ساعة رولكس ديت‑جست 41"
              />
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">من 3 إلى 120 محرفًا.</p>
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="w-desc">
                الوصف
              </label>
              <textarea
                id="w-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                className="field"
                placeholder="حالة القطعة، ما يجي معها، وأي شيء يهم المزايد…"
              />
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">من 20 إلى 2000 محرف.</p>
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">التصنيف</label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="hairline flex h-[46px] w-full cursor-pointer items-center gap-2.5 rounded-[12px] bg-raised px-3.5 text-[15px]"
              >
                {picked ? (
                  <span className="truncate">
                    {picked.label.includes("›") ? (
                      <>
                        {picked.label.split("›")[0]}›{" "}
                        <span className="font-semibold text-gold">{picked.label.split("›")[1]}</span>
                      </>
                    ) : (
                      <span className="font-semibold text-gold">{picked.label}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-ink3">اختر التصنيف</span>
                )}
                <span className="ms-auto text-ink3">{picked ? "تغيير" : "‹"}</span>
              </button>
            </div>

            {attrFields.length > 0 ? (
              <div>
                <label className="mb-1.5 block text-[13.5px] font-semibold">مواصفات — اختيارية</label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {attrFields.map((f) => (
                    <input
                      key={f}
                      value={attrs[f] ?? ""}
                      onChange={(e) => setAttrs((prev) => ({ ...prev, [f]: e.target.value }))}
                      placeholder={f}
                      className="field"
                    />
                  ))}
                </div>
                <p className="m-0 mt-1.5 text-[12.5px] text-ink3">
                  الحقول تتغيّر حسب التصنيف. كلها اختيارية — ما تمنع النشر.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---- step 3: bidding ---- */}
        {step === 2 ? (
          <div>
            <PriceSuggestionCard
              categoryId={picked?.mainId ?? null}
              title={title}
              onUse={(formatted) => setStartingPrice(formatted)}
            />
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="w-price">
                سعر البداية
              </label>
              <input
                id="w-price"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                onBlur={() => {
                  const p = parseMoneyInput(startingPrice);
                  if (p) setStartingPrice(formatMoney(p));
                }}
                inputMode="decimal"
                dir="ltr"
                className="field num text-start font-display font-semibold"
                placeholder="45,000.00"
              />
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">
                أول مزايدة بهذا المبلغ بالضبط مقبولة.{" "}
                <b className="text-ink2">ما فيه حد أعلى للسعر</b> ولا سعر احتياطي.
              </p>
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">
                مقدار الزيادة — المكتوب داخل الزر
              </label>
              <div className="flex flex-wrap gap-2">
                {INCREMENTS.map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => {
                      setIncrement(inc);
                      setCustomIncrement(false);
                    }}
                    className={`grid h-11 min-w-[78px] cursor-pointer place-items-center rounded-[12px] px-4 font-display text-[15px] font-semibold ${
                      !customIncrement && increment === inc
                        ? "bg-gold text-gold-ink"
                        : "hairline bg-raised text-ink2 hover:text-ink"
                    }`}
                  >
                    <IncrementAmount amount={inc} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomIncrement(true)}
                  className={`grid h-11 cursor-pointer place-items-center rounded-[12px] px-4 text-sm ${
                    customIncrement
                      ? "bg-gold font-semibold text-gold-ink"
                      : "hairline bg-raised text-ink2 hover:text-ink"
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
                  className="field num mt-2.5 max-w-[200px] text-start font-display font-semibold"
                  placeholder="2000"
                />
              ) : null}

              <div className="mt-3.5 rounded-[13px] bg-[rgba(245,185,66,.07)] px-4 py-3 [box-shadow:inset_0_0_0_1px_rgba(245,185,66,.2)]">
                <span className="mb-1.5 block text-[12px] text-ink3">هذا اللي بيشوفه المزايد:</span>
                <span className="btn-gold pointer-events-none h-[52px] px-6 font-display text-lg">
                  <span className="text-sm font-medium opacity-70">زايد بـ</span>
                  {/^\d+0$/.test(increment) ? <IncrementAmount amount={increment} /> : "—"}
                </span>
              </div>
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">
                المبلغ لازم يكون من مضاعفات العشرة. المزايد ما يكتب رقمًا — يضغط زرًا.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[13.5px] font-semibold" htmlFor="w-end">
                وقت الانتهاء
              </label>
              <input
                id="w-end"
                type="datetime-local"
                value={endTime}
                min={minEndTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="field num"
                dir="ltr"
              />
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">
                على الأقل بعد 5 دقائق من الآن. أي مزايدة <b className="text-teal">تُقبل</b> في
                آخر 15 ثانية تمدّد الوقت 30 ثانية، حتى 20 مرة.
              </p>
            </div>
          </div>
        ) : null}

        {/* ---- step 4: review ---- */}
        {step === 3 ? (
          <div>
            <div className="mb-5 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
              بعد النشر ما تقدر تعدّل المزاد ولا تلغيه، ويستمر لين وقت انتهائه. هذه آخر فرصة
              تصلّح فيها شي.
            </div>

            <div className="grid gap-5 sm:grid-cols-[1fr_268px]">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {[
                    ["الاسم", <bdi key="t">{title}</bdi>],
                    ["التصنيف", picked?.label ?? "—"],
                    [
                      "الصور",
                      <span key="i" className="num">
                        {images.length === 1
                          ? "صورة واحدة"
                          : images.length === 2
                            ? "صورتان"
                            : `${images.length} صور`}{" "}
                        · الغلاف هو الأولى
                      </span>,
                    ],
                    [
                      "سعر البداية",
                      price ? <Money key="p" amount={price} className="font-display font-semibold" /> : "—",
                    ],
                    [
                      "الزيادة",
                      <span key="z" className="num">
                        <IncrementAmount amount={increment || "0"} /> — أول مزايدة تصير{" "}
                        {price ? <Money amount={price} /> : "—"}
                      </span>,
                    ],
                    [
                      "ينتهي",
                      <span key="e" className="num">
                        {endTime ? formatDateTimeAr(new Date(endTime)) : "—"}
                      </span>,
                    ],
                    ["الحد الأعلى", <span key="m" className="text-teal">ما فيه</span>],
                  ].map(([k, v], i) => (
                    <tr key={i} className="border-b border-[var(--color-hair)] last:border-0">
                      <td className="w-[110px] py-2.5 align-top text-[13px] text-ink3">{k}</td>
                      <td className="py-2.5">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div>
                <div className="hairline overflow-hidden rounded-[18px] bg-raised">
                  <div
                    className="relative h-[132px]"
                    style={{ background: "linear-gradient(135deg,#1B212C,#11151D)" }}
                  >
                    {images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageSrc(images[0])} alt="" className="size-full object-cover" />
                    ) : null}
                    <span className="pill pill-live absolute start-2.5 top-2.5 h-6 text-[11.5px]">
                      <span className="dot" />
                      مباشر
                    </span>
                  </div>
                  <div className="p-3.5">
                    <h4 className="m-0 mb-2.5 truncate text-[15px] font-semibold">{title || "—"}</h4>
                    <span className="block text-[11.5px] text-ink3">يبدأ من</span>
                    {price ? (
                      <Money amount={price} className="font-display text-[20px] font-bold text-gold" />
                    ) : null}
                  </div>
                </div>
                <p className="m-0 mt-2 text-center text-[12px] text-ink3">كذا بيشوفه الناس</p>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mb-0 mt-5 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
            {error}
          </p>
        ) : null}

        {/* nav row */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          {step < 3 ? (
            <button type="button" onClick={() => goTo(step + 1)} className="btn-gold h-[50px] px-8 text-[15px]">
              التالي
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => persist("active")}
                disabled={busy !== null}
                className="btn-gold h-[50px] px-8 text-[15px]"
              >
                {busy === "publish" ? "جارٍ النشر…" : "انشر المزاد"}
              </button>
              <button
                type="button"
                onClick={() => persist("draft")}
                disabled={busy !== null}
                className="btn-ghost h-[50px] px-5 text-[15px]"
              >
                {busy === "draft" ? "جارٍ الحفظ…" : "احفظ مسودة"}
              </button>
            </>
          )}
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={busy !== null}
              className="btn-ghost h-[50px] px-6 text-[15px]"
            >
              رجوع
            </button>
          ) : null}
        </div>
      </div>

      {pickerOpen ? (
        <CategoryPicker
          categories={categories}
          initialMainId={picked?.mainId}
          onDone={(p) => {
            setPicked(p);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
