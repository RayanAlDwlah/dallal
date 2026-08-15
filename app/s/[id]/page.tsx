import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BidSlot, type ViewerRole } from "@/components/auction/detail/bid-slot";
import { BidHistory } from "@/components/bidding/bid-history";
import { LivePriceRegion } from "@/components/bidding/live-price-region";
import { LiveStatusCountdown } from "@/components/bidding/live-status-countdown";
import { Container } from "@/components/layout/container";
import { Alert } from "@/components/ui/alert";
import { ImageFrame } from "@/components/ui/image-frame";
import { Money } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { getViewer } from "@/lib/auth/identity";
import { readAuctionDetail } from "@/lib/auctions/detail";
import { presentedStatus } from "@/lib/auctions/presentation";
import { readSession, type SessionLot } from "@/lib/sessions/queries";

import { endSessionAction, openNextLotAction } from "./actions";

/**
 * V2 — the session hall (قاعة الجلسة). One lot open at a time; the open lot
 * IS an auction, so the stage below mounts the SAME live components the
 * auction detail page mounts — LiveStatusCountdown, LivePriceRegion, BidSlot,
 * BidHistory — fed by the lot's auction id. No second bidding surface exists.
 *
 * Host controls are drawn for the host only; the RPCs re-verify the host from
 * the server session either way (a bidder crafting the call is refused inside
 * the database — CLAUDE.md §6).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await readSession(id);
  return { title: session ? session.title : "الجلسة" };
}

const SESSION_STATUS_LABEL = {
  scheduled: "لم تبدأ بعد",
  live: "جارية الآن",
  ended: "انتهت",
} as const;

function startLabel(iso: string): string {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function LotStrip({ lots, current }: { lots: SessionLot[]; current: number | null }) {
  return (
    <ol className="flex list-none flex-wrap items-center gap-2 p-0">
      {lots.map((lot) => {
        const state =
          lot.position === current
            ? "current"
            : lot.auctionId !== null
              ? "done"
              : "upcoming";
        return (
          <li
            key={lot.position}
            className={
              state === "current"
                ? "bg-brand text-on-brand border-brand rounded-full border px-3 py-1 text-xs font-bold"
                : state === "done"
                  ? "border-rule text-ink-3 rounded-full border px-3 py-1 text-xs line-through"
                  : "border-rule text-ink-2 rounded-full border px-3 py-1 text-xs"
            }
          >
            <span className="num">{lot.position}</span> · <bdi>{lot.name}</bdi>
          </li>
        );
      })}
    </ol>
  );
}

export default async function SessionHallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, viewer] = await Promise.all([readSession(id), getViewer()]);
  if (!session) notFound();

  const viewerId = viewer?.id ?? null;
  const isHost = viewerId !== null && viewerId === session.hostId;

  /* The stage: the open lot's auction, read through the one detail path. */
  const stage =
    session.currentLot?.auctionId != null
      ? await readAuctionDetail(session.currentLot.auctionId)
      : null;
  const stageAuction = stage?.state === "found" ? stage.auction : null;
  const stageStatus =
    stage?.state === "found" ? presentedStatus(stage.auction, stage.serverNow) : null;

  const role: ViewerRole = !viewerId ? "visitor" : isHost ? "owner" : "bidder";

  const nextPlanned = session.lots.find((l) => l.auctionId === null) ?? null;

  return (
    <Container as="main" className="flex flex-col gap-6 py-6 sm:py-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold sm:text-2xl">
            <bdi>{session.title}</bdi>
          </h1>
          <StatusPill tone={session.status === "live" ? "active" : "ended"}>
            {session.status === "live" ? (
              <span
                aria-hidden="true"
                className="bg-urge size-1.5 rounded-full shadow-[0_0_8px_var(--c-urge)]"
              />
            ) : null}
            {SESSION_STATUS_LABEL[session.status]}
          </StatusPill>
        </div>
        <p className="text-ink-2 text-sm">
          يديرها <bdi>{session.hostName}</bdi>
          {session.city ? <> · {session.city}</> : null}
          {session.status === "scheduled" ? (
            <>
              {" "}
              · تبدأ <span className="num">{startLabel(session.startTime)}</span>
            </>
          ) : null}
        </p>
      </header>

      <LotStrip lots={session.lots} current={session.currentLot?.position ?? null} />

      {/* Host controls — an affordance; the RPC is the gate. */}
      {isHost && session.status !== "ended" ? (
        <div className="flex flex-wrap items-center gap-3">
          <form action={openNextLotAction.bind(null, session.id)}>
            <button
              type="submit"
              className="bg-brand text-on-brand border-brand min-h-tap rounded-md border px-5 font-semibold"
            >
              {session.currentLot
                ? "القطعة الحالية ما زالت مفتوحة"
                : nextPlanned
                  ? `افتح القطعة ${nextPlanned.position}`
                  : "لا قطع متبقية"}
            </button>
          </form>
          <form action={endSessionAction.bind(null, session.id)}>
            <button
              type="submit"
              className="border-rule text-ink-2 min-h-tap rounded-md border px-5 font-semibold"
            >
              أنهِ الجلسة
            </button>
          </form>
          <p className="text-ink-3 text-xs">
            الإنهاء لا يقصّر قطعة مفتوحة — ينفَّذ فقط بين القطع.
          </p>
        </div>
      ) : null}

      {stageAuction && stageStatus ? (
        /* ---- THE STAGE — the open lot, on the same live machinery ---- */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
            <LiveStatusCountdown
              auctionId={stageAuction.id}
              serverStatus={stageStatus}
              endsAt={stageAuction.endsAt}
              serverNow={stage!.state === "found" ? stage!.serverNow : ""}
            />
            <LivePriceRegion
              auctionId={stageAuction.id}
              startingPrice={stageAuction.startingPrice}
              currentPrice={stageAuction.currentPrice}
              bidCount={stageAuction.bidCount}
              status={stageStatus}
            />
            <BidSlot
              auctionId={stageAuction.id}
              role={role}
              status={stageStatus}
              nextOffer={stageAuction.nextOffer}
            />
          </aside>

          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">
                القطعة <span className="num">{session.currentLot!.position}</span> —{" "}
                <bdi>{stageAuction.name}</bdi>
              </h2>
            </div>
            <ImageFrame src={stageAuction.imageUrl} alt={stageAuction.name} ratio="wide" />
            <p className="text-ink-2 whitespace-pre-line text-sm">
              <bdi>{stageAuction.description}</bdi>
            </p>
            <BidHistory auctionId={stageAuction.id} />
          </div>
        </div>
      ) : session.status === "ended" || (!nextPlanned && !session.currentLot) ? (
        <Alert tone="info" title="انتهت الجلسة">
          <p>كل القطع أُغلقت. نتائج كل قطعة على صفحتها.</p>
        </Alert>
      ) : (
        <Alert tone="info" title={session.status === "scheduled" ? "الجلسة لم تبدأ" : "بين القطع"}>
          <p>
            {nextPlanned ? (
              <>
                القطعة القادمة: <bdi>{nextPlanned.name}</bdi> — تبدأ من{" "}
                <Money amount={nextPlanned.startingPrice} size="sm" /> بزيادة{" "}
                <Money amount={nextPlanned.bidIncrement} size="sm" />.
                {isHost ? " افتحها بالزر أعلاه." : " تُفتح عندما يعلن المضيف."}
              </>
            ) : (
              "لا قطع مضافة بعد."
            )}
          </p>
        </Alert>
      )}

      {/* Completed lots link out to their own (ended) auction pages. */}
      {session.lots.some((l) => l.auctionId !== null && l.position !== session.currentLot?.position) ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold">قطع سابقة</h2>
          <ul className="text-ink-2 list-none space-y-1 p-0 text-sm">
            {session.lots
              .filter((l) => l.auctionId !== null && l.position !== session.currentLot?.position)
              .map((l) => (
                <li key={l.position}>
                  <a className="underline" href={`/auctions/${l.auctionId}`}>
                    القطعة <span className="num">{l.position}</span> — <bdi>{l.name}</bdi>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
