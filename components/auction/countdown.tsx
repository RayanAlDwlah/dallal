"use client";

import { useEffect } from "react";

import { countdownState, formatCountdown } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/**
 * Visual countdown only — auction validity is always decided server-side.
 * Under a minute the digits turn red (type-and-money.html).
 */
export function Countdown({
  endTime,
  className = "",
  onEnd,
}: {
  endTime: string;
  className?: string;
  onEnd?: () => void;
}) {
  const now = useNow();
  const remaining = new Date(endTime).getTime() - now;
  const state = now === 0 ? "normal" : countdownState(remaining);
  const ended = state === "ended";

  useEffect(() => {
    if (ended && onEnd) onEnd();
  }, [ended, onEnd]);

  return (
    <span
      suppressHydrationWarning
      className={`num font-display font-semibold ${state === "urgent" ? "text-red" : ""} ${className}`}
    >
      {now === 0 ? "--:--:--" : ended ? "انتهى" : formatCountdown(remaining)}
    </span>
  );
}
