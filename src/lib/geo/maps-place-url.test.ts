import { describe, expect, it } from "vitest";
import { parseGoogleMapsPlaceUrl } from "@/lib/geo/maps-place-url";

describe("parseGoogleMapsPlaceUrl", () => {
  it("extracts ChIJ place id, name, and @coords", () => {
    const url =
      "https://www.google.com/maps/place/%E9%BA%BA%E5%B1%8B/@35.668419,139.7016359,17z/data=!3m1!4b1!4m6!3m5!1sChIJk6jaYkMvC18Rqtff7aLGDL0!8m2!3d35.668419!4d139.7016359";
    const parsed = parseGoogleMapsPlaceUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed!.placeId).toBe("ChIJk6jaYkMvC18Rqtff7aLGDL0");
    expect(parsed!.name).toBe("麺屋");
    expect(parsed!.lat).toBeCloseTo(35.668419, 5);
    expect(parsed!.lng).toBeCloseTo(139.7016359, 5);
  });

  it("reads the place id from a Maps app search link", () => {
    const url =
      "https://www.google.com/maps/search/?api=1&query=Test&query_place_id=ChIJk6jaYkMvC18Rqtff7aLGDL0";
    const parsed = parseGoogleMapsPlaceUrl(url);
    expect(parsed?.placeId).toBe("ChIJk6jaYkMvC18Rqtff7aLGDL0");
    expect(parsed?.name).toBe("Test");
  });

  it("rejects a search link that has no place id", () => {
    expect(
      parseGoogleMapsPlaceUrl("https://www.google.com/maps/search/?api=1&query=Test"),
    ).toBeNull();
  });

  it("reads a google.co.jp place page from the app", () => {
    const url =
      "https://www.google.co.jp/maps/place/%E9%BA%BA%E5%B1%8B/@35.66,139.70,17z/data=!4m2!3m1!1sChIJk6jaYkMvC18Rqtff7aLGDL0";
    const parsed = parseGoogleMapsPlaceUrl(url);
    expect(parsed?.placeId).toBe("ChIJk6jaYkMvC18Rqtff7aLGDL0");
    expect(parsed?.name).toBe("麺屋");
  });

  it("reads the app scheme when it names a place id", () => {
    const parsed = parseGoogleMapsPlaceUrl(
      "comgooglemaps://?q=place_id:ChIJk6jaYkMvC18Rqtff7aLGDL0",
    );
    expect(parsed?.placeId).toBe("ChIJk6jaYkMvC18Rqtff7aLGDL0");
  });

  it("accepts /maps/place with query_place_id", () => {
    const url =
      "https://www.google.com/maps/place/?q=place_id:ChIJk6jaYkMvC18Rqtff7aLGDL0";
    // path is /maps/place/ — ok; ChIJ still in string
    const parsed = parseGoogleMapsPlaceUrl(
      "https://www.google.com/maps/place/data=!4m2!3m1!1sChIJk6jaYkMvC18Rqtff7aLGDL0",
    );
    expect(parsed?.placeId).toBe("ChIJk6jaYkMvC18Rqtff7aLGDL0");
  });

  it("rejects non-place hosts and short links", () => {
    expect(
      parseGoogleMapsPlaceUrl("https://maps.app.goo.gl/abcdef"),
    ).toBeNull();
    expect(parseGoogleMapsPlaceUrl("https://example.com/maps/place/x")).toBeNull();
  });

  it("parses name + coords when place id is hex-only", () => {
    const url =
      "https://www.google.com/maps/place/Menya+Soul/@35.66,139.70,17z/data=!3m1!4b1!4m6!3m5!1s0x60188b:0xabc!8m2!3d35.66!4d139.70";
    const parsed = parseGoogleMapsPlaceUrl(url);
    expect(parsed?.placeId).toBeNull();
    expect(parsed?.name).toBe("Menya Soul");
    expect(parsed?.lat).toBeCloseTo(35.66, 2);
    expect(parsed?.lng).toBeCloseTo(139.7, 2);
  });
});
