import { describe, expect, it } from "vitest";
import {
  extractPlacesPhotoName,
  stripPhotoApiKey,
  toClientPhotoUrl,
  withPhotoMaxWidth,
} from "@/lib/places/photo-url";

const RESOURCE = "places/ChIJtest/photos/AW-photo";
const LEGACY = `https://places.googleapis.com/v1/${RESOURCE}/media?maxWidthPx=800&key=SECRET_KEY`;
const KEYLESS = `https://places.googleapis.com/v1/${RESOURCE}/media?maxWidthPx=800`;

describe("extractPlacesPhotoName", () => {
  it("parses legacy Google media URLs", () => {
    expect(extractPlacesPhotoName(LEGACY)).toBe(RESOURCE);
  });

  it("parses keyless Google media URLs", () => {
    expect(extractPlacesPhotoName(KEYLESS)).toBe(RESOURCE);
  });

  it("parses proxy URLs and raw names", () => {
    expect(extractPlacesPhotoName(`/api/photo?name=${encodeURIComponent(RESOURCE)}`)).toBe(
      RESOURCE,
    );
    expect(extractPlacesPhotoName(RESOURCE)).toBe(RESOURCE);
  });
});

describe("stripPhotoApiKey", () => {
  it("removes key from Places media URL", () => {
    expect(stripPhotoApiKey(LEGACY)).not.toContain("key=");
    expect(stripPhotoApiKey(LEGACY)).toContain("maxWidthPx=800");
  });
});

describe("toClientPhotoUrl", () => {
  it("never exposes the API key", () => {
    const client = toClientPhotoUrl(LEGACY, 400);
    expect(client).toBe(
      `/api/photo?name=${encodeURIComponent(RESOURCE)}&maxWidthPx=400`,
    );
    expect(client).not.toContain("SECRET");
    expect(client).not.toContain("key=");
  });
});

describe("withPhotoMaxWidth", () => {
  it("rewrites legacy Places URLs onto the proxy", () => {
    const out = withPhotoMaxWidth(LEGACY, 400);
    expect(out).toContain("/api/photo?");
    expect(out).toContain("maxWidthPx=400");
    expect(out).not.toContain("key=");
    expect(out).not.toContain("maxWidthPx=800");
  });

  it("updates maxWidthPx on existing proxy URLs", () => {
    const src = toClientPhotoUrl(RESOURCE, 800);
    expect(withPhotoMaxWidth(src, 400)).toContain("maxWidthPx=400");
  });

  it("leaves unrelated URLs unchanged (aside from key strip)", () => {
    const src = "https://images.unsplash.com/photo.jpg";
    expect(withPhotoMaxWidth(src, 400)).toBe(src);
  });
});
