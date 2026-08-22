import { describe, expect, it } from "vitest";
import { injectNativeAd, SPOTS_PER_AD } from "@/lib/feed/native-ad";
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
  } as FeedSpot;
}

describe("injectNativeAd", () => {
  it(`inserts one ad after every ${SPOTS_PER_AD} spots`, () => {
    const spots = Array.from({ length: 9 }, (_, i) => fakeSpot(i));
    const items = injectNativeAd(spots);

    const pattern = items.map((item) => (isFeedNativeAd(item) ? "ad" : "spot"));
    expect(pattern).toEqual([
      "spot",
      "spot",
      "spot",
      "ad",
      "spot",
      "spot",
      "spot",
      "ad",
      "spot",
      "spot",
      "spot",
      "ad",
    ]);
  });

  it("gives each ad a unique id", () => {
    const spots = Array.from({ length: 6 }, (_, i) => fakeSpot(i));
    const ads = injectNativeAd(spots).filter(isFeedNativeAd);
    expect(ads.map((a) => a.id)).toEqual(["ad-slot-0", "ad-slot-1"]);
  });
});
