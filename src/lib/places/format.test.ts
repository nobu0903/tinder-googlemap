import { describe, expect, it } from "vitest";
import {
  formatPriceLabel,
  getTodayClose,
  isOpenNow,
} from "@/lib/places/format";
import type { SpotRow } from "@/types/backend";

function spotWithPeriods(
  periods: NonNullable<SpotRow["opening_hours"]>["periods"],
): SpotRow {
  return {
    id: "ChIJtest",
    name: "Test",
    lat: 35.68,
    lng: 139.76,
    rating: 4,
    user_ratings_total: 10,
    price_level: 2,
    primary_type: "restaurant",
    types: ["restaurant"],
    editorial_summary: null,
    photos: [],
    phone: null,
    website: null,
    google_maps_uri: null,
    opening_hours: { periods, weekdayDescriptions: [] },
    reservable: null,
    tags: [],
    updated_at: new Date().toISOString(),
    hotpepper_url: null,
    booking_url: null,
  } as SpotRow;
}

describe("formatPriceLabel (BUG-016)", () => {
  it("shows Free for price level 0", () => {
    expect(formatPriceLabel(0)).toBe("Free");
  });

  it("maps 1–4 to yen marks", () => {
    expect(formatPriceLabel(1)).toBe("¥");
    expect(formatPriceLabel(3)).toBe("¥¥¥");
  });

  it("returns empty for null", () => {
    expect(formatPriceLabel(null)).toBe("");
  });
});

describe("isOpenNow (BUG-011 / BUG-012)", () => {
  it("does not throw when close is missing", () => {
    const row = spotWithPeriods([
      { open: { day: 1, hour: 9, minute: 0 } },
    ]);
    // Monday 10:00 UTC ≈ Tuesday morning Tokyo — just assert no throw
    expect(() => isOpenNow(row, new Date("2026-07-20T01:00:00Z"))).not.toThrow();
  });

  it("treats same-day open/close correctly in Asia/Tokyo", () => {
    // Wed Jul 22 2026 12:00 JST = 03:00 UTC
    const row = spotWithPeriods([
      {
        open: { day: 3, hour: 11, minute: 0 },
        close: { day: 3, hour: 22, minute: 0 },
      },
    ]);
    expect(isOpenNow(row, new Date("2026-07-22T03:00:00Z"))).toBe(true);
    expect(isOpenNow(row, new Date("2026-07-22T14:00:00Z"))).toBe(false);
  });
});

describe("getTodayClose (BUG-013)", () => {
  it("returns close for overnight period still active", () => {
    // Thu 01:00 JST = Wed 16:00 UTC
    const row = spotWithPeriods([
      {
        open: { day: 3, hour: 18, minute: 0 },
        close: { day: 4, hour: 2, minute: 0 },
      },
    ]);
    expect(getTodayClose(row, new Date("2026-07-22T16:00:00Z"))).toBe("02:00");
  });

  it("returns null when no usable close", () => {
    const row = spotWithPeriods([
      { open: { day: 1, hour: 9, minute: 0 } },
    ]);
    expect(getTodayClose(row, new Date("2026-07-20T01:00:00Z"))).toBeNull();
  });
});
