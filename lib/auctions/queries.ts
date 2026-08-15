import type { SupabaseClient } from "@supabase/supabase-js";

import { isMoneyString } from "@/lib/money";
import { searchWords } from "@/lib/search";
import {
  AUCTION_WITH_RELATIONS,
  BID_COLUMNS,
  type AuctionListItem,
  type Bid,
  type Category,
} from "@/types/db";

export interface CategoryTree extends Category {
  children: Category[];
}

export async function fetchCategoryTree(supabase: SupabaseClient): Promise<CategoryTree[]> {
  const { data } = await supabase
    .from("categories")
    .select("id, name_ar, slug, parent_id, icon, fields, sort")
    .order("sort", { ascending: true });
  const all = (data ?? []) as Category[];
  const mains = all.filter((c) => c.parent_id === null);
  return mains.map((m) => ({ ...m, children: all.filter((c) => c.parent_id === m.id) }));
}

export async function fetchActiveAuctions(
  supabase: SupabaseClient,
  opts: {
    q?: string;
    categoryIds?: number[];
    limit?: number;
    /** Filters produced by the visible search chips («يفهم البحث», ai.html).
     * maxPrice is a validated amount STRING compared in SQL — never a JS number. */
    maxPrice?: string;
    endingWithinHours?: number;
  } = {},
): Promise<AuctionListItem[]> {
  let query = supabase
    .from("auctions")
    .select(AUCTION_WITH_RELATIONS)
    .eq("status", "active")
    .gt("end_time", new Date().toISOString())
    .order("end_time", { ascending: true })
    .limit(opts.limit ?? 60);

  if (opts.categoryIds && opts.categoryIds.length > 0) {
    query = query.in("category_id", opts.categoryIds);
  }
  if (opts.q) {
    /* Every meaningful word must appear somewhere — AND of per-word
       (title OR description). Filler words are dropped first, otherwise
       «أبغا رولكس» demands a title containing «أبغا» and returns nothing. */
    const words = searchWords(opts.q.replace(/[%_,()]/g, " "));
    for (const w of words) {
      query = query.or(`title.ilike.%${w}%,description.ilike.%${w}%`);
    }
  }
  if (opts.maxPrice && isMoneyString(opts.maxPrice)) {
    /* «تحت 60 ألف» compares the price a bidder would actually pay now. */
    query = query.or(
      `current_price.lte.${opts.maxPrice},and(current_price.is.null,starting_price.lte.${opts.maxPrice})`,
    );
  }
  if (opts.endingWithinHours && opts.endingWithinHours >= 1) {
    query = query.lte(
      "end_time",
      new Date(Date.now() + opts.endingWithinHours * 3_600_000).toISOString(),
    );
  }

  const { data, error } = await query;
  if (error) return [];
  return data as unknown as AuctionListItem[];
}

export async function fetchAuction(
  supabase: SupabaseClient,
  id: string,
): Promise<AuctionListItem | null> {
  const { data } = await supabase
    .from("auctions")
    .select(AUCTION_WITH_RELATIONS)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as AuctionListItem) ?? null;
}

export async function fetchBids(
  supabase: SupabaseClient,
  auctionId: string,
  limit = 20,
): Promise<Bid[]> {
  const { data } = await supabase
    .from("bids")
    .select(BID_COLUMNS)
    .eq("auction_id", auctionId)
    .order("id", { ascending: false })
    .limit(limit);
  return (data as unknown as Bid[]) ?? [];
}
