import type { SpotRow, OpeningHours } from "@/types/backend";
import { MIN_PHOTOS_SKIP_DETAILS } from "@/types/backend";

/** Photos-only Details — cheapest when identity + booking pipeline already done */
export const DETAILS_PHOTOS_FIELD_MASK = "id,photos";

/** Full Details including Contact fields for Hotpepper matching */
export const DETAILS_FULL_FIELD_MASK = [
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
  "nationalPhoneNumber",
  // reservationUri was removed from Places API (New) FieldMask — requesting it
  // returns 400 INVALID_ARGUMENT and blocks all Details enrichment (incl. photos).
].join(",");

/** Legacy Batch-B stub — must not count as real hours or block re-enrichment */
export const HOURS_UNAVAILABLE_STUB = "Hours not available";

function photoCount(row: SpotRow | null | undefined): number {
  return row?.photos?.length ?? 0;
}

export function isHoursUnavailableStub(
  hours: OpeningHours | null | undefined,
): boolean {
  if (!hours) return false;
  const desc = hours.weekdayDescriptions ?? [];
  return (
    desc.length === 1 &&
    desc[0] === HOURS_UNAVAILABLE_STUB &&
    (hours.periods?.length ?? 0) === 0
  );
}

/** Drop the legacy stub so UI / merge logic see “no hours”. */
export function stripHoursUnavailableStub(
  hours: OpeningHours | null | undefined,
): OpeningHours | null {
  if (!hours || isHoursUnavailableStub(hours)) return null;
  return hours;
}

export function hasRealOpeningHours(
  hours: OpeningHours | null | undefined,
): boolean {
  if (!hours || isHoursUnavailableStub(hours)) return false;
  return (
    (hours.weekdayDescriptions?.length ?? 0) > 0 ||
    (hours.periods?.length ?? 0) > 0
  );
}

/**
 * True when booking enrichment has already run.
 *
 * Only `hotpepper_url != null` (including `""` = checked, no match) or a real
 * `booking_url` count. Real opening hours / phone alone must NOT mark done —
 * those can exist from older Details while Hotpepper was never resolved
 * (common after Admin hydrate → User swipe).
 */
export function isBookingPipelineDone(
  row: Pick<SpotRow, "booking_url" | "hotpepper_url">,
): boolean {
  if (row.booking_url) return true;
  // "" means resolveBookingUrl already ran with no affiliate match
  if (row.hotpepper_url != null) return true;
  return false;
}

/** Whether Place Details should be called for this cached row. */
export function needsDetailsEnrichment(row: SpotRow | null): boolean {
  if (!row) return true;
  const needsPhotos = photoCount(row) < MIN_PHOTOS_SKIP_DETAILS;
  const needsBooking = !isBookingPipelineDone(row);
  const needsHoursOrAddress =
    !hasRealOpeningHours(row.opening_hours) || !row.address;
  // Places photo media names expire — refresh Details periodically.
  const needsPhotoRefresh =
    photoCount(row) > 0 && spotPhotosNeedRefresh(row.updated_at);
  return needsPhotos || needsBooking || needsHoursOrAddress || needsPhotoRefresh;
}

/**
 * Field mask for Place Details.
 * Booking-unresolved rows always get the full mask (phone + identity fields).
 * Missing address / weekly hours also need the full mask (not photos-only).
 */
export function detailsFieldMask(row: SpotRow | null): string {
  if (!row) return DETAILS_FULL_FIELD_MASK;
  if (!isBookingPipelineDone(row)) return DETAILS_FULL_FIELD_MASK;
  if (!(row.name && row.lat && row.lng)) return DETAILS_FULL_FIELD_MASK;
  if (!hasRealOpeningHours(row.opening_hours) || !row.address) {
    return DETAILS_FULL_FIELD_MASK;
  }
  if (photoCount(row) < MIN_PHOTOS_SKIP_DETAILS) {
    return DETAILS_PHOTOS_FIELD_MASK;
  }
  if (spotPhotosNeedRefresh(row.updated_at)) {
    return DETAILS_PHOTOS_FIELD_MASK;
  }
  return DETAILS_FULL_FIELD_MASK;
}

/**
 * Client-side: should we request /api/spots/hydrate for this feed card?
 */
export function feedSpotNeedsHydrate(spot: {
  photoCount: number;
  bookingUrl: string | null;
  /** Server set after resolveBookingUrl (even when no bookable URL) */
  bookingResolved: boolean;
  weekdayDescriptions: string[];
  address?: string | null;
  /** True when cached photo media names are likely expired */
  photosNeedRefresh?: boolean;
}): boolean {
  if (spot.photosNeedRefresh) return true;
  if (spot.photoCount < MIN_PHOTOS_SKIP_DETAILS) return true;
  if (!spot.weekdayDescriptions?.length) return true;
  if (!spot.address) return true;
  if (spot.bookingResolved) return false;
  if (spot.bookingUrl) return false;
  return true;
}

/** Places photo resource names expire; refresh Details after this age. */
export const PHOTO_MEDIA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Minimum gap between forced Place Details photo refreshes for one spot.
 * Stops refreshPhotos from billing Google on every card error.
 */
export const FORCED_PHOTO_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

/** True when updated_at is recent enough that a forced photo refresh should no-op. */
export function isForcedPhotoRefreshCoolingDown(
  updatedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!updatedAt) return false;
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated)) return false;
  const age = nowMs - updated;
  return age >= 0 && age < FORCED_PHOTO_REFRESH_COOLDOWN_MS;
}

/** True when spot.updated_at is missing or older than PHOTO_MEDIA_MAX_AGE_MS. */
export function spotPhotosNeedRefresh(
  updatedAt: string | null | undefined,
): boolean {
  if (!updatedAt) return true;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > PHOTO_MEDIA_MAX_AGE_MS;
}
