// Browser-side Supabase client (use in Client Components / hooks only).
// Uses the public anon key — never use the service role key here.
import { createClient } from "@supabase/supabase-js";

// Lazy initialisation — env check fires at first use, not at module load.
let _client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.",
    );
  }
  _client = createClient(url, key);
  return _client;
}

// Convenience export for direct use
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_t, prop) {
    const c = getSupabase();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
});
