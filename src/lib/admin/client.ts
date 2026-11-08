import { ADMIN_PASSKEY_HEADER } from "@/lib/admin/constants";
import { supabase } from "@/lib/supabase/client";

type AdminFetchInit = RequestInit & { skipPasskey?: boolean };

async function browserAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function operationNeedsPasskey(url: string, skipPasskey: boolean): boolean {
  if (skipPasskey || process.env.NODE_ENV !== "production") return false;
  return (
    !url.includes("/api/admin/session") && !url.includes("/api/admin/passkey/")
  );
}

/** Fetch admin APIs. Production sends the Google access token and a one-time passkey assertion. */
export async function adminFetch(url: string, init?: AdminFetchInit) {
  const { skipPasskey = false, ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  headers.set("Content-Type", "application/json");

  const token = await browserAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (operationNeedsPasskey(url, skipPasskey)) {
    const { collectPasskeyHeader } = await import("@/lib/admin/passkey-browser");
    headers.set(ADMIN_PASSKEY_HEADER, await collectPasskeyHeader());
  }

  const res = await fetch(url, {
    ...rest,
    credentials: "include",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data;
}
