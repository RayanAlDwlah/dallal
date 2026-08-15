"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/**
 * The search bar IS the AI entry point — there is deliberately no sixth icon
 * («يفهم البحث», ai.html): a natural Arabic sentence becomes visible filter
 * chips on the home page; a plain keyword stays a plain keyword search.
 *
 * The parse call is best-effort: on any failure (AI off, timeout, nonsense)
 * the query falls through unchanged to the ilike search. Search never breaks
 * because a model did.
 */

let aiSearchOff = false; // remembered per tab after the first 503

const PRICE_TIME_WORDS = /ألف|الف|ريال|تحت|فوق|أقل|اقل|أكثر|اكثر|ينتهي|اليوم|ساعة|ساعه|\d/;

function looksNatural(q: string): boolean {
  return q.split(/\s+/).length >= 3 && PRICE_TIME_WORDS.test(q);
}

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();

    const plain = () => {
      const usp = new URLSearchParams(params.toString());
      for (const k of ["q", "maxp", "endin"]) usp.delete(k);
      if (q) usp.set("q", q);
      router.push(`/${usp.size ? `?${usp}` : ""}`);
    };

    if (!q || aiSearchOff || !looksNatural(q) || parsing) {
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
      else {
        const cat = params.get("cat");
        if (cat) usp.set("cat", cat);
      }
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
    <form onSubmit={submit} className="relative w-full" role="search">
      <span className="pointer-events-none absolute start-3.5 top-[9px] text-[15px] text-ink3">⌕</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ابحث عادي، أو اطلب: كامري 2020 تحت 60 ألف…"
        className="h-10 w-full rounded-full border-0 bg-raised ps-9 pe-4 text-sm text-ink outline-none [box-shadow:inset_0_0_0_1px_var(--color-hair)] placeholder:text-ink3 focus:[box-shadow:inset_0_0_0_1px_var(--color-teal),0_0_0_3px_rgba(45,212,191,.15)]"
        aria-label="بحث"
      />
      {parsing ? (
        <span
          className="absolute end-3.5 top-[11px] size-[18px] animate-pulse rounded-[5px] bg-[rgba(124,58,237,.35)]"
          aria-label="يفهم طلبك…"
        />
      ) : null}
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
