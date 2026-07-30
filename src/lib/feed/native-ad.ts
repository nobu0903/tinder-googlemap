import type { FeedNativeAd, FeedSpot, SwipeFeedItem } from "@/types/backend";

export const NATIVE_AD_SLOT_ID = "ad-slot-google-admob";

const MAX_FEED_ITEMS = 20;

/** Random index in [7, 11] for in-feed native ad placement */
export function pickNativeAdIndex(): number {
  return 7 + Math.floor(Math.random() * 5);
}

export function createNativeAdSlot(): FeedNativeAd {
  return {
    id: NATIVE_AD_SLOT_ID,
    layoutType: "AD_NATIVE",
    name: "Sponsored",
  };
}

/**
 * Inject a native ad slot into the production feed (max 20 items including ad).
 * Spots-only input is trimmed to 19 before insert when at capacity.
 */
export function injectNativeAd(spots: FeedSpot[]): SwipeFeedItem[] {
  if (spots.length === 0) return spots;

  const ad = createNativeAdSlot();
  const index = Math.min(pickNativeAdIndex(), spots.length);
  const items: SwipeFeedItem[] = [...spots];

  if (items.length >= MAX_FEED_ITEMS) {
    items.pop();
  }

  items.splice(index, 0, ad);

  if (items.length > MAX_FEED_ITEMS) {
    items.length = MAX_FEED_ITEMS;
  }

  return items;
}
