import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  FREE_SWIPE_LIMIT,
  tokyoDayKey,
} from "@/lib/hooks/use-free-swipe-quota";

const STORAGE_KEY = "vibeloop:free-swipe-daily-v2";
const LEGACY_ABSOLUTE_KEY = "vibeloop:free-swipe-count";

function readCount(): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;
  const parsed = JSON.parse(raw) as { day: string; count: number };
  if (parsed.day !== tokyoDayKey()) return 0;
  return parsed.count;
}

function consumeFromStorage(): number {
  localStorage.removeItem(LEGACY_ABSOLUTE_KEY);
  const today = tokyoDayKey();
  const prev = readCount();
  if (prev >= FREE_SWIPE_LIMIT) return prev;
  const next = prev + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: today, count: next }));
  return next;
}

describe("free swipe daily quota", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("caps at FREE_SWIPE_LIMIT (10)", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: tokyoDayKey(), count: FREE_SWIPE_LIMIT }),
    );
    expect(consumeFromStorage()).toBe(FREE_SWIPE_LIMIT);
  });

  it("increments within the same Tokyo day", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: tokyoDayKey(), count: 3 }),
    );
    expect(consumeFromStorage()).toBe(4);
  });

  it("resets when stored day is not today", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: "2000-01-01", count: 10 }),
    );
    expect(consumeFromStorage()).toBe(1);
  });
});
