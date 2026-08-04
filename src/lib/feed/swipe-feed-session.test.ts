import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetSwipeFeedSessionForTests,
  loadNearbySwipeFeedSession,
  runFeedFetchExclusive,
  saveSwipeFeedSession,
  swipeFeedCacheKey,
} from "@/lib/feed/swipe-feed-session";
import type { FeedSpot } from "@/types/backend";

function spot(id: string): FeedSpot {
  return {
    id,
    spotId: id,
    photoCount: 0,
    photoPages: [],
    name: id,
    rating: null,
    reviewCount: null,
    priceLevel: null,
    priceLabel: "",
    lat: 35,
    lng: 139,
    distanceKm: 1,
    isOpen: false,
    todayClose: null,
    category: "restaurant",
    layoutType: "SINGLE_FULL",
    photos: [],
    vibeTags: [],
    address: null,
    weekdayDescriptions: [],
    openingPeriods: [],
    hoursFromGoogle: false,
    bookingUrl: null,
    bookingResolved: true,
  };
}

describe("swipe feed session store", () => {
  beforeEach(() => {
    __resetSwipeFeedSessionForTests();
  });

  it("does not overwrite a warm queue with empty remount flash", () => {
    const coords = { lat: 43.12, lng: 141.368 };
    const key = swipeFeedCacheKey(coords);
    saveSwipeFeedSession({
      cacheKey: key,
      lat: coords.lat,
      lng: coords.lng,
      tag: "",
      queue: [spot("a"), spot("b")],
      seenSpotIds: [],
      lastFetchAt: Date.now(),
      hydrateRequested: [],
      sessionHydrates: 0,
      isSparseTheme: false,
    });

    saveSwipeFeedSession({
      cacheKey: key,
      lat: coords.lat,
      lng: coords.lng,
      tag: "",
      queue: [],
      seenSpotIds: [],
      lastFetchAt: Date.now(),
      hydrateRequested: [],
      sessionHydrates: 0,
      isSparseTheme: false,
    });

    expect(loadNearbySwipeFeedSession(coords)?.queue).toHaveLength(2);
  });

  it("dedupes concurrent fetches for the same key", async () => {
    let runs = 0;
    const key = "k|";
    const p1 = runFeedFetchExclusive(key, async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 20));
    });
    const p2 = runFeedFetchExclusive(key, async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 20));
    });
    await Promise.all([p1, p2]);
    expect(runs).toBe(1);
  });
});
