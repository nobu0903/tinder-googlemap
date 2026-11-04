import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpotRow } from "@/types/backend";

const upsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: () => ({ upsert }),
  },
}));

const { enrichSpotFromDetails } = await import("@/lib/places/ingest");

function bookedRow(overrides: Partial<SpotRow> = {}): SpotRow {
  return {
    id: "ChIJtest",
    name: "Cached Name",
    rating: 4.3,
    user_rating_count: 120,
    price_level: 2,
    lat: 35.6,
    lng: 139.7,
    address: "Tokyo",
    photos: [
      { url: "/api/photo?name=places%2FChIJtest%2Fphotos%2Fold", width: 400, height: 300 },
    ],
    opening_hours: {
      openNow: true,
      periods: [],
      weekdayDescriptions: ["Monday: 11:00 – 22:00"],
    },
    primary_type: "restaurant",
    vibe_tags: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    phone_number: null,
    reservation_uri: null,
    hotpepper_url: "",
    booking_url: null,
    ...overrides,
  };
}

function mockDetailsResponse(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

describe("enrichSpotFromDetails with the photos-only field mask", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    upsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    upsert.mockReset();
  });

  it("merges new photos onto the cached row instead of crashing on missing displayName", async () => {
    mockDetailsResponse({
      id: "ChIJtest",
      photos: [{ name: "places/ChIJtest/photos/new", widthPx: 800, heightPx: 600 }],
    });

    const result = await enrichSpotFromDetails("ChIJtest", bookedRow());

    expect(result?.name).toBe("Cached Name");
    expect(result?.photos).toHaveLength(1);
    expect(result?.photos?.[0].url).toContain("ChIJtest/photos/new");
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("keeps cached photos when an unforced refresh returns none", async () => {
    mockDetailsResponse({ id: "ChIJtest" });
    const cached = bookedRow();

    const result = await enrichSpotFromDetails("ChIJtest", cached);

    expect(result?.photos).toEqual(cached.photos);
  });

  it("drops cached photos when a forced refresh returns none", async () => {
    mockDetailsResponse({ id: "ChIJtest" });

    const result = await enrichSpotFromDetails("ChIJtest", bookedRow(), undefined, {
      forcePhotos: true,
    });

    expect(result?.photos).toEqual([]);
  });
});
