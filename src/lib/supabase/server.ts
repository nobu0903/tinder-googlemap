// Server-side Supabase admin client (use in API Routes / Server Actions only).
// Uses the service role key — this file must NEVER be imported on the client.
//
// The client is created lazily so that the missing-env guard only fires at
// request time (not at Next.js static-analysis / build time).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }

  // Service role bypasses RLS — keep this strictly server-side.
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// Proxy object so callers can write `supabaseAdmin.from(...)` without worrying
// about the lazy initialisation.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
