import { SessionCard } from "@/components/session/session-card";
import { Page } from "@/components/layout/container";
import { EmptyState } from "@/components/ui/empty-state";
import { listSessions } from "@/lib/sessions/queries";

export const metadata = { title: "الجلسات — دلال" };

/**
 * V2 — the sessions listing. Public, like the auctions listing (FR-LIST-01's
 * shape): a visitor can browse; entering the hall to bid needs an account,
 * and the hall says so itself.
 */
export default async function SessionsPage() {
  const sessions = await listSessions();

  return (
    <Page
      title="جلسات المزاد"
      description="جلسات مباشرة يديرها البائع — قطعة واحدة مفتوحة للمزايدة في كل لحظة."
    >
      {sessions.length === 0 ? (
        <EmptyState
          title="لا توجد جلسات بعد"
          description="أول جلسة تُنشأ تظهر هنا فور نشرها."
        />
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <SessionCard session={s} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
