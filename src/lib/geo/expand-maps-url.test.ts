import { describe, expect, it, vi } from "vitest";
import { expandMapsPlaceUrl, type MapsHop } from "@/lib/geo/expand-maps-url";

const PLACE =
  "https://www.google.com/maps/place/%E9%BA%BA%E5%B1%8B/@35.668419,139.7016359,17z/data=!3m1!4b1!4m6!3m5!1sChIJk6jaYkMvC18Rqtff7aLGDL0!8m2!3d35.668419!4d139.7016359";

function hops(locations: Array<string | null>) {
  const seen: string[] = [];
  const requestHop = vi.fn(async (url: URL): Promise<MapsHop> => {
    seen.push(url.toString());
    const location = locations[seen.length - 1] ?? null;
    return { status: location ? 302 : 200, location };
  });
  return { requestHop, seen };
}

describe("expandMapsPlaceUrl", () => {
  it("does not open a place URL that is already complete", async () => {
    const { requestHop } = hops([]);
    await expect(expandMapsPlaceUrl(PLACE, requestHop)).resolves.toBe(PLACE);
    expect(requestHop).not.toHaveBeenCalled();
  });

  it("does not open a short link from another site", async () => {
    const { requestHop } = hops(["https://example.com/maps/place/x"]);
    await expect(expandMapsPlaceUrl("https://example.com/abc", requestHop)).resolves.toBe(
      "https://example.com/abc",
    );
    expect(requestHop).not.toHaveBeenCalled();
  });

  it("follows a cid link from the app to the place page", async () => {
    const { requestHop, seen } = hops([PLACE]);
    await expect(
      expandMapsPlaceUrl("https://maps.google.com/?cid=12345678901234", requestHop),
    ).resolves.toBe(PLACE);
    expect(seen).toEqual(["https://maps.google.com/?cid=12345678901234"]);
  });

  it("follows the link inside an app share that also contains the shop name", async () => {
    const { requestHop } = hops([PLACE]);
    await expect(
      expandMapsPlaceUrl("https://maps.app.goo.gl/abcdef\n麺屋", requestHop),
    ).resolves.toBe(PLACE);
    expect(requestHop).toHaveBeenCalledTimes(1);
  });

  it("follows a maps.app.goo.gl link to the place page", async () => {
    const { requestHop, seen } = hops([PLACE]);
    await expect(expandMapsPlaceUrl("https://maps.app.goo.gl/abcdef", requestHop)).resolves.toBe(
      PLACE,
    );
    expect(seen).toEqual(["https://maps.app.goo.gl/abcdef"]);
  });

  it("stops when a hop leaves Google Maps", async () => {
    const { requestHop, seen } = hops(["https://evil.example/maps/place/x"]);
    await expect(expandMapsPlaceUrl("https://maps.app.goo.gl/abcdef", requestHop)).rejects.toThrow(
      /place page/,
    );
    expect(seen).toEqual(["https://maps.app.goo.gl/abcdef"]);
  });

  it("stops when the short link does not redirect", async () => {
    const { requestHop } = hops([null]);
    await expect(expandMapsPlaceUrl("https://maps.app.goo.gl/abcdef", requestHop)).rejects.toThrow(
      /place page/,
    );
  });

  it("stops after too many hops", async () => {
    const { requestHop } = hops([
      "https://www.google.com/maps/search/a",
      "https://www.google.com/maps/search/b",
      "https://www.google.com/maps/search/c",
      "https://www.google.com/maps/search/d",
    ]);
    await expect(expandMapsPlaceUrl("https://maps.app.goo.gl/abcdef", requestHop)).rejects.toThrow(
      /place page/,
    );
    expect(requestHop).toHaveBeenCalledTimes(4);
  });

  it("rejects a short link that is not https", async () => {
    const { requestHop } = hops([PLACE]);
    await expect(expandMapsPlaceUrl("http://maps.app.goo.gl/abcdef", requestHop)).resolves.toBe(
      "http://maps.app.goo.gl/abcdef",
    );
    expect(requestHop).not.toHaveBeenCalled();
  });
});
