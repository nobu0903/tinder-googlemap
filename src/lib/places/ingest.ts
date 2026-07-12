// Google Places API (New) → Supabase ingestion pipeline.
// Cache-first: searchNearby only when needed; Place Details for photo hydration.

import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  GooglePlacesPlace,
  SpotPhoto,
  OpeningHours,
  SpotRow,
} from "@/types/backend";
import {
  MAX_STORED_PHOTOS,
} from "@/types/backend";
import {
  isDiningPlace,
  isDiningSpotRow,
} from "@/lib/places/dining-filter";
import { CHAIN_PRIMARY_TYPES } from "@/lib/places/chain-filter";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const CACHE_TTL_DAYS = 7;
const MIN_CACHED_SPOTS = 20;

/** Chain-heavy types + top-level lodging types for searchNearby (Table A only) */
const EXCLUDED_PRIMARY_TYPES = [
  ...Array.from(CHAIN_PRIMARY_TYPES),
  "lodging",
  "hotel",
];

const INCLUDED_NEARBY_TYPES = ["restaurant", "cafe"];

const NEARBY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.types",
  "places.photos",
  "places.currentOpeningHours",
  "places.location",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryType",
  "types",
  "photos",
  "currentOpeningHours",
  "location",
].join(",");

// ── Helpers ───────────────────────────────────────────────────────────────────

export function staleThresholdIso(): string {
  return new Date(
    Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export function isCacheFresh(updatedAt: string): boolean {
  return updatedAt > staleThresholdIso();
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY env var.");
  return apiKey;
}

function toPlaceResourceId(id: string): string {
  return id.startsWith("places/") ? id.slice("places/".length) : id;
}

/** Google Places (New) returns priceLevel as an enum string — map to 0–4 for DB storage. */
function normalizePriceLevel(raw: number | string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return raw;

  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[raw] ?? null;
}

/** Build a served photo URL from a Google Places photo resource name. */
function buildPhotoUrl(photoName: string, maxWidth = 800): string {
  return `${GOOGLE_PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
}

function mapPhotosFromPlace(
  place: GooglePlacesPlace,
  limit = MAX_STORED_PHOTOS,
): SpotPhoto[] {
  return (
    place.photos?.slice(0, limit).map((p) => ({
      url: buildPhotoUrl(p.name),
      width: p.widthPx,
      height: p.heightPx,
    })) ?? []
  );
}

/** Derive a rough vibe_tags list from price level and opening hours. */
function deriveVibeTags(place: GooglePlacesPlace): string[] {
  const tags: string[] = [];
  const priceLevel = normalizePriceLevel(place.priceLevel);

  if (priceLevel !== null) {
    if (priceLevel <= 1) tags.push("budget-eat");
    if (priceLevel >= 3) tags.push("splurge");
  }

  if (place.rating !== undefined) {
    if (place.rating >= 4.5) tags.push("top-rated");
  }

  const periods = place.currentOpeningHours?.periods ?? [];
  const hasLateNight = periods.some(
    (p) => p.close && (p.close.hour >= 22 || p.close.hour <= 2),
  );
  if (hasLateNight) tags.push("late-night");

  return tags;
}

function mapOpeningHours(
  place: GooglePlacesPlace,
): OpeningHours | null {
  if (!place.currentOpeningHours) return null;
  return {
    openNow: place.currentOpeningHours.openNow,
    periods: place.currentOpeningHours.periods,
    weekdayDescriptions: place.currentOpeningHours.weekdayDescriptions,
  };
}

/** Map a raw Google Places result to a SpotRow ready for upsert. */
export function mapPlaceToRow(
  place: GooglePlacesPlace,
  existing?: Partial<SpotRow>,
): SpotRow {
  const photos = mapPhotosFromPlace(place);

  return {
    id: place.id,
    name: place.displayName.text,
    rating: place.rating ?? null,
    user_rating_count: place.userRatingCount ?? null,
    price_level: normalizePriceLevel(place.priceLevel),
    lat: place.location?.latitude ?? existing?.lat ?? 0,
    lng: place.location?.longitude ?? existing?.lng ?? 0,
    address: place.formattedAddress ?? existing?.address ?? null,
    photos,
    opening_hours: mapOpeningHours(place) ?? existing?.opening_hours ?? null,
    primary_type: place.primaryType ?? existing?.primary_type ?? null,
    vibe_tags: (() => {
      const tags = deriveVibeTags(place);
      return tags.length ? tags : (existing?.vibe_tags ?? []);
    })(),
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function photoCount(row: SpotRow | null | undefined): number {
  return row?.photos?.length ?? 0;
}

function needsDetailsEnrichment(
  row: SpotRow | null,
  forceIfSparse: boolean,
): boolean {
  if (!forceIfSparse) return false;
  if (photoCount(row) >= MAX_STORED_PHOTOS) return false;
  if (!row) return true;
  // Full photo quota met on a fresh row — skip
  if (isCacheFresh(row.updated_at) && photoCount(row) >= MAX_STORED_PHOTOS) {
    return false;
  }
  // Sparse rows (< 10 photos): enrich even on fresh cache (legacy 5-photo data)
  if (photoCount(row) < MAX_STORED_PHOTOS) return true;
  return !isCacheFresh(row.updated_at);
}

// ── Google API calls ──────────────────────────────────────────────────────────

async function fetchPlaceDetails(placeId: string): Promise<GooglePlacesPlace | null> {
  const resourceId = toPlaceResourceId(placeId);
  const res = await fetch(`${GOOGLE_PLACES_BASE}/places/${resourceId}`, {
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.warn(
      `[ingest] Place Details failed for ${placeId}: ${res.status}`,
    );
    return null;
  }

  return (await res.json()) as GooglePlacesPlace;
}

async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<GooglePlacesPlace[]> {
  const body = {
    includedTypes: INCLUDED_NEARBY_TYPES,
    excludedTypes: ["lodging"],
    excludedPrimaryTypes: EXCLUDED_PRIMARY_TYPES,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
  };

  const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": NEARBY_FIELD_MASK,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.places ?? []) as GooglePlacesPlace[];
}

// ── Enrichment ────────────────────────────────────────────────────────────────

/**
 * Hydrate a single spot via Place Details when cache is missing/stale and
 * fewer than MAX_STORED_PHOTOS photos are stored.
 */
export async function enrichSpotFromDetails(
  spotId: string,
  cachedRow?: SpotRow | null,
): Promise<SpotRow | null> {
  if (!needsDetailsEnrichment(cachedRow ?? null, true)) {
    return cachedRow ?? null;
  }

  const details = await fetchPlaceDetails(spotId);
  if (!details) return cachedRow ?? null;

  const enriched = mapPlaceToRow(details, cachedRow ?? undefined);
  if (!isDiningPlace(details) && !isDiningSpotRow(enriched)) {
    return null;
  }

  const { error } = await supabaseAdmin
    .from("spots")
    .upsert(enriched, { onConflict: "id" });

  if (error) {
    console.warn(`[ingest] Details upsert failed for ${spotId}: ${error.message}`);
    return cachedRow ?? null;
  }

  return enriched;
}

/**
 * Enrich feed spots that still have sparse photos after cache lookup.
 * Runs Details only for stale/missing rows — max once per spot per 7 days.
 */
export async function hydrateFeedSpots(rows: SpotRow[]): Promise<SpotRow[]> {
  const results = await Promise.all(
    rows.map(async (row) => {
      if (photoCount(row) >= MAX_STORED_PHOTOS) return row;

      const { data: cached } = await supabaseAdmin
        .from("spots")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();

      const source = (cached as SpotRow | null) ?? row;
      if (!needsDetailsEnrichment(source, true)) return source;

      const enriched = await enrichSpotFromDetails(row.id, source);
      return enriched ?? source;
    }),
  );

  return results;
}

// ── Cache counting ────────────────────────────────────────────────────────────

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function boundingBox(
  lat: number,
  lng: number,
  radiusM: number,
): BoundingBox {
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** Count fresh, un-swiped spots in the bounding box. */
export async function countAvailableSpots(
  box: BoundingBox,
  excludedIds: string[],
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("spots")
    .select("id")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .gt("updated_at", staleThresholdIso());

  return (data ?? []).filter((row) => !excludedIds.includes(row.id)).length;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface IngestOptions {
  lat: number;
  lng: number;
  radiusMeters: number;
  excludedIds?: string[];
  /** When true, always call searchNearby (used on 5 km / 10 km expansion steps) */
  forceFetch?: boolean;
}

/**
 * Ensure the Supabase cache is populated for the given radius.
 * Calls searchNearby ONLY when fewer than 20 fresh un-swiped spots exist.
 * Sparse photo rows are hydrated via Place Details before upsert.
 */
export async function ensureSpotsCached(opts: IngestOptions): Promise<number> {
  const { lat, lng, radiusMeters, excludedIds = [], forceFetch = false } = opts;
  const box = boundingBox(lat, lng, radiusMeters);

  const available = await countAvailableSpots(box, excludedIds);
  if (!forceFetch && available >= MIN_CACHED_SPOTS) return 0;

  const places = await fetchNearbyPlaces(lat, lng, radiusMeters);
  const diningPlaces = places.filter(isDiningPlace);
  if (diningPlaces.length === 0) return 0;

  const rows: SpotRow[] = [];

  for (const place of diningPlaces) {
    const nearbyPhotos = place.photos?.length ?? 0;
    let row = mapPlaceToRow(place);

    if (nearbyPhotos < MAX_STORED_PHOTOS) {
      const { data: existing } = await supabaseAdmin
        .from("spots")
        .select("*")
        .eq("id", place.id)
        .maybeSingle();

      const cached = existing as SpotRow | null;

      if (needsDetailsEnrichment(cached, true)) {
        const details = await fetchPlaceDetails(place.id);
        if (details) {
          row = mapPlaceToRow(details, cached ?? row);
        }
      } else if (cached) {
        row = cached;
      }
    }

    rows.push(row);
  }

  const { error } = await supabaseAdmin
    .from("spots")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);

  return rows.length;
}
