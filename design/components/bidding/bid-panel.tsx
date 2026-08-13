"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  SAR_SUFFIX,
  formatSar,
  meetsMinimum,
  minimumAcceptableBid,
  minimumBidHint,
  trySar,
  type AuctionPrice,
  type Sar,
} from "@/lib/money";

/**
 * PRESENTATION: Mohammed. BEHAVIOUR: Rayan (TEAM.md §6, §11 — amended
 * 2026-08-12; the ownership line is presentation vs. logic, not feature area).
 *
 * Mohammed builds and styles this panel. Everything it *decides* still belongs
 * to Rayan and arrives through props: `submitBid` performs the submission,
 * `BidResult` carries which of the eight rejection reasons applies, and the
 * current price is a value Rayan owns. This component must never re-derive any
 * of that — Rayan reviews any change to how his semantics are presented.
 *
 * Two design decisions worth defending:
 *
 * 1. FOUR EXPLICIT STATES, not a chain of conditionals. SC-07 is a matrix
 *    test, so the component is a discriminated union and the compiler makes
 *    a missing case impossible.
 *
 * 2. NO OPTIMISTIC UPDATE. `useOptimistic` would paint the bid as accepted
 *    before the server ruled. Under contention the server rejects roughly
 *    half of competing bids (BR-12), so the UI would routinely show a bid
 *    landing and then snatch it back — while FR-BID-16 requires the user to be
 *    told DEFINITIVELY. Submit, await the decision, then render it.
 */

/** The eight rejection reasons from ARCHITECTURE.md §13.5, as a type. */
export type BidResult =
  | { status: "accepted"; amount: Sar }
  | { status: "rejected"; reason: RejectionReason; currentPrice?: Sar; startingPrice?: Sar };

export type RejectionReason =
  | "not-authenticated"
  | "auction-not-found"
  | "auction-ended"
  | "caller-is-owner"
  | "malformed-amount"
  | "below-starting-price"
  | "not-above-current-price"
  /** Lost a concurrency race. The user did nothing wrong (EC-01, SC-18). */
  | "lost-race";

export type BidPanelProps =
  | { state: "guest"; onSignIn: () => void }
  | { state: "owner" }
  | { state: "ended" }
  | {
      state: "bidder";
      auction: AuctionPrice;
      /** Calls the single serialized database operation (ADR-2). */
      submitBid: (amount: Sar) => Promise<BidResult>;
    };

export function BidPanel(props: BidPanelProps) {
  switch (props.state) {
    case "guest":
      return (
        <Panel label="زائر غير مسجّل">
          <p className="text-sm text-ink-2">
            سجّل الدخول للمزايدة على هذا المزاد. سنعيدك إلى هنا بعد الدخول —{" "}
            {/* FR-AUTH-11: the amount is deliberately not carried through. */}
            <strong className="text-ink">ولن يُنقل مبلغك</strong>، تُدخله من جديد.
          </p>
          <Button tone="secondary" onClick={props.onSignIn}>
            تسجيل الدخول
          </Button>
        </Panel>
      );

    case "owner":
      // FR-DETAIL-16. The server rejects an owner's bid regardless of route,
      // including a crafted request — this is the UI half only (BR-02).
      return (
        <Panel label="مالك المزاد">
          <p className="text-sm text-ink-2">
            لا يمكنك المزايدة على مزادك. هذا يحمي عدالة السعر لكل من يزايد.
          </p>
        </Panel>
      );

    case "ended":
      // FR-DETAIL-17: no control at all. The outcome banner takes this space.
      return null;

    case "bidder":
      return <BidForm auction={props.auction} submitBid={props.submitBid} />;
  }
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-rule bg-surface p-4">
      <h3 className="text-xs font-bold text-ink-3">{label}</h3>
      {children}
    </section>
  );
}

function BidForm({
  auction,
  submitBid,
}: {
  auction: AuctionPrice;
  submitBid: (amount: Sar) => Promise<BidResult>;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BidResult | null>(null);

  const minimum = minimumAcceptableBid(auction);
  const parsed = trySar(value);

  // Client-side only, for fast feedback. The server decides (BR-08, SEC-V6).
  const looksValid = parsed !== null && meetsMinimum(parsed, minimum);
  const looksTooLow = parsed !== null && !looksValid;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsed === null || pending) return;

    setPending(true);
    setResult(null);
    try {
      // The amount is never adjusted and resubmitted for the user (FR-BID-17).
      setResult(await submitBid(parsed));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-rule bg-surface p-4"
    >
      <label htmlFor={inputId} className="text-sm font-semibold">
        مبلغ المزايدة
      </label>

      <div
        className={cn(
          "flex overflow-hidden rounded-sm border bg-surface",
          "focus-within:border-brand",
          looksTooLow ? "border-stop" : "border-rule-strong",
        )}
      >
        <input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={hintId}
          aria-invalid={looksTooLow || undefined}
          // The field is an LTR island; its label above stays RTL.
          className="num min-h-tap flex-1 bg-transparent px-3 text-money-md text-ink outline-none"
        />
        <span className="flex items-center border-s border-rule bg-sunk px-3 text-sm text-ink-2">
          {SAR_SUFFIX}
        </span>
      </div>

      {/* Different verbs for inclusive vs exclusive — NFR-USA-11. */}
      <p id={hintId} className="text-sm text-ink-2">
        {minimumBidHint(minimum)}
      </p>

      <Button type="submit" loading={pending} disabled={parsed === null}>
        أضف مزايدة
      </Button>

      {result ? <BidFeedback result={result} /> : null}
    </form>
  );
}

function BidFeedback({ result }: { result: BidResult }) {
  if (result.status === "accepted") {
    return (
      <p
        role="status"
        className="flex gap-3 rounded-md border border-brand-line bg-brand-weak px-4 py-3 text-brand-text"
      >
        <span aria-hidden="true" className="font-bold">
          ✓
        </span>
        <span>
          قُبلت مزايدتك بمبلغ <bdi className="num">{formatSar(result.amount)}</bdi> {SAR_SUFFIX}. أنت
          المتصدّر الآن.
        </span>
      </p>
    );
  }

  // Losing a race is brass, not red: the user did nothing wrong (EC-01).
  const isRace = result.reason === "lost-race";

  return (
    <p
      role="alert"
      className={cn(
        "flex gap-3 rounded-md border px-4 py-3",
        isRace
          ? "border-urge-line bg-urge-weak text-urge-text"
          : "border-stop-line bg-stop-weak text-stop-text",
      )}
    >
      <span aria-hidden="true" className="font-bold">
        {isRace ? "↺" : "✕"}
      </span>
      <span>{rejectionMessage(result)}</span>
    </p>
  );
}

/**
 * Every rejection states what happened and what to do (BR-27, NFR-USA-03).
 * A generic error is a defect, and the concurrency case must be
 * distinguishable from a plain too-low bid (SC-18).
 */
function rejectionMessage(result: Extract<BidResult, { status: "rejected" }>): string {
  const current = result.currentPrice ? `${formatSar(result.currentPrice)} ${SAR_SUFFIX}` : "";
  const starting = result.startingPrice ? `${formatSar(result.startingPrice)} ${SAR_SUFFIX}` : "";

  switch (result.reason) {
    case "not-authenticated":
      return "سجّل الدخول أولاً لتتمكّن من المزايدة.";
    case "auction-not-found":
      return "هذا المزاد غير موجود.";
    case "auction-ended":
      return "انتهى هذا المزاد ولم تعد المزايدة ممكنة.";
    case "caller-is-owner":
      return "لا يمكنك المزايدة على مزادك.";
    case "malformed-amount":
      return "أدخل مبلغاً صحيحاً بخانتين عشريتين على الأكثر.";
    case "below-starting-price":
      return `المزايدة تبدأ من ${starting}.`;
    case "not-above-current-price":
      return `مزايدتك يجب أن تكون أكبر من ${current}.`;
    case "lost-race":
      return `زايد أحدهم قبلك — السعر الحالي أصبح ${current}. جرّب مبلغاً أعلى.`;
  }
}
