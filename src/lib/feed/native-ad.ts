import type { FeedNativeAd, FeedSpot, SwipeFeedItem } from "@/types/backend";

export const NATIVE_AD_SLOT_PREFIX = "ad-slot-";

/** Insert one ad after every N spot cards (unused while ads are disabled). */
export const SPOTS_PER_AD = 3;

/**
 * Native in-feed ads are currently disabled — return spots unchanged.
 * Re-enable injection here when AdSense / sponsor cards should return.
 */
export function injectNativeAd(spots: FeedSpot[]): SwipeFeedItem[] {
  return spots;
}

/** Kept for tests / future re-enable. */
export function createNativeAdSlot(seq: number): FeedNativeAd {
  return {
    id: `${NATIVE_AD_SLOT_PREFIX}${seq}`,
    layoutType: "AD_NATIVE",
    name: "Sponsored",
  };
}
