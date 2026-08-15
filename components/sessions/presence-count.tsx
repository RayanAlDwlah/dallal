"use client";

import { useMemo } from "react";

import { usePresenceCount } from "@/lib/sessions/use-presence";
import { createClient } from "@/lib/supabase/client";

/**
 * «N حاضر» on a session card. Reads the room's presence without joining it —
 * looking at a card is not being in the hall.
 */
export function PresenceCount({ sessionId }: { sessionId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const count = usePresenceCount(supabase, sessionId, false);

  return (
    <span className="num" suppressHydrationWarning>
      {count === null ? "—" : count} حاضر
    </span>
  );
}
