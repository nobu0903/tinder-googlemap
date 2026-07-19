"use client";

import { useCallback, useEffect, useState } from "react";

/** Absolute free-tier swipe cap (not per location). */
export const FREE_SWIPE_LIMIT = 20;

const STORAGE_KEY = "vibelooop:free-swipe-count";

function readStored(): number {
  if (typeof window === "undefined") return 0;
  try {
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
  localStorage.setItem(
    STORAGE_KEY,
    String(Math.min(FREE_SWIPE_LIMIT, Math.max(0, count))),
  );
}

interface UseFreeSwipeQuotaReturn {
  used: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
  /** Increment by 1 for a real spot swipe (not ads). No-op at limit. */
  consume: () => void;
}

/**
 * Free-tier swipe counter. Absolute across all locations —
 * changing area does NOT reset the count.
 */
export function useFreeSwipeQuota(): UseFreeSwipeQuotaReturn {
  const [used, setUsed] = useState(0);

  useEffect(() => {
    setUsed(readStored());
  }, []);

  const consume = useCallback(() => {
    setUsed((prev) => {
      if (prev >= FREE_SWIPE_LIMIT) return prev;
      const next = prev + 1;
      writeStored(next);
      return next;
    });
  }, []);

  return {
    used,
    limit: FREE_SWIPE_LIMIT,
    remaining: Math.max(0, FREE_SWIPE_LIMIT - used),
    isLimitReached: used >= FREE_SWIPE_LIMIT,
    consume,
  };
}
