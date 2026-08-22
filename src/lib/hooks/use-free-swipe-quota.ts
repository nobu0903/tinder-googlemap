"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Free swipes allowed per Tokyo calendar day. */
export const FREE_SWIPE_LIMIT = 10;

/** Canonical key (v2 daily quota). */
const STORAGE_KEY = "vibeloop:free-swipe-daily-v2";
/** Previous absolute-count key — ignored after daily model (fresh start). */
const LEGACY_ABSOLUTE_KEY = "vibeloop:free-swipe-count";
const LEGACY_TYPO_KEY = "vibelooop:free-swipe-count";

const listeners = new Set<() => void>();

/** Cached server snapshot — must be referentially stable. */
const SERVER_SNAPSHOT = 0;

function emitChange() {
  for (const listener of listeners) listener();
}

/** YYYY-MM-DD in Asia/Tokyo. */
export function tokyoDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

interface DailyRecord {
  day: string;
  count: number;
}

function parseRecord(raw: string | null): DailyRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyRecord>;
    if (
      typeof parsed.day === "string" &&
      typeof parsed.count === "number" &&
      Number.isFinite(parsed.count)
    ) {
      return {
        day: parsed.day,
        count: Math.min(
          FREE_SWIPE_LIMIT,
          Math.max(0, Math.floor(parsed.count)),
        ),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function clearLegacyKeys(): void {
  try {
    localStorage.removeItem(LEGACY_ABSOLUTE_KEY);
    localStorage.removeItem(LEGACY_TYPO_KEY);
  } catch {
    // ignore
  }
}

/** Returns today's used count (0 if missing / other day). Primitive for stable snapshots. */
function readUsedCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    clearLegacyKeys();
    const today = tokyoDayKey();
    const record = parseRecord(localStorage.getItem(STORAGE_KEY));
    if (!record || record.day !== today) return 0;
    return record.count;
  } catch {
    return 0;
  }
}

function writeUsedCount(count: number) {
  if (typeof window === "undefined") return;
  const capped = Math.min(FREE_SWIPE_LIMIT, Math.max(0, count));
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ day: tokyoDayKey(), count: capped }),
  );
  emitChange();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeIsClient(_onStoreChange: () => void) {
  return () => {};
}

interface UseFreeSwipeQuotaReturn {
  used: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
  consume: () => void;
}

/**
 * Free-tier swipe counter — 10 swipes per Asia/Tokyo calendar day.
 * Resets at Tokyo midnight (00:00 JST).
 */
export function useFreeSwipeQuota(): UseFreeSwipeQuotaReturn {
  const isClient = useSyncExternalStore(
    subscribeIsClient,
    () => true,
    () => false,
  );
  const used = useSyncExternalStore(
    subscribe,
    readUsedCount,
    () => SERVER_SNAPSHOT,
  );

  const consume = useCallback(() => {
    if (!isClient) return;
    const prev = readUsedCount();
    if (prev >= FREE_SWIPE_LIMIT) return;
    writeUsedCount(prev + 1);
  }, [isClient]);

  const safeUsed = isClient ? used : 0;
  const isLimitReached = !isClient || used >= FREE_SWIPE_LIMIT;

  return {
    used: safeUsed,
    limit: FREE_SWIPE_LIMIT,
    remaining: isClient ? Math.max(0, FREE_SWIPE_LIMIT - used) : 0,
    isLimitReached,
    consume,
  };
}
