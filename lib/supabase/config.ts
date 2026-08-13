/**
 * The only place the Supabase environment variables are read.
 *
 * docs/environment-contract.md fixes the two names. Reading them through one
 * function means a missing value fails loudly at the call site instead of
 * reaching Supabase as the string "undefined", which surfaces much later as an
 * unexplained network error.
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately absent and must stay absent — the
 * application is not supposed to need an elevated credential at all
 * (CLAUDE.md §6, ARCHITECTURE §17.3).
 */
export function publicSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set. " +
        "Copy .env.example to .env.local, or set them in Vercel for this environment.",
    );
  }

  return { url, anonKey };
}
