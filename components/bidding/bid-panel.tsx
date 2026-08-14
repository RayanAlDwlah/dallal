"use client";

import { useState, type FormEvent } from "react";

import { useLiveAuction } from "@/lib/bidding/use-live-auction";
import { placeBid, type PlaceBidOutcome } from "@/lib/bidding/place-bid";
import {
  formatSar,
  meetsMinimum,
  minimumAcceptableBid,
  minimumBidHint,
  SAR_SUFFIX,
  trySar,
  type Sar,
} from "@/lib/money";
import {
  isPossiblyStale,
  isTypedAmountSuperseded,
  shouldAnnounceConnectionLoss,
} from "@/lib/realtime/ux-rules";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RAYAN'S FILE — `@RayanAlDwlah`. Created empty by S0-13 (#22); behaviour
 * filled by BID-03, BID-04 and BID-06 on the BID-09 store. Mohammed owns the
 * presentation half (TEAM.md §11, ARCHITECTURE §14.6): every class and layout
 * choice is his to restyle without asking, provided the behaviours below are
 * unchanged.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `auctionId` is the ONLY prop S0-13 fixes. Everything else this panel needs
 * it takes from the shared live store (`useLiveAuction`) — which is a read of
 * an existing subscription, not a subscription of its own: one per-auction
 * channel is owned upstream by BID-08/BID-09, and a second would be a
 * competing update mechanism (CLAUDE.md §10.4 hazard).
 *
 * ## The behaviours, named so a restyle cannot silently drop one
 *
 * 1. NO CLIENT GATE (BID-03, BR-08). The typed string goes to the server as
 *    typed; `place_bid` decides. The minimum shown here is a HINT from the
 *    live snapshot — it never blocks submission, because a client blocking on
 *    its own copy of the price is a second validator that can disagree with
 *    the real one. The only thing that disables the button is a submission
 *    already in flight (double-submit protection — same bid twice is two
 *    server verdicts, one of them a guaranteed rejection the user never
 *    wanted).
 *
 * 2. THE ABSENT CHECKS ARE REQUIRED ABSENT (CLAUDE.md §5): no minimum-raise,
 *    no maximum, no reserve, no leading-bidder rejection, no length cap on
 *    the input (an amount may be arbitrarily large — BR-21), and no rounding
 *    (more than two decimals is the server's reason 5, REJECTED not rounded).
 *
 * 3. EVERY §13.5 REASON HAS ITS OWN SENTENCE (BID-04), and `outbid_race` is
 *    DISTINCT from `not_above_current` (EC-01, SC-18): losing a race is not
 *    bidding badly, and the message says so. Amounts inside messages render
 *    through the one formatter, digits inside `<bdi>`, `SAR` outside
 *    (CLAUDE.md §3/§4).
 *
 * 4. LIVE UPDATES NEVER TOUCH THE INPUT (SC-22 — BID-10's rule, honoured
 *    early): the typed amount is local state that no snapshot change writes
 *    to. It is cleared exactly once — on this user's own accepted bid. Focus
 *    is never moved programmatically.
 *
 * 5. NO OPTIMISM (BR-22, ADR-9). An accepted bid does not paint its own
 *    amount as the new price; the price region updates from the authoritative
 *    re-read the broadcast triggers — measured end-to-end at p50 ≈ 0.6 s
 *    (BID-09 doc §3), fast enough that optimism would buy one blink and cost
 *    a client-side source of truth.
 *
 * 6. TRANSPORT FAILURE IS AMBIGUOUS AND THE MESSAGE SAYS SO. A request that
 *    dies on the way back may still have committed; claiming "nothing
 *    happened" would be inventing a fact. The user is pointed at the live
 *    price/history — which is the authority and updates on its own (EC-09).
 *
 * 7. STALENESS MARKS, IT NEVER LOCKS (BID-10 #71, FR-RT-13/RT-R4/RT-R7). The
 *    form carries `data-stale` whenever cues are not arriving — including
 *    "connecting", when none can have arrived yet — while the SENTENCE about
 *    it waits for established loss ("unavailable"), so a normal page load does
 *    not announce a fault it does not have. The submit button is never
 *    disabled by connection state: a transport fault deciding a bidding
 *    outcome is exactly what RT-R1 forbids. The rules themselves, with their
 *    requirement citations and the two questions the PRD does not answer, are
 *    in lib/realtime/ux-rules.ts — read that file before changing any of this.
 */
export interface BidPanelProps {
  /** Which auction is being viewed. Passed by the detail page shell (AUC-11). */
  auctionId: string;
}

/** One amount, rendered the only way amounts render (§3/§4: bdi + suffix out). */
function Price({ amount }: { amount: Sar }) {
  return (
    <span className="num font-bold whitespace-nowrap">
      <bdi>{formatSar(amount)}</bdi> {SAR_SUFFIX}
    </span>
  );
}

/** BID-04 — one sentence per §13.5 reason. Wording is behaviour: it names the
 *  distinction each reason exists to carry, so it is Rayan's half even though
 *  the tone and placement are Mohammed's. */
function OutcomeMessage({ outcome }: { outcome: PlaceBidOutcome }) {
  if (outcome.kind === "accepted") {
    return <p className="text-brand-text font-semibold">قُبلت مزايدتك. السعر والسجل أعلاه يتحدّثان مباشرة.</p>;
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
      return <p className="text-ink-2">انتهت جلستك أو لم يتم تسجيل الدخول. سجّل الدخول ثم أعد المحاولة.</p>;
    case "auction_not_found":
      return <p className="text-ink-2">هذا المزاد لم يعد موجودًا.</p>;
    case "auction_ended":
      /* FR-BID-21 — definitively which side of the deadline they fell on. */
      return <p className="text-ink-2">انتهى المزاد قبل وصول مزايدتك، فلم تُقبل. النتيجة النهائية تظهر أعلاه.</p>;
    case "owner_cannot_bid":
      return <p className="text-ink-2">لا يمكنك المزايدة على مزادك أنت (قاعدة المنصة).</p>;
    case "malformed_amount":
      /* Reason 5 — REJECTED, never rounded. The message must not offer rounding. */
      return <p className="text-ink-2">المبلغ غير صالح. أدخل أرقامًا فقط، وبحدٍّ أقصى خانتان عشريتان — لا يُقرَّب المبلغ تلقائيًا.</p>;
    case "below_starting_price":
      /* FR-BID-10 — "bidding starts at X". */
      return (
        <p className="text-ink-2">
          المزايدة تبدأ من{" "}
          {outcome.startingPrice ? <Price amount={outcome.startingPrice} /> : "سعر البداية"}.
        </p>
      );
    /*
     * The price in the two messages below is the server's number from the
     * moment of REJECTION, and it ages while the message stays on screen —
     * the live PriceRegion sits in the same column and keeps moving. So both
     * speak in the PAST tense (the number is history, not a claim about now),
     * and the call to action names the live current price, never the frozen
     * number. `below_starting_price` is exempt: starting price is immutable
     * (BR-31), its number cannot go stale. The rule class is BID-10's (#71).
     */
    case "not_above_current":
      return (
        <p className="text-ink-2">
          يجب أن يكون مبلغك أكبر من السعر الحالي
          {outcome.currentPrice ? (
            <>
              {" "}
              — كان <Price amount={outcome.currentPrice} /> عند وصول مزايدتك
            </>
          ) : null}
          .
        </p>
      );
    case "outbid_race":
      /* EC-01 / SC-18 — DISTINCT from not_above_current: they did nothing wrong. */
      return (
        <p className="text-ink-2">
          سبقك مزايد آخر في اللحظة نفسها — مبلغك كان صالحًا عند إرساله، لكن السعر
          كان قد بلغ{" "}
          {outcome.currentPrice ? <Price amount={outcome.currentPrice} /> : "قيمة أعلى"} حين
          وصل. زد على السعر الحالي وحاول فورًا.
        </p>
      );
  }
}

export function BidPanel({ auctionId }: BidPanelProps) {
  const { snapshot, connection } = useLiveAuction(auctionId);

  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<PlaceBidOutcome | null>(null);

  /*
   * BID-17's other half (SC-23, FR-RT-08): when the LIVE status flips to
   * ended under the viewer, the bid control disappears — in the same paint
   * as the outcome banner's appearance, because both consume the same
   * snapshot publish from the shared store. BidSlot's server-side gate only
   * covers pages LOADED after the end; this gate covers the viewer who was
   * already here. The banner above answers the question the form no longer
   * can. After all hooks, deliberately: a conditional return before them
   * would break React's rules.
   *
   * BOUND TO THE STORED FLIP, NOT TO A CLOCK — and the difference is real,
   * so it is stated rather than blurred (@Dem4t, #122 review). Eligibility
   * itself is never decided here: `place_bid` decides it with
   * clock_timestamp() against end_time (LC-03), and this gate neither
   * participates in that nor may be read as doing so. What it decides is
   * only WHEN THE CONTROL LEAVES THE SCREEN, and it leaves on the recorded
   * transition.
   *
   * So in the EC-04 window — end_time passed, the sweep not yet run, up to
   * 30s (FR-END-03) — a viewer who was already here still has a form, and
   * the server rejects everything it sends with `auction_ended`. That is a
   * dead form for up to half a minute, and it disagrees with two surfaces
   * that ARE clock-driven: ActiveListing's card (offset-corrected) and a
   * fresh load's presentedStatus.
   *
   * It is bound this way on purpose: a control disappears on a fact the
   * server recorded, never on arithmetic over a client clock that can be
   * wrong in the direction that removes a form still able to be used.
   * Binding it to presentedStatus instead is a defensible different answer,
   * and it would make the three surfaces agree — recorded here, not taken
   * silently, and not settled inside a review of something else.
   */
  if (snapshot?.auction.status === "ended") return null;

  /*
   * BID-06 — the minimum, from the live snapshot, through the ONE rule module
   * (lib/money). Inclusive for the first bid (BR-29), strict after (BR-03) —
   * the hint's verb carries the difference. Null until the first read lands;
   * the panel still submits fine without it (the server needs no hint).
   */
  const minimum = snapshot
    ? minimumAcceptableBid({
        /*
         * The snapshot carries no startingPrice — deliberately, it is
         * immutable and never re-read (live-snapshot.ts). Passing currentPrice
         * here is correct BY INVARIANT, and only the zero-bid branch uses it:
         * creation pins current_price equal to starting_price
         * (auctions_owner_insert) and only place_bid ever moves it (BR-13), so
         * with bidCount === 0 the two are the same number. With bids, the rule
         * reads currentPrice and this field is dead. If the invariant ever
         * breaks, the suite's price-floor assertions break first.
         */
        startingPrice: snapshot.auction.currentPrice,
        currentPrice: snapshot.auction.currentPrice,
        bidCount: snapshot.auction.bidCount,
      })
    : null;

  /*
   * Soft feedback only (behaviour 1): typed-below-minimum shows the hint in a
   * firmer tone, and nothing else happens. Price only ever rises, so a bid
   * failing against this snapshot would fail against every newer one too —
   * but the server stays the one that says so.
   *
   * BID-10 (#71) routes the decision through lib/realtime/ux-rules so RT-X3
   * reads as the rule it is rather than as an inline conjunction. The
   * comparison itself stays in lib/money — the one place amounts may be
   * compared (CLAUDE.md §4). This recomputes from the live snapshot on every
   * publish, which is what makes "the price overtook you" appear WITHOUT the
   * input being touched: `amount` is local state and no snapshot path writes
   * to it (RT-X2/SC-22). That ABSENCE is the rule, and it is why ux-rules.ts
   * exports no helper for it: no function call can keep a line that is not
   * there from being added. See its "not functions" note.
   */
  const typed = trySar(amount.trim());
  const typedBelowMinimum = isTypedAmountSuperseded({
    hasTypedAmount: typed !== null,
    belowMinimum: typed !== null && minimum !== null && !meetsMinimum(typed, minimum),
  });

  /*
   * RT-R4 / FR-RT-13 — the control is MARKED stale, never disabled. Disabling
   * would let a transport fault decide a bidding outcome, which RT-R1 forbids.
   * Note that `disabled` below does not mention `connection` at all: that is
   * the whole enforcement, and ux-rules.ts says why it cannot be a helper.
   * `"connecting"` counts as stale
   * (no cue can have arrived yet) but does not get a sentence — that split
   * is isPossiblyStale vs shouldAnnounceConnectionLoss.
   *
   * `stale` marks the FORM, which is a state assistive technology can read at
   * any time; `announceLoss` gates the SENTENCE, which is the calm statement
   * RT-R2 asks for once loss is established rather than merely suspected.
   */
  const stale = isPossiblyStale(connection);
  const announceLoss = shouldAnnounceConnectionLoss(connection);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setOutcome(null);
    const verdict = await placeBid(auctionId, amount);
    setPending(false);
    setOutcome(verdict);
    if (verdict.kind === "accepted") setAmount(""); // behaviour 4: the ONLY clear
  };

  return (
    <section aria-labelledby="bid-panel-title">
      <h2 id="bid-panel-title" className="text-base font-bold">
        قدّم مزايدتك
      </h2>

      {/*
        data-stale is the MARK required by FR-RT-13 / RT-R4, exposed as a data
        attribute on purpose: it is a behavioural fact ("this copy may be
        behind the database"), and expressing it as an attribute lets
        @m7ya505 style the stale form however he wants — `[data-stale]` in his
        stylesheet — without me choosing a colour, and without him having to
        touch the condition that computes it. It is deliberately NOT
        `disabled`: bidding stays available while stale (RT-R1/RT-R7). It is
        true while "connecting" too, which is why it is
        `stale` and not `announceLoss`.
      */}
      <form onSubmit={submit} data-stale={stale || undefined} className="mt-2 flex flex-col gap-2">
        <label htmlFor="bid-amount" className="text-sm text-ink-2">
          مبلغ المزايدة (<span className="num">{SAR_SUFFIX}</span>)
        </label>
        <div className="flex items-center gap-2">
          {/*
            dir="ltr": digits and the decimal point read left-to-right even in
            the RTL document. inputMode brings the numeric keyboard; type stays
            "text" because type="number" is a float parser wearing a UI — it
            silently mangles wide values and blocks valid ones (§4 rule 1).
            NO maxLength: an amount may be arbitrarily large (BR-21).
          */}
          {/*
            aria-describedby ties the input to whichever notes are currently
            present, so a screen reader reaching the control hears "your copy
            may be stale" and the minimum hint as part of the control rather
            than as loose text it may never reach (FR-RT-13 / RT-R4: the
            control is MARKED). Behaviour, not styling: it changes what is
            announced, not how anything looks. Never aria-disabled — the
            control stays fully usable while stale (RT-R1/RT-R7).
          */}
          <input
            id="bid-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            /*
             * Keyed to `announceLoss`, not to `stale`: aria-describedby must
             * name an element that EXISTS. `stale` is also true while
             * "connecting", when the note is deliberately not rendered, and
             * pointing at a missing id is a dangling reference that assistive
             * technology resolves to nothing — a mark that silently is not one.
             */
            aria-describedby={
              [minimum ? "bid-minimum-hint" : null, announceLoss ? "bid-stale-note" : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className="num border-rule bg-surface min-h-tap w-full rounded-md border px-3 text-start"
            placeholder={minimum ? formatSar(minimum.amount) : ""}
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-brand text-on-brand border-brand min-h-tap shrink-0 rounded-md border px-5 font-semibold disabled:opacity-60"
          >
            {pending ? "يُرسل…" : "زايد"}
          </button>
        </div>

        {minimum && (
          <p
            id="bid-minimum-hint"
            className={typedBelowMinimum ? "text-urge-text text-sm" : "text-ink-3 text-sm"}
          >
            {minimumBidHint(minimum)}
          </p>
        )}

        {announceLoss && (
          /*
           * RT-R7 made visible: bidding works without realtime — the paths
           * are independent — so this is a staleness note, never a lock.
           * BID-11 owns the fuller treatment.
           *
           * The gate is `shouldAnnounceConnectionLoss`, NOT `isPossiblyStale`,
           * and the difference is the requirement: RT-R2 wants loss stated
           * "clearly and calmly", so `"connecting"` — true of every page load
           * for its first second — must not produce a sentence. It still
           * marks the control (`stale`), because trusting an unjoined channel
           * is what makes staleness silent. Wording is unchanged from BID-11.
           */
          <p id="bid-stale-note" className="text-ink-3 text-sm">
            التحديث المباشر متوقف مؤقتًا؛ السعر المعروض قد لا يكون الأحدث. المزايدة
            نفسها تعمل بشكل طبيعي.
          </p>
        )}

        {/* aria-live: the verdict is announced without stealing focus (SC-22). */}
        <div aria-live="polite" className="min-h-5 text-sm">
          {outcome && <OutcomeMessage outcome={outcome} />}
        </div>
      </form>
    </section>
  );
}
