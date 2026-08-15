import type { Category, Profile } from "@/types/db";

/**
 * Session row shapes. Money is STRINGS here too — every select casts the
 * numeric columns with ::text.
 */

export type SessionStatus = "draft" | "scheduled" | "live" | "ended";
export type LotStatus = "waiting" | "live" | "ended";
export type EntryMode = "deposit" | "invite";

export interface AuctionSession {
  id: string;
  host_id: string;
  title: string;
  description: string;
  cover_image: string | null;
  city: string | null;
  start_time: string;
  deposit: string | null;
  entry_mode: EntryMode;
  status: SessionStatus;
  current_lot_id: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionWithHost extends AuctionSession {
  host: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
}

export interface SessionLot {
  id: string;
  session_id: string;
  position: number;
  title: string;
  description: string;
  category_id: number;
  images: string[];
  attributes: Record<string, string>;
  starting_price: string;
  current_price: string | null;
  bid_increment: string;
  duration_seconds: number;
  bid_count: number;
  status: LotStatus;
  end_time: string | null;
  extension_count: number;
  winner_id: string | null;
}

export interface LotWithCategory extends SessionLot {
  category: Pick<Category, "id" | "name_ar" | "slug"> | null;
}

export interface SessionEntry {
  session_id: string;
  user_id: string;
  deposit_paid: boolean;
  approved: boolean;
  created_at: string;
  user?: Pick<Profile, "id" | "display_name" | "avatar_url"> | null;
}

export const SESSION_COLUMNS =
  "id, host_id, title, description, cover_image, city, start_time, deposit::text, " +
  "entry_mode, status, current_lot_id, paused_at, created_at, updated_at";

export const SESSION_WITH_HOST =
  `${SESSION_COLUMNS}, host:profiles!sessions_host_id_fkey(id, display_name, avatar_url)`;

export const LOT_COLUMNS =
  "id, session_id, position, title, description, category_id, images, attributes, " +
  "starting_price::text, current_price::text, bid_increment::text, duration_seconds, " +
  "bid_count, status, end_time, extension_count, winner_id";

export const LOT_WITH_CATEGORY = `${LOT_COLUMNS}, category:categories(id, name_ar, slug)`;

/** Expected running time of a session, in whole minutes. */
export function expectedMinutes(lots: Pick<SessionLot, "duration_seconds">[]): number {
  return Math.max(1, Math.round(lots.reduce((sum, l) => sum + l.duration_seconds, 0) / 60));
}
