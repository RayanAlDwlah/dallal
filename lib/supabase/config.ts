/**
 * The only place the Supabase environment variables are read.
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately absent and must stay absent —
 * the application never needs an elevated credential: privileged writes go
 * through SECURITY DEFINER database functions instead.
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
