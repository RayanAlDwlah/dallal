import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LOT_WITH_CATEGORY,
  SESSION_WITH_HOST,
  type LotWithCategory,
  type SessionEntry,
  type SessionWithHost,
} from "@/types/sessions";

export async function fetchSessions(
  supabase: SupabaseClient,
  opts: { statuses?: string[]; hostId?: string; limit?: number } = {},
): Promise<SessionWithHost[]> {
  let query = supabase
    .from("sessions")
    .select(SESSION_WITH_HOST)
    .order("start_time", { ascending: true })
    .limit(opts.limit ?? 40);

  query = query.in("status", opts.statuses ?? ["live", "scheduled"]);
  if (opts.hostId) query = query.eq("host_id", opts.hostId);

  const { data, error } = await query;
  if (error) return [];
  return data as unknown as SessionWithHost[];
}

export async function fetchSession(
  supabase: SupabaseClient,
  id: string,
): Promise<SessionWithHost | null> {
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_WITH_HOST)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as SessionWithHost) ?? null;
}

export async function fetchLots(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LotWithCategory[]> {
  const { data } = await supabase
    .from("session_lots")
    .select(LOT_WITH_CATEGORY)
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  return (data as unknown as LotWithCategory[]) ?? [];
}

export async function fetchEntries(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<SessionEntry[]> {
  const { data } = await supabase
    .from("session_entries")
    .select(
      "session_id, user_id, deposit_paid, approved, created_at, user:profiles!session_entries_user_id_fkey(id, display_name, avatar_url)",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return (data as unknown as SessionEntry[]) ?? [];
}

/*
 * There is deliberately no fetchAttendance() here. «حاضر» is who is in the
 * room right now, which no query can answer — it comes from Realtime Presence
 * (lib/sessions/use-presence.ts). session_entries answers a different
 * question, "who may bid", and is fetched by fetchEntries above.
 */
