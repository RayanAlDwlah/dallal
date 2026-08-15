import { createClient } from "@/lib/supabase/server";
import { sar, type Sar } from "@/lib/money";

import { publicImageUrl } from "./image-url";

/**
 * AUC-09 — the marketplace listing read.
 *
 * Mohammed's issue (#51); see the header of app/auctions/new/actions.ts for why
 * it is in this branch.
 *
 * FR-LIST-11 governs the SELECT list as strictly as the WHERE clause: no
 * owner_id, no bidder identity, no email — and email cannot leak from here even
 * by accident, because it lives in the auth schema and no join reaches it
 * (CLAUDE.md §6). The seller's display name is not read either; the listing has
 * no requirement for it (FR-LIST-02) and the cheapest way to keep a privacy
 * guarantee is to never fetch the data.
 */

export interface AuctionListEntry {
  id: string;
  name: string;
  /** Public URL, or undefined so ImageFrame renders its placeholder (EC-18). */
  imageUrl?: string;
  startingPrice: Sar;
  currentPrice: Sar;
  bidCount: number;
  /** ISO instant. The countdown measures against it (FR-LIST-04). */
  endsAt: string;
}

export interface AuctionListing {
  entries: AuctionListEntry[];
  /**
   * The clock the rows were selected against, handed to every countdown so a
   * wrong or manipulated browser clock changes only the display (BR-19, EC-17).
   */
  serverNow: string;
  /** True when the read itself failed — distinct from "no auctions" (FR-LIST-08). */
  failed: boolean;
}

/**
 * FR-LIST-09 — "usable with at least 100 auctions", with pagination explicitly
 * Should Have beyond that (S6). The cap is here so that the day the platform
 * has 5,000 auctions the page degrades by omission rather than by timing out —
 * and so the omission is visible to whoever reads this, instead of being a
 * silent truncation.
 */
const LISTING_LIMIT = 100;

/**
 * Row shape from PostgREST. `bids` is the embedded aggregate, which arrives as
 * a one-element array even though it is a single count.
 */
interface AuctionRow {
  id: string;
  name: string;
  image_path: string;
  starting_price: string;
  current_price: string;
  end_time: string;
  bids: { count: number }[] | null;
}

export async function listActiveAuctions(
  /**
   * V2 — restrict to a category family (a main id plus its sub ids), computed
   * by lib/categories/catalog.ts. Undefined lists everything, which is every
   * V1 call site unchanged.
   */
  categoryIds?: number[],
  /**
   * V2 — a free-text search over the product name. Characters PostgREST's
   * filter grammar treats specially are stripped rather than escaped: a
   * search term is words, and a term that was ONLY specials degrades to the
   * unfiltered listing instead of a 400.
   */
  q?: string,
): Promise<AuctionListing> {
  const supabase = await createClient();

  /*
   * FR-LIST-05 — Active auctions ONLY, and the filter is TWO conditions.
   *
   * `status = 'active'` alone is not enough. The closing sweep runs every 15
   * seconds (BID-16), so there is a window in which the end time has passed and
   * the flag still says active. This is the same trap CLAUDE.md §5 and LC-03
   * name for bid eligibility, in its milder listing form: gating on the stored
   * flag alone would keep a finished auction on the marketplace with a
   * countdown reading 00:00:00.
   *
   * The clock here is the APPLICATION server's, not the database's, and that is
   * a deliberate limit: this filter decides only what is DISPLAYED. Every
   * decision that binds — whether a bid is accepted, when an auction closes,
   * who won — is taken inside the database against clock_timestamp(), and none
   * of them consults this value. A second of skew moves one row on or off the
   * page for one render; it cannot move an outcome.
   *
   * FR-LIST-06 — soonest end time first. The partial index
   * auctions_active_ending_soonest is (end_time asc) WHERE status = 'active',
   * which serves the filter and the sort in one scan.
   */
  const serverNow = new Date().toISOString();

  /*
   * `::text` ON BOTH MONEY COLUMNS. Not a style choice — measured on
   * dallal-dev on 2026-08-14 with a 30-digit amount (BR-21 permits one; there
   * is no ceiling):
   *
   *   select=starting_price        →  123456789012345678901234567890.99
   *                                   an unquoted JSON *number*, which
   *                                   JSON.parse turns into 1.2345678901234568e+29
   *   select=starting_price::text  →  "123456789012345678901234567890.99"
   *                                   a JSON string, exact
   *
   * S0-12 §1 and §6 say amounts travel as strings, and this is the one place a
   * `sar_amount` column is read directly rather than through bid_history, which
   * already routes every amount through public.sar_text(). Without the cast the
   * money contract is broken by the transport, before a line of TypeScript
   * runs, and the branded `Sar` type would be a string annotation over a float.
   *
   * The trailing comment in 20260812120000 §3b calls "bid_history / auctions
   * select" the text path. Half of that is wrong — the plain auctions select is
   * not one. Raised for the team rather than fixed silently here, since it
   * affects AUC-11's detail read and BID-09's realtime re-read too.
   */
  let query = supabase
    .from("auctions")
    .select(
      "id, name, image_path, starting_price::text, current_price::text, end_time, bids(count)",
    )
    .eq("status", "active")
    .gt("end_time", serverNow);

  if (categoryIds && categoryIds.length > 0) {
    query = query.in("category_id", categoryIds);
  }

  const safeQ = q?.replace(/[%_,()."\\]/g, " ").trim();
  if (safeQ) {
    query = query.ilike("name", `%${safeQ}%`);
  }

  const { data, error } = await query
    .order("end_time", { ascending: true })
    .limit(LISTING_LIMIT)
    .returns<AuctionRow[]>();

  if (error || !data) {
    /*
     * Reported, never disguised as an empty marketplace. FR-LIST-08's empty
     * state invites the user to create the first auction — showing it after a
     * failed read would tell someone their auctions had vanished.
     */
    return { entries: [], serverNow, failed: true };
  }

  return {
    serverNow,
    failed: false,
    entries: data.map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: publicImageUrl(supabase, row.image_path),
      /*
       * sar() throws on anything that is not an exact decimal string. That is
       * the intent: the amounts arrive as strings from a `sar_amount` column
       * (S0-12 §6), and a value that fails this has already violated the money
       * contract somewhere upstream. Failing loudly beats rendering `NaN SAR`.
       */
      startingPrice: sar(row.starting_price),
      currentPrice: sar(row.current_price),
      /*
       * FR-LIST-03 needs the starting-price / current-bid distinction, and it
       * CANNOT be derived from the prices: BR-29 lets the first bid equal the
       * starting price exactly, so current_price === starting_price does not
       * mean there are no bids. The count is read, not inferred.
       */
      bidCount: row.bids?.[0]?.count ?? 0,
      endsAt: row.end_time,
    })),
  };
}

