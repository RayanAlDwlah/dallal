"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

/**
 * V2 — the topbar search (topbar.html). Submits to the home listing as ?q=;
 * the SERVER filters (lib/auctions/listing.ts) — this box only carries the
 * words. Wrapped in Suspense because useSearchParams suspends during
 * prerender.
 */
function SearchBoxInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  return (
    <form onSubmit={submit} className="relative w-full" role="search">
      <span
        aria-hidden="true"
        className="text-ink-3 pointer-events-none absolute start-3.5 top-[9px] text-[15px]"
      >
        ⌕
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ابحث عن سيارة، ساعة، أرض…"
        aria-label="بحث"
        className="bg-sunk text-ink placeholder:text-ink-3 h-10 w-full rounded-full border-0 ps-9 pe-4 text-sm outline-none [box-shadow:inset_0_0_0_1px_var(--c-rule)] focus:[box-shadow:inset_0_0_0_1px_var(--c-urge),0_0_0_3px_rgba(45,212,191,.15)]"
      />
    </form>
  );
}

export function SearchBox() {
  return (
    <Suspense fallback={<div className="bg-sunk h-10 w-full rounded-full" />}>
      <SearchBoxInner />
    </Suspense>
  );
}
