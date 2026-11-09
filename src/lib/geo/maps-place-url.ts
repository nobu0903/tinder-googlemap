/**
 * Parse a Google Maps place link into Place ID / name / coords.
 * Web links use /maps/place/. The Maps app also shares /maps/search links
 * that carry query_place_id, google.co.jp place pages, and comgooglemaps://.
 * Short links are expanded before this parser runs.
 */

const PLACE_ID_RE = /ChIJ[A-Za-z0-9_-]{10,}/;

/** Pull the first Maps URL out of an app share that also includes the shop name. */
export function normalizeMapsAppUrl(raw: string): string {
  const trimmed = raw.trim();
  const found = trimmed.match(
    /https:\/\/\S+|comgooglemapsurl:\/\/\S+|comgooglemaps:\/\/\S+/i,
  );
  let token = (found?.[0] ?? trimmed).replace(/[)\].,。、」』>]+$/u, "");
  if (/^comgooglemapsurl:\/\//i.test(token)) {
    const rest = token.slice("comgooglemapsurl://".length);
    token = /^https?:\/\//i.test(rest) ? rest : `https://${rest}`;
  } else if (/^comgooglemaps:\/\//i.test(token)) {
    const rest = token.slice("comgooglemaps://".length);
    token = `https://maps.google.com/${rest.startsWith("?") ? rest : `?${rest}`}`;
  }
  return token;
}

function placeIdIn(value: string | null | undefined): string | null {
  return value?.match(PLACE_ID_RE)?.[0] ?? null;
}

export interface ParsedMapsPlaceUrl {
  placeId: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
}

function looksLikeGoogleMapsHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return (
    h === "google.com" ||
    h === "www.google.com" ||
    h.endsWith(".google.com") ||
    h === "maps.google.com" ||
    h === "google.co.jp" ||
    h === "www.google.co.jp" ||
    h === "maps.google.co.jp"
  );
}

export function parseGoogleMapsPlaceUrl(
  raw: string,
): ParsedMapsPlaceUrl | null {
  const trimmed = normalizeMapsAppUrl(raw);
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!looksLikeGoogleMapsHost(url.hostname)) return null;

  const queryPlaceId = placeIdIn(
    url.searchParams.get("query_place_id") ?? url.searchParams.get("place_id"),
  );
  const q = url.searchParams.get("q") ?? "";
  const qPlaceId = q.startsWith("place_id:") ? placeIdIn(q.slice("place_id:".length)) : null;
  const isPlacePath = url.pathname.includes("/maps/place");
  const placeId = queryPlaceId ?? qPlaceId ?? (isPlacePath ? placeIdIn(trimmed) : null);
  const isAppSearch = url.pathname.includes("/maps/search") && Boolean(queryPlaceId ?? qPlaceId);
  if (!isPlacePath && !isAppSearch && !qPlaceId) return null;

  let name: string | null = null;
  const queryName = url.searchParams.get("query");
  if (queryName && !queryName.startsWith("place_id:") && !/^-?\d+(?:\.\d+)?,-?\d+/.test(queryName)) {
    name = queryName;
  }
  const nameMatch = url.pathname.match(/\/maps\/place\/([^/]+)/);
  if (nameMatch?.[1]) {
    const decoded = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
    // Skip coordinate / data segments mistaken as the name
    if (
      !decoded.startsWith("@") &&
      !decoded.startsWith("data=") &&
      !PLACE_ID_RE.test(decoded)
    ) {
      name = decoded;
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;
  const atMatch = url.pathname.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  );
  if (atMatch) {
    lat = Number(atMatch[1]);
    lng = Number(atMatch[2]);
  } else {
    const markerMatch = trimmed.match(
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    );
    if (markerMatch) {
      lat = Number(markerMatch[1]);
      lng = Number(markerMatch[2]);
    }
  }

  if (
    (lat !== null && !Number.isFinite(lat)) ||
    (lng !== null && !Number.isFinite(lng))
  ) {
    lat = null;
    lng = null;
  }

  if (!placeId && !name && lat === null) return null;

  return { placeId, name, lat, lng };
}
