"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Absolute free-tier swipe cap (not per location). */
export const FREE_SWIPE_LIMIT = 100;

/** Canonical key (correct spelling). */
const STORAGE_KEY = "vibeloop:free-swipe-count";
/** Legacy typo key from early builds — migrated on read. */
const LEGACY_STORAGE_KEY = "vibelooop:free-swipe-count";

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function migrateLegacyKey(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEY) != null) return;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy == null) return;
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function readStored(): number {
  if (typeof window === "undefined") return 0;
  try {
    migrateLegacyKey();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const count = Number(raw);
    if (!Number.isFinite(count)) return 0;
    return Math.min(FREE_SWIPE_LIMIT, Math.max(0, Math.floor(count)));
  } catch {
    return 0;
  }
}

function writeStored(count: number) {
  if (typeof window === "undefined") return;
  migrateLegacyKey();
  localStorage.setItem(
    STORAGE_KEY,
    String(Math.min(FREE_SWIPE_LIMIT, Math.max(0, count))),
  );
  emitChange();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === LEGACY_STORAGE_KEY ||
      event.key === null
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeIsClient(onStoreChange: () => void) {
  void onStoreChange;
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
 * Free-tier swipe counter. Absolute across all locations —
 * changing area does NOT reset the count.
 */
export function useFreeSwipeQuota(): UseFreeSwipeQuotaReturn {
  const isClient = useSyncExternalStore(
    subscribeIsClient,
    () => true,
    () => false,
  );
  const used = useSyncExternalStore(subscribe, readStored, () => 0);

  const consume = useCallback(() => {
    if (!isClient) return;
    const prev = readStored();
    if (prev >= FREE_SWIPE_LIMIT) return;
    writeStored(prev + 1);
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
