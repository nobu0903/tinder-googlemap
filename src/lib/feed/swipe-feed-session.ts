/**
 * In-memory swipe feed session — survives BottomNav route changes
 * (SwipeScreen unmount/remount) without calling /api/swipe again.
 *
 * Also owns a process-wide in-flight lock so React Strict Mode / remount
 * cannot start a second /api/swipe while one is already running.
 */

import type { SwipeFeedItem } from "@/types/backend";
import type { Coordinates } from "@/lib/hooks/use-location";
import { distanceMeters } from "@/lib/location/location-session";

/** Keep restored queues for 15 minutes of idle tab-switching */
export const SWIPE_FEED_SESSION_TTL_MS = 15 * 60 * 1000;
/** Treat as same feed area (GPS vs city-center shouldn't bust the cache) */
export const SWIPE_FEED_NEAR_M = 2_500;

export interface SwipeFeedSessionSnapshot {
  cacheKey: string;
  lat: number;
  lng: number;
  tag: string;
  queue: SwipeFeedItem[];
  seenSpotIds: string[];
  lastFetchAt: number;
  hydrateRequested: string[];
  sessionHydrates: number;
  isSparseTheme: boolean;
  savedAt: number;
}

let session: SwipeFeedSessionSnapshot | null = null;

/** Shared across hook instances — Strict Mode remount safe */
let inFlightFetch: Promise<void> | null = null;
let inFlightKey: string | null = null;

/** Stable key: ~11m grid + optional theme tag (debug / exact match) */
export function swipeFeedCacheKey(
  coords: Coordinates,
  tag?: string | null,
): string {
  return `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}|${tag ?? ""}`;
}

function isFresh(snap: SwipeFeedSessionSnapshot): boolean {
  return Date.now() - snap.savedAt <= SWIPE_FEED_SESSION_TTL_MS;
}

export function loadSwipeFeedSession(
  cacheKey: string,
): SwipeFeedSessionSnapshot | null {
  if (!session || session.cacheKey !== cacheKey) return null;
  if (!isFresh(session)) {
    session = null;
    return null;
  }
  return session;
}

/** Prefer exact key; otherwise same tag within SWIPE_FEED_NEAR_M. */
export function loadNearbySwipeFeedSession(
  coords: Coordinates,
  tag?: string | null,
): SwipeFeedSessionSnapshot | null {
  if (!session) return null;
  if (!isFresh(session)) {
    session = null;
    return null;
  }

  const normalizedTag = tag ?? "";
  if (session.tag !== normalizedTag) return null;

  const exact = swipeFeedCacheKey(coords, tag);
  if (session.cacheKey === exact) return session;

  const dist = distanceMeters(coords, { lat: session.lat, lng: session.lng });
  // Allow nearby hit even with empty queue so lastFetchAt / seen still restore
  if (dist <= SWIPE_FEED_NEAR_M) {
    return session;
  }
  return null;
}

export function saveSwipeFeedSession(
  snapshot: Omit<SwipeFeedSessionSnapshot, "savedAt">,
  options?: { allowEmptyOverwrite?: boolean },
): void {
  // Never clobber a warm queue with [] from a remount's first render.
  if (
    !options?.allowEmptyOverwrite &&
    snapshot.queue.length === 0 &&
    session &&
    isFresh(session) &&
    session.queue.length > 0 &&
    session.tag === snapshot.tag
  ) {
    const dist = distanceMeters(
      { lat: snapshot.lat, lng: snapshot.lng },
      { lat: session.lat, lng: session.lng },
    );
    if (dist <= SWIPE_FEED_NEAR_M) {
      session = {
        ...session,
        seenSpotIds: snapshot.seenSpotIds,
        lastFetchAt: Math.max(session.lastFetchAt, snapshot.lastFetchAt),
        hydrateRequested: snapshot.hydrateRequested,
        sessionHydrates: snapshot.sessionHydrates,
        isSparseTheme: snapshot.isSparseTheme,
        savedAt: Date.now(),
      };
      return;
    }
  }

  session = { ...snapshot, savedAt: Date.now() };
}

export function clearSwipeFeedSession(): void {
  session = null;
}

export function getInFlightFeedFetch(
  cacheKey: string,
): Promise<void> | null {
  if (inFlightFetch && inFlightKey === cacheKey) return inFlightFetch;
  // Nearby: if any fetch is in flight for same tag area, join it
  if (inFlightFetch && inFlightKey) {
    const flyingTag = inFlightKey.split("|")[1] ?? "";
    const wantTag = cacheKey.split("|")[1] ?? "";
    if (flyingTag === wantTag) return inFlightFetch;
  }
  return null;
}

export function runFeedFetchExclusive(
  cacheKey: string,
  task: () => Promise<void>,
): Promise<void> {
  const existing = getInFlightFeedFetch(cacheKey);
  if (existing) return existing;

  const promise = task().finally(() => {
    if (inFlightFetch === promise) {
      inFlightFetch = null;
      inFlightKey = null;
    }
  });
  inFlightFetch = promise;
  inFlightKey = cacheKey;
  return promise;
}

/** Test helper */
export function __resetSwipeFeedSessionForTests(): void {
  session = null;
  inFlightFetch = null;
  inFlightKey = null;
}
