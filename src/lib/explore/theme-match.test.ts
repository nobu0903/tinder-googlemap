import { describe, expect, it } from "vitest";
import {
  matchesTheme,
  rankByThemeFit,
  themeMatchScore,
} from "@/lib/explore/theme-match";
import type { SpotRow } from "@/types/backend";

function spot(partial: Partial<SpotRow>): SpotRow {
  return {
    id: partial.id ?? "id",
    name: partial.name ?? "Spot",
    rating: partial.rating ?? null,
    user_rating_count: partial.user_rating_count ?? 100,
    price_level: partial.price_level ?? null,
    lat: 0,
    lng: 0,
    address: null,
    photos: null,
    opening_hours: null,
    primary_type: partial.primary_type ?? null,
    vibe_tags: partial.vibe_tags ?? [],
    created_at: "",
    updated_at: "",
    phone_number: null,
    reservation_uri: null,
    hotpepper_url: null,
    booking_url: null,
  };
}

describe("themeMatchScore", () => {
  it("prefers explicit vibe_tags", () => {
    const tagged = spot({ vibe_tags: ["splurge"], price_level: null });
    const soft = spot({ vibe_tags: [], price_level: 3 });
    expect(themeMatchScore(tagged, "splurge")).toBeGreaterThan(
      themeMatchScore(soft, "splurge"),
    );
  });

  it("matches budget via cheap price or cafe-like type", () => {
    expect(
      matchesTheme(spot({ price_level: 1, vibe_tags: [] }), "budget-eat"),
    ).toBe(true);
    expect(
      matchesTheme(
        spot({ price_level: null, primary_type: "coffee_shop", vibe_tags: [] }),
        "budget-eat",
      ),
    ).toBe(true);
    expect(
      matchesTheme(spot({ price_level: 3, vibe_tags: [] }), "budget-eat"),
    ).toBe(false);
  });

  it("matches splurge via mid/high price when tag missing (rural soft fill)", () => {
    expect(matchesTheme(spot({ price_level: 2, vibe_tags: [] }), "splurge")).toBe(
      true,
    );
    expect(matchesTheme(spot({ price_level: 3, vibe_tags: [] }), "splurge")).toBe(
      true,
    );
    expect(
      matchesTheme(
        spot({ price_level: null, rating: 4.5, vibe_tags: [] }),
        "splurge",
      ),
    ).toBe(true);
    expect(
      matchesTheme(
        spot({ price_level: 1, rating: 4.8, vibe_tags: [] }),
        "splurge",
      ),
    ).toBe(false);
  });

  it("matches top-rated from rating alone", () => {
    expect(
      matchesTheme(spot({ rating: 4.3, vibe_tags: [] }), "top-rated"),
    ).toBe(true);
    expect(
      matchesTheme(spot({ rating: 3.9, vibe_tags: [] }), "top-rated"),
    ).toBe(false);
  });
});

describe("rankByThemeFit", () => {
  it("orders tagged spots ahead of soft matches", () => {
    const tagged = spot({ id: "t", vibe_tags: ["budget-eat"], price_level: 2 });
    const soft = spot({ id: "s", vibe_tags: [], price_level: 1 });
    const none = spot({ id: "n", vibe_tags: [], price_level: 3 });
    const ranked = rankByThemeFit([soft, none, tagged], "budget-eat").filter(
      (r) => matchesTheme(r, "budget-eat"),
    );
    expect(ranked.map((r) => r.id)).toEqual(["t", "s"]);
  });
});
