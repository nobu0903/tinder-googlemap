/**
 * Places photo URL helpers.
 * DB may store keyless Google media URLs (or legacy keyed URLs).
 * Clients always receive same-origin `/api/photo` URLs — never the API key.
 */

const PLACES_HOST = "places.googleapis.com";

/** Extract `places/.../photos/...` resource name from stored URL, proxy URL, or raw name. */
export function extractPlacesPhotoName(urlOrName: string): string | null {
  const trimmed = urlOrName.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("places/") &&
    trimmed.includes("/photos/") &&
    !trimmed.includes("://")
  ) {
    return trimmed.split("?")[0] ?? null;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.pathname === "/api/photo" || parsed.pathname.endsWith("/api/photo")) {
      const name = parsed.searchParams.get("name");
      return name && name.length > 0 ? name : null;
    }

    if (parsed.hostname === PLACES_HOST) {
      const match = parsed.pathname.match(/^\/v1\/(.+)\/media\/?$/);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
  } catch {
    return null;
  }

  return null;
}

/** Remove `key` query param from any URL (legacy DB rows). */
export function stripPhotoApiKey(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("key")) return url;
    parsed.searchParams.delete("key");
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Client-facing photo URL (same-origin proxy). Never includes GOOGLE_PLACES_API_KEY.
 * Non-Places URLs are returned key-stripped as a safe fallback.
 * Default width matches swipe card display (~480), not the old 800px Google default.
 */
export function toClientPhotoUrl(
  storedUrlOrName: string,
  maxWidthPx = 480,
): string {
  const name = extractPlacesPhotoName(storedUrlOrName);
  if (!name) return stripPhotoApiKey(storedUrlOrName);

  const params = new URLSearchParams({
    name,
    maxWidthPx: String(Math.min(Math.max(maxWidthPx, 1), 4800)),
  });
  return `/api/photo?${params.toString()}`;
}

/**
 * Rewrite maxWidthPx on proxy or Places media URLs.
 * Prefer converting Places/legacy URLs to the client proxy.
 */
export function withPhotoMaxWidth(url: string, maxWidthPx: number): string {
  const name = extractPlacesPhotoName(url);
  if (name) return toClientPhotoUrl(name, maxWidthPx);

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("maxWidthPx")) return stripPhotoApiKey(url);
    parsed.searchParams.set("maxWidthPx", String(maxWidthPx));
    parsed.searchParams.delete("key");
    return parsed.toString();
  } catch {
    return url;
  }
}
