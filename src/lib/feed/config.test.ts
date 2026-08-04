import { describe, expect, it } from "vitest";
import {
  AREA_GEM_BANDS,
  applyAreaGemBands,
  applyStarvationRelaxation,
  DEFAULT_FEED_CONFIG,
} from "@/lib/feed/config";

describe("AREA_GEM_BANDS", () => {
  it("widens classic/vibe caps from local → urban → tourist", () => {
    expect(AREA_GEM_BANDS.local.classicMaxReviews).toBeLessThan(
      AREA_GEM_BANDS.urban.classicMaxReviews,
    );
    expect(AREA_GEM_BANDS.urban.classicMaxReviews).toBeLessThan(
      AREA_GEM_BANDS.tourist.classicMaxReviews,
    );
    expect(AREA_GEM_BANDS.local.vibeMaxReviews).toBeLessThan(
      AREA_GEM_BANDS.urban.vibeMaxReviews,
    );
  });

  it("keeps vibe/classic bands contiguous (no review gap)", () => {
    for (const band of Object.values(AREA_GEM_BANDS)) {
      expect(band.classicMinReviews).toBe(band.vibeMaxReviews + 1);
    }
  });
});

describe("applyStarvationRelaxation", () => {
  it("raises caps so mid-famous spots can fill a thin local feed", () => {
    const local = applyAreaGemBands(DEFAULT_FEED_CONFIG, "local");
    const relaxed = applyStarvationRelaxation(local);
    expect(relaxed.classicMaxReviews).toBeGreaterThanOrEqual(2_500);
    expect(relaxed.vibeMaxReviews).toBeGreaterThanOrEqual(800);
    expect(relaxed.minEligibleSpots).toBeLessThanOrEqual(8);
  });
});

describe("radius ladder", () => {
  it("uses 2 → 3 → 5 → 10 km steps", () => {
    expect(DEFAULT_FEED_CONFIG.radiusStepsM).toEqual([
      2_000, 3_000, 5_000, 10_000,
    ]);
  });
});
