"use client";

import { useSyncExternalStore } from "react";

import { Countdown } from "@/components/auction/countdown";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import type { AuctionStatus } from "@/lib/auctions/detail";

/**
 * MOHAMMED'S FILE — `@m7ya505`. AUC-13 (#55); the empty file came from S0-13.
 * The status label and the live countdown.
 *
 * Presentation is Mohammed's; the status VALUE and the moment it changes are
 * Rayan's, arriving from finalization and his subscription (ARCHITECTURE §14.6,
 * BID-15/BID-17). This region displays them and derives neither.
 *
 * ── The issue text for #55 is stale, and this is the resolution ────────────
 *
 * Issue #55 says "the end time never changes — there is no anti-sniping
 * extension (BR-36)". That is WRONG and must not be built to.
 *
 * BR-36 was REVERSED on 2026-08-13. A bid ACCEPTED in the final 15 seconds
 * extends end_time by exactly 30 seconds, repeating, to a hard cap of 20
 * extensions. The mechanism is real and lives in
 * supabase/migrations/20260814000000_bid15_closing_and_extension.sql.
 *
 * Three sources agree against the issue text:
 *   - CLAUDE.md §5, which says in terms that a document claiming a fixed end
 *     time is stale and that §5 governs
 *   - GITHUB_PLAN.md:401, the source of truth for the breakdown, which carries
 *     the corrected wording: "the end time CAN change… the countdown must
 *     follow the server-supplied end time when it moves, and must not freeze
 *     on a value read once at mount"
 *   - ARCHITECTURE §15.2, which records the reversal and its consequences
 *
 * The issues were created 2026-08-13T21:01, and the amendment did not reach
 * them. Raised for correction rather than quietly followed or quietly ignored.
 *
 * The consequence here is concrete: NOTHING caches a deadline. `endsAt` is a
 * prop, Countdown re-derives on every change to it, and a moved end time flows
 * straight through (RT-P3). There is no subscription in this file — one
 * per-auction subscription is owned by BID-08/BID-09, and a second would be a
 * competing update mechanism (TEAM.md §10.4).
 */
export interface StatusCountdownProps {
  /**
   * The status to DISPLAY. Taken as a prop rather than derived, because the
   * displayed status is not always the stored one: an auction past its end time
   * whose row still says `active` must present as ended (FR-DETAIL-24, EC-04).
   * Deciding that is AUC-16 (#58), and it changes what the shell passes here —
   * not what this component does with it.
   */
  status: AuctionStatus;
  /** Server-supplied, and it moves. See the note above. */
  endsAt: string;
  /** The server clock at read time, so a wrong client clock cannot mislead. */
  serverNow: string;
}

export function StatusCountdown({ status, endsAt, serverNow }: StatusCountdownProps) {
  const ended = status === "ended";

  return (
    <Card as="section" aria-label="حالة المزاد">
      <CardBody className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-ink-3 text-xs font-bold">حالة المزاد</h2>
          {/*
            FR-DETAIL-07 — stated explicitly, in words as well as colour, so it
            survives for a colour-blind reader (NFR-USA-10). StatusPill contains
            no lifecycle logic; the caller decides, and here the caller is the
            `status` prop.
          */}
          <StatusPill tone={ended ? "ended" : "active"}>
            {ended ? "منتهي" : "نشط"}
          </StatusPill>
        </div>

        {/* FR-DETAIL-08 — live, at least once per second, from the server end time. */}
        <Countdown endsAt={endsAt} serverNow={serverNow} />

        <LocalEndTime endsAt={endsAt} ended={ended} />
      </CardBody>
    </Card>
  );
}

/**
 * NFR-USA-07 / FR-DETAIL-08 — the absolute end time in the VIEWER'S local
 * timezone, with the zone named.
 *
 * The zone is not decoration. Every stored instant is `timestamptz` in one
 * canonical zone (NFR-DAT-06), and a bidder in Riyadh and one in Cairo are
 * looking at the same instant rendered two different ways. Without the zone
 * printed, a screenshot of this page is ambiguous and a bidder can plan around
 * the wrong minute.
 *
 * Rendered only after mount, and this is not optional: Intl resolves the
 * timezone from the runtime, so a server render uses the SERVER's zone and the
 * client render uses the viewer's. Emitting both is a hydration mismatch, and
 * the value would be wrong in the HTML that search engines and the first paint
 * see. The placeholder holds the line's height so nothing jumps.
 *
 * `ar-SA` alone resolves numberingSystem to "arab" and renders ٢٠/٠٨/٢٠٢٦.
 * BR-42 requires Western digits; `-u-nu-latn` is the whole fix, and it is the
 * same extension components/auction/countdown.tsx already uses.
 */
function LocalEndTime({ endsAt, ended }: { endsAt: string; ended: boolean }) {
  const hydrated = useHydrated();

  /*
   * Explicit components rather than dateStyle/timeStyle, and that is a
   * REQUIREMENT, not a preference. ECMA-402 makes dateStyle and timeStyle
   * mutually exclusive with every individual field option, timeZoneName
   * included — combining them throws `TypeError: Invalid option : option` at
   * runtime. TypeScript's lib types permit the combination and `next build`
   * compiles it, so nothing catches this before a browser does. It was caught
   * by one, and the note is here so it is not reintroduced.
   */
  const absolute = hydrated
    ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(endsAt))
    : null;

  return (
    <p className="text-ink-2 text-sm">
      {ended ? "انتهى في" : "ينتهي في"}{" "}
      {/*
        <bdi> because the formatted string mixes Western digits and a zone
        abbreviation that may be Latin (GMT+3) inside an RTL line.
      */}
      <bdi className="num font-semibold">{absolute ?? "—"}</bdi>
    </p>
  );
}

/**
 * True only once the component is running in the browser.
 *
 * useSyncExternalStore with a server snapshot is React's own answer for a value
 * that must differ between server and client — it is not a workaround for the
 * `react-hooks/set-state-in-effect` rule, and the rule is not disabled anywhere
 * in this repository (docs/design-system-notes.md §6.3 makes that a standing
 * position).
 *
 * The store never emits, so `subscribe` returns an unsubscribe that does
 * nothing. Both callbacks are module-level constants so their identity is
 * stable and the store is never re-subscribed on re-render.
 */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

function useHydrated(): boolean {
  return useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);
}
