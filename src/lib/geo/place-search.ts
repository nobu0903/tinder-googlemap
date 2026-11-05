export interface PlaceHit {
  lat: number;
  lng: number;
  label: string;
}

interface NominatimItem {
  lat?: unknown;
  lon?: unknown;
  name?: unknown;
  display_name?: unknown;
}

/** First Nominatim hit, or null when the payload has no usable point. */
export function firstPlaceHit(data: unknown): PlaceHit | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const item = data[0] as NominatimItem;
  const lat = typeof item.lat === "string" ? Number(item.lat) : Number.NaN;
  const lng = typeof item.lon === "string" ? Number(item.lon) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const name = typeof item.name === "string" ? item.name.trim() : "";
  const display =
    typeof item.display_name === "string" ? item.display_name.split(",")[0].trim() : "";
  const label = name || display;
  if (!label) return null;
  return { lat, lng, label };
}

export function nominatimSearchUrl(query: string): string {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "jp");
  return url.toString();
}
