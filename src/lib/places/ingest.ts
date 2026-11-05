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
  AreaFetchSession,
  MAX_TEXT_SEARCH_PAGES,
  areaFetchKey,
  isRetryDue,
  nextRetryAfter,
  type AreaFetchState,
} from "@/lib/places/area-fetch-state";
import { DEFAULT_FEED_CONFIG } from "@/lib/feed/config";
import { passesReviewGate, reviewGateOrFilter } from "@/lib/feed/review-gate";
import {
  DETAILS_FULL_FIELD_MASK,
  DETAILS_PHOTOS_FIELD_MASK,
  detailsFieldMask,
  isHoursUnavailableStub,
  needsDetailsEnrichment,
  stripHoursUnavailableStub,
} from "@/lib/places/enrichment-gate";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
/** Days before a cached spot is considered stale for freshness queries */
export const CACHE_TTL_DAYS = 30;
/** Full review floor for caching — matches the feed (see review-gate for 20–59) */
const MIN_CACHE_REVIEW_COUNT = DEFAULT_FEED_CONFIG.vibeMinReviews;
const MIN_CACHED_SPOTS = 20;
/** Minimum vibe-range spots in cache before skipping supplemental ingest */
const MIN_VIBE_CACHED_SPOTS = 15;
/** A Google search that takes longer than this counts as failed */
const PLACES_SEARCH_TIMEOUT_MS = 8_000;
/** Production Text Search query — measured to return dining spots Nearby misses */
const PRODUCTION_TEXT_QUERY = "飲食店";

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

/** Text Search paging adds only the token (Essentials field) */
const TEXT_SEARCH_FIELD_MASK = `${SEARCH_FIELD_MASK},nextPageToken`;

/** Google search failed or timed out — callers must not record it as a success. */
export class PlacesSearchError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "PlacesSearchError";
    this.status = status;
  }
}

interface PlacesSearchResponse {
  places?: GooglePlacesPlace[];
  nextPageToken?: string;
}

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
function buildPhotoUrl(photoName: string, maxWidth = 800): string {
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
    // Photo media names expire; never serve stale Details from Next Data Cache.
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.warn(
      `[ingest] Place Details failed for ${placeId}: ${res.status} ${errBody.slice(0, 240)}`,
    );
    return null;
  }

  return (await res.json()) as GooglePlacesPlace;
}

/**
 * POST a Places search. Throws PlacesSearchError on HTTP errors, network
 * errors, and timeouts so a failure is never mistaken for "no places".
 * Not cached: the area fetch state decides when to search again.
 */
async function postPlacesSearch(
  endpoint: "searchNearby" | "searchText",
  body: Record<string, unknown>,
  fieldMask: string,
  label: string,
): Promise<PlacesSearchResponse> {
  let res: Response;
  try {
    res = await fetch(`${GOOGLE_PLACES_BASE}/places:${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(PLACES_SEARCH_TIMEOUT_MS),
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? `timed out after ${PLACES_SEARCH_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : "network error";
    throw new PlacesSearchError(`[ingest] ${label} ${reason}`, null);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PlacesSearchError(
      `[ingest] ${label} failed ${res.status}: ${text.slice(0, 500)}`,
      res.status,
    );
  }

  return (await res.json()) as PlacesSearchResponse;
}

function nearbyBody(
  lat: number,
  lng: number,
  radiusMeters: number,
  includedTypes: string[],
  rankPreference?: "POPULARITY" | "DISTANCE",
): Record<string, unknown> {
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
  return body;
}

/** Single nearby request with multiple types — 1 API call instead of N */
async function fetchNearbyPlacesCombined(
  lat: number,
  lng: number,
  radiusMeters: number,
  includedTypes: string[],
  rankPreference?: "POPULARITY" | "DISTANCE",
): Promise<GooglePlacesPlace[]> {
  const data = await postPlacesSearch(
    "searchNearby",
    nearbyBody(lat, lng, radiusMeters, includedTypes, rankPreference),
    SEARCH_FIELD_MASK,
    "searchNearby(combined)",
  );
  return data.places ?? [];
}

/** Admin per-type discovery: one failed type is logged and skipped. */
async function fetchNearbyPlacesByType(
  lat: number,
  lng: number,
  radiusMeters: number,
  includedType: string,
): Promise<GooglePlacesPlace[]> {
  try {
    const data = await postPlacesSearch(
      "searchNearby",
      nearbyBody(lat, lng, radiusMeters, [includedType]),
      SEARCH_FIELD_MASK,
      `searchNearby(${includedType})`,
    );
    return data.places ?? [];
  } catch (err) {
    if (!(err instanceof PlacesSearchError)) throw err;
    console.warn(err.message);
    return [];
  }
}

/** One Text Search page (DISTANCE, rectangle around the circle). */
async function fetchTextSearchPage(
  lat: number,
  lng: number,
  radiusMeters: number,
  textQuery: string,
  pageToken?: string,
): Promise<{ places: GooglePlacesPlace[]; nextPageToken: string | null }> {
  const box = boundingBox(lat, lng, radiusMeters);
  const body: Record<string, unknown> = {
    textQuery,
    pageSize: 20,
    languageCode: "ja",
    rankPreference: "DISTANCE",
    locationRestriction: {
      rectangle: {
        low: { latitude: box.minLat, longitude: box.minLng },
        high: { latitude: box.maxLat, longitude: box.maxLng },
      },
    },
  };
  if (pageToken) body.pageToken = pageToken;

  const data = await postPlacesSearch(
    "searchText",
    body,
    TEXT_SEARCH_FIELD_MASK,
    `searchText("${textQuery}")`,
  );
  return { places: data.places ?? [], nextPageToken: data.nextPageToken ?? null };
}

/** Admin text discovery: first page only; a failed query is logged and skipped. */
async function fetchTextSearchPlaces(
  lat: number,
  lng: number,
  radiusMeters: number,
  textQuery: string,
): Promise<GooglePlacesPlace[]> {
  try {
    const page = await fetchTextSearchPage(lat, lng, radiusMeters, textQuery);
    return page.places;
  } catch (err) {
    if (!(err instanceof PlacesSearchError)) throw err;
    console.warn(err.message);
    return [];
  }
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
 *
 * `forcePhotos` always re-fetches Place Details photos — used when stored
 * media names have expired (client saw /api/photo 404).
 */
export async function enrichSpotFromDetails(
  spotId: string,
  cachedRow?: SpotRow | null,
  apiCalls?: IngestApiCalls,
  options?: { forcePhotos?: boolean },
): Promise<SpotRow | null> {
  const forcePhotos = options?.forcePhotos === true;
  const cleanedCached = cachedRow
    ? {
        ...cachedRow,
        opening_hours: stripHoursUnavailableStub(cachedRow.opening_hours),
      }
    : null;

  if (!forcePhotos && !needsDetailsEnrichment(cleanedCached)) {
    return cachedRow ?? null;
  }

  if (apiCalls) apiCalls.placeDetails += 1;
  // Forced photo refresh only needs media names — never risk FULL mask failures.
  const fieldMask = forcePhotos
    ? cleanedCached
      ? DETAILS_PHOTOS_FIELD_MASK
      : DETAILS_FULL_FIELD_MASK
    : detailsFieldMask(cleanedCached);
  const details = await fetchPlaceDetails(spotId, fieldMask);

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

  // Photos-only FieldMask has no displayName — merge onto cache instead of mapPlaceToRow.
  if (cleanedCached && fieldMask === DETAILS_PHOTOS_FIELD_MASK) {
    const freshPhotos = mapPhotosFromPlace(details);
    const photoOnly: SpotRow = {
      ...cleanedCached,
      // Forced refresh means the cached names already 404 — never keep them.
      photos:
        forcePhotos || freshPhotos.length > 0
          ? freshPhotos
          : cleanedCached.photos,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("spots")
      .upsert(photoOnly, { onConflict: "id" });
    if (error) {
      console.warn(
        `[ingest] Photo refresh upsert failed for ${spotId}: ${error.message}`,
      );
      return cachedRow ?? null;
    }
    return photoOnly;
  }

  const enriched = mapPlaceToRow(details, cleanedCached ?? undefined);
  if (forcePhotos) {
    // Always replace photo list on forced refresh — never keep expired media names.
    enriched.photos = mapPhotosFromPlace(details);
  }
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

/** Count vibe-range spots (passing the review gate) in the bounding box. */
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
    .or(reviewGateOrFilter(vibeMin))
    .lte("user_rating_count", vibeMax);

  if (freshOnly) {
    query = query.gt("updated_at", staleThresholdIso());
  }

  const { data, error } = await query;
  if (error) throw new Error(`Supabase vibe count failed: ${error.message}`);
  return (data ?? []).filter((row) => !excludedIds.includes(row.id)).length;
}

function meetsCacheReviewFloor(place: GooglePlacesPlace): boolean {
  return passesReviewGate(
    { user_rating_count: place.userRatingCount, rating: place.rating },
    MIN_CACHE_REVIEW_COUNT,
  );
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
  skippedReason?: "cooldown" | "sufficient_cache" | "busy";
  /** A Google search failed or timed out; nothing was recorded as fetched */
  failed?: boolean;
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
  /** Shared per-request area state; created (and finished) here when omitted */
  session?: AreaFetchSession;
}

/**
 * Ensure the Supabase cache is populated for the given radius.
 *
 * Production:
 * - Cold area (<20 spots): 1× Nearby, then wait (area_fetch_state.primary_retry_after)
 * - Vibe-scarce area: 1× DISTANCE Nearby, save only ≤vibeMax reviews
 *   (area_fetch_state.vibe_retry_after)
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
    vibeMaxReviews = 600,
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

  const vibeOnlyRefresh = needsVibeDiversity && !needsPrimary;
  const usesAreaState = !forceFetch && !bypassCooldown;
  const ownSession =
    usesAreaState && !opts.session
      ? new AreaFetchSession(areaFetchKey(lat, lng, radiusMeters))
      : null;
  const session = usesAreaState ? (opts.session ?? ownSession) : null;

  try {
    if (session) {
      const state = await session.current();
      const retryAfter = vibeOnlyRefresh ? state.vibeRetryAfter : state.primaryRetryAfter;
      if (!isRetryDue(retryAfter)) {
        return { ingested: 0, apiCalls, skippedReason: "cooldown" };
      }
      if (!(await session.acquire())) {
        return { ingested: 0, apiCalls, skippedReason: "busy" };
      }
    }

    return await discoverAndSave({
      lat,
      lng,
      radiusMeters,
      ingestProfile,
      needsVibeDiversity,
      vibeOnlyRefresh,
      vibeMaxReviews,
      forceFetch,
      apiCalls,
      session,
    });
  } finally {
    await ownSession?.finish();
  }
}

async function discoverAndSave(args: {
  lat: number;
  lng: number;
  radiusMeters: number;
  ingestProfile: IngestProfile;
  needsVibeDiversity: boolean;
  vibeOnlyRefresh: boolean;
  vibeMaxReviews: number;
  forceFetch: boolean;
  apiCalls: IngestApiCalls;
  session: AreaFetchSession | null;
}): Promise<IngestResult> {
  const {
    lat,
    lng,
    radiusMeters,
    ingestProfile,
    needsVibeDiversity,
    vibeOnlyRefresh,
    vibeMaxReviews,
    forceFetch,
    apiCalls,
    session,
  } = args;

  const useTextSearch =
    ingestProfile === "admin" && (needsVibeDiversity || forceFetch);

  const nearbyTypes =
    ingestProfile === "admin" ? ADMIN_NEARBY_TYPES : PRODUCTION_NEARBY_TYPES;

  let places: GooglePlacesPlace[];
  try {
    places = await discoverDiversePlaces(lat, lng, radiusMeters, {
      nearbyTypes,
      textSearch: useTextSearch,
      combinedNearby: ingestProfile === "production",
      // Hunt nearer / less famous spots when topping up gems
      rankPreference: vibeOnlyRefresh || needsVibeDiversity ? "DISTANCE" : undefined,
      apiCalls,
    });
  } catch (err) {
    if (!(err instanceof PlacesSearchError)) throw err;
    console.warn(err.message);
    return { ingested: 0, apiCalls, failed: true };
  }

  // Vibe refresh: do not write mega-famous places into the cache
  const ingested =
    places.length > 0
      ? await upsertPlacesFromGoogle(
          places,
          vibeOnlyRefresh ? { maxReviews: vibeMaxReviews } : undefined,
        )
      : 0;

  // Recorded only after the save succeeded, so a failed write retries next time.
  // One Nearby per wait, whichever reason triggered it. Leaving the other
  // column empty would let the next request call Google again immediately.
  const retryAfter = nextRetryAfter(places.length);
  session?.record({ primaryRetryAfter: retryAfter, vibeRetryAfter: retryAfter });

  return { ingested, apiCalls };
}

export interface TextPagingResult {
  ingested: number;
  pagesFetched: number;
  apiCalls: IngestApiCalls;
  skippedReason?: "cooldown" | "busy";
  failed?: boolean;
}

/** True when this area's Text Search pages are all used and the wait has not passed. */
export function isTextSearchExhausted(state: AreaFetchState, now = Date.now()): boolean {
  return state.textNextPageToken === null && !isRetryDue(state.textRetryAfter, now);
}

/**
 * Fetch the next Text Search pages for an area (DISTANCE order, up to 3 pages
 * of 20 in total) and save spots that pass the dining and review filters.
 * Stops early once `shouldStop` reports enough cards. The page token is kept
 * in area_fetch_state so the next request continues where this one stopped.
 */
export async function fetchTextSearchPagesIntoCache(opts: {
  lat: number;
  lng: number;
  radiusMeters: number;
  session: AreaFetchSession;
  shouldStop: () => Promise<boolean>;
}): Promise<TextPagingResult> {
  const { lat, lng, radiusMeters, session, shouldStop } = opts;
  const apiCalls: IngestApiCalls = { ...EMPTY_INGEST_API_CALLS };

  const state = await session.current();
  const continuing = state.textNextPageToken !== null;
  if (!continuing && !isRetryDue(state.textRetryAfter)) {
    return { ingested: 0, pagesFetched: 0, apiCalls, skippedReason: "cooldown" };
  }
  if (!(await session.acquire())) {
    return { ingested: 0, pagesFetched: 0, apiCalls, skippedReason: "busy" };
  }

  let token = state.textNextPageToken;
  let pagesFetched = continuing ? state.textPagesFetched : 0;
  let restartedExpiredToken = false;
  let chainHadPlaces = continuing;
  let ingested = 0;
  let pagesThisRequest = 0;
  let failed = false;

  while (pagesFetched < MAX_TEXT_SEARCH_PAGES) {
    let page: { places: GooglePlacesPlace[]; nextPageToken: string | null };
    try {
      apiCalls.textSearch += 1;
      page = await fetchTextSearchPage(
        lat,
        lng,
        radiusMeters,
        PRODUCTION_TEXT_QUERY,
        token ?? undefined,
      );
    } catch (err) {
      if (!(err instanceof PlacesSearchError)) throw err;
      // A stored token Google no longer accepts: start the list again once.
      if (token && err.status === 400 && !restartedExpiredToken) {
        console.warn(`${err.message} — restarting Text Search from page 1`);
        restartedExpiredToken = true;
        token = null;
        pagesFetched = 0;
        chainHadPlaces = false;
        continue;
      }
      console.warn(err.message);
      failed = true;
      break;
    }

    pagesFetched += 1;
    pagesThisRequest += 1;
    if (page.places.length > 0) chainHadPlaces = true;
    if (page.places.length > 0) ingested += await upsertPlacesFromGoogle(page.places);
    token = page.nextPageToken;
    if (!token) break;
    if (pagesFetched < MAX_TEXT_SEARCH_PAGES && (await shouldStop())) break;
  }

  if (failed) {
    if (pagesThisRequest > 0) {
      session.record({ textNextPageToken: token, textPagesFetched: pagesFetched });
    }
    return { ingested, pagesFetched: pagesThisRequest, apiCalls, failed: true };
  }

  const chainDone = token === null || pagesFetched >= MAX_TEXT_SEARCH_PAGES;
  session.record(
    chainDone
      ? {
          textNextPageToken: null,
          textPagesFetched: pagesFetched,
          textRetryAfter: nextRetryAfter(chainHadPlaces ? 1 : 0),
        }
      : { textNextPageToken: token, textPagesFetched: pagesFetched, textRetryAfter: null },
  );

  return { ingested, pagesFetched: pagesThisRequest, apiCalls };
}
