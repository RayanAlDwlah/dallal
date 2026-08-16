import { NextResponse } from "next/server";

import { fetchCategoryTree } from "@/lib/auctions/queries";
import { compareMoney, formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

/**
 * «يقترح سعر البداية» — ai.html touchpoint 5. Deliberately NOT a model call:
 * the range comes from real ended auctions in the same category, computed on
 * integer cents. A language model never produces an amount on this platform.
 *
 * The three written constraints, enforced here and in the wizard:
 *   1. seller-only, create-form-only — bidders never see it;
 *   2. it fills a field and nothing else — no floor, no reserve, no warning
 *      when the seller ignores it;
 *   3. it disappears below 3 comparables — a range from two auctions is a
 *      guess in a confident suit.
 */

const WINDOW_DAYS = 90;
const MIN_COMPS = 3;

const STOPWORDS = new Set([
  "في", "من", "على", "مع", "عن", "الى", "إلى", "او", "أو", "و", "ال", "هذا", "هذه",
  "جديد", "جديدة", "مستعمل", "مستعملة", "للبيع", "نظيف", "نظيفة", "بحالة", "ممتازة",
]);

function tokens(title: string): string[] {
  return title
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/^ال/, ""))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export async function POST(req: Request) {
  let categoryId = 0;
  let title = "";
  try {
    const body = (await req.json()) as { categoryId?: unknown; title?: unknown };
    categoryId = typeof body.categoryId === "number" ? body.categoryId : 0;
    title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  } catch {
    /* fall through */
  }
  if (!categoryId) return NextResponse.json({ ok: false });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const categories = await fetchCategoryTree(supabase);
  const main =
    categories.find((c) => c.id === categoryId) ??
    categories.find((c) => c.children.some((s) => s.id === categoryId));
  if (!main) return NextResponse.json({ ok: false });
  const ids = [main.id, ...main.children.map((s) => s.id)];

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("auctions")
    .select("title, current_price::text")
    .eq("status", "ended")
    .not("current_price", "is", null)
    .not("winner_id", "is", null)
    .in("category_id", ids)
    .gte("end_time", since)
    .order("end_time", { ascending: false })
    .limit(200);

  const sold = (data ?? []) as Array<{ title: string; current_price: string }>;

  /* Prefer comps whose titles share words with the seller's; fall back to the
     whole category when the title matches nothing yet (or is still empty). */
  const mine = new Set(tokens(title));
  const scored = sold.filter((r) => tokens(r.title).some((t) => mine.has(t)));
  const comps = scored.length >= MIN_COMPS ? scored : sold;
  if (comps.length < MIN_COMPS) return NextResponse.json({ ok: false });

  /* Interquartile range on integer cents — no floats, no ceiling. */
  const cents = comps
    .map((r) => r.current_price)
    .sort(compareMoney)
    .map((s) => BigInt(s.replace(".", "")));
  const q1 = cents[Math.floor((cents.length - 1) * 0.25)]!;
  const q3 = cents[Math.ceil((cents.length - 1) * 0.75)]!;
  const mid = (q1 + q3) / 2n;

  const asAmount = (c: bigint) => {
    const s = c.toString().padStart(3, "0");
    return `${s.slice(0, -2)}.${s.slice(-2)}`;
  };

  return NextResponse.json({
    ok: true,
    low: asAmount(q1),
    high: asAmount(q3),
    suggested: asAmount(mid),
    lowLabel: formatMoney(asAmount(q1)),
    highLabel: formatMoney(asAmount(q3)),
    count: comps.length,
    days: WINDOW_DAYS,
    matchedTitle: scored.length >= MIN_COMPS,
  });
}
