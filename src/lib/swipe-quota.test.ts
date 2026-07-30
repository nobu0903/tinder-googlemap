import { describe, expect, it } from "vitest";
import { FREE_SWIPE_LIMIT } from "@/lib/hooks/use-free-swipe-quota";
import {
  swipeQuotaProgressPercent,
  swipeQuotaRemaining,
} from "@/lib/swipe-quota";

describe("swipeQuotaProgressPercent", () => {
  it("returns 0 when unused", () => {
    expect(swipeQuotaProgressPercent(0)).toBe(0);
  });

  it("returns 100 at the free limit", () => {
    expect(swipeQuotaProgressPercent(FREE_SWIPE_LIMIT)).toBe(100);
  });

  it("clamps above the limit", () => {
    expect(swipeQuotaProgressPercent(FREE_SWIPE_LIMIT + 10)).toBe(100);
  });

  it("clamps negative used to 0", () => {
    expect(swipeQuotaProgressPercent(-3)).toBe(0);
  });

  it("returns mid-range progress for half usage", () => {
    expect(swipeQuotaProgressPercent(10, 20)).toBe(50);
  });
});

describe("swipeQuotaRemaining", () => {
  it("counts down from the limit", () => {
    expect(swipeQuotaRemaining(3, 20)).toBe(17);
  });

  it("never goes below zero", () => {
    expect(swipeQuotaRemaining(30, 20)).toBe(0);
  });
});
