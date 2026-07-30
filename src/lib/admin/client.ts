export const ADMIN_SECRET_KEY = "vibeloop_admin_secret";

export function adminHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const secret = sessionStorage.getItem(ADMIN_SECRET_KEY) ?? "";
  return secret ? { "X-Admin-Secret": secret } : {};
}

export async function adminFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data;
}
