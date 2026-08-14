import { createClient } from "@/lib/supabase/server";

import { IMAGE_BUCKET } from "./validation";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The public URL for a stored auction image, or undefined so ImageFrame renders
 * its placeholder (EC-18).
 *
 * FR-CREATE-20 — the bucket is public, so this is a plain URL and needs no
 * signing and no credential. Built through the SDK rather than by concatenating
 * the project URL, so the object-path shape lives in one place.
 *
 * Lifted out of listing.ts unchanged when AUC-11 needed the same URL on the
 * detail page. One image path must resolve to one URL on both surfaces, and two
 * copies of three lines is how that stops being true.
 */
export function publicImageUrl(
  supabase: SupabaseClient,
  path: string,
): string | undefined {
  if (!path) return undefined;
  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl || undefined;
}
