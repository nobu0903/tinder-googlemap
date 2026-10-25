import { describe, expect, it } from "vitest";
import {
  DETAILS_FULL_FIELD_MASK,
  DETAILS_PHOTOS_FIELD_MASK,
  detailsFieldMask,
  feedSpotNeedsHydrate,
  HOURS_UNAVAILABLE_STUB,
  isBookingPipelineDone,
  isForcedPhotoRefreshCoolingDown,
  needsDetailsEnrichment,
  spotPhotosNeedRefresh,
  stripHoursUnavailableStub,
} from "@/lib/places/enrichment-gate";
import type { SpotRow } from "@/types/backend";

function baseRow(overrides: Partial<SpotRow> = {}): SpotRow {
  return {
    id: "ChIJ",
    name: "Test",
    rating: 4,
    user_rating_count: 100,
    price_level: 2,
    lat: 35.6,
    lng: 139.7,
    address: null,
    photos: [{ url: "https://example.com/a.jpg", width: 100, height: 100 }],
    opening_hours: null,
    primary_type: "restaurant",
    vibe_tags: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    phone_number: null,
    reservation_uri: null,
    hotpepper_url: null,
    booking_url: null,
    ...overrides,
  };
}

describe("isBookingPipelineDone", () => {
  it("is false for Nearby-only rows", () => {
    expect(isBookingPipelineDone(baseRow())).toBe(false);
  });

  it("treats hotpepper_url empty string as checked", () => {
    expect(isBookingPipelineDone(baseRow({ hotpepper_url: "" }))).toBe(true);
  });

  it("does not treat Hours not available stub as done", () => {
    expect(
      isBookingPipelineDone(
        baseRow({
          opening_hours: {
            openNow: false,
            periods: [],
            weekdayDescriptions: [HOURS_UNAVAILABLE_STUB],
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("needsDetailsEnrichment", () => {
  it("still needs Details when photos exist but booking unresolved (BUG-006)", () => {
    expect(needsDetailsEnrichment(baseRow())).toBe(true);
  });

  it("skips when photos, address, hours, and booking are complete", () => {
    const row = baseRow({
      address: "1-1 Chiyoda, Tokyo",
      photos: [
        { url: "a", width: 1, height: 1 },
        { url: "b", width: 1, height: 1 },
        { url: "c", width: 1, height: 1 },
      ],
      opening_hours: {
        openNow: true,
        periods: [],
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
      },
      booking_url: "https://book.example",
      updated_at: new Date().toISOString(),
    });
    expect(needsDetailsEnrichment(row)).toBe(false);
  });

  it("needs Details when photos look complete but updated_at is stale", () => {
    const row = baseRow({
      address: "1-1 Chiyoda, Tokyo",
      photos: [
        { url: "a", width: 1, height: 1 },
        { url: "b", width: 1, height: 1 },
        { url: "c", width: 1, height: 1 },
      ],
      opening_hours: {
        openNow: true,
        periods: [],
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
      },
      booking_url: "https://book.example",
      updated_at: "2000-01-01T00:00:00.000Z",
    });
    expect(needsDetailsEnrichment(row)).toBe(true);
    expect(detailsFieldMask(row)).toBe(DETAILS_PHOTOS_FIELD_MASK);
  });

  it("still needs Details when booking done but address/hours missing", () => {
    const row = baseRow({
      photos: [
        { url: "a", width: 1, height: 1 },
        { url: "b", width: 1, height: 1 },
        { url: "c", width: 1, height: 1 },
      ],
      hotpepper_url: "",
      address: null,
      opening_hours: null,
    });
    expect(needsDetailsEnrichment(row)).toBe(true);
  });
});

describe("detailsFieldMask", () => {
  it("uses full mask when booking unresolved even if name/coords exist (BUG-007)", () => {
    const mask = detailsFieldMask(baseRow());
    expect(mask).toBe(DETAILS_FULL_FIELD_MASK);
    expect(mask).toContain("nationalPhoneNumber");
    expect(mask).not.toContain("reservationUri");
  });

  it("uses photos-only when booking/hours/address done and only photos are sparse", () => {
    const row = baseRow({
      address: "1-1 Chiyoda, Tokyo",
      photos: [{ url: "a", width: 1, height: 1 }],
      opening_hours: {
        openNow: true,
        periods: [],
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
      },
      hotpepper_url: "",
    });
    expect(detailsFieldMask(row)).toBe(DETAILS_PHOTOS_FIELD_MASK);
  });

  it("uses full mask when hours/address missing even if booking done", () => {
    const row = baseRow({
      photos: [
        { url: "a", width: 1, height: 1 },
        { url: "b", width: 1, height: 1 },
        { url: "c", width: 1, height: 1 },
      ],
      hotpepper_url: "",
      address: null,
    });
    expect(detailsFieldMask(row)).toBe(DETAILS_FULL_FIELD_MASK);
  });

  it("still needs full mask when hours exist but Hotpepper never resolved", () => {
    const row = baseRow({
      address: "1-1 Chiyoda, Tokyo",
      photos: [
        { url: "a", width: 1, height: 1 },
        { url: "b", width: 1, height: 1 },
        { url: "c", width: 1, height: 1 },
      ],
      opening_hours: {
        openNow: true,
        periods: [],
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
      },
      hotpepper_url: null,
    });
    expect(isBookingPipelineDone(row)).toBe(false);
    expect(needsDetailsEnrichment(row)).toBe(true);
    expect(detailsFieldMask(row)).toBe(DETAILS_FULL_FIELD_MASK);
  });
});

describe("feedSpotNeedsHydrate", () => {
  it("requests hydrate when booking not resolved", () => {
    expect(
      feedSpotNeedsHydrate({
        photoCount: 3,
        bookingUrl: null,
        bookingResolved: false,
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
        address: "Tokyo",
      }),
    ).toBe(true);
  });

  it("requests hydrate when hours or address missing", () => {
    expect(
      feedSpotNeedsHydrate({
        photoCount: 3,
        bookingUrl: null,
        bookingResolved: true,
        weekdayDescriptions: [],
        address: "Tokyo",
      }),
    ).toBe(true);
    expect(
      feedSpotNeedsHydrate({
        photoCount: 3,
        bookingUrl: null,
        bookingResolved: true,
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
        address: null,
      }),
    ).toBe(true);
  });

  it("skips when bookingResolved and address/hours present", () => {
    expect(
      feedSpotNeedsHydrate({
        photoCount: 3,
        bookingUrl: null,
        bookingResolved: true,
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
        address: "Tokyo",
      }),
    ).toBe(false);
  });

  it("requests hydrate when photosNeedRefresh is set", () => {
    expect(
      feedSpotNeedsHydrate({
        photoCount: 3,
        bookingUrl: null,
        bookingResolved: true,
        weekdayDescriptions: ["Monday: 11 AM – 10 PM"],
        address: "Tokyo",
        photosNeedRefresh: true,
      }),
    ).toBe(true);
  });
});

describe("spotPhotosNeedRefresh", () => {
  it("is true for missing or ancient updated_at", () => {
    expect(spotPhotosNeedRefresh(null)).toBe(true);
    expect(spotPhotosNeedRefresh("2000-01-01T00:00:00.000Z")).toBe(true);
  });

  it("is false for a fresh updated_at", () => {
    expect(spotPhotosNeedRefresh(new Date().toISOString())).toBe(false);
  });
});

describe("isForcedPhotoRefreshCoolingDown", () => {
  const now = Date.parse("2026-06-01T00:00:00.000Z");

  it("is true for a spot updated inside the cooldown", () => {
    expect(
      isForcedPhotoRefreshCoolingDown("2026-05-31T23:50:00.000Z", now),
    ).toBe(true);
  });

  it("is false once the cooldown has passed", () => {
    expect(
      isForcedPhotoRefreshCoolingDown("2026-05-31T23:00:00.000Z", now),
    ).toBe(false);
  });
});

describe("stripHoursUnavailableStub", () => {
  it("clears the legacy stub", () => {
    expect(
      stripHoursUnavailableStub({
        openNow: false,
        periods: [],
        weekdayDescriptions: [HOURS_UNAVAILABLE_STUB],
      }),
    ).toBeNull();
  });
});
