"use client";

// useSwipeFeed — one card per spot; tracks seen IDs to prevent repeat loops.

import { useState, useEffect, useCallback, useRef } from "react";
import type { FeedSpot, SwipeAction, SwipeFeedItem } from "@/types/backend";
import {
  feedItemKey,
  isFeedNativeAd,
} from "@/types/backend";
import type { Coordinates } from "@/lib/hooks/use-location";

/** Refetch only when the queue is fully exhausted */
const REFETCH_WHEN_EMPTY = true;
/** Minimum gap between /api/swipe calls (ms) */
const MIN_FEED_FETCH_INTERVAL_MS = 2 * 60 * 1000;
/** Cap Place Details hydrates per browser session */
const MAX_SESSION_HYDRATES = 4;

interface UseSwipeFeedOptions {
  tag?: string;
  accessToken?: string | null;
  coords: Coordinates | null;
  /** When false, skips all feed fetches */
  enabled?: boolean;
}

interface UseSwipeFeedReturn {
  currentItem: SwipeFeedItem | null;
  queueLength: number;
  isInitialLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  advance: () => void;
  recordSwipe: (action: SwipeAction) => void;
}

export function useSwipeFeed({
  tag,
  accessToken = null,
  coords,
  enabled = true,
}: UseSwipeFeedOptions): UseSwipeFeedReturn {
  const [queue, setQueue] = useState<SwipeFeedItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const queueRef = useRef<SwipeFeedItem[]>([]);
  const seenSpotIdsRef = useRef<Set<string>>(new Set());
  const hydrateRequestedRef = useRef<Set<string>>(new Set());
  const sessionHydratesRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  const coordsRef = useRef<Coordinates | null>(coords);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const lazyHydrateQueue = useCallback(async () => {
    const currentCoords = coordsRef.current;
    if (!currentCoords || queueRef.current.length === 0) return;
    if (sessionHydratesRef.current >= MAX_SESSION_HYDRATES) return;

    const remaining = MAX_SESSION_HYDRATES - sessionHydratesRef.current;
    const candidates = queueRef.current
      .slice(0, 2)
      .filter(
        (item): item is FeedSpot =>
          !isFeedNativeAd(item) &&
          item.photoCount === 0 &&
          !hydrateRequestedRef.current.has(item.spotId),
      )
      .slice(0, Math.min(1, remaining));

    if (candidates.length === 0) return;

    for (const s of candidates) hydrateRequestedRef.current.add(s.spotId);
    sessionHydratesRef.current += candidates.length;

    try {
      const res = await fetch("/api/spots/hydrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotIds: candidates.map((s) => s.spotId),
          lat: currentCoords.lat,
          lng: currentCoords.lng,
        }),
      });
      if (!res.ok) return;

      const data = (await res.json()) as { spots?: FeedSpot[] };
      const hydrated = data.spots ?? [];
      if (hydrated.length === 0) return;

      const byId = new Map(hydrated.map((s) => [s.spotId, s]));
      setQueue((prev) =>
        prev.map((item) => {
          if (isFeedNativeAd(item)) return item;
          return byId.get(item.spotId) ?? item;
        }),
      );
    } catch {
      // Non-fatal
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    if (!enabled || fetchingRef.current) return;
    const currentCoords = coordsRef.current;
    if (!currentCoords) return;

    const now = Date.now();
    const isBackground = queueRef.current.length > 0;
    if (
      isBackground &&
      now - lastFetchAtRef.current < MIN_FEED_FETCH_INTERVAL_MS
    ) {
      return;
    }

    fetchingRef.current = true;
    if (isBackground) setIsRefetching(true);
    else setIsInitialLoading(true);
    setError(null);

    try {
      const url = new URL("/api/swipe", window.location.origin);
      url.searchParams.set("lat", String(currentCoords.lat));
      url.searchParams.set("lng", String(currentCoords.lng));
      if (tag) url.searchParams.set("tag", tag);

      const exclude = [...seenSpotIdsRef.current];
      if (exclude.length > 0) {
        url.searchParams.set("exclude", exclude.join(","));
      }

      const headers: HeadersInit = {};
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Feed API error: ${res.status}`,
        );
      }

      const data = await res.json();
      const newItems: SwipeFeedItem[] = data.spots ?? [];

      setQueue((prev) => {
        const inQueue = new Set(prev.map(feedItemKey));
        const fresh = newItems.filter((item) => {
          const key = feedItemKey(item);
          if (isFeedNativeAd(item)) return !inQueue.has(key);
          return !seenSpotIdsRef.current.has(key) && !inQueue.has(key);
        });
        return [...prev, ...fresh];
      });
      lastFetchAtRef.current = Date.now();
      void lazyHydrateQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed.");
    } finally {
      setIsInitialLoading(false);
      setIsRefetching(false);
      fetchingRef.current = false;
    }
  }, [tag, accessToken, enabled, lazyHydrateQueue]);

  const currentItemKey = queue[0] ? feedItemKey(queue[0]) : null;

  useEffect(() => {
    if (enabled && coords && queue.length > 0) void lazyHydrateQueue();
  }, [currentItemKey, queue.length, lazyHydrateQueue, enabled, coords]);

  useEffect(() => {
    if (!enabled || !coords) return;
    const shouldFetch = REFETCH_WHEN_EMPTY
      ? queue.length === 0
      : queue.length <= 3;
    if (shouldFetch && !fetchingRef.current) {
      fetchFeed();
    }
  }, [queue.length, enabled, coords, fetchFeed]);

  const advance = useCallback(() => {
    setQueue((prev) => {
      const [head, ...rest] = prev;
      if (head && !isFeedNativeAd(head)) {
        seenSpotIdsRef.current.add(feedItemKey(head));
      }
      return rest;
    });
  }, []);

  const recordSwipe = useCallback(
    (action: SwipeAction) => {
      const item = queue[0];
      if (!item) return;

      if (isFeedNativeAd(item)) {
        advance();
        return;
      }

      seenSpotIdsRef.current.add(item.spotId);

      if (accessToken) {
        fetch("/api/swipe/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ spotId: item.spotId, action }),
        }).catch(console.error);
      }

      advance();
    },
    [queue, accessToken, advance],
  );

  return {
    currentItem: queue[0] ?? null,
    queueLength: queue.length,
    isInitialLoading,
    isRefetching,
    error,
    advance,
    recordSwipe,
  };
}
