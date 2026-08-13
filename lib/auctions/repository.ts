import type { Auction } from "@/lib/auction";
import { effectiveStatus } from "@/lib/auction";
import { sar } from "@/lib/money";

/**
 * ⚠ THE SINGLE POINT OF SUBSTITUTION FOR AUCTION DATA — TODO(S0-04).
 *
 * Supabase does not exist yet (S0-04, Abdulrahman). TEAM.md §9.1's unblocking
 * rule is explicit: build against a placeholder, but make it **one clearly
 * marked point of substitution, not scattered assumptions**. Every page reads
 * auctions through this module and nowhere else, so swapping in Supabase is a
 * change to this file alone.
 *
 * When it is replaced:
 *  - Reads run with the caller's own identity; RLS is the authorization
 *    (ARCHITECTURE §6.4 path P1). No elevated credential belongs here.
 *  - `serverNow()` must come from the database, not the app server. Vercel
 *    functions have their own clocks and must never decide anything (§21.1).
 *  - Nothing in this module may ever WRITE currentPrice, bidCount, status,
 *    finalPrice, winnerId or closedAt. Those belong to Rayan's two elevated
 *    operations (S0-11 §3.2, SEC-Z5, SEC-Z6).
 */

/**
 * The authoritative clock. Everything time-based reads it rather than calling
 * `Date.now()` inline, so there is one place to point at the database later.
 */
export function serverNow(): Date {
  // TODO(S0-04): return the database clock, not the app server's.
  return new Date();
}

const OWNER = "u_maha";

function iso(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

const FIXTURES: Auction[] = [
  {
    id: "a1",
    ownerId: OWNER,
    ownerDisplayName: "مها",
    createdAt: iso(-45),
    status: "active",
    productName: "ساعة جيب نحاسية — طراز ١٩٤٠",
    productDescription:
      "ساعة جيب نحاسية أصلية بحالة ممتازة، تعمل بالتعبئة اليدوية.\nالغطاء سليم بلا خدوش، والسلسلة الأصلية مرفقة.",
    startingPrice: sar("100"),
    endsAt: iso(9),
    currentPrice: sar("250"),
    bidCount: 4,
    finalPrice: null,
    winnerId: null,
    winnerDisplayName: null,
    closedAt: null,
  },
  {
    // The case that motivated bid_count: one accepted bid of exactly the
    // starting price, so currentPrice === startingPrice yet bids exist
    // (BR-29, contract §1). The detail page must still show "المزايدة الحالية".
    id: "a2",
    ownerId: "u_omar",
    ownerDisplayName: "عمر",
    createdAt: iso(-20),
    status: "active",
    productName: "آلة كاتبة قديمة",
    productDescription: "آلة كاتبة بحروف عربية، تعمل بالكامل، مع علبتها الأصلية.",
    startingPrice: sar("100"),
    endsAt: iso(2880),
    currentPrice: sar("100"),
    bidCount: 1,
    finalPrice: null,
    winnerId: null,
    winnerDisplayName: null,
    closedAt: null,
  },
  {
    id: "a3",
    ownerId: OWNER,
    ownerDisplayName: "مها",
    createdAt: iso(-10),
    status: "active",
    productName: "كاميرا فيلم ٣٥ ملم",
    productDescription: "كاميرا فيلم بعدسة ثابتة، مناسبة للمبتدئين. لم تُجرَّب منذ سنوات.",
    startingPrice: sar("450.50"),
    endsAt: iso(240),
    currentPrice: sar("450.50"),
    bidCount: 0,
    finalPrice: null,
    winnerId: null,
    winnerDisplayName: null,
    closedAt: null,
  },
  {
    id: "a4",
    ownerId: "u_khalid",
    ownerDisplayName: "خالد",
    createdAt: iso(-4320),
    status: "ended",
    productName: "راديو ترانزستور",
    productDescription: "راديو محمول بحالة جيدة، يعمل على البطاريات.",
    startingPrice: sar("80"),
    endsAt: iso(-120),
    currentPrice: sar("400"),
    bidCount: 7,
    finalPrice: sar("400"),
    winnerId: "u_mohammed",
    winnerDisplayName: "محمد",
    closedAt: iso(-119),
  },
  {
    // Zero bids at close: no winner, no final price, and NOT an error (BR-09).
    id: "a5",
    ownerId: "u_layla",
    ownerDisplayName: "ليلى",
    createdAt: iso(-2880),
    status: "ended",
    productName: "طقم أقلام حبر",
    productDescription: "طقم من ثلاثة أقلام حبر سائل في علبة خشبية.",
    startingPrice: sar("60"),
    endsAt: iso(-60),
    currentPrice: sar("60"),
    bidCount: 0,
    finalPrice: null,
    winnerId: null,
    winnerDisplayName: null,
    closedAt: iso(-59),
  },
];

/**
 * The main listing — **active auctions only**, soonest ending first
 * (FR-LIST-05, FR-LIST-06, SC-71).
 *
 * An auction past its end time is filtered out even while the row still says
 * active, so a viewer never sees something they cannot bid on (LC-03).
 * Ended auctions leave the listing but stay reachable by direct link
 * (FR-LIST-05a, FR-END-12).
 */
export async function listActiveAuctions(): Promise<Auction[]> {
  const now = serverNow();
  return FIXTURES.filter((a) => effectiveStatus(a, now) === "active").sort(
    (a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt),
  );
}

/** Any auction, active or ended, by direct link (FR-DETAIL-01, FR-END-12). */
export async function getAuction(id: string): Promise<Auction | null> {
  return FIXTURES.find((a) => a.id === id) ?? null;
}
