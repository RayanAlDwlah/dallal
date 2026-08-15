"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";

/**
 * «الشريطي 😎» is a MODE, not a one-shot button (Rayan 2026-08-16): pressing
 * it lights AI search on and it stays on — every Enter after that goes
 * through the parser and comes back as removable filter chips. Pressing it
 * again goes back to plain keyword search. The choice is remembered per
 * browser. On any AI failure the query falls through to plain search —
 * search never breaks because a model did.
 */

const MODE_KEY = "dallal-shraiti";
const MODE_EVENT = "dallal-shraiti-change";

/*
 * The mode lives in localStorage — an EXTERNAL store, read through
 * useSyncExternalStore rather than mirrored into state by an effect (the
 * setState-in-effect lint rule, and the hydration flash it papers over).
 * The server snapshot is `false`; the client corrects on hydration. The
 * custom event is what makes a same-tab toggle re-render — `storage` fires
 * only in OTHER tabs, which conveniently keeps two open tabs in sync too.
 */
function subscribeMode(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(MODE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(MODE_EVENT, cb);
  };
}

function readMode(): boolean {
  return localStorage.getItem(MODE_KEY) === "1";
}

function writeMode(on: boolean) {
  localStorage.setItem(MODE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(MODE_EVENT));
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
  const aiMode = useSyncExternalStore(subscribeMode, readMode, () => false);
  const [parsing, setParsing] = useState(false);

  function toggleMode() {
    writeMode(!aiMode);
  }

  function plain() {
    const q = value.trim();
    const usp = new URLSearchParams(params.toString());
    for (const k of ["q", "maxp", "endin"]) usp.delete(k);
    if (q) usp.set("q", q);
    router.push(`/${usp.size ? `?${usp}` : ""}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q || !aiMode || parsing) {
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
        writeMode(false);
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
    <form onSubmit={submit} className="relative w-full" role="search">
      <span className="pointer-events-none absolute start-3.5 top-[9px] text-[15px] text-ink3">⌕</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          aiMode ? "اكتب اللي في بالك… الشريطي فاهمك 😎" : "ابحث… أو شغّل الشريطي يفهمك"
        }
        className={`h-10 w-full rounded-full border-0 bg-raised ps-9 pe-[104px] text-sm text-ink outline-none placeholder:text-ink3 ${
          aiMode
            ? "[box-shadow:inset_0_0_0_1px_rgba(124,58,237,.45),0_0_16px_rgba(124,58,237,.12)] focus:[box-shadow:inset_0_0_0_1px_rgba(124,58,237,.7),0_0_0_3px_rgba(124,58,237,.15)]"
            : "[box-shadow:inset_0_0_0_1px_var(--color-hair)] focus:[box-shadow:inset_0_0_0_1px_var(--color-teal),0_0_0_3px_rgba(45,212,191,.15)]"
        }`}
        aria-label="بحث"
      />
      <button
        type="button"
        onClick={toggleMode}
        aria-pressed={aiMode}
        title={
          aiMode
            ? "وضع الشريطي شغّال — اكتب طلبك عادي واضغط Enter. اضغط للإطفاء"
            : "شغّل وضع الشريطي: يفهم طلبك ويحوّله فلاتر"
        }
        className={`absolute end-1 top-1 h-8 cursor-pointer rounded-full border-0 px-3 text-[12.5px] font-semibold transition ${
          aiMode
            ? "bg-[rgba(124,58,237,.9)] text-white [box-shadow:0_0_14px_rgba(124,58,237,.45)]"
            : "bg-white/5 text-ink2 [box-shadow:inset_0_0_0_1px_var(--color-hair)] hover:text-ink"
        }`}
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
