import Image from "next/image";
import Link from "next/link";

import { Money } from "@/components/ui/money";
import { auctionImageUrl } from "@/lib/images";
import { formatDateTimeAr } from "@/lib/time";
import type { LotWithCategory, SessionWithHost } from "@/types/sessions";

import { PresenceCount } from "./presence-count";
import { SessionCountdown } from "./session-countdown";

/**
 * The session card (session-card.html). A session is a KIND OF AUCTION, not a
 * kind of account — the host block says «فرد» or the company's name, and both
 * look the same.
 */
export function SessionCard({
  session,
  lots,
  featured = false,
}: {
  session: SessionWithHost;
  lots: LotWithCategory[];
  featured?: boolean;
}) {
  const live = session.status === "live";
  const done = lots.filter((l) => l.status === "ended").length;
  const current = lots.find((l) => l.id === session.current_lot_id);
  const hostName = session.host?.display_name ?? "مضيف";
  const initials = hostName.trim().slice(0, 2);

  return (
    <Link href={`/sessions/${session.id}`} className="block">
      <article className="hairline group relative overflow-hidden rounded-[20px] bg-surface transition hover:-translate-y-0.5 hover:[box-shadow:inset_0_0_0_1px_rgba(45,212,191,.3),0_0_30px_rgba(45,212,191,.12)]">
        <div
          className={`relative ${featured ? "h-[196px]" : "h-[150px]"}`}
          style={{ background: "linear-gradient(135deg,#1E2431,#10141C)" }}
        >
          {session.cover_image ? (
            <Image
              src={auctionImageUrl(session.cover_image)}
              alt=""
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
              className="object-cover opacity-90"
            />
          ) : null}
          {/* the session cover carries the one permitted gradient wash */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 90% at 30% 10%,rgba(124,58,237,.28),transparent 65%),radial-gradient(60% 80% at 85% 70%,rgba(45,212,191,.2),transparent 65%)",
            }}
          />

          <span className="absolute start-3 top-3 z-[2]">
            {live ? (
              <span className="pill pill-live">
                <span className="dot" />
                مباشر الآن
              </span>
            ) : session.status === "ended" ? (
              <span className="pill pill-done">انتهت</span>
            ) : (
              <span className="pill bg-white/10 text-ink2">
                تبدأ {formatDateTimeAr(session.start_time).split("، ")[1]}
              </span>
            )}
          </span>

          <div className="absolute bottom-3 start-3 z-[2] flex items-center gap-2.5">
            <div className="hairline grid size-[34px] place-items-center rounded-[10px] bg-[#0B0E14] font-display text-[13px] font-bold text-gold">
              {initials}
            </div>
            <div>
              <b className="block text-sm font-semibold leading-tight">{hostName}</b>
              {session.city ? <small className="text-xs text-ink2">{session.city}</small> : null}
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="m-0 mb-2.5 truncate font-display text-[18px] font-semibold">
            {session.title}
          </h3>

          <div className="num flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-ink2">
            <span>{lots.length} قطعة</span>
            {live && current ? (
              <>
                <span>·</span>
                <span>
                  المعروض الآن {current.position} من {lots.length}
                </span>
              </>
            ) : session.status === "scheduled" ? (
              <>
                <span>·</span>
                <SessionCountdown startTime={session.start_time} />
              </>
            ) : session.status === "ended" ? (
              <>
                <span>·</span>
                <span>بِيع منها {done}</span>
              </>
            ) : null}
            <span>·</span>
            <PresenceCount sessionId={session.id} />
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[var(--color-hair)] pt-3.5">
            <div>
              <span className="block text-xs text-ink3">عربون الدخول</span>
              {session.deposit ? (
                <Money
                  amount={session.deposit}
                  className="font-display text-[18px] font-bold text-gold"
                />
              ) : (
                <span className="font-display text-[18px] font-bold text-gold">بدون</span>
              )}
            </div>
            <span
              className={`grid h-[42px] flex-none place-items-center whitespace-nowrap rounded-[12px] px-5 text-sm font-semibold ${
                live ? "bg-gold text-gold-ink" : "hairline bg-transparent text-ink"
              }`}
            >
              {live ? "ادخل القاعة" : session.status === "ended" ? "شوف النتائج" : "احجز مكانك"}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
