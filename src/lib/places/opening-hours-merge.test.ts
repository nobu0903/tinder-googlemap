import { describe, expect, it } from "vitest";
import { mergeOpeningHours } from "@/lib/places/ingest";

describe("mergeOpeningHours", () => {
  it("keeps existing weekly lines when Search returns periods only", () => {
    const existing = {
      openNow: false,
      periods: [
        {
          open: { day: 1, hour: 11, minute: 0 },
          close: { day: 1, hour: 22, minute: 0 },
        },
      ],
      weekdayDescriptions: ["月曜日: 11:00～22:00"],
    };
    const incoming = {
      openNow: true,
      periods: [
        {
          open: { day: 2, hour: 10, minute: 0 },
          close: { day: 2, hour: 21, minute: 0 },
        },
      ],
      weekdayDescriptions: [],
    };

    const merged = mergeOpeningHours(incoming, existing);
    expect(merged?.weekdayDescriptions).toEqual(["月曜日: 11:00～22:00"]);
    expect(merged?.periods).toEqual(incoming.periods);
    expect(merged?.openNow).toBe(true);
  });

  it("prefers incoming weekly lines when present", () => {
    const merged = mergeOpeningHours(
      {
        openNow: true,
        periods: [],
        weekdayDescriptions: ["火曜日: 12:00～20:00"],
      },
      {
        openNow: false,
        periods: [],
        weekdayDescriptions: ["月曜日: 11:00～22:00"],
      },
    );
    expect(merged?.weekdayDescriptions).toEqual(["火曜日: 12:00～20:00"]);
  });
});
