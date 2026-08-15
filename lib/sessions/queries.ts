import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/auctions/image-url";
import { sar, type Sar } from "@/lib/money";

/**
 * V2 — session reads. A lot IS an auction once opened (see the sessions
 * migration header), so everything live about the current lot — price,
 * history, the button — is read through the EXISTING auction paths by
 * auction id. These queries only answer: which sessions exist, which lots
 * belong to one, and which lot is current.
 */

export type SessionStatus = "scheduled" | "live" | "ended";

export interface SessionListEntry {
  id: string;
  title: string;
  city: string | null;
  coverUrl?: string;
  startTime: string;
  status: SessionStatus;
  hostName: string;
  lotCount: number;
}

export interface SessionLot {
  position: number;
  name: string;
  imageUrl?: string;
  startingPrice: Sar;
  bidIncrement: Sar;
  durationSeconds: number;
  /** Null while the lot is still only a plan. */
  auctionId: string | null;
  /** The linked auction's stored status + end, for the lot strip. */
  auctionStatus: "active" | "ended" | null;
  auctionEndTime: string | null;
}

export interface SessionDetail {
  id: string;
  title: string;
  description: string;
  city: string | null;
  coverUrl?: string;
  startTime: string;
  status: SessionStatus;
  hostId: string;
  hostName: string;
  lots: SessionLot[];
  /**
   * The lot to put on stage: the open one (its auction is active and unexpired
   * by the stored end_time), else null — the page decides what to show.
   */
  currentLot: SessionLot | null;
  serverNow: string;
}

interface SessionRow {
  id: string;
  title: string;
  city: string | null;
  cover_path: string | null;
  start_time: string;
  status: SessionStatus;
  host: { display_name: string } | null;
  session_lots: { count: number }[] | null;
}

export async function listSessions(): Promise<SessionListEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, title, city, cover_path, start_time, status, host:profiles(display_name), session_lots(count)",
    )
    .order("start_time", { ascending: true })
    .limit(50)
    .returns<SessionRow[]>();
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    city: row.city,
    coverUrl: row.cover_path ? publicImageUrl(supabase, row.cover_path) : undefined,
    startTime: row.start_time,
    status: row.status,
    hostName: row.host?.display_name ?? "",
    lotCount: row.session_lots?.[0]?.count ?? 0,
  }));
}

interface LotRow {
  position: number;
  name: string;
  image_path: string;
  starting_price: string;
  bid_increment: string;
  duration_seconds: number;
  auction_id: string | null;
  auction: { status: "active" | "ended"; end_time: string } | null;
}

interface SessionDetailRow {
  id: string;
  title: string;
  description: string;
  city: string | null;
  cover_path: string | null;
  start_time: string;
  status: SessionStatus;
  host_id: string;
  host: { display_name: string } | null;
}

export const readSession = cache(async (id: string): Promise<SessionDetail | null> => {
  const supabase = await createClient();
  const serverNow = new Date().toISOString();

  const [sessionRes, lotsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, title, description, city, cover_path, start_time, status, host_id, host:profiles(display_name)",
      )
      .eq("id", id)
      .maybeSingle<SessionDetailRow>(),
    supabase
      .from("session_lots")
      .select(
        /* ::text on both sar_amount columns — same transport rule as every
         * other money read (§4.7). The embedded auction row carries NO money
         * column on purpose: price and history are read live by auction id. */
        "position, name, image_path, starting_price::text, bid_increment::text, duration_seconds, auction_id, auction:auctions(status, end_time)",
      )
      .eq("session_id", id)
      .order("position", { ascending: true })
      .returns<LotRow[]>(),
  ]);

  if (sessionRes.error || !sessionRes.data || lotsRes.error) return null;
  const row = sessionRes.data;

  const lots: SessionLot[] = (lotsRes.data ?? []).map((l) => ({
    position: l.position,
    name: l.name,
    imageUrl: publicImageUrl(supabase, l.image_path),
    startingPrice: sar(l.starting_price),
    bidIncrement: sar(l.bid_increment),
    durationSeconds: l.duration_seconds,
    auctionId: l.auction_id,
    auctionStatus: l.auction?.status ?? null,
    auctionEndTime: l.auction?.end_time ?? null,
  }));

  /* The lot on stage: opened, stored-active, and unexpired against the same
   * server clock the page hands its countdowns. Display only — eligibility
   * stays the database's decision (LC-03). */
  const currentLot =
    lots.find(
      (l) =>
        l.auctionId !== null &&
        l.auctionStatus === "active" &&
        l.auctionEndTime !== null &&
        Date.parse(l.auctionEndTime) > Date.parse(serverNow),
    ) ?? null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    city: row.city,
    coverUrl: row.cover_path ? publicImageUrl(supabase, row.cover_path) : undefined,
    startTime: row.start_time,
    status: row.status,
    hostId: row.host_id,
    hostName: row.host?.display_name ?? "",
    lots,
    currentLot,
    serverNow,
  };
});
