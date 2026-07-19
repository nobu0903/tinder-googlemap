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

/**
 * Food & drink primary types from Places Table A (and common response values).
 * Used so feed filtering does not drop coffee shops, steak houses, etc.
 */
export const DINING_PRIMARY_TYPES = new Set([
  "restaurant",
  "cafe",
  "coffee_shop",
  "bar",
  "pub",
  "wine_bar",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "sandwich_shop",
  "steak_house",
  "ice_cream_shop",
  "juice_shop",
  "tea_house",
  "brunch_restaurant",
  "breakfast_restaurant",
  "fast_food_restaurant",
  "hamburger_restaurant",
  "pizza_restaurant",
  "seafood_restaurant",
  "sushi_restaurant",
  "ramen_restaurant",
  "japanese_restaurant",
  "chinese_restaurant",
  "korean_restaurant",
  "thai_restaurant",
  "vietnamese_restaurant",
  "indian_restaurant",
  "indonesian_restaurant",
  "italian_restaurant",
  "french_restaurant",
  "american_restaurant",
  "mexican_restaurant",
  "mediterranean_restaurant",
  "middle_eastern_restaurant",
  "greek_restaurant",
  "spanish_restaurant",
  "brazilian_restaurant",
  "lebanese_restaurant",
  "turkish_restaurant",
  "vegan_restaurant",
  "vegetarian_restaurant",
  "barbecue_restaurant",
  "fine_dining_restaurant",
]);

const DINING_KEYWORDS =
  /レストラン|餐厅|食堂|ダイニング|ビストロ|dining|restaurant|bistro|grill|kitchen|café|cafe|カフェ|バー|bar|料理|diner|eatery/i;

const HOTEL_KEYWORDS =
  /ホテル|hotel|旅館|リゾート|resort|inn\b|ゲストハウス|hostel|民宿/i;

/** True when the name looks like a hotel property, not its restaurant. */
export function isPureHotelName(name: string): boolean {
  if (!HOTEL_KEYWORDS.test(name)) return false;
  return !DINING_KEYWORDS.test(name);
}

/**
 * Accept known dining types + any `*_restaurant` / cafe|bar|bakery|meal_* patterns.
 * Unknown non-lodging types are NOT dining (avoids tourist_attraction etc. in feed).
 */
export function primaryTypeIsDining(primaryType: string): boolean {
  if (!primaryType) return true;
  if (LODGING_PRIMARY_TYPES.has(primaryType)) return false;
  if (DINING_PRIMARY_TYPES.has(primaryType)) return true;
  if (primaryType.endsWith("_restaurant")) return true;
  if (
    primaryType.includes("cafe") ||
    primaryType.includes("coffee") ||
    primaryType.includes("bakery") ||
    primaryType.includes("bar") ||
    primaryType.startsWith("meal_")
  ) {
    return true;
  }
  return false;
}

/** Filter a raw Google Places result before caching. */
export function isDiningPlace(place: GooglePlacesPlace): boolean {
  const primary = place.primaryType ?? "";
  const types = place.types ?? [];
  const name = place.displayName.text;

  if (primary && LODGING_PRIMARY_TYPES.has(primary)) return false;

  // Lodging in types[] but dining primary (e.g. hotel restaurant) → keep
  if (types.some((t) => LODGING_PRIMARY_TYPES.has(t))) {
    if (!primaryTypeIsDining(primary)) return false;
  }

  // If Google gave a primary type, require it to be dining-related
  if (primary && !primaryTypeIsDining(primary)) return false;

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
