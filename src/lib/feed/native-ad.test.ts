import { describe, expect, it } from "vitest";
import { injectNativeAd } from "@/lib/feed/native-ad";
import { isFeedNativeAd, type FeedSpot } from "@/types/backend";

function fakeSpot(i: number): FeedSpot {
  return {
    id: `spot-${i}`,
    spotId: `spot-${i}`,
    photoCount: 0,
    photoPages: [],
    name: `Spot ${i}`,
    rating: 4,
    userRatingCount: 100,
    priceLabel: "¥",
    primaryType: "restaurant",
    types: [],
    vibeTags: [],
    distanceKm: 1,
    openNow: true,
    todayClose: null,
    weekdayDescriptions: null,
    address: null,
    layoutType: "SINGLE_FULL",
    photos: [],
    mapsUrl: "",
    bookingUrl: null,
    editorialSummary: null,
  } as unknown as FeedSpot;
}

describe("injectNativeAd", () => {
  it("returns spots unchanged while in-feed ads are disabled", () => {
    const spots = Array.from({ length: 9 }, (_, i) => fakeSpot(i));
    const items = injectNativeAd(spots);

    expect(items).toHaveLength(9);
    expect(items.every((item) => !isFeedNativeAd(item))).toBe(true);
    expect(items.map((item) => (item as FeedSpot).spotId)).toEqual(
      spots.map((s) => s.spotId),
    );
  });
});
