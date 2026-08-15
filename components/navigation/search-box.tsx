"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/**
 * Two explicit modes, user's choice (Rayan 2026-08-16 — no guessing):
 *   • Enter / plain submit → ordinary keyword search, always.
 *   • the purple «الشريطي 😎» button → the query goes to the AI parser and
 *     comes back as visible, removable filter chips («يفهم البحث», ai.html).
 * On any AI failure the query falls through to the ordinary search — search
 * never breaks because a model did.
 */

let aiSearchOff = false; // remembered per tab after the first 503

interface ParsedFilters {
  category: { slug: string; label: string } | null;
  keywords: string[];
  maxPrice: string | null;
  endingWithinHours: number | null;
}

function SearchBoxInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [parsing, setParsing] = useState(false);

  function plain() {
    const q = value.trim();
    const usp = new URLSearchParams(params.toString());
    for (const k of ["q", "maxp", "endin"]) usp.delete(k);
    if (q) usp.set("q", q);
    router.push(`/${usp.size ? `?${usp}` : ""}`);
  }

  async function askShraiti() {
    const q = value.trim();
    if (!q || parsing) return;
    if (aiSearchOff) {
      plain();
      return;
    }
    setParsing(true);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 503) {
        aiSearchOff = true;
        plain();
        return;
      }
      if (!res.ok) {
        plain();
        return;
      }
      const f = (await res.json()) as ParsedFilters;
      const usp = new URLSearchParams();
      if (f.keywords.length > 0) usp.set("q", f.keywords.join(" "));
      if (f.category) usp.set("cat", f.category.slug);
      if (f.maxPrice) usp.set("maxp", f.maxPrice);
      if (f.endingWithinHours) usp.set("endin", String(f.endingWithinHours));
      if (usp.size === 0) {
        plain();
        return;
      }
      router.push(`/?${usp}`);
    } catch {
      plain();
    } finally {
      setParsing(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        plain();
      }}
      className="relative w-full"
      role="search"
    >
      <span className="pointer-events-none absolute start-3.5 top-[9px] text-[15px] text-ink3">⌕</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ابحث… أو خل الشريطي يفهمك: كامري 2020 تحت 60 ألف"
        className="h-10 w-full rounded-full border-0 bg-raised ps-9 pe-[104px] text-sm text-ink outline-none [box-shadow:inset_0_0_0_1px_var(--color-hair)] placeholder:text-ink3 focus:[box-shadow:inset_0_0_0_1px_var(--color-teal),0_0_0_3px_rgba(45,212,191,.15)]"
        aria-label="بحث"
      />
      <button
        type="button"
        onClick={askShraiti}
        disabled={parsing || !value.trim()}
        title="الشريطي يحوّل كلامك لفلاتر — تشوفها وتعدّلها"
        className="absolute end-1 top-1 h-8 cursor-pointer rounded-full border-0 bg-[rgba(124,58,237,.85)] px-3 text-[12.5px] font-semibold text-white disabled:opacity-40"
      >
        {parsing ? "يفهمك…" : "الشريطي 😎"}
      </button>
    </form>
  );
}

export function SearchBox() {
  return (
    <Suspense fallback={<div className="h-10 w-full rounded-full bg-raised" />}>
      <SearchBoxInner />
    </Suspense>
  );
}
