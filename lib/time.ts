/**
 * Countdown + date formatting. Western digits, tabular rendering.
 * The browser renders the countdown visually; auction validity is always
 * decided server-side (place_bid / finalize against the server clock).
 */

export type CountdownState = "normal" | "urgent" | "ended";

const URGENT_MS = 60_000; // under a minute → red (type-and-money.html)

export function countdownState(remainingMs: number): CountdownState {
  if (remainingMs <= 0) return "ended";
  if (remainingMs < URGENT_MS) return "urgent";
  return "normal";
}

/** Card pill flips to «ينتهي قريب» inside the final 10 minutes. */
export function isEndingSoon(remainingMs: number): boolean {
  return remainingMs > 0 && remainingMs <= 10 * 60_000;
}

/** Has this end time passed on the reader's clock? (display/refetch hint only). */
export function hasExpired(endTime: string): boolean {
  return new Date(endTime).getTime() <= Date.now();
}

/** An ISO timestamp `minutes` from now — used for `min` on datetime inputs. */
export function isoFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** HH:MM:SS with unbounded hours — 76:14:09 stays exact, never abbreviated. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "20/08/2026، 9:30 م" — Gregorian, Latin digits, Arabic day period. */
export function formatDateTimeAr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const h24 = d.getHours();
  const period = h24 >= 12 ? "م" : "ص";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${day}/${month}/${year}، ${h12}:${pad(d.getMinutes())} ${period}`;
}

/** Relative time for bid history: «قبل ثانيتين» / «قبل 3 د» / «قبل ساعتين». */
export function relativeTimeAr(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (diff < 5) return "الآن";
  if (diff < 60) {
    if (diff < 11) return diff === 1 ? "قبل ثانية" : diff === 2 ? "قبل ثانيتين" : `قبل ${diff} ثوانٍ`;
    return `قبل ${diff} ثانية`;
  }
  const mins = Math.floor(diff / 60);
  if (mins < 60) return mins === 1 ? "قبل دقيقة" : mins === 2 ? "قبل دقيقتين" : `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "قبل ساعة" : hours === 2 ? "قبل ساعتين" : `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "قبل يوم" : days === 2 ? "قبل يومين" : `قبل ${days} يوم`;
}

/** Local datetime-input value (YYYY-MM-DDTHH:mm) for a Date. */
export function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
