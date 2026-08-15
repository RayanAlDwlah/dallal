"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface CountdownProps {
  /**
   * ISO timestamp. **It can move.** This line used to read "fixed at creation
   * and never extended"; BR-36 was reversed on 2026-08-13 and an accepted bid
   * in the final 15 seconds now pushes the end 30 seconds out, up to 20 times.
   * BR-16 narrowed rather than disappeared: no *human* and no edit path may
   * move it, only that automatic extension, and only forward.
   *
   * The effect below already depends on this prop, so a new value restarts the
   * ticker — which is what AUC-13 requires ("must not freeze on a value read
   * once at mount"). Passing an end time captured once at page load would
   * defeat that from the caller's side, not this component's.
   */
  endsAt: string;
  /**
   * The server's clock at render time. Used to measure skew, so a wrong or
   * manipulated client clock changes only this display and never an outcome
   * (BR-19, EC-17). Every real decision uses the database clock.
   */
  serverNow: string;
  className?: string;
}

const HOUR = 3600;
const MINUTE = 60;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function label(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / HOUR);
  const m = Math.floor((totalSeconds % HOUR) / MINUTE);
  const s = totalSeconds % MINUTE;
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days}د ${clock}` : clock;
}

/**
 * Display only. It never gates a bid — the server compares the end time
 * against its own clock on every attempt (LC-03, §13 step 4), which is why a
 * countdown that is a second out cannot corrupt an outcome.
 */
export function Countdown({ endsAt, serverNow, className }: CountdownProps) {
  // null until mounted: the server render has no client clock to read, and
  // rendering a different value on each would be a hydration mismatch.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const end = Date.parse(endsAt);
    const skew = Date.parse(serverNow) - Date.now();

    const tick = () => {
      setRemaining(Math.max(0, Math.floor((end - (Date.now() + skew)) / 1000)));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, serverNow]);

  // `ar-SA` alone resolves numberingSystem to "arab" and renders ٢٠/٠٨/٢٠٢٦.
  // BR-42 requires Western digits, and this string is not incidental: it is
  // both the sr-only announcement and the entire visible value once the
  // auction has ended. `-u-nu-latn` is the whole fix; `-ca-gregory` is not
  // added because the calendar already resolves to gregory.
  const absolute = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(endsAt));

  const over = remaining === 0;
  const final = remaining !== null && remaining > 0 && remaining <= MINUTE;
  const soon = remaining !== null && remaining > MINUTE && remaining <= 10 * MINUTE;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-sm",
        /*
         * V2 splits what was one urgency colour into two (type-and-money.html):
         * teal while the end is near («فوق 10 دقايق» ends), RED under the
         * minute — "تحت الدقيقة — يصير أحمر". Red is reserved for the final
         * seconds and errors, so `soon` must not use it.
         */
        over ? "text-calm-text" : final ? "text-stop-text" : soon ? "text-urge-text" : "text-ink-2",
        className,
      )}
    >
      <span>{over ? "انتهى في" : final ? "ينتهي الآن" : "يتبقّى"}</span>

      {/*
        aria-hidden on the ticker: a value that changes every second would be
        announced every second. The absolute end time below carries the same
        information once, calmly.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "num text-money-md font-bold",
          over ? "text-calm-text" : final ? "text-stop-text" : soon ? "text-urge-text" : "text-ink",
          final && "motion-safe:animate-pulse",
        )}
      >
        {remaining === null ? "—" : over ? absolute : label(remaining)}
      </span>

      <span className="sr-only">ينتهي المزاد في {absolute}</span>
    </div>
  );
}
