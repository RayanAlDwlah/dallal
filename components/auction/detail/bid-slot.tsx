import Link from "next/link";

import { BidButton } from "@/components/bidding/bid-button";
import { BidPanel } from "@/components/bidding/bid-panel";
import { Alert } from "@/components/ui/alert";
import { loginPath } from "@/lib/auth/validation";
import type { AuctionStatus } from "@/lib/auctions/detail";
import type { Sar } from "@/lib/money";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-15 (#57). What occupies the bid-control
 * slot, for each kind of viewer.
 *
 * FR-DETAIL-14 → 17 and SC-07 are a MATRIX, not a chain of conditions, so this
 * is written as one exhaustive switch over a discriminated state. A matrix
 * requirement expressed as nested `&&`s is how one of its four cells silently
 * stops being covered.
 *
 *   | viewer            | presented status | slot                              |
 *   |-------------------|------------------|-----------------------------------|
 *   | unauthenticated   | active           | sign-in prompt   (FR-DETAIL-15)   |
 *   | signed-in, owner  | active           | "you cannot bid" (FR-DETAIL-16)   |
 *   | signed-in, other  | active           | Rayan's BidPanel (FR-DETAIL-14)   |
 *   | any               | ended            | nothing at all   (FR-DETAIL-17)   |
 *
 * ── What this is NOT ──────────────────────────────────────────────────────
 *
 * It is not an authorization control. Drawing no bid panel does not stop
 * anybody bidding: the server rejects an owner's bid, an anonymous bid and a
 * late bid regardless of what this component rendered, on every route including
 * a crafted request (BR-02, EC-07, FR-SEC-16, SEC-V6). This decides what is
 * DISPLAYED — the identity contract's thing (1) — and the page hands it an
 * answer already derived from the server-verified identity, thing (2)
 * (S0-10 §6).
 *
 * The `ended` row uses the PRESENTED status (lib/auctions/presentation.ts), not
 * the stored one. An auction past its end time whose row still says `active`
 * must show no control, because it can no longer accept a bid (EC-04, LC-03) —
 * offering one would be an invitation to a guaranteed rejection.
 */

/** Who is looking, as far as display is concerned. */
export type ViewerRole =
  /** Not signed in. A supported user, not an error state (S0-10 §6, FR-AUTH-23). */
  | "visitor"
  /** Signed in, and this auction is theirs. Owners may never bid (BR-02). */
  | "owner"
  /** Signed in, and not the owner. The only role that gets a control. */
  | "bidder";

export interface BidSlotProps {
  auctionId: string;
  role: ViewerRole;
  /** The PRESENTED status from lib/auctions/presentation.ts, not the raw row. */
  status: AuctionStatus;
  /**
   * V2 — the server-computed next offer, non-null exactly when the auction is
   * fixed-increment. It selects WHICH control the bidder cell mounts: the
   * one-button control (V2), or the amount input (V1 legacy). It is display
   * seed data, not authorization: the server recomputes the amount inside the
   * lock regardless of what was drawn here.
   */
  nextOffer: Sar | null;
}

export function BidSlot({ auctionId, role, status, nextOffer }: BidSlotProps) {
  /*
   * FR-DETAIL-17 — ended, and nobody gets a control. Checked before the role,
   * because it applies to all three of them and a role-first shape would have
   * to repeat it three times.
   */
  if (status === "ended") return null;

  switch (role) {
    /*
     * FR-DETAIL-15 / FR-AUTH-11 — a prompt where the control would be, carrying
     * the return path so signing in lands the visitor back on this auction
     * rather than on the marketplace. loginPath validates that path itself, so
     * an id from the URL cannot become an open redirect.
     */
    case "visitor":
      return (
        <Alert tone="info" title="سجّل الدخول للمزايدة">
          <p className="mb-3">
            تصفّح المزاد وسجلّ المزايدات متاحان للجميع. المزايدة تحتاج حسابًا.
          </p>
          <Link
            href={loginPath(`/auctions/${auctionId}`)}
            className="bg-brand text-on-brand border-brand min-h-tap inline-flex w-full items-center justify-center rounded-md border px-5 font-semibold sm:w-auto"
          >
            تسجيل الدخول
          </Link>
        </Alert>
      );

    /*
     * FR-DETAIL-16 / BR-02 — no usable control, AND a statement of why. The
     * requirement is explicit that the owner is told rather than left looking
     * at a gap where other people have a form: an unexplained absence reads as
     * a broken page, and the seller is the one person guaranteed to open this
     * auction repeatedly.
     *
     * `info` rather than `error`: owning your own auction is not a mistake.
     */
    case "owner":
      return (
        <Alert tone="info" title="لا يمكنك المزايدة على مزادك">
          <p>
            أنت صاحب هذا المزاد. يظل السعر والسجل أمامك مباشرةً حتى وقت الانتهاء.
          </p>
        </Alert>
      );

    /*
     * FR-DETAIL-14 — the bidder's control. V2 fixed-increment auctions get
     * the one-button control; V1 legacy auctions keep the amount input,
     * unchanged (S0-13, components/bidding/bid-panel.tsx).
     */
    case "bidder":
      return nextOffer !== null ? (
        <BidButton auctionId={auctionId} initialNextOffer={nextOffer} />
      ) : (
        <BidPanel auctionId={auctionId} />
      );
  }
}
