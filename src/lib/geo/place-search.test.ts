import { describe, expect, it } from "vitest";
import { firstPlaceHit, nominatimSearchUrl } from "@/lib/geo/place-search";

describe("firstPlaceHit", () => {
  it("reads the first place name and coordinates", () => {
    const hit = firstPlaceHit([
      {
        name: "吉祥寺",
        display_name: "吉祥寺, 武蔵野市, 東京都, 日本",
        lat: "35.7033",
        lon: "139.5797",
      },
    ]);
    expect(hit).toEqual({ lat: 35.7033, lng: 139.5797, label: "吉祥寺" });
  });

  it("rejects an empty list and a non-numeric point", () => {
    expect(firstPlaceHit([])).toBeNull();
    expect(firstPlaceHit([{ name: "横浜", lat: "nope", lon: "139.6" }])).toBeNull();
  });
});

describe("nominatimSearchUrl", () => {
  it("asks for one result in Japan", () => {
    const url = new URL(nominatimSearchUrl("吉祥寺"));
    expect(url.searchParams.get("q")).toBe("吉祥寺");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("countrycodes")).toBe("jp");
  });
});
