"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Countdown } from "@/components/auction/countdown";
import { IncrementAmount, Money } from "@/components/ui/money";
import { arError } from "@/lib/errors";
import { addMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { authorizeRealtime } from "@/lib/supabase/realtime-auth";
import { relativeTimeAr } from "@/lib/time";
import { AUCTION_COLUMNS, BID_COLUMNS, type Auction, type Bid, type PlaceBidResult } from "@/types/db";

interface Props {
  auction: Auction;
  initialBids: Bid[];
  viewerId: string | null;
  isOwner: boolean;
  initialBidderCount: number;
  winnerName: string | null;
  loginHref: string;
}

/**
 * The live bidding panel. Realtime events are used as SIGNALS only — on any
 * change we refetch through PostgREST with ::text casts, so no money value
 * ever passes through a JSON float.
 */
export function LiveAuction({
  auction: initial,
  initialBids,
  viewerId,
  isOwner,
  initialBidderCount,
  winnerName,
  loginHref,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [auction, setAuction] = useState<Auction>(initial);
  const [bids, setBids] = useState<Bid[]>(initialBids);
  const [bidderCount, setBidderCount] = useState(initialBidderCount);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extendedFlash, setExtendedFlash] = useState(false);
  const finalizeRequested = useRef(false);
  const extCountRef = useRef(initial.extension_count);

  const refetchAuction = useCallback(async () => {
    const { data } = await supabase
      .from("auctions")
      .select(AUCTION_COLUMNS)
      .eq("id", initial.id)
      .maybeSingle();
    if (data) {
      const next = data as unknown as Auction;
      if (next.extension_count > extCountRef.current) {
        extCountRef.current = next.extension_count;
        setExtendedFlash(true);
        setTimeout(() => setExtendedFlash(false), 5000);
      }
      setAuction(next);
    }
  }, [supabase, initial.id]);

  const refetchBids = useCallback(async () => {
    const { data } = await supabase
      .from("bids")
      .select(BID_COLUMNS)
      .eq("auction_id", initial.id)
      .order("id", { ascending: false })
      .limit(20);
    if (data) {
      const list = data as unknown as Bid[];
      setBids(list);
    }
    if (isOwner) {
      const { data: ids } = await supabase
        .from("bids")
        .select("bidder_id")
        .eq("auction_id", initial.id);
      if (ids) setBidderCount(new Set(ids.map((r) => r.bidder_id as string)).size);
    }
  }, [supabase, initial.id, isOwner]);

  /* realtime: auction row updates + new bids, for every open browser.
     auctions/bids are publicly readable, so this stream works even for a
     signed-out viewer; authorizing the socket keeps it correct if those
     policies ever tighten. */
  useEffect(() => {
    void authorizeRealtime(supabase);

    const channel = supabase
      .channel(`auction:${initial.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${initial.id}` },
        () => {
          void refetchAuction();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${initial.id}` },
        () => {
          void refetchBids();
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refetchAuction();
        void refetchBids();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, refetchAuction, refetchBids]);

  /* countdown reached zero while still «active» → ask the server to settle */
  const onCountdownEnd = useCallback(() => {
    if (finalizeRequested.current) return;
    finalizeRequested.current = true;
    void supabase
      .rpc("finalize_auction", { p_auction_id: initial.id })
      .then(() => refetchAuction());
  }, [supabase, initial.id, refetchAuction]);

  const ended = auction.status === "ended";
  const hasBids = auction.bid_count > 0;
  const nextAmount = auction.current_price
    ? addMoney(auction.current_price, auction.bid_increment)
    : auction.starting_price;
  const isLeading = viewerId !== null && bids[0]?.bidder_id === viewerId;
  const isWinner = ended && viewerId !== null && auction.winner_id === viewerId;

  /* The seller who is WATCHING their auction end sees the winner's name, same
     as one who reloads afterwards. The server-rendered `winnerName` is null on
     a page that loaded while the auction was still live, so fall back to the
     bid history — the winning bidder is by definition the top row of it, and
     it is already refetched on every bid. Without this, the owner's live view
     silently degrades to the visitor's wording at the moment that matters. */
  const winnerDisplayName =
    winnerName ??
    (auction.winner_id
      ? (bids.find((b) => b.bidder_id === auction.winner_id)?.bidder?.display_name ?? null)
      : null);

  async function submitBid() {
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("place_bid", {
        p_auction_id: initial.id,
        p_amount: nextAmount,
      });
      if (rpcError) {
        setError(arError("network"));
      } else {
        const result = data as PlaceBidResult;
        if (!result.ok) {
          setError(arError(result.error));
        }
      }
    } catch {
      setError(arError("network"));
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
      void refetchAuction();
      void refetchBids();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isOwner && !ended ? (
        <div className="flex items-center gap-3 rounded-[14px] bg-[rgba(245,185,66,.09)] px-4 py-3 [box-shadow:inset_0_0_0_1px_rgba(245,185,66,.22)]">
          <b className="text-sm text-gold">مزادك</b>
          <span className="text-[13px] text-ink2">ما يمكن تعديله ولا إلغاؤه — يستمر لين وقت انتهائه.</span>
        </div>
      ) : null}

      {/* owner stats (create-auction.html «بعد النشر») */}
      {isOwner ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
          <div className="hairline rounded-[14px] bg-raised p-3.5">
            <div className="num font-display text-[20px] font-bold leading-snug text-gold">
              {hasBids && auction.current_price ? (
                <Money amount={auction.current_price} />
              ) : (
                "—"
              )}
            </div>
            <div className="text-[12px] text-ink3">السعر الحالي</div>
          </div>
          <div className="hairline rounded-[14px] bg-raised p-3.5">
            <div className="num font-display text-[23px] font-bold leading-snug">{auction.bid_count}</div>
            <div className="text-[12px] text-ink3">مزايدة</div>
          </div>
          <div className="hairline rounded-[14px] bg-raised p-3.5">
            <div className="num font-display text-[23px] font-bold leading-snug">{bidderCount}</div>
            <div className="text-[12px] text-ink3">مزايدين</div>
          </div>
          <div className="hairline rounded-[14px] bg-raised p-3.5">
            <div className="num font-display text-[20px] font-bold leading-snug text-teal">
              {ended ? "انتهى" : <Countdown endTime={auction.end_time} onEnd={onCountdownEnd} />}
            </div>
            <div className="text-[12px] text-ink3">باقي على الانتهاء</div>
          </div>
        </div>
      ) : null}

      {/* the price + bid panel */}
      <div className="hairline rounded-[20px] bg-surface p-5">
        {ended ? (
          hasBids ? (
            <div className="rounded-[16px] bg-[rgba(52,211,153,.09)] px-5 py-4 [box-shadow:inset_0_0_0_1px_rgba(52,211,153,.24)]">
              <span className="text-[13px] text-ink2">انتهى المزاد</span>
              <div className="num font-display text-[28px] font-bold leading-snug text-green">
                {auction.current_price ? <Money amount={auction.current_price} /> : null}
              </div>
              <div className="mt-1 text-sm">
                {isWinner ? (
                  <b className="text-green">فزت بهذا المزاد 🎉</b>
                ) : isOwner && winnerDisplayName ? (
                  <>
                    بِيع لـ <b>{winnerDisplayName}</b> ·{" "}
                    <span className="num">{auction.bid_count}</span> مزايدة
                    {auction.extension_count > 0 ? (
                      <>
                        {" "}
                        · مُدِّد الوقت <span className="num">{auction.extension_count}</span> مرات
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    بِيع بهذا المبلغ · <span className="num">{auction.bid_count}</span> مزايدة
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] bg-white/5 px-5 py-4">
              <b className="text-[15px] text-ink2">انتهى المزاد بدون مزايدات</b>
            </div>
          )
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="pill pill-live">
                <span className="dot" />
                مباشر
              </span>
              <Countdown
                endTime={auction.end_time}
                onEnd={onCountdownEnd}
                className="text-[26px]"
              />
            </div>

            {extendedFlash ? (
              <p className="num m-0 mb-1 text-end text-[13px] font-semibold text-teal">
                مُدِّد 30 ثانية — مزايدة في آخر 15 ثانية
              </p>
            ) : null}

            <div className="mt-3">
              <span className="block text-[13px] text-ink3">
                {hasBids ? "السعر الحالي" : "يبدأ من"}
              </span>
              <Money
                amount={auction.current_price ?? auction.starting_price}
                className="font-display text-[34px] font-bold leading-tight text-gold"
              />
            </div>

            {isLeading ? (
              <p className="m-0 mt-1 text-[13px] font-semibold text-green">أنت الأعلى الآن</p>
            ) : null}

            {!isOwner ? (
              <div className="mt-4">
                {viewerId ? (
                  <button
                    onClick={() => {
                      setError(null);
                      setConfirmOpen(true);
                    }}
                    disabled={submitting}
                    className="btn-gold h-14 w-full px-7 font-display text-[19px]"
                  >
                    {submitting ? (
                      "جارٍ الإرسال…"
                    ) : (
                      <>
                        <span className="text-[15px] font-medium opacity-70">زايد بـ</span>
                        <IncrementAmount amount={auction.bid_increment} />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="hairline flex h-14 w-full items-center justify-center rounded-[12px] bg-raised font-display text-[17px] font-semibold text-ink3"
                  >
                    سجّل الدخول للمزايدة
                  </Link>
                )}
                <p className="m-0 mt-2.5 text-[13px] text-ink3">
                  تصير مزايدتك <Money amount={nextAmount} />
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-[13px] bg-[rgba(255,77,94,.08)] px-4 py-3 text-[13.5px] text-[#FFB3BB] [box-shadow:inset_0_0_0_1px_rgba(255,77,94,.24)]">
                {error}
              </p>
            ) : null}

            <p className="m-0 mt-3 text-[12.5px] text-ink3">
              أي مزايدة <b className="text-teal">تُقبل</b> في آخر 15 ثانية تمدّد الوقت 30 ثانية،
              حتى 20 مرة.
            </p>
          </>
        )}
      </div>

      {/* bid history */}
      <div className="hairline rounded-[20px] bg-surface p-5">
        <div className="mb-1.5 text-[13px] text-ink3">
          سجل المزايدات{hasBids ? <span className="num"> · {auction.bid_count}</span> : null}
        </div>
        {bids.length === 0 ? (
          <p className="m-0 py-2 text-sm text-ink2">ما فيه مزايدات بعد — أول مزايدة بسعر البداية مقبولة.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {bids.map((b, i) => (
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
                <span className="num ms-auto font-display font-semibold">
                  <Money amount={b.amount} className={i === 0 ? "text-gold" : ""} />
                </span>
                <span className="num min-w-[52px] text-end text-[12px] text-ink3">
                  {relativeTimeAr(b.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* confirmation dialog (bid-button.html) */}
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(4,6,10,.72)] p-5"
          onClick={() => (submitting ? null : setConfirmOpen(false))}
        >
          <div
            className="hairline w-full max-w-[400px] rounded-[28px] bg-raised p-7 shadow-[0_24px_64px_rgba(0,0,0,.6)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="تأكيد المزايدة"
          >
            <h3 className="m-0 mb-1.5 font-display text-[20px] font-semibold">تأكيد المزايدة</h3>
            <p className="m-0 mb-5 truncate text-sm text-ink2">{auction.title}</p>
            <div className="font-display text-[38px] font-bold leading-tight text-gold">
              <Money amount={nextAmount} />
            </div>
            <div className="num mt-0.5 text-[13px] text-ink3">
              {auction.current_price ? (
                <>
                  من <Money amount={auction.current_price} /> · زيادة{" "}
                  <IncrementAmount amount={auction.bid_increment} />
                </>
              ) : (
                "أول مزايدة — بسعر البداية"
              )}
            </div>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={submitBid}
                disabled={submitting}
                className="btn-gold h-12 flex-1 text-[15px]"
              >
                {submitting ? "جارٍ الإرسال…" : "تأكيد"}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
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
