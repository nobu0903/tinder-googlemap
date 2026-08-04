"use client";

// useSwipeFeed — one card per spot; tracks seen IDs to prevent repeat loops.
// Queue / seen / hydrate / in-flight fetch live in a module session so
// BottomNav navigations and React Strict Mode remounts do not double-hit
// /api/swipe.

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type MutableRefObject,
} from "react";
import type { FeedSpot, SwipeAction, SwipeFeedItem } from "@/types/backend";
import {
  feedItemKey,
  isFeedNativeAd,
} from "@/types/backend";
import type { Coordinates } from "@/lib/hooks/use-location";
import { feedSpotNeedsHydrate } from "@/lib/places/enrichment-gate";
import { openCurrentNativeAd } from "@/lib/ads/native-ad-opener";
import {
  loadNearbySwipeFeedSession,
  runFeedFetchExclusive,
  saveSwipeFeedSession,
  swipeFeedCacheKey,
  type SwipeFeedSessionSnapshot,
} from "@/lib/feed/swipe-feed-session";

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
  nextItem: SwipeFeedItem | null;
  queueLength: number;
  isInitialLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  isSparseTheme: boolean;
  advance: () => void;
  recordSwipe: (action: SwipeAction) => void;
}

function applySnapshotToRefs(
  snap: SwipeFeedSessionSnapshot,
  refs: {
    queueRef: MutableRefObject<SwipeFeedItem[]>;
    seenSpotIdsRef: MutableRefObject<Set<string>>;
    hydrateRequestedRef: MutableRefObject<Set<string>>;
    sessionHydratesRef: MutableRefObject<number>;
    lastFetchAtRef: MutableRefObject<number>;
    activeCacheKeyRef: MutableRefObject<string | null>;
  },
) {
  refs.queueRef.current = snap.queue;
  refs.seenSpotIdsRef.current = new Set(snap.seenSpotIds);
  refs.hydrateRequestedRef.current = new Set(snap.hydrateRequested);
  refs.sessionHydratesRef.current = snap.sessionHydrates;
  refs.lastFetchAtRef.current = snap.lastFetchAt;
  refs.activeCacheKeyRef.current = snap.cacheKey;
}

export function useSwipeFeed({
  tag,
  accessToken = null,
  coords,
  enabled = true,
}: UseSwipeFeedOptions): UseSwipeFeedReturn {
  const initialSnap =
    coords != null ? loadNearbySwipeFeedSession(coords, tag) : null;

  const [queue, setQueue] = useState<SwipeFeedItem[]>(
    () => initialSnap?.queue ?? [],
  );
  const [isInitialLoading, setIsInitialLoading] = useState(
    () => !(initialSnap && initialSnap.queue.length > 0),
  );
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSparseTheme, setIsSparseTheme] = useState(
    () => initialSnap?.isSparseTheme ?? false,
  );

  const queueRef = useRef<SwipeFeedItem[]>(initialSnap?.queue ?? []);
  const seenSpotIdsRef = useRef<Set<string>>(
    new Set(initialSnap?.seenSpotIds ?? []),
  );
  const hydrateRequestedRef = useRef<Set<string>>(
    new Set(initialSnap?.hydrateRequested ?? []),
  );
  const sessionHydratesRef = useRef(initialSnap?.sessionHydrates ?? 0);
  const lastFetchAtRef = useRef(initialSnap?.lastFetchAt ?? 0);
  const coordsRef = useRef<Coordinates | null>(coords);
  const activeCacheKeyRef = useRef<string | null>(
    initialSnap?.cacheKey ?? null,
  );

  const accessTokenRef = useRef(accessToken);
  const tagRef = useRef(tag);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);
  useEffect(() => {
    tagRef.current = tag;
  }, [tag]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const coordsKey =
    coords != null ? `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}` : null;

  // Restore when area / theme identity changes (not on every remount with same area).
  useEffect(() => {
    coordsRef.current = coords;
    if (!coords) {
      activeCacheKeyRef.current = null;
      return;
    }

    const key = swipeFeedCacheKey(coords, tag);
    const cached = loadNearbySwipeFeedSession(coords, tag);

    if (cached && cached.queue.length > 0) {
      if (activeCacheKeyRef.current === cached.cacheKey && queueRef.current.length > 0) {
        return;
      }
      applySnapshotToRefs(cached, {
        queueRef,
        seenSpotIdsRef,
        hydrateRequestedRef,
        sessionHydratesRef,
        lastFetchAtRef,
        activeCacheKeyRef,
      });
      setQueue(cached.queue);
      setIsSparseTheme(cached.isSparseTheme);
      setError(null);
      setIsInitialLoading(false);
      return;
    }

    // Warm session with empty queue (swiped through) — keep seen / lastFetchAt
    if (cached) {
      applySnapshotToRefs(cached, {
        queueRef,
        seenSpotIdsRef,
        hydrateRequestedRef,
        sessionHydratesRef,
        lastFetchAtRef,
        activeCacheKeyRef,
      });
      setQueue([]);
      setIsSparseTheme(cached.isSparseTheme);
      return;
    }

    if (activeCacheKeyRef.current === key) return;

    activeCacheKeyRef.current = key;
    setQueue([]);
    queueRef.current = [];
    seenSpotIdsRef.current = new Set();
    hydrateRequestedRef.current = new Set();
    sessionHydratesRef.current = 0;
    lastFetchAtRef.current = 0;
    setIsSparseTheme(false);
    setError(null);
  }, [coords, coordsKey, tag]);

  // Persist — never blank out a warm queue from a remount flash.
  useEffect(() => {
    if (!coords || !activeCacheKeyRef.current) return;
    saveSwipeFeedSession({
      cacheKey: activeCacheKeyRef.current,
      lat: coords.lat,
      lng: coords.lng,
      tag: tag ?? "",
      queue,
      seenSpotIds: [...seenSpotIdsRef.current],
      lastFetchAt: lastFetchAtRef.current,
      hydrateRequested: [...hydrateRequestedRef.current],
      sessionHydrates: sessionHydratesRef.current,
      isSparseTheme,
    });
  }, [queue, isSparseTheme, coords, tag]);

  const tabHiddenRef = useRef(false);
  useEffect(() => {
    const handleVisibility = () => {
      tabHiddenRef.current = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
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
    }
  }, []);

  const fetchFeed = useCallback(async () => {
    if (tabHiddenRef.current) return;
    if (!enabledRef.current) return;

    const currentCoords = coordsRef.current;
    if (!currentCoords) return;

    // Already have cards (e.g. sync restore) — do not refetch on remount.
    if (queueRef.current.length > 0) return;

    const key =
      activeCacheKeyRef.current ??
      swipeFeedCacheKey(currentCoords, tagRef.current);

    setIsInitialLoading(true);
    setError(null);

    await runFeedFetchExclusive(key, async () => {
      // Another instance may have filled the queue while we waited for the lock
      const raced = loadNearbySwipeFeedSession(currentCoords, tagRef.current);
      if (raced && raced.queue.length > 0) {
        applySnapshotToRefs(raced, {
          queueRef,
          seenSpotIdsRef,
          hydrateRequestedRef,
          sessionHydratesRef,
          lastFetchAtRef,
          activeCacheKeyRef,
        });
        setQueue(raced.queue);
        setIsSparseTheme(raced.isSparseTheme);
        setIsInitialLoading(false);
        return;
      }

      if (queueRef.current.length > 0) {
        setIsInitialLoading(false);
        return;
      }

      try {
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
        if (vibeCount !== null && tagRef.current) {
          setIsSparseTheme(vibeCount < 6);
        }

        const inQueue = new Set(queueRef.current.map(feedItemKey));
        const fresh = newItems.filter((item) => {
          const itemKey = feedItemKey(item);
          if (isFeedNativeAd(item)) return !inQueue.has(itemKey);
          return !seenSpotIdsRef.current.has(itemKey) && !inQueue.has(itemKey);
        });
        const nextQueue = [...queueRef.current, ...fresh];
        queueRef.current = nextQueue;
        lastFetchAtRef.current = Date.now();
        activeCacheKeyRef.current = key;

        saveSwipeFeedSession(
          {
            cacheKey: key,
            lat: currentCoords.lat,
            lng: currentCoords.lng,
            tag: tagRef.current ?? "",
            queue: nextQueue,
            seenSpotIds: [...seenSpotIdsRef.current],
            lastFetchAt: lastFetchAtRef.current,
            hydrateRequested: [...hydrateRequestedRef.current],
            sessionHydrates: sessionHydratesRef.current,
            isSparseTheme: vibeCount !== null && !!tagRef.current && vibeCount < 6,
          },
          { allowEmptyOverwrite: true },
        );

        setQueue(nextQueue);
        void lazyHydrateQueue();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load feed.");
      } finally {
        setIsInitialLoading(false);
        setIsRefetching(false);
      }
    });
  }, [lazyHydrateQueue]);

  const fetchFeedRef = useRef(fetchFeed);
  useEffect(() => {
    fetchFeedRef.current = fetchFeed;
  });

  const currentItemKey = queue[0] ? feedItemKey(queue[0]) : null;

  useEffect(() => {
    if (enabled && coords && queue.length > 0) void lazyHydrateQueue();
  }, [currentItemKey, queue.length, lazyHydrateQueue, enabled, coords]);

  useEffect(() => {
    if (!enabled || !coords) return;

    // Sync restore already has cards — never fetch.
    if (queueRef.current.length > 0) {
      setIsInitialLoading(false);
      return;
    }

    if (queueRef.current.length > 0) return;
    void fetchFeedRef.current();
  }, [enabled, coords, tag, coordsKey]);

  const persistNow = useCallback(
    (nextQueue: SwipeFeedItem[], allowEmptyOverwrite: boolean) => {
      const c = coordsRef.current;
      if (!c || !activeCacheKeyRef.current) return;
      saveSwipeFeedSession(
        {
          cacheKey: activeCacheKeyRef.current,
          lat: c.lat,
          lng: c.lng,
          tag: tagRef.current ?? "",
          queue: nextQueue,
          seenSpotIds: [...seenSpotIdsRef.current],
          lastFetchAt: lastFetchAtRef.current,
          hydrateRequested: [...hydrateRequestedRef.current],
          sessionHydrates: sessionHydratesRef.current,
          isSparseTheme,
        },
        { allowEmptyOverwrite },
      );
    },
    [isSparseTheme],
  );

  const advance = useCallback(() => {
    setQueue((prev) => {
      const [head, ...rest] = prev;
      if (head && !isFeedNativeAd(head)) {
        seenSpotIdsRef.current.add(feedItemKey(head));
      }
      queueRef.current = rest;
      persistNow(rest, true);
      return rest;
    });
  }, [persistNow]);

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

  // When queue empties by swiping, top up once.
  useEffect(() => {
    if (!enabled || !coords) return;
    if (queue.length > 0) return;
    if (lastFetchAtRef.current === 0) return; // initial load handled elsewhere
    void fetchFeedRef.current();
  }, [queue.length, enabled, coords]);

  return {
    currentItem: queue[0] ?? null,
    nextItem: queue[1] ?? null,
    queueLength: queue.length,
    isInitialLoading,
    isRefetching,
    error,
    isSparseTheme,
    advance,
    recordSwipe,
  };
}
