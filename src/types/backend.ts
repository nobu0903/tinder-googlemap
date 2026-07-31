// Shared backend types for VibeLoop's swipe feed pipeline.
// These mirror the Supabase `spots` and `swipes` table columns exactly.

// ── Photo ─────────────────────────────────────────────────────────────────────

export interface SpotPhoto {
  url: string;
  width: number;
  height: number;
}

// ── Opening hours (raw from Google Places) ────────────────────────────────────

export interface OpeningHoursPeriod {
  open: { day: number; hour: number; minute: number };
  /** Google may omit close for some always-open / incomplete encodings */
  close?: { day: number; hour: number; minute: number };
}

export interface OpeningHours {
  openNow: boolean;
  periods: OpeningHoursPeriod[];
  weekdayDescriptions: string[];
}

// ── DB row types ──────────────────────────────────────────────────────────────

export interface SpotRow {
  id: string;               // Google Place ID
  name: string;
  rating: number | null;
  user_rating_count: number | null;
  price_level: number | null;
  lat: number;
  lng: number;
  address: string | null;
  photos: SpotPhoto[] | null;
  opening_hours: OpeningHours | null;
  /** Google primary type, e.g. "restaurant" or "lodging" */
  primary_type: string | null;
  vibe_tags: string[];
  created_at: string;
  updated_at: string;
  /** National phone number from Google Places, e.g. "03-1234-5678" */
  phone_number: string | null;
  /** Google reservationUri — TableCheck / Ebica / Google Reserve URL */
  reservation_uri: string | null;
  /** Raw Hotpepper Gourmet shop URL (null = no match found) */
  hotpepper_url: string | null;
  /**
   * Final resolved booking URL.
   * Tier 1: ValueCommerce-wrapped Hotpepper URL
   * Tier 2: Google reservationUri (no affiliate)
   * null: only Google Maps fallback available (use buildGoogleMapsPlaceUrl)
   */
  booking_url: string | null;
}

export type SwipeAction = "like" | "dislike";

export interface SwipeRow {
  id: number;
  user_id: string;
  spot_id: string;
  action: SwipeAction;
  created_at: string;
}

/**
 * Photos fetched and stored per spot (Nearby + Place Details).
 * Cap display/storage at 5 — each photo URL hit in the browser is billed
 * by Google Place Photo (~$0.007). Collection only needs a short carousel.
 */
export const MAX_STORED_PHOTOS = 5;

/** Skip Place Details when at least this many photos exist from search cache */
export const MIN_PHOTOS_SKIP_DETAILS = 3;

/** Collection list card image width (px) — cards are ~400 CSS px tall/wide */
export const COLLECTION_CARD_PHOTO_WIDTH = 400;

/**
 * Swipe card photo maxWidthPx for Google Place Photo / `/api/photo`.
 * Cards are ~400 CSS px; 480 covers light retina without the old 800px payload.
 */
export const SWIPE_CARD_PHOTO_WIDTH = 480;

/** Max Place Details calls per production feed batch (0 = lazy client hydrate only) */
export const PRODUCTION_MAX_DETAILS_PER_FEED = 0;

/** Max Place Details calls per admin feed batch */
export const ADMIN_MAX_DETAILS_PER_FEED = 8;

// `layoutType` drives how the swipe card renders photos.
// DUAL_STACK = 2 stacked horizontal images (width > height)
// SINGLE_FULL = 1 portrait image filling the full card (height >= width)
// AD_NATIVE = in-feed sponsored slot (not a Google Place)
export type LayoutType = "DUAL_STACK" | "SINGLE_FULL" | "AD_NATIVE";

export type SpotLayoutType = Exclude<LayoutType, "AD_NATIVE">;

export interface FeedPhoto {
  url: string;
  alt: string;
}

export interface FeedPhotoPage {
  layoutType: SpotLayoutType;
  photos: FeedPhoto[];
}

/** In-feed native ad placeholder — injected by GET /api/swipe only */
export interface FeedNativeAd {
  /** Unique per insertion, e.g. ad-slot-0 */
  id: string;
  layoutType: "AD_NATIVE";
  name: "Sponsored";
}

export type SwipeFeedItem = FeedSpot | FeedNativeAd;

export function isFeedNativeAd(item: SwipeFeedItem): item is FeedNativeAd {
  return item.layoutType === "AD_NATIVE";
}

export function feedItemKey(item: SwipeFeedItem): string {
  return isFeedNativeAd(item) ? item.id : item.spotId;
}

export interface FeedSpot {
  /** Google Place ID — one card per spot */
  id: string;
  /** Google Place ID used for swipe actions and Maps deep links */
  spotId: string;
  /** Number of source photos attached (up to MAX_STORED_PHOTOS) */
  photoCount: number;
  /** Pages browsable via tap left/right inside the card */
  photoPages: FeedPhotoPage[];
  name: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  /** Price string formatted from priceLevel, e.g. "¥¥" */
  priceLabel: string;
  distanceKm: number;
  isOpen: boolean;
  todayClose: string | null;
  category: string;
  /** Layout of the first photo page */
  layoutType: SpotLayoutType;
  /** Photos on the first page (convenience mirror of photoPages[0]) */
  photos: FeedPhoto[];
  vibeTags: string[];
  address: string | null;
  /** Google weekday descriptions, e.g. "Monday: 11:00 AM – 10:00 PM" */
  weekdayDescriptions: string[];
  /**
   * Final resolved booking URL surfaced to the UI.
   * Tier 1: ValueCommerce-wrapped Hotpepper link (affiliate revenue)
   * Tier 2: Google reservationUri (TableCheck / Ebica / Google Reserve)
   * null: only Google Maps fallback available — "Book" button is hidden
   */
  bookingUrl: string | null;
  /**
   * True after booking resolve ran (hotpepper_url set, even to "").
   * Client uses this to skip redundant /api/spots/hydrate calls.
   */
  bookingResolved: boolean;
}

// ── Collection (liked spots) ──────────────────────────────────────────────────

/** A spot the authenticated user has liked, returned by GET /api/collection */
export interface LikedSpot {
  spotId: string;
  name: string;
  rating: number | null;
  priceLevel: number | null;
  primaryType: string | null;
  address: string | null;
  lat: number;
  lng: number;
  photos: SpotPhoto[];
  bookingUrl: string | null;
  likedAt: string;
}

export interface CollectionResponse {
  spots: LikedSpot[];
  total: number;
}

// ── API request / response shapes ────────────────────────────────────────────

export interface SwipeFeedParams {
  lat: number;
  lng: number;
  tag?: string;
  /** Comma-separated spot IDs to exclude (session dedup) */
  exclude?: string;
}

export interface SwipeFeedResponse {
  spots: SwipeFeedItem[];
  /** Search radius actually used (km) — may be 2, 5, or 10 after auto-expansion */
  radiusKm: number;
  /**
   * Number of vibe-pool spots that passed all filters for the requested tag.
   * Only present when a `tag` was requested. Used by the client to show a
   * "limited themed spots" banner when this is low.
   */
  vibeSpotCount?: number;
}

export interface SwipeActionPayload {
  spotId: string;
  action: SwipeAction;
}

export interface SwipeActionResponse {
  ok: boolean;
}

/** Zero-cost Google Maps deep link using verified Place ID */
export function buildGoogleMapsPlaceUrl(
  spotId: string,
  placeName?: string,
): string {
  const id = spotId.startsWith("places/") ? spotId.slice("places/".length) : spotId;
  const params = new URLSearchParams({
    api: "1",
    query_place_id: id,
  });
  if (placeName) {
    params.set("query", placeName);
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

// ── Google Places API raw shapes (New Places API) ────────────────────────────

export interface GooglePlacesPhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface GooglePlacesPeriod {
  open: { day: number; hour: number; minute: number };
  close: { day: number; hour: number; minute: number };
}

export interface GooglePlacesOpeningHours {
  openNow: boolean;
  periods: GooglePlacesPeriod[];
  weekdayDescriptions: string[];
}

export interface GooglePlacesPlace {
  id: string;
  displayName: { text: string; languageCode: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number | string;
  primaryType?: string;
  types?: string[];
  photos?: GooglePlacesPhoto[];
  currentOpeningHours?: GooglePlacesOpeningHours;
  location?: { latitude: number; longitude: number };
  /** National-format phone number, e.g. "03-1234-5678" (Advanced field) */
  nationalPhoneNumber?: string;
  /** Direct reservation URL from Google (TableCheck, Ebica, Google Reserve, etc.) */
  reservationUri?: string;
}

/** Booking tier for analytics tracking */
export type BookingTier = 1 | 2 | 3;

export interface BookingClickPayload {
  spotId: string;
  bookingUrl: string;
  /** 1=Hotpepper affiliate, 2=Google Reserve, 3=Google Maps */
  tier: BookingTier;
}
