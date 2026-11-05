import { describe, expect, it } from "vitest";
import {
  AREA_EMPTY_RETRY_AFTER_MS,
  AREA_RETRY_AFTER_MS,
  areaFetchKey,
  isRetryDue,
  nextRetryAfter,
  parseLockResult,
} from "@/lib/places/area-fetch-state";

describe("area fetch timing", () => {
  const now = Date.parse("2026-11-05T00:00:00.000Z");

  it("waits 30 days after a search that returned places, 7 days after an empty one", () => {
    expect(Date.parse(nextRetryAfter(4, now)) - now).toBe(AREA_RETRY_AFTER_MS);
    expect(Date.parse(nextRetryAfter(0, now)) - now).toBe(AREA_EMPTY_RETRY_AFTER_MS);
  });

  it("treats a missing retry time as due, and a future one as waiting", () => {
    expect(isRetryDue(null, now)).toBe(true);
    expect(isRetryDue(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isRetryDue(new Date(now + 1000).toISOString(), now)).toBe(false);
  });

  it("buckets coordinates to about 500m and the radius to 500m", () => {
    expect(areaFetchKey(35.5310748, 139.6842689, 2_000)).toBe(
      areaFetchKey(35.532, 139.685, 2_200),
    );
    expect(areaFetchKey(35.5310748, 139.6842689, 2_000)).not.toBe(
      areaFetchKey(35.54, 139.6842689, 2_000),
    );
  });
});

describe("parseLockResult", () => {
  it("reads the lock payload, including a JSON string", () => {
    expect(parseLockResult({ acquired: true, lock_expires_at: "2026-11-05T00:00:30.000Z" })).toEqual({
      acquired: true,
      lockExpiresAt: "2026-11-05T00:00:30.000Z",
    });
    expect(parseLockResult('{"acquired":false,"lock_expires_at":"2026-11-05T00:00:30.000Z"}')).toEqual({
      acquired: false,
      lockExpiresAt: "2026-11-05T00:00:30.000Z",
    });
    expect(parseLockResult("not-json")).toEqual({ acquired: false, lockExpiresAt: null });
  });
});
