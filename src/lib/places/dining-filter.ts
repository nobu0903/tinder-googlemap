// Dining-only filters — exclude hotels/lodging and chains, keep hotel restaurants.

import type { GooglePlacesPlace } from "@/types/backend";
import { isChainPlace, isChainSpotRow } from "@/lib/places/chain-filter";

/** Primary types that are accommodation, not dining destinations (filter responses + DB) */
export const LODGING_PRIMARY_TYPES = new Set([
  "lodging",
  "hotel",
  "motel",
  "resort_hotel",
  "extended_stay_hotel",
  "bed_and_breakfast",
  "hostel",
  "guest_house",
  "japanese_inn",
  "budget_japanese_inn",
  "ryokan", // response-only; not valid in searchNearby request params
  "inn",
  "campground",
  "camping_cabin",
  "rv_park",
  "cottage",
  "farmstay",
  "private_guest_room",
  "mobile_home_park",
]);

/**
 * Lodging types valid for searchNearby excludedTypes / excludedPrimaryTypes (Table A only).
 * @see https://developers.google.com/maps/documentation/places/web-service/place-types
 */
export const API_EXCLUDED_LODGING_TYPES = [
  "lodging",
  "hotel",
  "motel",
  "resort_hotel",
  "extended_stay_hotel",
  "bed_and_breakfast",
  "hostel",
  "guest_house",
  "japanese_inn",
  "budget_japanese_inn",
  "inn",
  "campground",
  "camping_cabin",
  "rv_park",
] as const;

/** @deprecated Use API_EXCLUDED_LODGING_TYPES for API requests */
export const EXCLUDED_LODGING_TYPES = [...API_EXCLUDED_LODGING_TYPES];

const DINING_KEYWORDS =
  /レストラン|餐厅|食堂|ダイニング|ビストロ|dining|restaurant|bistro|grill|kitchen|café|cafe|カフェ|バー|bar|料理|diner|eatery/i;

const HOTEL_KEYWORDS =
  /ホテル|hotel|旅館|リゾート|resort|inn\b|ゲストハウス|hostel|民宿/i;

/** True when the name looks like a hotel property, not its restaurant. */
export function isPureHotelName(name: string): boolean {
  if (!HOTEL_KEYWORDS.test(name)) return false;
  return !DINING_KEYWORDS.test(name);
}

function primaryTypeIsDining(primaryType: string): boolean {
  if (!primaryType) return true;
  if (LODGING_PRIMARY_TYPES.has(primaryType)) return false;
  return (
    primaryType.includes("restaurant") ||
    primaryType.includes("cafe") ||
    primaryType === "bar" ||
    primaryType === "bakery" ||
    primaryType === "meal_takeaway" ||
    primaryType === "food"
  );
}

/** Filter a raw Google Places result before caching. */
export function isDiningPlace(place: GooglePlacesPlace): boolean {
  const primary = place.primaryType ?? "";
  const types = place.types ?? [];
  const name = place.displayName.text;

  if (primary && LODGING_PRIMARY_TYPES.has(primary)) return false;

  if (types.some((t) => LODGING_PRIMARY_TYPES.has(t))) {
    if (!primaryTypeIsDining(primary)) return false;
  }

  if (isPureHotelName(name)) return false;

  if (isChainPlace(place)) return false;

  return true;
}

/** Filter cached DB rows (legacy rows may lack primary_type). */
export function isDiningSpotRow(row: {
  name: string;
  primary_type?: string | null;
}): boolean {
  if (row.primary_type && LODGING_PRIMARY_TYPES.has(row.primary_type)) {
    return false;
  }
  if (row.primary_type && !primaryTypeIsDining(row.primary_type)) {
    return false;
  }
  return !isPureHotelName(row.name) && !isChainSpotRow(row);
}

export function filterDiningSpotRows<T extends { name: string; primary_type?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter(isDiningSpotRow);
}
