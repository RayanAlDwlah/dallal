"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/(auth)/actions";

/** Circular avatar → dropdown. Identity is the picture, not a labelled button. */
export function UserMenu({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="ملفي الشخصي"
        aria-label="قائمة الحساب"
        className="hairline grid size-[38px] cursor-pointer place-items-center overflow-hidden rounded-full font-display text-sm font-semibold text-ink2 transition hover:[box-shadow:inset_0_0_0_1px_var(--color-hair),0_0_0_3px_rgba(245,185,66,.25)]"
        style={{ background: "linear-gradient(140deg,#2A3140,#171C26)" }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          displayName.trim().charAt(0)
        )}
      </button>

      {open ? (
        <div className="hairline absolute end-0 top-[46px] z-50 w-52 rounded-2xl bg-raised p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
          <div className="truncate px-3 py-2 text-sm font-semibold">{displayName}</div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block rounded-[10px] px-3 py-2 text-sm text-ink2 hover:bg-white/5 hover:text-ink"
          >
            ملفي ومزاداتي
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="block w-full cursor-pointer rounded-[10px] px-3 py-2 text-start text-sm text-ink2 hover:bg-white/5 hover:text-ink"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
