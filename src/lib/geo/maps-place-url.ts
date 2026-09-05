/**
 * Parse google.com/maps/place/... URLs into Place ID / name / coords.
 * Short links (maps.app.goo.gl) are intentionally unsupported.
 */

export interface ParsedMapsPlaceUrl {
  placeId: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
}

function looksLikeGoogleMapsHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "google.com" ||
    h === "www.google.com" ||
    h.endsWith(".google.com") ||
    h === "maps.google.com"
  );
}

/** ChIJ… Place IDs as they appear in Maps / Places API (New). */
const PLACE_ID_RE = /ChIJ[A-Za-z0-9_-]{10,}/;

export function parseGoogleMapsPlaceUrl(
  raw: string,
): ParsedMapsPlaceUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!looksLikeGoogleMapsHost(url.hostname)) return null;
  if (!url.pathname.includes("/maps/place")) return null;

  const fromQuery =
    url.searchParams.get("query_place_id") ??
    url.searchParams.get("place_id");
  const fromBody = trimmed.match(PLACE_ID_RE)?.[0] ?? null;
  const placeId = fromQuery && PLACE_ID_RE.test(fromQuery) ? fromQuery : fromBody;

  let name: string | null = null;
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
