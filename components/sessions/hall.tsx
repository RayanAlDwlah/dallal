"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Countdown } from "@/components/auction/countdown";
import { SessionCountdown } from "@/components/sessions/session-countdown";
import { IncrementAmount, Money } from "@/components/ui/money";
import { arError } from "@/lib/errors";
import { auctionImageUrl } from "@/lib/images";
import { usePresenceCount } from "@/lib/sessions/use-presence";
import { addMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime-auth";
import { formatDateTimeAr, relativeTimeAr } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import { BID_COLUMNS, type Bid } from "@/types/db";
import {
  LOT_WITH_CATEGORY,
  SESSION_COLUMNS,
  type LotWithCategory,
  type SessionEntry,
  type SessionWithHost,
} from "@/types/sessions";

const SESSION_ERRORS: Record<string, string> = {
  entry_required: "ادخل القاعة أولاً عشان تزايد",
  paused: "الجلسة موقوفة مؤقتًا",
  session_not_live: "الجلسة ما بدأت بعد",
  not_host: "هذا الإجراء للمضيف فقط",
  lot_still_running: "القطعة لسه شغّالة",
  too_close_to_end: "ما تقدر تقفل القطعة في آخر 15 ثانية — هذي اللحظة اللي وُجد التمديد عشانها",
  host_cannot_join: "أنت المضيف",
};

const err = (code?: string) => (code && SESSION_ERRORS[code]) || arError(code);

interface Props {
  session: SessionWithHost;
  lots: LotWithCategory[];
  initialBids: Bid[];
  entries: SessionEntry[];
  viewerId: string | null;
  isHost: boolean;
  myEntry: SessionEntry | null;
  loginHref: string;
}

export function Hall({
  session: initialSession,
  lots: initialLots,
  initialBids,
  entries: initialEntries,
  viewerId,
  isHost,
  myEntry: initialEntry,
  loginHref,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState(initialSession);
  const [lots, setLots] = useState(initialLots);
  const [bids, setBids] = useState(initialBids);
  const [entries, setEntries] = useState(initialEntries);
  const [myEntry, setMyEntry] = useState(initialEntry);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [extendedFlash, setExtendedFlash] = useState(false);
  const advancing = useRef(false);
  const extRef = useRef(0);

  const current = lots.find((l) => l.id === session.current_lot_id) ?? null;
  const live = session.status === "live";
  const paused = session.paused_at !== null;

  const refetch = useCallback(async () => {
    const [{ data: s }, { data: l }, { data: e }] = await Promise.all([
      supabase.from("sessions").select(SESSION_COLUMNS).eq("id", initialSession.id).maybeSingle(),
      supabase
        .from("session_lots")
        .select(LOT_WITH_CATEGORY)
        .eq("session_id", initialSession.id)
        .order("position", { ascending: true }),
      supabase
        .from("session_entries")
        .select(
          "session_id, user_id, deposit_paid, approved, created_at, user:profiles!session_entries_user_id_fkey(id, display_name, avatar_url)",
        )
        .eq("session_id", initialSession.id),
    ]);
    if (s) setSession((prev) => ({ ...prev, ...(s as unknown as SessionWithHost) }));
    if (l) {
      const list = l as unknown as LotWithCategory[];
      setLots(list);
      const open = list.find((x) => x.status === "live");
      if (open && open.extension_count > extRef.current) {
        extRef.current = open.extension_count;
        setExtendedFlash(true);
        setTimeout(() => setExtendedFlash(false), 5000);
      }
    }
    if (e) {
      const list = e as unknown as SessionEntry[];
      setEntries(list);
      if (viewerId) setMyEntry(list.find((x) => x.user_id === viewerId) ?? null);
    }
  }, [supabase, initialSession.id, viewerId]);

  const refetchBids = useCallback(
    async (lotId: string) => {
      const { data } = await supabase
        .from("bids")
        .select(BID_COLUMNS)
        .eq("lot_id", lotId)
        .order("id", { ascending: false })
        .limit(20);
      if (data) setBids(data as unknown as Bid[]);
    },
    [supabase],
  );

  useEffect(() => {
    void authorizeRealtime(supabase);
    const channel = supabase
      .channel(`session:${initialSession.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${initialSession.id}` },
        () => void refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_lots",
          filter: `session_id=eq.${initialSession.id}`,
        },
        () => void refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_entries",
          filter: `session_id=eq.${initialSession.id}`,
        },
        () => void refetch(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids" }, (payload) => {
        const row = payload.new as { lot_id: string | null };
        if (row.lot_id) void refetchBids(row.lot_id);
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, initialSession.id, refetch, refetchBids]);

  /* When the room moves to the next lot, load that lot's log. The previous
     lot's bids are hidden by deriving from the open lot rather than clearing
     state, and the fetch is cancellable so a fast advance cannot land an old
     lot's rows on top of the new one. */
  useEffect(() => {
    const lotId = session.current_lot_id;
    if (!lotId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("bids")
        .select(BID_COLUMNS)
        .eq("lot_id", lotId)
        .order("id", { ascending: false })
        .limit(20);
      if (!cancelled && data) setBids(data as unknown as Bid[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, session.current_lot_id]);

  /* The room must not stall because nobody's tab is open: any viewer whose
     clock says the lot is over asks the server to advance. The server refuses
     unless it agrees, so a wrong client clock changes nothing. */
  const askAdvance = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    void supabase
      .rpc("advance_session", { p_session_id: initialSession.id })
      .then(() => refetch())
      .then(() => {
        advancing.current = false;
      });
  }, [supabase, initialSession.id, refetch]);

  async function call(fn: string, args: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(fn, args);
      if (rpcError) setError(arError("network"));
      else {
        const res = data as { ok?: boolean; error?: string };
        if (res && res.ok === false) setError(err(res.error));
      }
    } catch {
      setError(arError("network"));
    } finally {
      setBusy(null);
      await refetch();
      if (session.current_lot_id) await refetchBids(session.current_lot_id);
    }
  }

  const canBid = Boolean(viewerId) && !isHost && myEntry?.approved === true;
  const nextAmount = current
    ? current.current_price
      ? addMoney(current.current_price, current.bid_increment)
      : current.starting_price
    : "0.00";
  /* The log belongs to the OPEN lot; between lots there is nothing to show. */
  const shownBids = session.current_lot_id ? bids : [];
  /* «حاضر» is who is in the room right now — this page tracks presence, which
     is what makes the viewer one of them. «مزايد» stays a count of real bids. */
  const attendees = usePresenceCount(supabase, initialSession.id, true);
  const bidderCount = new Set(shownBids.map((b) => b.bidder_id)).size;
  const pending = entries.filter((e) => !e.approved);
  const isLeading = viewerId !== null && shownBids[0]?.bidder_id === viewerId;

  /* The host's early-close button is refused in the final 15 seconds; mirror
     that in the UI so the button is never offered and then rejected. Derived
     from the shared clock rather than synced into state. */
  const now = useNow();
  const remainingMs = current?.end_time ? new Date(current.end_time).getTime() - now : 0;
  const closeBlocked = now > 0 && remainingMs > 0 && remainingMs <= 15_000;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_292px] lg:items-start">
      <div className="min-w-0">
        {/* ---- the stage ---- */}
        <div
          className={`rounded-[22px] bg-surface p-5 sm:p-6 ${
            live
              ? "[box-shadow:inset_0_0_0_1px_rgba(45,212,191,.22),0_0_34px_rgba(45,212,191,.09)]"
              : "hairline"
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            {live ? (
              paused ? (
                <span className="pill bg-white/10 text-ink2">موقوفة مؤقتًا</span>
              ) : (
                <span className="pill pill-live">
                  <span className="dot" />
                  مباشر
                </span>
              )
            ) : session.status === "ended" ? (
              <span className="pill pill-done">انتهت الجلسة</span>
            ) : (
              <span className="pill bg-white/10 text-ink2">
                تبدأ {formatDateTimeAr(session.start_time)}
              </span>
            )}
            {current ? (
              <span className="num text-[13px] text-ink2">
                القطعة {current.position} من {lots.length}
              </span>
            ) : null}
            <span className="num ms-auto text-[13px] text-ink2" suppressHydrationWarning>
              {attendees === null ? "—" : attendees} حاضر · {bidderCount} مزايد
            </span>
          </div>

          {current ? (
            <>
              <div className="flex items-start gap-4">
                <span
                  className="hairline relative size-[104px] flex-none overflow-hidden rounded-[15px] sm:size-[148px]"
                  style={{ background: "linear-gradient(140deg,#232B39,#141922)" }}
                >
                  {current.images[0] ? (
                    <Image
                      src={auctionImageUrl(current.images[0])}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 148px, 104px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="num text-[12.5px] text-ink3">القطعة رقم {current.position}</div>
                  <h2 className="m-0 mb-2.5 font-display text-[20px] font-semibold">
                    {current.title}
                  </h2>
                  <div className="font-display text-[30px] font-bold leading-tight text-gold sm:text-[34px]">
                    <Money amount={current.current_price ?? current.starting_price} />
                  </div>
                  {paused ? (
                    <div className="mt-0.5 font-display text-[20px] font-semibold text-ink3">
                      الوقت موقوف
                    </div>
                  ) : current.end_time ? (
                    <Countdown
                      endTime={current.end_time}
                      onEnd={askAdvance}
                      className="mt-0.5 text-[20px]"
                    />
                  ) : (
                    <div className="mt-0.5 flex items-center gap-2 text-[14px] font-semibold text-teal">
                      <span className="dot inline-block size-[7px] rounded-full bg-teal [box-shadow:0_0_8px_var(--color-teal)]" />
                      مفتوحة — تستمر لين يقفلها المضيف
                    </div>
                  )}
                  {extendedFlash ? (
                    <p className="num m-0 mt-1 text-[13px] font-semibold text-teal">
                      مُدِّد 30 ثانية — مزايدة في آخر 15 ثانية
                    </p>
                  ) : null}
                  {isLeading ? (
                    <p className="m-0 mt-1 text-[13px] font-semibold text-green">أنت الأعلى الآن</p>
                  ) : null}
                </div>
              </div>

              {/* ---- host controls / bidder actions ---- */}
              {isHost ? (
                <div className="mt-4 flex flex-wrap gap-2.5 border-t border-[var(--color-hair)] pt-4">
                  <button
                    onClick={() => call("host_next_lot", { p_session_id: session.id }, "next")}
                    disabled={busy !== null || closeBlocked || paused}
                    className="btn-gold h-11 px-5 text-sm"
                    title={closeBlocked ? "معطّل في آخر 15 ثانية" : undefined}
                  >
                    {busy === "next"
                      ? "…"
                      : lots.some((l) => l.status === "waiting")
                        ? `أغلق وافتح القطعة ${current.position + 1}`
                        : "أغلق القطعة الأخيرة"}
                  </button>
                  <button
                    onClick={() =>
                      call(paused ? "resume_session" : "pause_session", { p_session_id: session.id }, "pause")
                    }
                    disabled={busy !== null}
                    className="btn-ghost h-11 px-5 text-sm"
                  >
                    {busy === "pause" ? "…" : paused ? "استأنف" : "أوقف مؤقتًا"}
                  </button>
                  <button
                    onClick={() => call("end_session", { p_session_id: session.id }, "end")}
                    disabled={busy !== null}
                    className="ms-auto h-11 rounded-[12px] bg-transparent px-5 text-sm font-semibold text-[#FF8A95] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.28)]"
                  >
                    {busy === "end" ? "…" : "أنهِ الجلسة"}
                  </button>
                  {closeBlocked ? (
                    <p className="m-0 basis-full text-[12.5px] text-ink3">
                      الإغلاق معطّل في آخر 15 ثانية — مضيف يقفل قطعة وأحدهم زايد عليها قبل نصف
                      ثانية هو بالضبط الشيء اللي التمديد موجود عشانه.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 border-t border-[var(--color-hair)] pt-4">
                  {!viewerId ? (
                    <Link
                      href={loginHref}
                      className="hairline flex h-14 w-full items-center justify-center rounded-[12px] bg-raised font-display text-[17px] font-semibold text-ink3"
                    >
                      سجّل الدخول للمزايدة
                    </Link>
                  ) : !myEntry ? (
                    <button onClick={() => setJoinOpen(true)} className="btn-gold h-14 w-full text-[16px]">
                      ادخل القاعة
                      {session.deposit ? (
                        <>
                          {" · "}
                          <Money amount={session.deposit} />
                        </>
                      ) : null}
                    </button>
                  ) : !myEntry.approved ? (
                    <div className="hairline rounded-[12px] bg-raised px-4 py-3.5 text-center text-sm text-ink2">
                      طلبك وصل المضيف — تقدر تتفرّج، والمزايدة تنفتح لك أول ما يوافق.
                    </div>
                  ) : paused ? (
                    <button disabled className="btn-gold h-14 w-full text-[16px]">
                      الجلسة موقوفة مؤقتًا
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setError(null);
                          setConfirmOpen(true);
                        }}
                        disabled={busy !== null || !canBid}
                        className="btn-gold h-14 w-full px-7 font-display text-[19px]"
                      >
                        {busy === "bid" ? (
                          "جارٍ الإرسال…"
                        ) : (
                          <>
                            <span className="text-[15px] font-medium opacity-70">زايد بـ</span>
                            <IncrementAmount amount={current.bid_increment} />
                          </>
                        )}
                      </button>
                      <p className="m-0 mt-2.5 text-[13px] text-ink3">
                        تصير مزايدتك <Money amount={nextAmount} />
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="relative -m-5 overflow-hidden rounded-[22px] sm:-m-6">
              {session.cover_image ? (
                <Image
                  src={auctionImageUrl(session.cover_image)}
                  alt=""
                  fill
                  sizes="100vw"
                  className="scale-105 object-cover opacity-30 blur-[2px]"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(70% 90% at 30% 10%,rgba(124,58,237,.22),transparent 65%),radial-gradient(60% 80% at 85% 70%,rgba(45,212,191,.15),transparent 65%)",
                  }}
                />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,13,.25),rgba(7,9,13,.82))]" />
              <div className="relative px-6 py-12 text-center sm:py-14">
                <p className="m-0 font-display text-[22px] font-semibold">
                  {session.status === "ended" ? "انتهت الجلسة" : "الجلسة ما بدأت بعد"}
                </p>
                {session.status === "ended" ? (
                  <p className="m-0 mt-1.5 text-sm text-ink2">شوف نتائج القطع في القائمة.</p>
                ) : (
                  <>
                    <div className="num mt-3 font-display text-[34px] font-bold text-gold">
                      <SessionCountdown startTime={session.start_time} />
                    </div>
                    <p className="m-0 mt-1.5 text-sm text-ink2">
                      {formatDateTimeAr(session.start_time)} — القطع تُفتح بالترتيب
                    </p>
                  </>
                )}
                {session.status === "scheduled" && viewerId && !isHost && !myEntry ? (
                  <button
                    onClick={() => setJoinOpen(true)}
                    className="btn-gold mt-5 h-12 px-8 text-[15px]"
                  >
                    احجز مكانك
                    {session.deposit ? (
                      <>
                        {" · "}
                        <Money amount={session.deposit} />
                      </>
                    ) : null}
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {error ? (
            <p className="mt-3 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
              {error}
            </p>
          ) : null}
        </div>

        {/* ---- bid log for the open lot ---- */}
        {current ? (
          <div className="hairline mt-4 rounded-[20px] bg-surface p-5">
            <div className="mb-1.5 text-[13px] text-ink3">
              سجل المزايدات{" "}
              {shownBids.length > 0 ? <span className="num">· {shownBids.length}</span> : null}
            </div>
            {shownBids.length === 0 ? (
              <p className="m-0 py-2 text-sm text-ink2">
                ما فيه مزايدات على هذي القطعة — أول مزايدة بسعر البداية مقبولة.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {shownBids.map((b, i) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 border-b border-[var(--color-hair)] py-2.5 text-sm last:border-0"
                  >
                    <span
                      className="hairline grid size-[30px] flex-none place-items-center rounded-full text-[12px] text-ink2"
                      style={{ background: "linear-gradient(140deg,#2A3140,#171C26)" }}
                    >
                      {b.bidder?.display_name?.trim().charAt(0) ?? "؟"}
                    </span>
                    <span className="truncate">{b.bidder?.display_name ?? "مزايد"}</span>
                    <Money
                      amount={b.amount}
                      className={`num ms-auto font-display font-semibold ${i === 0 ? "text-gold" : ""}`}
                    />
                    <span className="num min-w-[52px] text-end text-[12px] text-ink3">
                      {relativeTimeAr(b.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* ---- host: pending invite requests ---- */}
        {isHost && pending.length > 0 ? (
          <div className="hairline mt-4 rounded-[20px] bg-surface p-5">
            <div className="mb-2 text-[13px] text-ink3">طلبات الدخول</div>
            <ul className="m-0 list-none p-0">
              {pending.map((e) => (
                <li
                  key={e.user_id}
                  className="flex items-center gap-3 border-b border-[var(--color-hair)] py-2.5 text-sm last:border-0"
                >
                  <span className="truncate">{e.user?.display_name ?? "مستخدم"}</span>
                  <button
                    onClick={() =>
                      call(
                        "approve_entry",
                        { p_session_id: session.id, p_user_id: e.user_id },
                        `approve-${e.user_id}`,
                      )
                    }
                    disabled={busy !== null}
                    className="btn-gold ms-auto h-9 px-4 text-[13px]"
                  >
                    وافق
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* ---- the queue — one card per lot ---- */}
      <aside className="lg:sticky lg:top-24">
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <span className="text-[12.5px] text-ink3">القطع</span>
          <span className="num text-[12px] text-ink3">
            {lots.filter((l) => l.status === "ended").length}/{lots.length}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {lots.map((lot) => {
            const isCurrent = lot.id === session.current_lot_id;
            const done = lot.status === "ended";
            return (
              <div
                key={lot.id}
                className={`flex items-center gap-3 rounded-[16px] bg-surface p-2.5 ${
                  isCurrent
                    ? "[box-shadow:inset_0_0_0_1px_rgba(245,185,66,.4),0_0_18px_rgba(245,185,66,.08)]"
                    : "hairline"
                } ${done ? "opacity-70" : ""}`}
              >
                <span
                  className="hairline relative size-[52px] flex-none overflow-hidden rounded-[11px]"
                  style={{ background: "linear-gradient(140deg,#232B39,#141922)" }}
                >
                  {lot.images[0] ? (
                    <Image
                      src={auctionImageUrl(lot.images[0])}
                      alt=""
                      fill
                      sizes="52px"
                      className="object-cover"
                    />
                  ) : null}
                  <span className="num absolute bottom-0.5 start-0.5 rounded-[5px] bg-black/60 px-1 text-[10px] text-ink2">
                    {lot.position}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <b
                    className={`block truncate text-[13.5px] ${
                      isCurrent ? "font-semibold" : done ? "font-medium text-ink2" : "font-medium"
                    }`}
                  >
                    {lot.title}
                  </b>
                  <span className="num block text-[12px] text-ink3">
                    {done ? (
                      lot.current_price ? (
                        <>
                          بيعت بـ{" "}
                          <Money amount={lot.current_price} className="font-semibold text-green" />
                        </>
                      ) : (
                        "بدون مزايدات"
                      )
                    ) : isCurrent ? (
                      <span className="font-semibold text-gold">مفتوحة الآن</span>
                    ) : (
                      <>
                        تبدأ من <Money amount={lot.starting_price} />
                        {lot.duration_seconds == null
                          ? " · بدون مدة"
                          : ` · ${Math.round(lot.duration_seconds / 60)} د`}
                      </>
                    )}
                  </span>
                </span>
                {isCurrent ? (
                  <span className="pill pill-live h-6 flex-none text-[11px]">
                    <span className="dot" />
                    الآن
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ---- enter the hall ---- */}
      {joinOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(4,6,10,.72)] p-5"
          onClick={() => setJoinOpen(false)}
        >
          <div
            className="hairline w-full max-w-[400px] rounded-[28px] bg-raised p-7 shadow-[0_24px_64px_rgba(0,0,0,.6)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="m-0 mb-1.5 font-display text-[20px] font-semibold">
              {session.entry_mode === "invite" ? "اطلب دعوة" : "ادخل القاعة"}
            </h3>
            <p className="m-0 mb-5 text-sm text-ink2">{session.title}</p>
            {session.deposit ? (
              <>
                <div className="font-display text-[34px] font-bold leading-tight text-gold">
                  <Money amount={session.deposit} />
                </div>
                <div className="mt-0.5 text-[13px] text-ink3">
                  عربون دخول — يخوّلك المزايدة على كل القطع
                </div>
              </>
            ) : (
              <div className="text-[15px] text-ink2">ما فيه عربون على هذي الجلسة.</div>
            )}
            <div className="mt-4 rounded-[13px] bg-[rgba(124,58,237,.1)] px-4 py-3 text-[13px] text-[#CDB6FF] [box-shadow:inset_0_0_0_1px_rgba(124,58,237,.26)]">
              العربون <b>محاكاة</b> — ما فيه دفع حقيقي ولا حقل بطاقة. الضغط يسجّل دخولك للقاعة فقط.
            </div>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={async () => {
                  await call("join_session", { p_session_id: session.id }, "join");
                  setJoinOpen(false);
                }}
                disabled={busy !== null}
                className="btn-gold h-12 flex-1 text-[15px]"
              >
                {busy === "join" ? "…" : session.entry_mode === "invite" ? "أرسل الطلب" : "أوافق وادخل"}
              </button>
              <button onClick={() => setJoinOpen(false)} className="btn-ghost h-12 flex-1 text-[15px]">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- confirm bid ---- */}
      {confirmOpen && current ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(4,6,10,.72)] p-5"
          onClick={() => (busy ? null : setConfirmOpen(false))}
        >
          <div
            className="hairline w-full max-w-[400px] rounded-[28px] bg-raised p-7 shadow-[0_24px_64px_rgba(0,0,0,.6)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="m-0 mb-1.5 font-display text-[20px] font-semibold">تأكيد المزايدة</h3>
            <p className="m-0 mb-5 truncate text-sm text-ink2">{current.title}</p>
            <div className="font-display text-[38px] font-bold leading-tight text-gold">
              <Money amount={nextAmount} />
            </div>
            <div className="num mt-0.5 text-[13px] text-ink3">
              {current.current_price ? (
                <>
                  من <Money amount={current.current_price} /> · زيادة{" "}
                  <IncrementAmount amount={current.bid_increment} />
                </>
              ) : (
                "أول مزايدة — بسعر البداية"
              )}
            </div>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={async () => {
                  await call("place_lot_bid", { p_lot_id: current.id, p_amount: nextAmount }, "bid");
                  setConfirmOpen(false);
                }}
                disabled={busy !== null}
                className="btn-gold h-12 flex-1 text-[15px]"
              >
                {busy === "bid" ? "جارٍ الإرسال…" : "تأكيد"}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={busy !== null}
                className="btn-ghost h-12 flex-1 text-[15px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
