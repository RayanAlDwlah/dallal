"use client";

import { isEndingSoon } from "@/lib/time";
import { useNow } from "@/lib/use-now";
import type { AuctionStatus } from "@/types/db";

/** مباشر (teal) → ينتهي قريب (red, final 10 minutes) → منتهي. */
export function CardPill({ status, endTime }: { status: AuctionStatus; endTime: string }) {
  const now = useNow();
  const remaining = new Date(endTime).getTime() - now;

  if (status === "ended" || (now > 0 && remaining <= 0)) {
    return <span className="pill pill-done">منتهي</span>;
  }
  if (now > 0 && isEndingSoon(remaining)) {
    return <span className="pill pill-urgent">ينتهي قريب</span>;
  }
  return (
    <span className="pill pill-live">
      <span className="dot" />
      مباشر
    </span>
  );
}
