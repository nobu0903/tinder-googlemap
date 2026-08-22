"use client";

// useSwipeFeed — one card per spot; tracks seen IDs to prevent repeat loops.

import { useState, useEffect, useCallback, useRef } from "react";
import type { FeedSpot, SwipeAction, SwipeFeedItem } from "@/types/backend";
import {
  feedItemKey,
  isFeedNativeAd,
} from "@/types/backend";
import type { Coordinates } from "@/lib/hooks/use-location";
import { feedSpotNeedsHydrate } from "@/lib/places/enrichment-gate";
import {
  runSwipeFetchExclusive,
  swipeFetchKey,
} from "@/lib/feed/swipe-fetch-lock";
import { openCurrentNativeAd } from "@/lib/ads/native-ad-opener";

/** Refetch only when the queue is fully exhausted */
const REFETCH_WHEN_EMPTY = true;
/** Minimum gap between /api/swipe calls (ms) */
const MIN_FEED_FETCH_INTERVAL_MS = 2 * 60 * 1000;
/** Cap Place Details hydrates per browser session (photos + booking) */
const MAX_SESSION_HYDRATES = 16;

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
  /** True when a tag was requested but fewer than 6 vibe spots matched — classic fills in. */
  isSparseTheme: boolean;
  advance: () => void;
  recordSwipe: (action: SwipeAction) => void;
  /** Re-fetch Place Details photos after /api/photo 404 (expired media names). */
  refreshSpotPhotos: (spotId: string) => void;
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
  const [isSparseTheme, setIsSparseTheme] = useState(false);

  const fetchingRef = useRef(false);
  const queueRef = useRef<SwipeFeedItem[]>([]);
  const seenSpotIdsRef = useRef<Set<string>>(new Set());
  const hydrateRequestedRef = useRef<Set<string>>(new Set());
  const photoRefreshRequestedRef = useRef<Set<string>>(new Set());
  const sessionHydratesRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  const coordsRef = useRef<Coordinates | null>(coords);

  // ── Volatile-value refs (avoid stale closures without re-creating callbacks) ──
  const accessTokenRef = useRef(accessToken);
  const tagRef = useRef(tag);
  const enabledRef = useRef(enabled);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { tagRef.current = tag; }, [tag]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Location change: drop old-area cards and allow an immediate refetch.
  // Does NOT clear seenSpotIds or the free-tier swipe counter (absolute quota).
  const coordsKey =
    coords != null ? `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}` : null;
  const prevCoordsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    coordsRef.current = coords;
    if (coordsKey === prevCoordsKeyRef.current) return;
    const hadPrevious = prevCoordsKeyRef.current !== null;
    prevCoordsKeyRef.current = coordsKey;
    if (!hadPrevious || coordsKey === null) return;

    setQueue([]);
    queueRef.current = [];
    lastFetchAtRef.current = 0;
    setError(null);
    setIsSparseTheme(false);
  }, [coords, coordsKey]);

  // ── Page Visibility: pause all fetching when the tab is in the background ──
  const tabHiddenRef = useRef(false);
  useEffect(() => {
    const handleVisibility = () => {
      tabHiddenRef.current = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const lazyHydrateQueue = useCallback(async () => {
    const currentCoords = coordsRef.current;
    if (!currentCoords || queueRef.current.length === 0) return;
    if (sessionHydratesRef.current >= MAX_SESSION_HYDRATES) return;
    if (tabHiddenRef.current) return;

    const remaining = MAX_SESSION_HYDRATES - sessionHydratesRef.current;
    const candidates = queueRef.current
      .slice(0, 4)
      .filter(
        (item): item is FeedSpot =>
          !isFeedNativeAd(item) &&
          feedSpotNeedsHydrate(item) &&
          !hydrateRequestedRef.current.has(item.spotId),
      )
      .slice(0, Math.min(2, remaining));

    if (candidates.length === 0) return;

    const candidateIds = candidates.map((s) => s.spotId);
    for (const id of candidateIds) hydrateRequestedRef.current.add(id);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const token = accessTokenRef.current;
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/spots/hydrate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          spotIds: candidateIds,
          lat: currentCoords.lat,
          lng: currentCoords.lng,
        }),
      });
      if (!res.ok) {
        // Allow retry on rate-limit / transient errors
        for (const id of candidateIds) hydrateRequestedRef.current.delete(id);
        return;
      }

      sessionHydratesRef.current += candidateIds.length;

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
      for (const id of candidateIds) hydrateRequestedRef.current.delete(id);
      // Non-fatal
    }
  }, []);

  const refreshSpotPhotos = useCallback((spotId: string) => {
    if (!spotId) return;
    if (photoRefreshRequestedRef.current.has(spotId)) return;
    photoRefreshRequestedRef.current.add(spotId);

    const currentCoords = coordsRef.current;
    if (!currentCoords) return;

    void (async () => {
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        const token = accessTokenRef.current;
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch("/api/spots/hydrate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            spotIds: [spotId],
            lat: currentCoords.lat,
            lng: currentCoords.lng,
            refreshPhotos: true,
          }),
        });
        if (!res.ok) {
          photoRefreshRequestedRef.current.delete(spotId);
          return;
        }

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
        photoRefreshRequestedRef.current.delete(spotId);
      }
    })();
  }, []);

  /**
   * fetchFeed is intentionally stable (empty volatile deps).
   * accessToken, tag, enabled are accessed via refs to avoid this callback
   * being recreated on every Supabase JWT refresh (every ~1 hour), which
   * would otherwise cause the trigger effect below to fire and make an
   * unwanted API call when the queue happened to be empty.
   */
  const fetchFeed = useCallback(async () => {
    // Pause when tab is hidden (e.g. user minimised browser or closed lid)
    if (tabHiddenRef.current) return;
    if (!enabledRef.current || fetchingRef.current) return;

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

    const lockKey = swipeFetchKey(
      currentCoords.lat,
      currentCoords.lng,
      tagRef.current,
    );

    try {
      // Strict Mode remounts reset instance refs; share one in-flight fetch + result.
      const result = await runSwipeFetchExclusive(lockKey, async () => {
        const url = new URL("/api/swipe", window.location.origin);
        url.searchParams.set("lat", String(currentCoords.lat));
        url.searchParams.set("lng", String(currentCoords.lng));
        if (tagRef.current) url.searchParams.set("tag", tagRef.current);

        const exclude = [...seenSpotIdsRef.current].slice(-100);
        if (exclude.length > 0) {
          url.searchParams.set("exclude", exclude.join(","));
        }

        const headers: HeadersInit = {};
        if (accessTokenRef.current) {
          headers.Authorization = `Bearer ${accessTokenRef.current}`;
        }

        const res = await fetch(url.toString(), { headers });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ??
              `Feed API error: ${res.status}`,
          );
        }

        const data = await res.json();
        const newItems: SwipeFeedItem[] = data.spots ?? [];
        const vibeCount =
          typeof data.vibeSpotCount === "number" ? data.vibeSpotCount : null;
        return { newItems, vibeCount };
      });

      if (result.vibeCount !== null && tagRef.current) {
        setIsSparseTheme(result.vibeCount < 6);
      }

      setQueue((prev) => {
        const inQueue = new Set(prev.map(feedItemKey));
        const fresh = result.newItems.filter((item) => {
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
  }, [lazyHydrateQueue]);

  /**
   * Keep a stable ref to the latest fetchFeed so the trigger effect below
   * does NOT need fetchFeed in its dependency array.  Without this, any change
   * to fetchFeed (e.g. due to a Supabase JWT refresh changing accessToken) would
   * re-run the effect and potentially fire an unwanted API call.
   */
  const fetchFeedRef = useRef(fetchFeed);
  useEffect(() => { fetchFeedRef.current = fetchFeed; });

  const currentItemKey = queue[0] ? feedItemKey(queue[0]) : null;

  useEffect(() => {
    if (enabled && coords && queue.length > 0) void lazyHydrateQueue();
  }, [currentItemKey, queue.length, lazyHydrateQueue, enabled, coords]);

  // Trigger effect: only re-runs when queue length, enabled flag, or coords change.
  // fetchFeed is intentionally NOT a dependency — we access it via fetchFeedRef.
  // Use coordsKey (not coords object) so GPS noise / new object identity does not double-fetch.
  useEffect(() => {
    if (!enabled || !coords) return;
    const shouldFetch = REFETCH_WHEN_EMPTY
      ? queue.length === 0
      : queue.length <= 3;
    if (shouldFetch && !fetchingRef.current) {
      void fetchFeedRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, enabled, coordsKey]);

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
        if (action === "like") {
          openCurrentNativeAd();
        }
        advance();
        return;
      }

      seenSpotIdsRef.current.add(item.spotId);

      if (accessTokenRef.current) {
        fetch("/api/swipe/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessTokenRef.current}`,
          },
          body: JSON.stringify({ spotId: item.spotId, action }),
        }).catch(console.error);
      }

      advance();
    },
    [queue, advance],
  );

  return {
    currentItem: queue[0] ?? null,
    queueLength: queue.length,
    isInitialLoading,
    isRefetching,
    error,
    isSparseTheme,
    advance,
    recordSwipe,
    refreshSpotPhotos,
  };
}
