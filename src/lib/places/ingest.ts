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
import {
  ingestAreaKey,
  isIngestOnCooldown,
  markIngestCompleted,
} from "@/lib/places/ingest-cooldown";
import { DEFAULT_FEED_CONFIG } from "@/lib/feed/config";
import {
  DETAILS_FULL_FIELD_MASK,
  detailsFieldMask,
  isHoursUnavailableStub,
  needsDetailsEnrichment,
  stripHoursUnavailableStub,
} from "@/lib/places/enrichment-gate";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
/** Days before a cached spot is considered stale for freshness queries */
export const CACHE_TTL_DAYS = 30;
/** Minimum review count to cache — matches feed noise floor (60) */
const MIN_CACHE_REVIEW_COUNT = DEFAULT_FEED_CONFIG.vibeMinReviews;
const MIN_CACHED_SPOTS = 20;
/** Minimum vibe-range spots in cache before skipping supplemental ingest */
const MIN_VIBE_CACHED_SPOTS = 15;
/** Production: skip repeat nearby ingest if box had any upsert within this window */
const PRODUCTION_INGEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * When the area already has enough total spots but vibe (hidden-gem) count is low,
 * allow one DISTANCE Nearby refresh at most once per this window. Much shorter than
 * the full ingest cooldown so feeds don't stay stuck on the same famous-heavy cache.
 */
const VIBE_REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Chain-heavy types + top-level lodging types for searchNearby (Table A only) */
const EXCLUDED_PRIMARY_TYPES = [
  ...Array.from(CHAIN_PRIMARY_TYPES),
  "lodging",
  "hotel",
];

/**
 * Food & drink Table A types for searchNearby.
 * Broader than restaurant/cafe/bar alone — coffee_shop / bakery were previously missed.
 * (fast_food / hamburger / sandwich_shop still dropped later by chain-filter.)
 */
const FOOD_NEARBY_TYPES = [
  "restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "bakery",
  "meal_takeaway",
];

/** Admin: full multi-type discovery (same set; admin may split into per-type calls) */
const ADMIN_NEARBY_TYPES = [...FOOD_NEARBY_TYPES];

/** Production: combined nearby types — no Text Search */
const PRODUCTION_NEARBY_TYPES = [...FOOD_NEARBY_TYPES];

/** Text queries with DISTANCE ranking (admin only) */
const TEXT_SEARCH_QUERIES = [
  "restaurant",
  "cafe",
  "coffee shop",
  "bar",
  "bakery",
];

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

/** Nearby / Text Search field mask — includes address + weekly hours (pre–cost-cut design). */
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.photos",
  "places.currentOpeningHours",
  "places.location",
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

/**
 * Store a keyless Places media URL (resource identity + preferred width).
 * Clients never see this directly — APIs rewrite via `toClientPhotoUrl` → `/api/photo`.
 */
function buildPhotoUrl(photoName: string, maxWidth = 480): string {
  return `${GOOGLE_PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}`;
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

/** Derive vibe_tags from price, rating, type, and hours (best-effort). */
function deriveVibeTags(place: GooglePlacesPlace): string[] {
  const tags: string[] = [];
  const priceLevel = normalizePriceLevel(place.priceLevel);
  const primaryType = place.primaryType ?? "";

    if (priceLevel !== null) {
    if (priceLevel <= 1) tags.push("budget-eat");
    // Align with Explore THEME_TAG_MAP ("date-night" / "treat-yourself" → splurge)
    if (priceLevel >= 2) tags.push("splurge");
    if (priceLevel >= 2) tags.push("date");
  } else if (
    primaryType === "cafe" ||
    primaryType === "coffee_shop" ||
    primaryType === "bakery" ||
    primaryType === "meal_takeaway"
  ) {
    tags.push("budget-eat");
  }

  if (place.rating !== undefined && place.rating >= 4.2) {
    tags.push("top-rated");
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
  const searchedPhotos = mapPhotosFromPlace(place);
  // Search may return fewer/no photos; keep enriched/cached photos when empty.
  const photos =
    searchedPhotos.length > 0
      ? searchedPhotos
      : (existing?.photos ?? []);

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
    // Booking / affiliate fields (populated during Details enrichment)
    phone_number: place.nationalPhoneNumber ?? existing?.phone_number ?? null,
    reservation_uri: place.reservationUri ?? existing?.reservation_uri ?? null,
    hotpepper_url: existing?.hotpepper_url ?? null,
    booking_url: existing?.booking_url ?? null,
  };
}

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
    languageCode: "ja",
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
  rankPreference?: "POPULARITY" | "DISTANCE",
): Promise<GooglePlacesPlace[]> {
  const body: Record<string, unknown> = {
    includedTypes,
    excludedTypes: ["lodging"],
    excludedPrimaryTypes: EXCLUDED_PRIMARY_TYPES,
    maxResultCount: 20,
    languageCode: "ja",
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(radiusMeters, 50_000),
      },
    },
  };
  // DISTANCE surfaces nearer / less prominence-biased spots (better for gems)
  if (rankPreference) body.rankPreference = rankPreference;

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
 * surfaces more vibe-range (60–300 review) spots in tourist areas.
 */
async function discoverDiversePlaces(
  lat: number,
  lng: number,
  radiusMeters: number,
  options: {
    nearbyTypes: string[];
    textSearch: boolean;
    combinedNearby: boolean;
    /** Prefer DISTANCE when hunting for hidden gems */
    rankPreference?: "POPULARITY" | "DISTANCE";
    apiCalls: IngestApiCalls;
  },
): Promise<GooglePlacesPlace[]> {
  let nearbyBatches: GooglePlacesPlace[][];

  if (options.combinedNearby) {
    options.apiCalls.nearbySearch += 1;
    nearbyBatches = [
      await fetchNearbyPlacesCombined(
        lat,
        lng,
        radiusMeters,
        options.nearbyTypes,
        options.rankPreference,
      ),
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

// ── Affiliate booking resolution ──────────────────────────────────────────────

const HOTPEPPER_BASE = "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/";

/** Strip country code (+81) and non-digits to produce a 10-11 digit local number. */
function normalizePhoneNumber(raw: string): string {
  return raw
    .replace(/^\+81/, "0")   // +81 → leading 0
    .replace(/[^\d]/g, "");  // remove dashes, spaces, parens
}

/** Wrap a Hotpepper shop URL with the ValueCommerce affiliate link. */
function wrapWithValueCommerce(hotpepperUrl: string): string {
  const sid = process.env.VALUE_COMMERCE_SID ?? "";
  const pid = process.env.VALUE_COMMERCE_PID ?? "";
  if (!sid || !pid) return hotpepperUrl; // skip wrapping when keys not configured
  return (
    `https://ck.jp.ap.valuecommerce.com/servlet/referral` +
    `?sid=${encodeURIComponent(sid)}` +
    `&pid=${encodeURIComponent(pid)}` +
    `&vc_url=${encodeURIComponent(hotpepperUrl)}`
  );
}

interface HotpepperShop {
  id: string;
  name: string;
  urls: { pc: string };
}

interface HotpepperResponse {
  results: {
    shop?: HotpepperShop[];
  };
}

/**
 * Query the Hotpepper Gourmet API for a matching restaurant.
 * Strategy:
 *   1. If phone_number is available → exact tel lookup (highest confidence)
 *   2. Fallback: lat/lng range=1 (300 m) + name keyword → pick first result
 * Returns the raw Hotpepper shop URL, or null if no match.
 */
async function matchHotpepperShop(
  name: string,
  lat: number,
  lng: number,
  phoneNumber: string | null,
): Promise<string | null> {
  const apiKey = process.env.HOTPEPPER_API_KEY;
  if (!apiKey) return null;

  const tryFetch = async (params: Record<string, string>): Promise<HotpepperShop[]> => {
    const qs = new URLSearchParams({ key: apiKey, format: "json", count: "5", ...params });
    try {
      const res = await fetch(`${HOTPEPPER_BASE}?${qs.toString()}`, {
        next: { revalidate: 86400 }, // cache 24 h — Hotpepper data rarely changes daily
      });
      if (!res.ok) return [];
      const json = (await res.json()) as HotpepperResponse;
      return json.results.shop ?? [];
    } catch {
      return [];
    }
  };

  // Strategy 1: phone number exact match
  if (phoneNumber) {
    const tel = normalizePhoneNumber(phoneNumber);
    const shops = await tryFetch({ tel });
    if (shops.length > 0) return shops[0].urls.pc;
  }

  // Strategy 2: lat/lng proximity + name keyword
  const shops = await tryFetch({
    lat: String(lat),
    lng: String(lng),
    range: "1", // 300 m
    keyword: name,
  });

  // Fuzzy match: accept if shop name contains or is contained by spot name
  const normalise = (s: string) => s.replace(/\s|　/g, "").toLowerCase();
  const normName = normalise(name);
  const match = shops.find((s) => {
    const n = normalise(s.name);
    return n.includes(normName) || normName.includes(n);
  });

  return match ? match.urls.pc : null;
}

/**
 * Resolve the final booking_url using the 3-tier fallback chain.
 * Returns { hotpepperUrl, bookingUrl } — both may be null.
 * Tier 1: Hotpepper → ValueCommerce affiliate
 * Tier 2: Google reservationUri (no commission, preserves UX)
 * null: caller should surface the free Google Maps deep link instead
 */
async function resolveBookingUrl(
  row: SpotRow,
): Promise<{ hotpepperUrl: string | null; bookingUrl: string | null }> {
  // Tier 1
  const hotpepperRaw = await matchHotpepperShop(
    row.name,
    row.lat,
    row.lng,
    row.phone_number,
  );
  if (hotpepperRaw) {
    return {
      hotpepperUrl: hotpepperRaw,
      bookingUrl: wrapWithValueCommerce(hotpepperRaw),
    };
  }

  // Tier 2
  if (row.reservation_uri) {
    return { hotpepperUrl: null, bookingUrl: row.reservation_uri };
  }

  // Tier 3 — caller uses buildGoogleMapsPlaceUrl
  return { hotpepperUrl: null, bookingUrl: null };
}

// ── Enrichment ────────────────────────────────────────────────────────────────

/**
 * Hydrate a single spot via Place Details when photos are sparse and/or
 * the booking pipeline has not run yet (see enrichment-gate).
 */
export async function enrichSpotFromDetails(
  spotId: string,
  cachedRow?: SpotRow | null,
  apiCalls?: IngestApiCalls,
): Promise<SpotRow | null> {
  const cleanedCached = cachedRow
    ? {
        ...cachedRow,
        opening_hours: stripHoursUnavailableStub(cachedRow.opening_hours),
      }
    : null;

  if (!needsDetailsEnrichment(cleanedCached)) {
    return cachedRow ?? null;
  }

  if (apiCalls) apiCalls.placeDetails += 1;
  const details = await fetchPlaceDetails(
    spotId,
    detailsFieldMask(cleanedCached),
  );

  // Even if Details fails, Hotpepper can match on name/lat/lng from cache.
  if (!details) {
    if (
      cleanedCached &&
      cleanedCached.booking_url == null &&
      cleanedCached.hotpepper_url == null
    ) {
      const { hotpepperUrl, bookingUrl } =
        await resolveBookingUrl(cleanedCached);
      const fallback: SpotRow = {
        ...cleanedCached,
        hotpepper_url: hotpepperUrl ?? "",
        booking_url: bookingUrl,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin
        .from("spots")
        .upsert(fallback, { onConflict: "id" });
      if (error) {
        console.warn(
          `[ingest] Booking fallback upsert failed for ${spotId}: ${error.message}`,
        );
        return cachedRow ?? null;
      }
      return fallback;
    }
    return cachedRow ?? null;
  }

  const enriched = mapPlaceToRow(details, cleanedCached ?? undefined);
  if (!isDiningPlace(details) && !isDiningSpotRow(enriched)) {
    return null;
  }

  // Resolve affiliate booking URL (Hotpepper → ValueCommerce, Google Reserve, or null).
  // Only run when booking fields are not already filled to avoid redundant API calls.
  if (enriched.booking_url === null && enriched.hotpepper_url == null) {
    const { hotpepperUrl, bookingUrl } = await resolveBookingUrl(enriched);
    // "" = checked, no match — prevents infinite re-Details (do NOT stub opening_hours)
    enriched.hotpepper_url = hotpepperUrl ?? "";
    enriched.booking_url = bookingUrl;
  }

  // Clear legacy "Hours not available" stub if Google still gave us nothing useful
  if (isHoursUnavailableStub(enriched.opening_hours)) {
    enriched.opening_hours = null;
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
    const { data: cached } = await supabaseAdmin
      .from("spots")
      .select("*")
      .eq("id", row.id)
      .maybeSingle();

    const source = (cached as SpotRow | null) ?? row;
    if (!needsDetailsEnrichment(source)) {
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

/** Count vibe-range spots in the bounding box. */
export async function countVibeSpotsInBox(
  box: BoundingBox,
  vibeMin: number,
  vibeMax: number,
  excludedIds: string[],
  opts: { freshOnly?: boolean } = {},
): Promise<number> {
  const freshOnly = opts.freshOnly ?? true;
  let query = supabaseAdmin
    .from("spots")
    .select("id")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .gte("user_rating_count", vibeMin)
    .lte("user_rating_count", vibeMax);

  if (freshOnly) {
    query = query.gt("updated_at", staleThresholdIso());
  }

  const { data } = await query;
  return (data ?? []).filter((row) => !excludedIds.includes(row.id)).length;
}

/** DB-backed cooldown for gem-targeted refreshes (24h). */
async function hadRecentVibeRefreshInBox(
  box: BoundingBox,
  vibeMax: number,
): Promise<boolean> {
  const since = new Date(Date.now() - VIBE_REFRESH_COOLDOWN_MS).toISOString();
  const { data } = await supabaseAdmin
    .from("spots")
    .select("id")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .lte("user_rating_count", vibeMax)
    .gt("updated_at", since)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

function meetsCacheReviewFloor(place: GooglePlacesPlace): boolean {
  const count = place.userRatingCount;
  return count !== undefined && count !== null && count >= MIN_CACHE_REVIEW_COUNT;
}

function meetsReviewCeiling(
  place: GooglePlacesPlace,
  maxReviews: number | undefined,
): boolean {
  if (maxReviews === undefined) return true;
  const count = place.userRatingCount;
  if (count === undefined || count === null) return false;
  return count <= maxReviews;
}

async function upsertPlacesFromGoogle(
  places: GooglePlacesPlace[],
  opts: { maxReviews?: number } = {},
): Promise<number> {
  const diningPlaces = places.filter(
    (place) =>
      isDiningPlace(place) &&
      meetsCacheReviewFloor(place) &&
      meetsReviewCeiling(place, opts.maxReviews),
  );
  if (diningPlaces.length === 0) return 0;

  const ids = diningPlaces.map((p) => p.id);
  const { data: existingData, error: existingError } = await supabaseAdmin
    .from("spots")
    .select("*")
    .in("id", ids);

  if (existingError) {
    throw new Error(`Supabase select error: ${existingError.message}`);
  }

  const existingById = new Map(
    (existingData ?? []).map((row) => [row.id as string, row as SpotRow]),
  );

  // Merge with existing so Search (lean field mask) does not null out
  // booking_url / opening_hours / address / phone from Details enrichment.
  const rows: SpotRow[] = diningPlaces.map((place) =>
    mapPlaceToRow(place, existingById.get(place.id)),
  );

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
 *
 * Production:
 * - Cold area (<20 spots): 1× Nearby (7-day cooldown)
 * - Vibe-scarce area: 1× DISTANCE Nearby, save only ≤vibeMax reviews (24h cooldown)
 * Admin: per-type nearby + text search when vibe spots are scarce.
 */
export async function ensureSpotsCached(opts: IngestOptions): Promise<IngestResult> {
  const {
    lat,
    lng,
    radiusMeters,
    excludedIds = [],
    forceFetch = false,
    ingestProfile = "production",
    bypassCooldown = false,
    vibeMinReviews = 60,
    vibeMaxReviews = 300,
    minVibeSpots = MIN_VIBE_CACHED_SPOTS,
  } = opts;
  const apiCalls: IngestApiCalls = { ...EMPTY_INGEST_API_CALLS };
  const box = boundingBox(lat, lng, radiusMeters);

  const available = await countAvailableSpots(box, []);
  // Count all vibe rows (not only "fresh") so we don't re-hit Google every day
  // when gems already exist but are older than CACHE_TTL.
  const vibeAvailable = await countVibeSpotsInBox(
    box,
    vibeMinReviews,
    vibeMaxReviews,
    excludedIds,
    { freshOnly: false },
  );

  const needsPrimary = available < MIN_CACHED_SPOTS;
  // Production AND admin: refresh when hidden-gem inventory is thin
  const needsVibeDiversity = vibeAvailable < minVibeSpots;

  if (!forceFetch && !needsPrimary && !needsVibeDiversity) {
    return { ingested: 0, apiCalls, skippedReason: "sufficient_cache" };
  }

  const areaKey = ingestAreaKey(lat, lng, radiusMeters);
  const vibeAreaKey = `${areaKey}:vibe`;
  const vibeOnlyRefresh = needsVibeDiversity && !needsPrimary;

  if (!forceFetch && !bypassCooldown) {
    if (vibeOnlyRefresh) {
      // Short cooldown — unlock new gems without waiting a full week
      if (
        isIngestOnCooldown(vibeAreaKey) ||
        (await hadRecentVibeRefreshInBox(box, vibeMaxReviews))
      ) {
        markIngestCompleted(vibeAreaKey);
        return { ingested: 0, apiCalls, skippedReason: "cooldown" };
      }
    } else if (ingestProfile === "production" || needsPrimary) {
      if (isIngestOnCooldown(areaKey) || (await hadRecentIngestInBox(box))) {
        markIngestCompleted(areaKey);
        return { ingested: 0, apiCalls, skippedReason: "cooldown" };
      }
    }
  }

  const useTextSearch =
    ingestProfile === "admin" && (needsVibeDiversity || forceFetch);

  const nearbyTypes =
    ingestProfile === "admin" ? ADMIN_NEARBY_TYPES : PRODUCTION_NEARBY_TYPES;

  const places = await discoverDiversePlaces(lat, lng, radiusMeters, {
    nearbyTypes,
    textSearch: useTextSearch,
    combinedNearby: ingestProfile === "production",
    // Hunt nearer / less famous spots when topping up gems
    rankPreference: vibeOnlyRefresh || needsVibeDiversity ? "DISTANCE" : undefined,
    apiCalls,
  });

  if (places.length === 0) {
    return { ingested: 0, apiCalls };
  }

  // Vibe refresh: do not write mega-famous places into the cache
  const ingested = await upsertPlacesFromGoogle(
    places,
    vibeOnlyRefresh ? { maxReviews: vibeMaxReviews } : undefined,
  );
  markIngestCompleted(vibeOnlyRefresh ? vibeAreaKey : areaKey);

  return { ingested, apiCalls };
}
