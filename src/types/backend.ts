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
  close: { day: number; hour: number; minute: number };
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
}

export type SwipeAction = "like" | "dislike";

export interface SwipeRow {
  id: number;
  user_id: string;
  spot_id: string;
  action: SwipeAction;
  created_at: string;
}

/** Photos fetched and stored per spot (Nearby + Place Details) */
export const MAX_STORED_PHOTOS = 10;

/** Enrich via Place Details until MAX_STORED_PHOTOS photos are cached */
export const MIN_PHOTOS_SKIP_DETAILS = MAX_STORED_PHOTOS;

// `layoutType` drives how the swipe card renders photos.
// DUAL_STACK = 2 stacked horizontal images (width > height)
// SINGLE_FULL = 1 portrait image filling the full card (height >= width)
export type LayoutType = "DUAL_STACK" | "SINGLE_FULL";

export interface FeedPhoto {
  url: string;
  alt: string;
}

export interface FeedPhotoPage {
  layoutType: LayoutType;
  photos: FeedPhoto[];
}

export interface FeedSpot {
  /** Google Place ID — one card per spot */
  id: string;
  /** Google Place ID used for swipe actions and Maps deep links */
  spotId: string;
  /** Number of source photos attached (up to 10) */
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
  layoutType: LayoutType;
  /** Photos on the first page (convenience mirror of photoPages[0]) */
  photos: FeedPhoto[];
  vibeTags: string[];
  address: string | null;
  /** Google weekday descriptions, e.g. "Monday: 11:00 AM – 10:00 PM" */
  weekdayDescriptions: string[];
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
  spots: FeedSpot[];
  /** Search radius actually used (km) — may be 2, 5, or 10 after auto-expansion */
  radiusKm: number;
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
}
