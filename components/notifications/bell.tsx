"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { IncrementAmount, Money } from "@/components/ui/money";
import { createClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime-auth";
import { relativeTimeAr } from "@/lib/time";
import type { AppNotification } from "@/types/db";

/**
 * Where a notification takes you. A session lot has no auction_id, so routing
 * on that alone sent every «فزت» from a session to the profile page — the
 * message arrived and led nowhere. The payload carries session_id for exactly
 * this.
 */
function notificationHref(n: AppNotification): string {
  if (n.payload.session_id) return `/sessions/${n.payload.session_id}`;
  if (n.auction_id) return `/auctions/${n.auction_id}`;
  return "/profile";
}

function notificationLine(n: AppNotification): { title: string; sub: React.ReactNode } {
  const t = n.payload.title ?? "";
  switch (n.type) {
    case "outbid":
      return {
        title: "أحد زايد عليك",
        sub: (
          <>
            {t} · صار السعر {n.payload.amount ? <Money amount={n.payload.amount} /> : null}
          </>
        ),
      };
    case "won":
      return {
        title: "فزت بالمزاد 🎉",
        sub: (
          <>
            {t} · بـ {n.payload.amount ? <Money amount={n.payload.amount} /> : null}
          </>
        ),
      };
    case "sold":
      return {
        title: "بِيع مزادك",
        sub: (
          <>
            {t} · بـ {n.payload.amount ? <Money amount={n.payload.amount} /> : null}
            {n.payload.winner_name ? ` · الفائز ${n.payload.winner_name}` : null}
          </>
        ),
      };
    case "ended_no_bids":
      return { title: "انتهى مزادك بدون مزايدات", sub: t };
    case "session_starting":
      return { title: "جلستك بدأت الآن", sub: `${t} · القطعة الأولى مفتوحة` };
    default:
      /* An unknown type must not take the topbar down with it. The database
         constraint can grow a value before this file learns about it, and a
         switch with no default returns undefined — which crashes on .title
         for every page, over a notification. */
      return { title: t || "إشعار جديد", sub: null };
  }
}

/**
 * The bell + its dropdown + the realtime «زايد عليك» toast (topbar.html).
 */
export function Bell({
  userId,
  initialItems,
  initialUnread,
}: {
  userId: string;
  initialItems: AppNotification[];
  initialUnread: number;
}) {
  const [items, setItems] = useState<AppNotification[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    /* The socket must carry the user's JWT before subscribing — notifications
       are readable only by their owner, so an unauthenticated socket receives
       nothing at all (see lib/supabase/realtime-auth.ts). */
    void (async () => {
      await authorizeRealtime(supabase);
      if (cancelled) return;

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new as AppNotification;
            setItems((prev) => [n, ...prev].slice(0, 12));
            setUnread((prev) => prev + 1);
            setToast(n);
          },
        )
        .subscribe();
    })();

    /* Access tokens are short-lived; a refresh must reach the socket too. */
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  /* Long enough to read a price and decide. Seven seconds was short enough
     that a toast could come and go between two glances at the screen. */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 14_000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  async function openAndMarkRead() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openAndMarkRead}
        aria-label="الإشعارات"
        className="relative grid size-[38px] cursor-pointer place-items-center rounded-full text-[17px] text-ink2 transition hover:bg-white/5 hover:text-ink"
      >
        ◔
        {unread > 0 ? (
          <span className="absolute end-2 top-[7px] size-2 rounded-full bg-red [box-shadow:0_0_0_2px_var(--color-surface),0_0_8px_var(--color-red)]" />
        ) : null}
      </button>

      {open ? (
        <div className="hairline absolute end-0 top-[46px] z-50 w-[330px] max-w-[calc(100vw-32px)] rounded-2xl bg-raised p-1.5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
          <div className="px-3 py-2 text-[13px] text-ink3">الإشعارات</div>
          {items.length === 0 ? (
            <p className="px-3 pb-3 pt-1 text-sm text-ink2">ما وصلك شيء بعد.</p>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto">
              {items.map((n) => {
                const line = notificationLine(n);
                return (
                  <li key={n.id}>
                    <Link
                      href={notificationHref(n)}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-[12px] px-3 py-2.5 hover:bg-white/5"
                    >
                      <span
                        className={`mt-1 w-[3px] self-stretch rounded-[2px] ${
                          n.type === "won"
                            ? "bg-green"
                            : n.type === "outbid"
                              ? "bg-gold"
                              : "bg-ink3"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{line.title}</span>
                        <span className="num block truncate text-[13px] text-ink2">{line.sub}</span>
                        <span className="num block text-[12px] text-ink3">
                          {relativeTimeAr(n.created_at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* realtime toast — the approved «زايد عليك» shape */}
      {toast ? (
        <div className="hairline fixed inset-x-4 bottom-4 z-[60] flex items-start gap-3 rounded-2xl bg-raised px-4 py-3.5 shadow-[0_16px_40px_rgba(0,0,0,.55)] sm:inset-x-auto sm:bottom-5 sm:start-5 sm:w-[390px]">
          <span className="w-[3px] self-stretch rounded-[2px] bg-gold" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm">{notificationLine(toast).title}</p>
            <small className="num block truncate text-[13px] text-ink2">
              {notificationLine(toast).sub}
            </small>
          </div>
          <span className="ms-auto" />
          {toast.type === "outbid" ? (
            <Link
              href={notificationHref(toast)}
              onClick={() => setToast(null)}
              className="whitespace-nowrap text-sm font-semibold text-gold"
            >
              {toast.payload.increment ? (
                <>
                  زايد بـ <IncrementAmount amount={toast.payload.increment} />
                </>
              ) : (
                "افتح المزاد"
              )}
            </Link>
          ) : (
            <Link
              href={notificationHref(toast)}
              onClick={() => setToast(null)}
              className="whitespace-nowrap text-sm font-semibold text-gold"
            >
              افتح
            </Link>
          )}
          {/* Every toast is dismissible. The action used to replace the close
              affordance, so an outbid toast could only be waited out. */}
          <button
            onClick={() => setToast(null)}
            className="cursor-pointer text-sm text-ink3"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
