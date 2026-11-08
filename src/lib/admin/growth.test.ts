import { describe, expect, it } from "vitest";
import {
  addDateDays,
  buildGrowthReport,
  formatLikePercent,
  parseStoredInstant,
  tokyoDateKey,
  type FeedbackPreview,
} from "@/lib/admin/growth";

const NOW = new Date("2026-11-05T15:30:00Z");

describe("tokyo days", () => {
  it("rolls the date at 00:00 in Tokyo, which is 15:00 UTC", () => {
    expect(tokyoDateKey(new Date("2026-11-05T14:59:59Z"))).toBe("2026-11-05");
    expect(tokyoDateKey(new Date("2026-11-05T15:00:00Z"))).toBe("2026-11-06");
  });

  it("treats a zone-less timestamp as UTC", () => {
    const instant = parseStoredInstant("2026-11-05 15:00:00");
    expect(instant?.toISOString()).toBe("2026-11-05T15:00:00.000Z");
    expect(instant && tokyoDateKey(instant)).toBe("2026-11-06");
  });

  it("shifts a calendar key without using the machine timezone", () => {
    expect(addDateDays("2026-11-06", -29)).toBe("2026-10-08");
    expect(addDateDays("2026-11-06", -6)).toBe("2026-10-31");
  });
});

describe("buildGrowthReport", () => {
  const recent: FeedbackPreview = {
    id: "9",
    area: "swipe",
    kind: "bug",
    message: "カードが止まった",
    extra: null,
    createdAt: "2026-11-05T16:00:00Z",
  };

  function report() {
    return buildGrowthReport({
      now: NOW,
      signups: [
        { createdAt: "2026-11-05T15:10:00Z" },
        { createdAt: "2026-11-05T14:00:00Z" },
        { createdAt: "2026-10-07T15:00:00Z" },
        { createdAt: "2026-01-01T00:00:00Z" },
        { createdAt: "not-a-date" },
      ],
      swipes: [
        { userId: "a", action: "like", createdAt: "2026-11-05 15:10:00" },
        { userId: "a", action: "dislike", createdAt: "2026-11-05 16:00:00" },
        { userId: "b", action: "like", createdAt: "2026-11-04T12:00:00Z" },
        { userId: "a", action: "like", createdAt: "2026-11-04T12:00:00Z" },
        { userId: "c", action: "dislike", createdAt: "2026-10-01T00:00:00Z" },
      ],
      feedback: [
        { createdAt: "2026-11-05T16:00:00Z" },
        { createdAt: "2026-11-01T00:00:00Z" },
        { createdAt: "2026-01-01T00:00:00Z" },
      ],
      recentFeedback: [recent],
    });
  }

  it("counts signups on Tokyo days, and keeps older people in the total", () => {
    const result = report();
    expect(result.today).toBe("2026-11-06");
    expect(result.signups).toEqual({ today: 1, days7: 2, days30: 3, total: 4 });
  });

  it("counts a person once per day, and once across the window", () => {
    const result = report();
    expect(result.swipers).toEqual({ today: 1, days7: 2, days30: 2 });
    const today = result.days[result.days.length - 1];
    expect(today.date).toBe("2026-11-06");
    expect(today.swipers).toBe(1);
    expect(today.swipes).toBe(2);
    expect(today.likes).toBe(1);
  });

  it("uses new swipes in the window for the like share", () => {
    const result = report();
    expect(result.likes.today).toEqual({ likes: 1, swipes: 2, ratio: 0.5 });
    expect(result.likes.days7).toEqual({ likes: 3, swipes: 4, ratio: 0.75 });
    expect(formatLikePercent(result.likes.today.ratio)).toBe("50%");
    expect(formatLikePercent(null)).toBe("—");
  });

  it("leaves a day with no swipes as an empty ratio", () => {
    const result = buildGrowthReport({
      now: NOW,
      signups: [],
      swipes: [],
      feedback: [],
      recentFeedback: [],
    });
    expect(result.likes.today.ratio).toBeNull();
    expect(result.days).toHaveLength(30);
    expect(result.days[0].date).toBe("2026-10-08");
    expect(result.days.every((day) => day.signups === 0)).toBe(true);
  });

  it("counts a guest browser as a person without adding a swipe", () => {
    const result = buildGrowthReport({
      now: NOW,
      signups: [],
      swipes: [],
      guestDays: [{ guestId: "g-1", userId: null, swipeDate: "2026-11-06" }],
      feedback: [],
      recentFeedback: [],
    });
    expect(result.swipers).toEqual({ today: 1, days7: 1, days30: 1 });
    expect(result.likes.today).toEqual({ likes: 0, swipes: 0, ratio: null });
    expect(result.days[result.days.length - 1].swipers).toBe(1);
  });

  it("counts a signed-in browser and that account as one person", () => {
    const result = buildGrowthReport({
      now: NOW,
      signups: [],
      swipes: [{ userId: "a", action: "like", createdAt: "2026-11-05 16:00:00" }],
      guestDays: [{ guestId: "g-1", userId: "a", swipeDate: "2026-11-06" }],
      feedback: [],
      recentFeedback: [],
    });
    expect(result.swipers.today).toBe(1);
    expect(result.likes.today.swipes).toBe(1);
  });

  it("keeps an unsigned browser separate from a logged-in person", () => {
    const result = buildGrowthReport({
      now: NOW,
      signups: [],
      swipes: [{ userId: "a", action: "like", createdAt: "2026-11-05 16:00:00" }],
      guestDays: [{ guestId: "g-1", userId: null, swipeDate: "2026-11-06" }],
      feedback: [],
      recentFeedback: [],
    });
    expect(result.swipers.today).toBe(2);
  });

  it("ignores a guest mark older than 30 days", () => {
    const result = buildGrowthReport({
      now: NOW,
      signups: [],
      swipes: [],
      guestDays: [{ guestId: "g-old", userId: null, swipeDate: "2026-10-01" }],
      feedback: [],
      recentFeedback: [],
    });
    expect(result.swipers.days30).toBe(0);
  });

  it("counts feedback inside the windows and keeps the recent text", () => {
    const result = report();
    expect(result.feedback.today).toBe(1);
    expect(result.feedback.days7).toBe(2);
    expect(result.feedback.days30).toBe(2);
    expect(result.feedback.recent).toEqual([recent]);
  });
});
