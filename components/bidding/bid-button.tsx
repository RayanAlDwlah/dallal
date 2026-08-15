"use client";

import { useState } from "react";

import { Money } from "@/components/ui/money";
import { useLiveAuction } from "@/lib/bidding/use-live-auction";
import { placeBidV2, type PlaceBidV2Outcome } from "@/lib/bidding/place-bid-v2";
import type { Sar } from "@/lib/money";
import {
  isPossiblyStale,
  shouldAnnounceConnectionLoss,
} from "@/lib/realtime/ux-rules";

/**
 * V2 — the ONE-BUTTON bid control, for fixed-increment auctions only.
 * Mounted by BidSlot when the auction carries a bid_increment; V1 auctions
 * keep BidPanel and its amount input, untouched.
 *
 * ## The behaviours
 *
 * 1. THE USER NEVER TYPES AN AMOUNT. The button shows the only amount the
 *    server would accept (`next_offer`, computed in SQL, re-read live) and
 *    pressing it submits exactly that. No amount arithmetic happens here —
 *    current + increment in JS is float arithmetic on money (CLAUDE.md §4.1);
 *    the number is read, never derived.
 *
 * 2. CONSENT IS TO A NUMBER. Submission is two taps: arm ("زايد بـ N"), then
 *    confirm — and the confirmed number is what travels as `expected`. If the
 *    price moved in between, the server rejects as outbid_race and the button
 *    re-arms with the new offer; it never silently escalates.
 *
 * 3. LIVE UPDATES MOVE THE IDLE BUTTON, NEVER THE ARMED ONE. While armed, the
 *    displayed amount is frozen local state — a live tick changing the number
 *    under a finger mid-tap is how someone pays more than they agreed to. The
 *    server's expected-check makes the frozen copy safe.
 *
 * 4. NO OPTIMISM (BR-22): an accepted bid does not paint its own amount as
 *    the price; the live store updates from the authoritative re-read.
 *
 * 5. STALENESS MARKS, NEVER LOCKS (RT-R1/RT-R4): same data-stale contract as
 *    BidPanel — the control stays usable, the server stays the judge.
 */
export interface BidButtonProps {
  auctionId: string;
  /** Server-rendered first offer, until the live snapshot's first read lands. */
  initialNextOffer: Sar;
}

function OutcomeMessage({ outcome }: { outcome: PlaceBidV2Outcome }) {
  if (outcome.kind === "accepted") {
    return (
      <p className="text-brand-text font-semibold">
        قُبلت مزايدتك. السعر والسجل أعلاه يتحدّثان مباشرة.
      </p>
    );
  }

  if (outcome.kind === "no_verdict") {
    return (
      <p className="text-ink-2">
        تعذّر تأكيد النتيجة — ربما لم تصل مزايدتك، وربما وصلت ولم يصلنا الرد.
        راقب السعر والسجل أعلاه: إن ظهرت مزايدتك فقد قُبلت، وإلا فأعد المحاولة.
      </p>
    );
  }

  switch (outcome.reason) {
    case "not_authenticated":
      return (
        <p className="text-ink-2">
          انتهت جلستك أو لم يتم تسجيل الدخول. سجّل الدخول ثم أعد المحاولة.
        </p>
      );
    case "auction_not_found":
      return <p className="text-ink-2">هذا المزاد لم يعد موجودًا.</p>;
    case "auction_ended":
      return (
        <p className="text-ink-2">
          انتهى المزاد قبل وصول مزايدتك، فلم تُقبل. النتيجة النهائية تظهر أعلاه.
        </p>
      );
    case "owner_cannot_bid":
      return <p className="text-ink-2">لا يمكنك المزايدة على مزادك أنت (قاعدة المنصة).</p>;
    case "malformed_amount":
    case "amount_required":
      /* Both unreachable from this UI (the button sends a server-derived
       * amount, and it is mounted only on fixed-increment auctions) — but a
       * verdict that arrives gets a sentence, never a blank. */
      return <p className="text-ink-2">تعذّر قبول المزايدة بهذا الشكل. حدِّث الصفحة وحاول مرة أخرى.</p>;
    case "outbid_race":
      return (
        <p className="text-ink-2">
          سبقك مزايد آخر في اللحظة نفسها — مزايدتك لم تُخصم ولم تُسجَّل. الزر
          أدناه يعرض المبلغ الجديد
          {outcome.nextOffer ? (
            <>
              {" "}
              — <Money amount={outcome.nextOffer} size="sm" />
            </>
          ) : null}
          .
        </p>
      );
  }
}

export function BidButton({ auctionId, initialNextOffer }: BidButtonProps) {
  const { snapshot, connection } = useLiveAuction(auctionId);

  /** Behaviour 2/3 — the armed number is frozen local state. */
  const [armed, setArmed] = useState<Sar | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<PlaceBidV2Outcome | null>(null);

  /* Same gate as BidPanel: the control leaves the screen on the RECORDED
   * status flip; the server remains the judge of eligibility (LC-03). */
  if (snapshot?.auction.status === "ended") return null;

  /* Behaviour 1 — the number is read, never derived: live snapshot first,
   * server render until it lands. */
  const liveOffer = snapshot?.auction.nextOffer ?? initialNextOffer;

  const stale = isPossiblyStale(connection);
  const announceLoss = shouldAnnounceConnectionLoss(connection);

  const confirm = async () => {
    if (pending || armed === null) return;
    setPending(true);
    setOutcome(null);
    const verdict = await placeBidV2(auctionId, armed);
    setPending(false);
    setArmed(null); // every verdict disarms; re-arming is a fresh consent
    setOutcome(verdict);
  };

  return (
    <section aria-labelledby="bid-button-title" data-stale={stale || undefined}>
      <h2 id="bid-button-title" className="text-base font-bold">
        قدّم مزايدتك
      </h2>

      <div className="mt-2 flex flex-col gap-2">
        {armed === null ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setArmed(liveOffer)}
            className="bg-brand text-on-brand border-brand min-h-tap inline-flex w-full items-center justify-center gap-2 rounded-md border px-5 py-2 font-semibold disabled:opacity-60"
          >
            زايد بـ
            <Money amount={liveOffer} size="md" className="text-on-brand" />
          </button>
        ) : (
          /* Armed: the number is frozen; confirm sends exactly it. */
          <div className="border-rule bg-surface flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm">
              تأكيد المزايدة بـ <Money amount={armed} size="sm" />؟ المزايدة
              نهائية ولا تُسحب.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={confirm}
                className="bg-brand text-on-brand border-brand min-h-tap flex-1 rounded-md border px-5 font-semibold disabled:opacity-60"
              >
                {pending ? "يُرسل…" : "تأكيد"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setArmed(null)}
                className="border-rule min-h-tap shrink-0 rounded-md border px-5 font-semibold disabled:opacity-60"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        <p className="text-ink-3 text-sm">
          المبلغ محدد من البائع بزيادة ثابتة — لا يمكن تعديله، والزر يعرض دائمًا
          العرض التالي المقبول.
        </p>

        {announceLoss && (
          <p className="text-ink-3 text-sm">
            التحديث المباشر متوقف مؤقتًا؛ المبلغ المعروض قد لا يكون الأحدث.
            المزايدة نفسها تعمل بشكل طبيعي.
          </p>
        )}

        <div aria-live="polite" className="min-h-5 text-sm">
          {outcome && <OutcomeMessage outcome={outcome} />}
        </div>
      </div>
    </section>
  );
}
