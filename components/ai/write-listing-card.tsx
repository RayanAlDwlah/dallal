"use client";

import { useState } from "react";

import { Sparkle } from "@/components/ai/sparkle";
import { toModelDataUrl } from "@/lib/images";

export interface ListingSuggestion {
  title: string;
  description: string;
  category: { id: number; label: string } | null;
  attributes: Record<string, string>;
}

/**
 * «دلال يكتب لك» — step 2 of the create wizard (ai.html touchpoint 1).
 * Reads the photos already chosen in step 1 and fills the editable fields.
 * The seller edits or rejects; nothing here publishes anything.
 */
export function WriteListingCard({
  images,
  hint,
  onApply,
}: {
  /** Files from step 1, or public URLs for already-uploaded draft images. */
  images: Array<File | string>;
  hint: string;
  onApply: (s: ListingSuggestion) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const payload = await Promise.all(images.slice(0, 3).map((i) => toModelDataUrl(i)));
      const res = await fetch("/api/ai/listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: payload, hint }),
      });
      if (res.status === 503) {
        setGone(true); // AI not configured — the card disappears, the form stays.
        return;
      }
      if (!res.ok) throw new Error();
      onApply((await res.json()) as ListingSuggestion);
      setNote("عبّينا الحقول من صورك — عدّل براحتك، ولا تنشر شيئًا ما تعرفه.");
    } catch {
      setNote("ما قدرنا نقرأ الصور الحين — اكتب بنفسك أو جرّب بعد شوي.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-[18px] bg-[linear-gradient(135deg,rgba(124,58,237,.12),rgba(45,212,191,.06))] p-4 [box-shadow:inset_0_0_0_1px_rgba(124,58,237,.28)]">
      <div className="flex flex-wrap items-center gap-3">
        <Sparkle />
        <div className="min-w-0 flex-1">
          <b className="block text-[14.5px]">دلال يكتب لك</b>
          <span className="block text-[12.5px] text-ink3">
            يقرأ صورك ويقترح عنوانًا ووصفًا وتصنيفًا. أنت تعدّل أو ترفض.
          </span>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy || images.length === 0}
          className="h-10 cursor-pointer rounded-[11px] border-0 bg-[rgba(124,58,237,.85)] px-5 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "يقرأ الصور…" : "اكتب لي"}
        </button>
      </div>
      {note ? <p className="m-0 mt-2.5 text-[12.5px] text-ink2">{note}</p> : null}
    </div>
  );
}
