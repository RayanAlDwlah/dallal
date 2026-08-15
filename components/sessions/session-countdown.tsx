"use client";

import { formatCountdown } from "@/lib/time";
import { useNow } from "@/lib/use-now";

/** «بعد 2:41:00» — time until a scheduled session opens. */
export function SessionCountdown({ startTime }: { startTime: string }) {
  const now = useNow();
  const remaining = new Date(startTime).getTime() - now;

  if (now === 0) return <span className="num">بعد --:--:--</span>;
  if (remaining <= 0) return <span className="num text-teal">تبدأ الآن</span>;
  return <span className="num">بعد {formatCountdown(remaining)}</span>;
}
