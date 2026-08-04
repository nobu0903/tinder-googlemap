import type { SpotRow, OpeningHours } from "@/types/backend";
import { MIN_PHOTOS_SKIP_DETAILS } from "@/types/backend";

/** Photos-only Details — cheapest when identity + booking pipeline already done */
export const DETAILS_PHOTOS_FIELD_MASK = "id,photos";

/** Full Details including Advanced fields for Hotpepper / Google Reserve */
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
  "regularOpeningHours",
  "location",
  "nationalPhoneNumber",
  "reservationUri",
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

/** Non-empty weekday lines suitable for the weekly hours UI (not stub/blank). */
export function usableWeekdayDescriptions(
  hours: OpeningHours | null | undefined,
): string[] {
  if (!hours || isHoursUnavailableStub(hours)) return [];
  return (hours.weekdayDescriptions ?? []).filter(
    (line) => line.trim().length > 0 && line !== HOURS_UNAVAILABLE_STUB,
  );
}

/**
 * True when weekly hours are displayable.
 * `periods` alone is NOT enough — more-info only renders weekdayDescriptions,
 * and Search often returns periods without localized weekly lines.
 */
export function hasRealOpeningHours(
  hours: OpeningHours | null | undefined,
): boolean {
  return usableWeekdayDescriptions(hours).length > 0;
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
  return needsPhotos || needsBooking || needsHoursOrAddress;
}

/**
 * Field mask for Place Details.
 * Booking-unresolved rows always get the full mask (phone + reservationUri).
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
  /** False/undefined → still need Details for Google weekly hours */
  hoursFromGoogle?: boolean;
  address?: string | null;
}): boolean {
  if (spot.photoCount < MIN_PHOTOS_SKIP_DETAILS) return true;
  if (!spot.hoursFromGoogle) return true;
  if (!spot.weekdayDescriptions?.length) return true;
  if (!spot.address) return true;
  if (spot.bookingResolved) return false;
  if (spot.bookingUrl) return false;
  return true;
}
