/**
 * Row shapes as the app reads them. All money amounts are STRINGS — the
 * queries cast numeric columns with ::text (via select aliases) so no float
 * ever materialises in JavaScript.
 */

export type AuctionStatus = "draft" | "active" | "ended";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name_ar: string;
  slug: string;
  parent_id: number | null;
  icon: string | null;
  fields: string[];
  sort: number;
}

export interface Auction {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category_id: number;
  images: string[];
  attributes: Record<string, string>;
  starting_price: string;
  current_price: string | null;
  bid_increment: string;
  bid_count: number;
  status: AuctionStatus;
  start_time: string | null;
  end_time: string;
  extension_count: number;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionListItem extends Auction {
  seller: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
  category: Pick<Category, "id" | "name_ar" | "slug" | "parent_id"> | null;
  /** Display name only (§6) — shown on ended cards («الفائز محمد»). */
  winner: Pick<Profile, "display_name"> | null;
}

export interface Bid {
  id: number;
  auction_id: string;
  bidder_id: string;
  amount: string;
  created_at: string;
  bidder?: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
}

export type NotificationType =
  | "outbid"
  | "won"
  | "sold"
  | "ended_no_bids"
  | "session_starting";

export interface AppNotification {
  id: number;
  user_id: string;
  type: NotificationType;
  /** exactly one of these is set — a single auction, or a lot inside a session */
  auction_id: string | null;
  lot_id: string | null;
  payload: {
    title?: string;
    amount?: string;
    increment?: string;
    winner_name?: string;
    /** present on everything that happened inside a session */
    session_id?: string;
  };
  read_at: string | null;
  created_at: string;
}

export interface PlaceBidResult {
  ok: boolean;
  error?: string;
  bid_id?: number;
  current_price?: string;
  min_amount?: string;
  end_time?: string;
  extension_count?: number;
  extended?: boolean;
}

/** Columns selected for auctions, with numeric money cast to text. */
export const AUCTION_COLUMNS =
  "id, seller_id, title, description, category_id, images, attributes, " +
  "starting_price::text, current_price::text, bid_increment::text, bid_count, " +
  "status, start_time, end_time, extension_count, winner_id, created_at, updated_at";

export const AUCTION_WITH_RELATIONS =
  `${AUCTION_COLUMNS}, seller:profiles!auctions_seller_id_fkey(id, display_name, avatar_url), ` +
  "category:categories(id, name_ar, slug, parent_id), " +
  "winner:profiles!auctions_winner_id_fkey(display_name)";

export const BID_COLUMNS =
  "id, auction_id, bidder_id, amount::text, created_at, " +
  "bidder:profiles!bids_bidder_id_fkey(id, display_name, avatar_url)";
