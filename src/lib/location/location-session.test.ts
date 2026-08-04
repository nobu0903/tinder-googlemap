import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetLocationSessionForTests,
  saveLocationSession,
  shouldAcceptGpsUpdate,
} from "@/lib/location/location-session";

describe("shouldAcceptGpsUpdate", () => {
  beforeEach(() => {
    __resetLocationSessionForTests();
  });

  it("rejects GPS overwrite when source is manual", () => {
    saveLocationSession(
      { lat: 43.0618, lng: 141.3545 },
      "ready",
      { source: "manual" },
    );
    expect(
      shouldAcceptGpsUpdate(
        { lat: 43.0618, lng: 141.3545 },
        { lat: 43.1205, lng: 141.3689 },
        "manual",
      ),
    ).toBe(false);
  });

  it("accepts large GPS move when source is gps", () => {
    expect(
      shouldAcceptGpsUpdate(
        { lat: 43.0618, lng: 141.3545 },
        { lat: 43.1205, lng: 141.3689 },
        "gps",
      ),
    ).toBe(true);
  });

  it("rejects tiny GPS jitter", () => {
    expect(
      shouldAcceptGpsUpdate(
        { lat: 43.12, lng: 141.368 },
        { lat: 43.1201, lng: 141.3681 },
        "gps",
      ),
    ).toBe(false);
  });
});
