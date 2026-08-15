"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * V2 — the host's two controls, both thin transports: the RPCs are host-only
 * and atomic INSIDE the database (session_open_lot / session_end take the
 * session row lock and re-verify auth.uid() themselves). Rendering the button
 * only for the host is an affordance; these functions are not the gate.
 */
export async function openNextLotAction(sessionId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("session_open_lot", { p_session_id: sessionId });
  /* Whatever the verdict, re-render the hall: on ok the stage fills; on
   * lot_still_open the still-running lot IS the explanation on screen. */
  revalidatePath(`/s/${sessionId}`);
}

export async function endSessionAction(sessionId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("session_end", { p_session_id: sessionId });
  revalidatePath(`/s/${sessionId}`);
}
