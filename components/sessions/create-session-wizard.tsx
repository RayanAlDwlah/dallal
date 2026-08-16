"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { IncrementAmount, Money } from "@/components/ui/money";
import { LotEditor, type DraftLot } from "@/components/sessions/lot-editor";
import type { CategoryTree } from "@/lib/auctions/queries";
import { guessMapping, parseCsv, type CsvMapping } from "@/lib/csv";
import { arError } from "@/lib/errors";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  auctionImageUrl,
  normalizeForUpload,
} from "@/lib/images";
import { addMoney, parseIncrementInput, parseMoneyInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeAr, isoFromNow, toDatetimeLocalValue } from "@/lib/time";
import type { AuctionSession, LotWithCategory } from "@/types/sessions";

const STEPS = ["المعلومات", "القطع", "الدخول", "المراجعة"] as const;
const DEPOSITS = ["بدون", "25", "50", "100", "500"] as const;

export interface SessionDraft {
  session: AuctionSession;
  lots: LotWithCategory[];
}

export function CreateSessionWizard({
  userId,
  categories,
  draft = null,
  aiEnabled = false,
}: {
  userId: string;
  categories: CategoryTree[];
  draft?: SessionDraft | null;
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const coverInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const findPicked = (categoryId: number | null) => {
    if (!categoryId) return null;
    for (const main of categories) {
      if (main.id === categoryId) return { id: main.id, label: main.name_ar, mainId: main.id };
      const sub = main.children.find((c) => c.id === categoryId);
      if (sub) return { id: sub.id, label: `${main.name_ar} › ${sub.name_ar}`, mainId: main.id };
    }
    return null;
  };

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(draft?.session.title ?? "");
  const [description, setDescription] = useState(draft?.session.description ?? "");
  const [city, setCity] = useState(draft?.session.city ?? "");
  const [startTime, setStartTime] = useState(() => {
    const saved = draft?.session.start_time ? new Date(draft.session.start_time) : null;
    return toDatetimeLocalValue(
      saved && saved.getTime() > Date.now() + 10 * 60_000
        ? saved
        : new Date(Date.now() + 60 * 60_000),
    );
  });
  const [startPreset, setStartPreset] = useState<"1" | "3" | "24" | "custom">(
    draft ? "custom" : "1",
  );
  const [minStart] = useState(() => toDatetimeLocalValue(isoFromNow(5)));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPath] = useState<string | null>(draft?.session.cover_image ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    draft?.session.cover_image ? auctionImageUrl(draft.session.cover_image) : null,
  );

  const [lots, setLots] = useState<DraftLot[]>(() =>
    (draft?.lots ?? []).map((l) => ({
      key: l.id,
      id: l.id,
      title: l.title,
      category: findPicked(l.category_id),
      startingPrice: l.starting_price,
      increment: l.bid_increment.split(".")[0] ?? l.bid_increment,
      durationMinutes: l.duration_seconds == null ? null : Math.round(l.duration_seconds / 60),
      file: null,
      preview: l.images[0] ? auctionImageUrl(l.images[0]) : null,
      imagePath: l.images[0] ?? null,
    })),
  );
  const [editing, setEditing] = useState<DraftLot | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const [deposit, setDeposit] = useState<string>(
    draft ? (draft.session.deposit ?? "بدون") : "50",
  );
  const [customDeposit, setCustomDeposit] = useState(
    draft?.session.deposit != null && !DEPOSITS.includes(draft.session.deposit as never),
  );
  const [entryMode, setEntryMode] = useState<"deposit" | "invite">(
    draft?.session.entry_mode ?? "deposit",
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"publish" | "draft" | null>(null);

  const totalStart = lots.reduce((sum, l) => addMoney(sum, l.startingPrice), "0.00");
  const totalMinutes = lots.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);
  const openEnded = lots.filter((l) => l.durationMinutes == null).length;

  function pickCover(f: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(f.type)) return setError("الصيغ المقبولة: JPG أو PNG أو WebP");
    if (f.size > MAX_IMAGE_BYTES) return setError("حجم الصورة الأقصى 5 ميجابايت");
    setError(null);
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function reorder(from: number, to: number) {
    setLots((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  function validateStep(target: number): boolean {
    setError(null);
    if (target >= 1) {
      if (title.trim().length < 3) {
        setError("اسم الجلسة من 3 محارف على الأقل");
        setStep(0);
        return false;
      }
      if (description.trim().length < 20) {
        setError("الوصف من 20 محرفًا على الأقل");
        setStep(0);
        return false;
      }
      if (new Date(startTime).getTime() < Date.now() + 5 * 60_000) {
        setError("موعد البداية لازم يكون بعد 5 دقائق على الأقل");
        setStep(0);
        return false;
      }
    }
    if (target >= 2 && lots.length === 0) {
      setError("أضف قطعة واحدة على الأقل");
      setStep(1);
      return false;
    }
    if (target >= 2 && lots.some((l) => !l.category)) {
      setError("فيه قطع مستوردة بدون تصنيف — افتح كل قطعة ملوّنة واختر تصنيفها");
      setStep(1);
      return false;
    }
    if (target >= 3 && customDeposit && deposit !== "بدون" && !parseMoneyInput(deposit)) {
      setError("أدخل مبلغ عربون صحيحًا");
      setStep(2);
      return false;
    }
    return true;
  }

  function goTo(target: number) {
    if (target > step && !validateStep(target)) return;
    setError(null);
    setStep(target);
  }

  async function uploadOne(file: File, folder: string): Promise<string> {
    const upload = await normalizeForUpload(file);
    const path = `${userId}/${folder}/${crypto.randomUUID().slice(0, 8)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("auction-images")
      .upload(path, upload, { contentType: upload.type, upsert: false });
    if (upErr) throw new Error("upload_failed");
    return path;
  }

  async function persist(status: "scheduled" | "draft") {
    if (!validateStep(3)) return;
    setBusy(status === "scheduled" ? "publish" : "draft");
    setError(null);
    try {
      const batch = crypto.randomUUID();
      const newCover = coverFile ? await uploadOne(coverFile, `sessions/${batch}`) : null;

      const depositValue =
        deposit === "بدون" ? null : (parseMoneyInput(deposit) ?? null);

      const row = {
        host_id: userId,
        title: title.trim(),
        description: description.trim(),
        cover_image: newCover ?? coverPath,
        city: city.trim() || null,
        start_time: new Date(startTime).toISOString(),
        deposit: depositValue,
        entry_mode: entryMode,
        status,
      };

      let sessionId = draft?.session.id ?? null;
      if (sessionId) {
        /* resuming a draft: update the session, replace its lots */
        const { error: upErr } = await supabase.from("sessions").update(row).eq("id", sessionId);
        if (upErr) throw upErr;
        const { error: delErr } = await supabase
          .from("session_lots")
          .delete()
          .eq("session_id", sessionId);
        if (delErr) throw delErr;
      } else {
        const { data: session, error: insErr } = await supabase
          .from("sessions")
          .insert(row)
          .select("id")
          .single();
        if (insErr) throw insErr;
        sessionId = session.id as string;
      }

      const rows = [];
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i]!;
        const path = lot.imagePath ?? (lot.file ? await uploadOne(lot.file, `sessions/${batch}`) : null);
        rows.push({
          session_id: sessionId,
          position: i + 1,
          title: lot.title,
          description: "",
          category_id: lot.category!.id,
          images: path ? [path] : [],
          starting_price: lot.startingPrice,
          bid_increment: lot.increment,
          duration_seconds: lot.durationMinutes == null ? null : lot.durationMinutes * 60,
        });
      }
      const { error: lotErr } = await supabase.from("session_lots").insert(rows);
      if (lotErr) throw lotErr;

      router.push(`/sessions/${sessionId}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "upload_failed" ? arError("upload_failed") : arError("unknown"));
      setBusy(null);
    }
  }

  /* ---------- «استيراد CSV» — the dealership already has this file ---------- */

  async function importCsv(file: File) {
    setImportNote(null);
    setError(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("csv_empty");
      const headers = rows[0]!;
      let mapping: CsvMapping = guessMapping(headers);

      /* headers the heuristics can't read → الشريطي maps the COLUMN NAMES
         (mapping only — every value still comes from the file). */
      if (mapping.title == null || mapping.price == null) {
        try {
          const res = await fetch("/api/ai/csv-map", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ headers, samples: rows.slice(1, 4) }),
          });
          if (res.ok) mapping = (await res.json()) as CsvMapping;
        } catch {
          /* heuristics remain */
        }
      }
      if (mapping.title == null || mapping.price == null) throw new Error("csv_unmapped");

      const imported: DraftLot[] = [];
      let skipped = 0;
      for (const r of rows.slice(1)) {
        const lotTitle = (r[mapping.title] ?? "").trim();
        const price = parseMoneyInput(r[mapping.price] ?? "");
        if (lotTitle.length < 3 || !price) {
          skipped++;
          continue;
        }
        const inc =
          mapping.increment != null ? parseIncrementInput(r[mapping.increment] ?? "") : null;
        const durRaw = mapping.duration != null ? r[mapping.duration] ?? "" : "";
        const dur = /^\d+$/.test(durRaw) ? Math.min(1440, Math.max(1, parseInt(durRaw, 10))) : 5;
        const catName = mapping.category != null ? (r[mapping.category] ?? "").trim() : "";
        const cat =
          categories.find((c) => c.name_ar === catName) ??
          categories.find((c) => catName && c.name_ar.includes(catName)) ??
          null;
        imported.push({
          key: crypto.randomUUID(),
          title: lotTitle.slice(0, 120),
          category: cat ? { id: cat.id, label: cat.name_ar, mainId: cat.id } : null,
          startingPrice: price,
          increment: inc ?? "500",
          durationMinutes: dur,
          file: null,
          preview: null,
          imagePath: null,
        });
      }
      if (imported.length === 0) throw new Error("csv_empty");
      setLots((prev) => [...prev, ...imported]);
      const missingCat = imported.filter((l) => !l.category).length;
      setImportNote(
        `أضفنا ${imported.length} قطعة من الملف` +
          (skipped ? ` وتجاوزنا ${skipped} صفًا ناقصًا` : "") +
          (missingCat ? ` — ${missingCat} منها تحتاج تختار تصنيفها قبل النشر` : "") +
          ". الصور تنضاف من تعديل كل قطعة.",
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "csv_unmapped"
          ? "ما قدرنا نفهم أعمدة الملف — خله بأعمدة: اسم القطعة، سعر البداية، الزيادة، المدة، التصنيف"
          : "الملف فاضي أو ما فيه صفوف صالحة",
      );
    }
  }

  const stepChip = (i: number) => (
    <div
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
      <div className="mb-5 flex items-center">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
            {i > 0 ? <span className="mx-3 h-px min-w-[12px] flex-1 bg-[var(--color-hair)]" /> : null}
            {stepChip(i)}
          </div>
        ))}
      </div>

      <div className="hairline rounded-[22px] bg-surface p-5 sm:p-6">
        {/* ---- 1: info ---- */}
        {step === 0 ? (
          <div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">اسم الجلسة</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                className="field"
                placeholder="مثال: مزاد السيارات الأسبوعي"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">الوصف</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                className="field min-h-[88px]"
                placeholder="وش يُعرض، ومتى يمكن الفحص…"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">الغلاف</label>
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                className="hairline relative grid h-[130px] w-full place-items-center overflow-hidden rounded-[14px]"
                style={{ background: "linear-gradient(135deg,#1E2431,#10141C)" }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(70% 90% at 30% 10%,rgba(124,58,237,.26),transparent 65%),radial-gradient(60% 80% at 85% 70%,rgba(45,212,191,.18),transparent 65%)",
                  }}
                />
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span className="relative z-[2] text-[13.5px] text-ink2">
                    اضغط لاختيار صورة الغلاف
                  </span>
                )}
              </button>
              <input
                ref={coverInput}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickCover(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">متى تبدأ؟</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["1", "بعد ساعة"],
                    ["3", "بعد 3 ساعات"],
                    ["24", "بكرة نفس الوقت"],
                  ] as const
                ).map(([hours, label]) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => {
                      setStartPreset(hours);
                      setStartTime(
                        toDatetimeLocalValue(new Date(Date.now() + Number(hours) * 3600_000)),
                      );
                    }}
                    className={`grid h-11 place-items-center rounded-[12px] px-4 text-sm ${
                      startPreset === hours
                        ? "bg-gold font-semibold text-gold-ink"
                        : "hairline bg-raised text-ink2 hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setStartPreset("custom")}
                  className={`grid h-11 place-items-center rounded-[12px] px-4 text-sm ${
                    startPreset === "custom"
                      ? "bg-gold font-semibold text-gold-ink"
                      : "hairline bg-raised text-ink2 hover:text-ink"
                  }`}
                >
                  وقت محدد
                </button>
              </div>
              {startPreset === "custom" ? (
                <input
                  type="datetime-local"
                  value={startTime}
                  min={minStart}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="field num mt-2.5"
                  dir="ltr"
                />
              ) : (
                <p className="num m-0 mt-2 text-[13px] text-ink2">
                  تبدأ {formatDateTimeAr(new Date(startTime))}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[13.5px] font-semibold">المدينة</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={60}
                className="field"
                placeholder="الرياض"
              />
            </div>
            <p className="m-0 mt-2 text-[12.5px] text-ink3">
              الجلسة تبدأ في وقتها. مدة كل قطعة تنحدّد في الخطوة الجاية، مو وقت انتهاء مطلق لكل
              وحدة.
            </p>
          </div>
        ) : null}

        {/* ---- 2: lots ---- */}
        {step === 1 ? (
          <div>
            <ul className="m-0 list-none p-0">
              {lots.map((lot, i) => (
                <li
                  key={lot.key}
                  draggable
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) reorder(dragIndex.current, i);
                    dragIndex.current = null;
                  }}
                  className="hairline mb-2.5 flex items-center gap-3 rounded-[14px] bg-raised px-3.5 py-3"
                >
                  <span className="cursor-grab text-[15px] leading-none text-ink3">⋮⋮</span>
                  <span className="num grid size-[26px] flex-none place-items-center rounded-[8px] bg-white/5 font-display text-[12.5px] font-semibold text-ink2">
                    {i + 1}
                  </span>
                  <span
                    className="hairline size-11 flex-none overflow-hidden rounded-[10px]"
                    style={{ background: "linear-gradient(140deg,#232B39,#141922)" }}
                  >
                    {lot.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={lot.preview} alt="" className="size-full object-cover" />
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(lot);
                      setEditorOpen(true);
                    }}
                    className="min-w-0 flex-1 text-start"
                  >
                    <b className="block truncate text-sm font-semibold">{lot.title}</b>
                    <small className="num text-xs text-ink3">
                      {lot.category ? (
                        lot.category.label.split("›").pop()?.trim()
                      ) : (
                        <span className="text-gold">اختر التصنيف ←</span>
                      )}{" "}
                      · {lot.durationMinutes == null ? "بدون مدة" : `${lot.durationMinutes} دقائق`} ·
                      زيادة <IncrementAmount amount={lot.increment} />
                    </small>
                  </button>
                  <Money
                    amount={lot.startingPrice}
                    className="num whitespace-nowrap font-display text-[15px] font-semibold text-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setLots((prev) => prev.filter((l) => l.key !== lot.key))}
                    className="grid size-[26px] flex-none place-items-center rounded-[8px] text-ink3 hover:bg-[rgba(255,77,94,.13)] hover:text-red"
                    aria-label="حذف القطعة"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-1 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
                className="h-[46px] flex-1 rounded-[13px] bg-transparent text-sm font-medium text-ink2 [box-shadow:inset_0_0_0_1.5px_rgba(255,255,255,.1)] hover:text-ink hover:[box-shadow:inset_0_0_0_1.5px_rgba(245,185,66,.35)]"
              >
                + أضف قطعة
              </button>
              <button
                type="button"
                onClick={() => csvInput.current?.click()}
                title="ملف من المعرض بأعمدة: اسم القطعة، سعر البداية، الزيادة، المدة، التصنيف"
                className="h-[46px] rounded-[13px] bg-transparent px-4 text-sm font-medium text-[#C4A6FF] [box-shadow:inset_0_0_0_1.5px_rgba(124,58,237,.35)] hover:[box-shadow:inset_0_0_0_1.5px_rgba(124,58,237,.6)]"
              >
                استيراد CSV 😎
              </button>
              <input
                ref={csvInput}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
            </div>

            {importNote ? (
              <p className="m-0 mt-2.5 rounded-[13px] bg-[rgba(124,58,237,.1)] px-4 py-2.5 text-[13px] text-[#CDB6FF] [box-shadow:inset_0_0_0_1px_rgba(124,58,237,.26)]">
                {importNote}
              </p>
            ) : null}

            <p className="m-0 mt-2.5 text-[12.5px] text-ink3">
              عندك ملف من المعرض؟ أعمدته:{" "}
              <b className="text-ink2">اسم القطعة، سعر البداية، الزيادة، المدة (دقائق)، التصنيف</b>{" "}
              — وأسماء أعمدة مختلفة؟ الشريطي يفكّها.{" "}
              <a href="/sample-lots.csv" download className="font-semibold text-[#C4A6FF]">
                حمّل نموذجًا جاهزًا
              </a>
            </p>

            {lots.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--color-hair)] pt-3.5 text-sm text-ink2">
                <span className="num">
                  {lots.length} قطعة · مدة متوقعة {totalMinutes} دقيقة
                  {openEnded > 0 ? ` + ${openEnded} بدون مدة` : ""}
                </span>
                <span>
                  مجموع أسعار البداية{" "}
                  <Money amount={totalStart} className="font-display font-bold text-gold" />
                </span>
              </div>
            ) : null}

            <p className="m-0 mt-3 text-[12.5px] text-ink3">
              كل قطعة مزاد كامل بحد ذاته — لها تصنيف وسعر بداية ومقدار زيادة ومدة. اللي يجمعها هو
              الترتيب والغرفة. مزايدة مقبولة في آخر 15 ثانية تضيف 30 ثانية{" "}
              <b className="text-teal">لهذي القطعة</b> فقط.
            </p>
          </div>
        ) : null}

        {/* ---- 3: entry ---- */}
        {step === 2 ? (
          <div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[13.5px] font-semibold">عربون الدخول</label>
              <div className="flex flex-wrap gap-2">
                {DEPOSITS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDeposit(d);
                      setCustomDeposit(false);
                    }}
                    className={`grid h-11 min-w-[72px] place-items-center rounded-[12px] px-4 font-display text-[15px] font-semibold ${
                      !customDeposit && deposit === d
                        ? "bg-gold text-gold-ink"
                        : "hairline bg-raised text-ink2 hover:text-ink"
                    }`}
                  >
                    {d === "بدون" ? <span className="font-body text-sm">بدون</span> : d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomDeposit(true)}
                  className={`grid h-11 place-items-center rounded-[12px] px-4 text-sm ${
                    customDeposit
                      ? "bg-gold font-semibold text-gold-ink"
                      : "hairline bg-raised text-ink2 hover:text-ink"
                  }`}
                >
                  مبلغ آخر
                </button>
              </div>
              {customDeposit ? (
                <input
                  value={deposit === "بدون" ? "" : deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="field num mt-2.5 max-w-[180px] text-start font-display font-semibold"
                  placeholder="75.00"
                />
              ) : null}
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">
                يُدفع مرة وحدة للدخول للقاعة، ويخوّل المزايدة على كل القطع.
              </p>
              <div className="mt-3 rounded-[13px] bg-[rgba(124,58,237,.1)] px-4 py-3 text-[13.5px] text-[#CDB6FF] [box-shadow:inset_0_0_0_1px_rgba(124,58,237,.26)]">
                هذا عرض توضيحي: العربون <b>محاكاة</b>. ما فيه بوابة دفع، ولا حقل بطاقة، ولا مبلغ
                ينتقل فعليًا — في أي مكان في المنتج.
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13.5px] font-semibold">من يقدر يدخل</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEntryMode("deposit")}
                  className={`grid h-11 place-items-center rounded-[12px] px-4.5 text-sm ${
                    entryMode === "deposit"
                      ? "bg-gold font-semibold text-gold-ink"
                      : "hairline bg-raised text-ink2 hover:text-ink"
                  }`}
                >
                  أي أحد بعد دفع العربون
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("invite")}
                  className={`grid h-11 place-items-center rounded-[12px] px-4.5 text-sm ${
                    entryMode === "invite"
                      ? "bg-gold font-semibold text-gold-ink"
                      : "hairline bg-raised text-ink2 hover:text-ink"
                  }`}
                >
                  بدعوة فقط
                </button>
              </div>
              <p className="m-0 mt-1.5 text-[12.5px] text-ink3">
                المشاهدة مفتوحة للجميع بأي حال — العربون يفتح <b>المزايدة</b> مو الفرجة.
                {entryMode === "invite"
                  ? " في وضع الدعوة، الطلبات تجيك في غرفة التحكّم وأنت توافق."
                  : null}
              </p>
            </div>
          </div>
        ) : null}

        {/* ---- 4: review ---- */}
        {step === 3 ? (
          <div>
            <div className="mb-5 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
              بعد النشر تقدر تضيف قطعة أو تعيد الترتيب <b>قبل</b> بداية الجلسة فقط. بعد ما تبدأ،
              القطع تُفتح بالترتيب وما تتغيّر.
            </div>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {[
                  ["الجلسة", title || "—"],
                  ["المضيف", city ? `أنت · ${city}` : "أنت"],
                  ["الموعد", <span key="t" className="num">{formatDateTimeAr(new Date(startTime))}</span>],
                  [
                    "القطع",
                    <span key="l" className="num">
                      {lots.length} · مدة متوقعة {totalMinutes} دقيقة
                      {openEnded > 0 ? ` + ${openEnded} بدون مدة` : ""}
                    </span>,
                  ],
                  [
                    "العربون",
                    deposit === "بدون" || (customDeposit && !parseMoneyInput(deposit)) ? (
                      "بدون"
                    ) : (
                      <span key="d">
                        <Money
                          amount={parseMoneyInput(deposit) ?? "0.00"}
                          className="font-display font-semibold"
                        />{" "}
                        — محاكاة
                      </span>
                    ),
                  ],
                  ["الدخول", entryMode === "deposit" ? "أي أحد بعد دفع العربون" : "بدعوة فقط"],
                ].map(([k, v], i) => (
                  <tr key={i} className="border-b border-[var(--color-hair)] last:border-0">
                    <td className="w-[120px] py-2.5 align-top text-[13px] text-ink3">{k}</td>
                    <td className="py-2.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? (
          <p className="mb-0 mt-5 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2.5">
          {step < 3 ? (
            <button type="button" onClick={() => goTo(step + 1)} className="btn-gold h-[50px] px-8 text-[15px]">
              التالي
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => persist("scheduled")}
                disabled={busy !== null}
                className="btn-gold h-[50px] px-8 text-[15px]"
              >
                {busy === "publish" ? "جارٍ النشر…" : "انشر الجلسة"}
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

      {editorOpen ? (
        <LotEditor
          categories={categories}
          aiEnabled={aiEnabled}
          initial={editing}
          onSave={(lot) => {
            setLots((prev) => {
              const i = prev.findIndex((l) => l.key === lot.key);
              if (i === -1) return [...prev, lot];
              const next = [...prev];
              next[i] = lot;
              return next;
            });
            setEditorOpen(false);
            setEditing(null);
          }}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
