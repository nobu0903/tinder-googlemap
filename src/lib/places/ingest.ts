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
  MIN_PHOTOS_SKIP_DETAILS,
} from "@/types/backend";
import {
  isDiningPlace,
  isDiningSpotRow,
} from "@/lib/places/dining-filter";
import { CHAIN_PRIMARY_TYPES } from "@/lib/places/chain-filter";
import {
  ingestAreaKey,
  isIngestOnCooldown,
  markIngestCompleted,
} from "@/lib/places/ingest-cooldown";
import { DEFAULT_FEED_CONFIG } from "@/lib/feed/config";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const CACHE_TTL_DAYS = 14;
/** Minimum review count to cache — matches feed noise floor (60) */
const MIN_CACHE_REVIEW_COUNT = DEFAULT_FEED_CONFIG.vibeMinReviews;
const MIN_CACHED_SPOTS = 20;
/** Minimum vibe-range spots in cache before skipping supplemental ingest */
const MIN_VIBE_CACHED_SPOTS = 15;
/** Production: skip repeat nearby ingest if box had any upsert within this window */
const PRODUCTION_INGEST_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Chain-heavy types + top-level lodging types for searchNearby (Table A only) */
const EXCLUDED_PRIMARY_TYPES = [
  ...Array.from(CHAIN_PRIMARY_TYPES),
  "lodging",
  "hotel",
];

/** Admin: full multi-type discovery */
const ADMIN_NEARBY_TYPES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "meal_takeaway",
];

/** Production: combined nearby types — no Text Search */
const PRODUCTION_NEARBY_TYPES = ["restaurant", "cafe", "bar"];

/** Text queries with DISTANCE ranking (admin only) */
const TEXT_SEARCH_QUERIES = ["restaurant", "cafe", "bar"];

export type IngestProfile = "production" | "admin";

export interface IngestApiCalls {
  nearbySearch: number;
  textSearch: number;
  placeDetails: number;
}

export const EMPTY_INGEST_API_CALLS: IngestApiCalls = {
  nearbySearch: 0,
  textSearch: 0,
  placeDetails: 0,
};

/** Lean search mask — no opening hours / types (lower SKU than full Pro fields) */
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.photos",
  "places.location",
].join(",");

/** Full details when metadata is missing */
const DETAILS_FULL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryType",
  "photos",
  "currentOpeningHours",
  "location",
].join(",");

/** Photos-only details — cheapest refresh when search already cached metadata */
const DETAILS_PHOTOS_FIELD_MASK = "id,photos";

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
  if (!row) return true;
  if (photoCount(row) >= MIN_PHOTOS_SKIP_DETAILS) return false;
  return true;
}

function detailsFieldMask(row: SpotRow | null): string {
  if (row?.name && row.lat && row.lng) {
    return DETAILS_PHOTOS_FIELD_MASK;
  }
  return DETAILS_FULL_FIELD_MASK;
}

// ── Google API calls ──────────────────────────────────────────────────────────

async function fetchPlaceDetails(
  placeId: string,
  fieldMask: string = DETAILS_FULL_FIELD_MASK,
): Promise<GooglePlacesPlace | null> {
  const resourceId = toPlaceResourceId(placeId);
  const res = await fetch(`${GOOGLE_PLACES_BASE}/places/${resourceId}`, {
    headers: {
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": fieldMask,
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

async function fetchNearbyPlacesByType(
  lat: number,
  lng: number,
  radiusMeters: number,
  includedType: string,
): Promise<GooglePlacesPlace[]> {
  const body = {
    includedTypes: [includedType],
    excludedTypes: ["lodging"],
    excludedPrimaryTypes: EXCLUDED_PRIMARY_TYPES,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusMeters, 50_000),
      },
    },
  };

  const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `[ingest] searchNearby(${includedType}) failed ${res.status}: ${text}`,
    );
    return [];
  }

  const data = await res.json();
  return (data.places ?? []) as GooglePlacesPlace[];
}

/** Single nearby request with multiple types — 1 API call instead of N */
async function fetchNearbyPlacesCombined(
  lat: number,
  lng: number,
  radiusMeters: number,
  includedTypes: string[],
): Promise<GooglePlacesPlace[]> {
  const body = {
    includedTypes,
    excludedTypes: ["lodging"],
    excludedPrimaryTypes: EXCLUDED_PRIMARY_TYPES,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusMeters, 50_000),
      },
    },
  };

  const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `[ingest] searchNearby(combined) failed ${res.status}: ${text}`,
    );
    return [];
  }

  const data = await res.json();
  return (data.places ?? []) as GooglePlacesPlace[];
}

async function fetchTextSearchPlaces(
  lat: number,
  lng: number,
  radiusMeters: number,
  textQuery: string,
): Promise<GooglePlacesPlace[]> {
  const box = boundingBox(lat, lng, radiusMeters);
  const body = {
    textQuery,
    pageSize: 20,
    rankPreference: "DISTANCE",
    locationRestriction: {
      rectangle: {
        low: { latitude: box.minLat, longitude: box.minLng },
        high: { latitude: box.maxLat, longitude: box.maxLng },
      },
    },
  };

  const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `[ingest] searchText("${textQuery}") failed ${res.status}: ${text}`,
    );
    return [];
  }

  const data = await res.json();
  return (data.places ?? []) as GooglePlacesPlace[];
}

function mergeUniquePlaces(batches: GooglePlacesPlace[][]): GooglePlacesPlace[] {
  const seen = new Set<string>();
  const out: GooglePlacesPlace[] = [];
  for (const batch of batches) {
    for (const place of batch) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      out.push(place);
    }
  }
  return out;
}

/**
 * Multi-strategy discovery: per-type nearby + optional distance-ranked text search.
 * Google searchNearby returns prominence-biased results; combining strategies
 * surfaces more vibe-range (60–499 review) spots in tourist areas.
 */
async function discoverDiversePlaces(
  lat: number,
  lng: number,
  radiusMeters: number,
  options: {
    nearbyTypes: string[];
    textSearch: boolean;
    combinedNearby: boolean;
    apiCalls: IngestApiCalls;
  },
): Promise<GooglePlacesPlace[]> {
  let nearbyBatches: GooglePlacesPlace[][];

  if (options.combinedNearby) {
    options.apiCalls.nearbySearch += 1;
    nearbyBatches = [
      await fetchNearbyPlacesCombined(lat, lng, radiusMeters, options.nearbyTypes),
    ];
  } else {
    nearbyBatches = await Promise.all(
      options.nearbyTypes.map(async (type) => {
        options.apiCalls.nearbySearch += 1;
        return fetchNearbyPlacesByType(lat, lng, radiusMeters, type);
      }),
    );
  }

  const textBatches: GooglePlacesPlace[][] = [];
  if (options.textSearch) {
    for (const query of TEXT_SEARCH_QUERIES) {
      options.apiCalls.textSearch += 1;
      textBatches.push(await fetchTextSearchPlaces(lat, lng, radiusMeters, query));
    }
  }

  return mergeUniquePlaces([...nearbyBatches, ...textBatches]);
}

// ── Enrichment ────────────────────────────────────────────────────────────────

/**
 * Hydrate a single spot via Place Details when cache is missing/stale and
 * fewer than MAX_STORED_PHOTOS photos are stored.
 */
export async function enrichSpotFromDetails(
  spotId: string,
  cachedRow?: SpotRow | null,
  apiCalls?: IngestApiCalls,
): Promise<SpotRow | null> {
  if (!needsDetailsEnrichment(cachedRow ?? null, true)) {
    return cachedRow ?? null;
  }

  if (apiCalls) apiCalls.placeDetails += 1;
  const details = await fetchPlaceDetails(
    spotId,
    detailsFieldMask(cachedRow ?? null),
  );
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

export interface HydrateFeedOptions {
  /** Cap Place Details calls per batch — 0 skips server-side hydrate entirely */
  maxDetailsCalls?: number;
}

/**
 * Enrich feed spots that still have sparse photos after cache lookup.
 * Sequential + capped to control burst billing.
 */
export async function hydrateFeedSpots(
  rows: SpotRow[],
  apiCalls?: IngestApiCalls,
  options?: HydrateFeedOptions,
): Promise<SpotRow[]> {
  const maxDetails = options?.maxDetailsCalls ?? rows.length;
  if (maxDetails <= 0) return rows;

  const results: SpotRow[] = [];
  let detailsUsed = 0;

  for (const row of rows) {
    if (photoCount(row) >= MIN_PHOTOS_SKIP_DETAILS) {
      results.push(row);
      continue;
    }

    const { data: cached } = await supabaseAdmin
      .from("spots")
      .select("*")
      .eq("id", row.id)
      .maybeSingle();

    const source = (cached as SpotRow | null) ?? row;
    if (!needsDetailsEnrichment(source, true)) {
      results.push(source);
      continue;
    }

    if (detailsUsed >= maxDetails) {
      results.push(source);
      continue;
    }

    const enriched = await enrichSpotFromDetails(row.id, source, apiCalls);
    detailsUsed += 1;
    results.push(enriched ?? source);
  }

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

/** True when any spot in the box was written recently (DB-backed ingest cooldown). */
async function hadRecentIngestInBox(box: BoundingBox): Promise<boolean> {
  const since = new Date(Date.now() - PRODUCTION_INGEST_COOLDOWN_MS).toISOString();
  const { data } = await supabaseAdmin
    .from("spots")
    .select("id")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .gt("updated_at", since)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/** Count fresh vibe-range spots in the bounding box. */
export async function countVibeSpotsInBox(
  box: BoundingBox,
  vibeMin: number,
  vibeMax: number,
  excludedIds: string[],
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("spots")
    .select("id")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .gte("user_rating_count", vibeMin)
    .lte("user_rating_count", vibeMax)
    .gt("updated_at", staleThresholdIso());

  return (data ?? []).filter((row) => !excludedIds.includes(row.id)).length;
}

function meetsCacheReviewFloor(place: GooglePlacesPlace): boolean {
  const count = place.userRatingCount;
  return count !== undefined && count !== null && count >= MIN_CACHE_REVIEW_COUNT;
}

async function upsertPlacesFromGoogle(
  places: GooglePlacesPlace[],
): Promise<number> {
  const diningPlaces = places.filter(
    (place) => isDiningPlace(place) && meetsCacheReviewFloor(place),
  );
  if (diningPlaces.length === 0) return 0;

  const rows: SpotRow[] = diningPlaces.map((place) => mapPlaceToRow(place));

  const { error } = await supabaseAdmin
    .from("spots")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);

  return rows.length;
}

export interface IngestResult {
  ingested: number;
  apiCalls: IngestApiCalls;
  skippedReason?: "cooldown" | "sufficient_cache";
}

export interface IngestOptions {
  lat: number;
  lng: number;
  radiusMeters: number;
  excludedIds?: string[];
  /** When true, bypass cache/cooldown checks and run discovery */
  forceFetch?: boolean;
  /** Admin uses full discovery; production uses lighter nearby-only */
  ingestProfile?: IngestProfile;
  /** Skip cooldown (admin force ingest) */
  bypassCooldown?: boolean;
  vibeMinReviews?: number;
  vibeMaxReviews?: number;
  minVibeSpots?: number;
}

/**
 * Ensure the Supabase cache is populated for the given radius.
 * Production: 1× combined nearby, no text search, lazy client hydrate for photos.
 * Admin: 5× nearby + text search when vibe spots are scarce.
 */
export async function ensureSpotsCached(opts: IngestOptions): Promise<IngestResult> {
  const {
    lat,
    lng,
    radiusMeters,
    forceFetch = false,
    ingestProfile = "production",
    bypassCooldown = false,
    vibeMinReviews = 60,
    vibeMaxReviews = 499,
    minVibeSpots = MIN_VIBE_CACHED_SPOTS,
  } = opts;
  const apiCalls: IngestApiCalls = { ...EMPTY_INGEST_API_CALLS };
  const box = boundingBox(lat, lng, radiusMeters);

  // Ingest thresholds use global cache — not per-user excludeIds
  const available = await countAvailableSpots(box, []);
  const vibeAvailable = await countVibeSpotsInBox(
    box,
    vibeMinReviews,
    vibeMaxReviews,
    [],
  );

  const needsPrimary = available < MIN_CACHED_SPOTS;
  const needsVibeDiversity =
    ingestProfile === "admin" && vibeAvailable < minVibeSpots;

  if (!forceFetch && !needsPrimary && !needsVibeDiversity) {
    return { ingested: 0, apiCalls, skippedReason: "sufficient_cache" };
  }

  const areaKey = ingestAreaKey(lat, lng, radiusMeters);

  // Production: in-memory + DB cooldown — serverless-safe guard against ingest loops
  if (ingestProfile === "production" && !forceFetch) {
    if (isIngestOnCooldown(areaKey)) {
      return { ingested: 0, apiCalls, skippedReason: "cooldown" };
    }
    if (await hadRecentIngestInBox(box)) {
      markIngestCompleted(areaKey);
      return { ingested: 0, apiCalls, skippedReason: "cooldown" };
    }
  }

  const vibeOnlyRefresh = needsVibeDiversity && !needsPrimary;
  const useTextSearch =
    ingestProfile === "admin" && (needsVibeDiversity || forceFetch);

  // Cooldown blocks expensive admin supplemental fetches, not production nearby-only
  if (
    !bypassCooldown &&
    !forceFetch &&
    vibeOnlyRefresh &&
    useTextSearch &&
    isIngestOnCooldown(areaKey)
  ) {
    return { ingested: 0, apiCalls, skippedReason: "cooldown" };
  }

  const nearbyTypes =
    ingestProfile === "admin" ? ADMIN_NEARBY_TYPES : PRODUCTION_NEARBY_TYPES;

  const places = await discoverDiversePlaces(lat, lng, radiusMeters, {
    nearbyTypes,
    textSearch: useTextSearch,
    combinedNearby: ingestProfile === "production",
    apiCalls,
  });

  if (places.length === 0) {
    return { ingested: 0, apiCalls };
  }

  const ingested = await upsertPlacesFromGoogle(places);
  markIngestCompleted(areaKey);

  return { ingested, apiCalls };
}
