import type { FeedNativeAd, FeedSpot, SwipeFeedItem } from "@/types/backend";

export const NATIVE_AD_SLOT_PREFIX = "ad-slot-";

/** Insert one ad after every N spot cards */
export const SPOTS_PER_AD = 3;

const MAX_FEED_ITEMS = 20;

export function createNativeAdSlot(seq: number): FeedNativeAd {
  return {
    id: `${NATIVE_AD_SLOT_PREFIX}${seq}`,
    layoutType: "AD_NATIVE",
    name: "Sponsored",
  };
}

/**
 * Inject native ads into the production feed: 1 ad after every 3 spots.
 * Caps total length at MAX_FEED_ITEMS (spots + ads).
 */
export function injectNativeAd(spots: FeedSpot[]): SwipeFeedItem[] {
  if (spots.length === 0) return spots;

  const items: SwipeFeedItem[] = [];
  let adSeq = 0;

  for (let i = 0; i < spots.length; i++) {
    if (items.length >= MAX_FEED_ITEMS) break;
    items.push(spots[i]!);

    const shouldInsertAd = (i + 1) % SPOTS_PER_AD === 0;
    if (shouldInsertAd && items.length < MAX_FEED_ITEMS) {
      items.push(createNativeAdSlot(adSeq));
      adSeq += 1;
    }
  }

  return items;
}
