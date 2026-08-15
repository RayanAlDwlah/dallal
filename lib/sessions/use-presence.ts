"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/**
 * Live «حاضر» — how many people are in the room RIGHT NOW, from Supabase
 * Realtime Presence rather than a count of everyone who ever entered.
 *
 * Two things about this are deliberate:
 *
 * `track` is what separates being IN the room from LOOKING AT a card. The hall
 * tracks; the listing subscribes without tracking, so it reads the count of a
 * room it is not standing in. Without that split, browsing the sessions page
 * would make you present in every hall at once.
 *
 * The presence key is a random per-tab id and the payload is empty. Presence
 * state is visible to everyone on the channel, so keying it by user id would
 * publish an attendee list of internal identifiers to the room — and display
 * name is the only public identity this product has. The cost is that one
 * person with two tabs counts twice; the number is honest about being viewers
 * in the room, which is what the design's «38 حاضر» describes.
 *
 * Returns null until the first sync, so callers can show a placeholder rather
 * than a confident zero.
 */
export function usePresenceCount(
  supabase: SupabaseClient,
  sessionId: string,
  track: boolean,
): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const key = crypto.randomUUID();
    const channel = supabase.channel(`presence:session:${sessionId}`, {
      config: { presence: { key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && track) void channel.track({});
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, track]);

  return count;
}
