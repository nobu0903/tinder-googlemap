import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { FREE_SWIPE_LIMIT } from "@/lib/hooks/use-free-swipe-quota";

const STORAGE_KEY = "vibeloop:free-swipe-count";
const LEGACY_STORAGE_KEY = "vibelooop:free-swipe-count";

/**
 * Mirrors consume()'s storage-first logic (BUG-004): never persist from an
 * implicit uninitialized 0 — always read localStorage before incrementing.
 * Also mirrors BUG-027 legacy key migration.
 */
function migrateLegacyKey(): void {
  if (localStorage.getItem(STORAGE_KEY) != null) return;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy == null) return;
  localStorage.setItem(STORAGE_KEY, legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function consumeFromStorage(): number {
  migrateLegacyKey();
  const raw = localStorage.getItem(STORAGE_KEY);
  const prev = (() => {
    if (!raw) return 0;
    const count = Number(raw);
    if (!Number.isFinite(count)) return 0;
    return Math.min(FREE_SWIPE_LIMIT, Math.max(0, Math.floor(count)));
  })();
  if (prev >= FREE_SWIPE_LIMIT) return prev;
  const next = prev + 1;
  localStorage.setItem(STORAGE_KEY, String(next));
  return next;
}

describe("free swipe quota storage (BUG-004 / BUG-027)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does not reset a capped count when consume reads storage first", () => {
    localStorage.setItem(STORAGE_KEY, String(FREE_SWIPE_LIMIT));
    expect(consumeFromStorage()).toBe(FREE_SWIPE_LIMIT);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(FREE_SWIPE_LIMIT));
  });

  it("increments from persisted value, not from implicit 0", () => {
    localStorage.setItem(STORAGE_KEY, "7");
    expect(consumeFromStorage()).toBe(8);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("8");
  });

  it("migrates legacy typo key on consume", () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, "12");
    expect(consumeFromStorage()).toBe(13);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("13");
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});
