import Link from "next/link";

import { Card, CardBody } from "@/components/ui/card";
import { ImageFrame } from "@/components/ui/image-frame";
import { StatusPill } from "@/components/ui/status-pill";
import type { SessionListEntry } from "@/lib/sessions/queries";

/**
 * V2 — one session on the sessions listing (session-card.html). Two live
 * states from the prototype: «مباشر الآن» and «تبدأ لاحقًا», plus ended.
 * No lifecycle logic here — the stored status is displayed, never derived.
 */
const STATUS_LABEL = {
  scheduled: "قريبًا",
  live: "مباشر الآن",
  ended: "انتهت",
} as const;

function startLabel(iso: string): string {
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function SessionCard({ session }: { session: SessionListEntry }) {
  return (
    <Card as="article" interactive className="overflow-hidden">
      <Link
        href={`/s/${session.id}`}
        className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <div className="relative">
          <ImageFrame
            src={session.coverUrl}
            alt={session.title}
            ratio="square"
            className="rounded-b-none border-0"
          />
          <StatusPill
            tone={session.status === "live" ? "active" : "ended"}
            className="absolute start-3 top-3 z-10"
          >
            {session.status === "live" ? (
              <span
                aria-hidden="true"
                className="bg-urge size-1.5 rounded-full shadow-[0_0_8px_var(--c-urge)]"
              />
            ) : null}
            {STATUS_LABEL[session.status]}
          </StatusPill>
        </div>

        <CardBody className="gap-2">
          <h2 className="line-clamp-2 text-base font-bold">
            <bdi>{session.title}</bdi>
          </h2>
          <div className="text-ink-2 flex items-center justify-between gap-3 text-xs">
            <span>
              يديرها <bdi>{session.hostName}</bdi>
              {session.city ? <> · {session.city}</> : null}
            </span>
            <span className="num shrink-0">{session.lotCount} قطعة</span>
          </div>
          {session.status !== "ended" ? (
            <p className="text-ink-3 text-xs">
              {session.status === "live" ? "الجلسة جارية الآن — ادخل القاعة" : (
                <>
                  تبدأ <span className="num">{startLabel(session.startTime)}</span>
                </>
              )}
            </p>
          ) : null}
        </CardBody>
      </Link>
    </Card>
  );
}
