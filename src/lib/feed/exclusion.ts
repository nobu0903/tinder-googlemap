import { isChainSpotRow } from "@/lib/places/chain-filter";
import {
  LODGING_PRIMARY_TYPES,
  isPureHotelName,
} from "@/lib/places/dining-filter";
import type { SpotRow } from "@/types/backend";
import type { FeedAlgorithmConfig } from "./config";
import { passesReviewGate } from "./review-gate";

export type FeedPoolKind = "classic" | "vibe" | "none";

/** Why a spot was removed from feed eligibility */
export function getSpotExclusionReason(row: {
  name: string;
  primary_type?: string | null;
}): string | null {
  if (isChainSpotRow(row)) {
    return `chain (${row.name})`;
  }
  if (row.primary_type && LODGING_PRIMARY_TYPES.has(row.primary_type)) {
    return `lodging type (${row.primary_type})`;
  }
  if (isPureHotelName(row.name)) {
    return "hotel name";
  }
  return null;
}

export function classifyPool(
  row: Pick<SpotRow, "user_rating_count" | "rating">,
  config: FeedAlgorithmConfig,
): FeedPoolKind {
  const count = row.user_rating_count;
  if (!passesReviewGate(row, config.vibeMinReviews)) return "none";
  if (count! > config.classicMaxReviews) return "none";
  if (
    count! >= config.classicMinReviews &&
    count! <= config.classicMaxReviews
  ) {
    return "classic";
  }
  if (count! <= config.vibeMaxReviews) return "vibe";
  return "none";
}
