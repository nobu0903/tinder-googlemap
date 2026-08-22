"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin/client";
import type { AreaProfile, FeedAlgorithmConfig } from "@/lib/feed/config";
import type { FeedEngineResult, FeedSpotDebug } from "@/lib/feed/engine";
import type { IngestApiCalls } from "@/lib/places/ingest";
import type { FeedSpot, SwipeAction } from "@/types/backend";
import { feedSpotNeedsHydrate } from "@/lib/places/enrichment-gate";

const REFETCH_THRESHOLD = 3;

const EMPTY_API_CALLS: IngestApiCalls = {
  nearbySearch: 0,
  textSearch: 0,
  placeDetails: 0,
};

interface UseAdminSwipeFeedOptions {
  lat: number;
  lng: number;
  config: Partial<FeedAlgorithmConfig>;
  active: boolean;
}

export function useAdminSwipeFeed({
  lat,
  lng,
  config,
  active,
}: UseAdminSwipeFeedOptions) {
  const [queue, setQueue] = useState<FeedSpot[]>([]);
  const [debugById, setDebugById] = useState<Map<string, FeedSpotDebug>>(
    () => new Map(),
  );
  const [sessionApiCalls, setSessionApiCalls] = useState<IngestApiCalls>({
    ...EMPTY_API_CALLS,
  });
  const [areaProfile, setAreaProfile] = useState<AreaProfile | null>(null);
  const [effectiveBands, setEffectiveBands] = useState<{
    classicMin: number;
    classicMax: number;
    vibeMin: number;
    vibeMax: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);
  const queueRef = useRef<FeedSpot[]>([]);
  const sessionKeyRef = useRef("");
  const hydrateRequestedRef = useRef<Set<string>>(new Set());
  const photoRefreshRequestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const lazyHydrateQueue = useCallback(async () => {
    if (!active || queueRef.current.length === 0) return;

    const candidates = queueRef.current
      .slice(0, 4)
      .filter(
        (s) =>
          feedSpotNeedsHydrate(s) &&
          !hydrateRequestedRef.current.has(s.spotId),
      )
      .slice(0, 2);

    if (candidates.length === 0) return;

    const candidateIds = candidates.map((s) => s.spotId);
    for (const id of candidateIds) hydrateRequestedRef.current.add(id);

    try {
      const res = await fetch("/api/spots/hydrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotIds: candidateIds,
          lat,
          lng,
        }),
      });
      if (!res.ok) {
        for (const id of candidateIds) hydrateRequestedRef.current.delete(id);
        return;
      }

      const data = (await res.json()) as { spots?: FeedSpot[] };
      const hydrated = data.spots ?? [];
      if (hydrated.length === 0) return;

      setSessionApiCalls((prev) => ({
        ...prev,
        placeDetails: prev.placeDetails + hydrated.length,
      }));

      const byId = new Map(hydrated.map((s) => [s.spotId, s]));
      setQueue((prev) => prev.map((s) => byId.get(s.spotId) ?? s));
    } catch {
      for (const id of candidateIds) hydrateRequestedRef.current.delete(id);
      // non-fatal
    }
  }, [active, lat, lng]);

  const fetchBatch = useCallback(async () => {
    if (fetchingRef.current) return;

    const isBackground = queueRef.current.length > 0;
    fetchingRef.current = true;
    if (isBackground) setIsRefetching(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = (await adminFetch("/api/admin/swipe-feed", {
        method: "POST",
        body: JSON.stringify({
          lat,
          lng,
          config,
          excludeIds: [...seenRef.current],
        }),
      })) as FeedEngineResult;

      setSessionApiCalls((prev) => ({
        nearbySearch: prev.nearbySearch + data.meta.apiCalls.nearbySearch,
        textSearch: prev.textSearch + data.meta.apiCalls.textSearch,
        placeDetails: prev.placeDetails + data.meta.apiCalls.placeDetails,
      }));
      setAreaProfile(data.meta.areaProfile);
      setEffectiveBands({
        classicMin: data.meta.config.classicMinReviews,
        classicMax: data.meta.config.classicMaxReviews,
        vibeMin: data.meta.config.vibeMinReviews,
        vibeMax: data.meta.config.vibeMaxReviews,
      });

      setDebugById((prev) => {
        const next = new Map(prev);
        for (const row of data.debugSpots) {
          next.set(row.spotId, row);
        }
        return next;
      });

      setQueue((prev) => {
        const inQueue = new Set(prev.map((s) => s.spotId));
        const fresh = data.spots.filter(
          (s) => !seenRef.current.has(s.spotId) && !inQueue.has(s.spotId),
        );
        return [...prev, ...fresh];
      });

      void lazyHydrateQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
      fetchingRef.current = false;
    }
  }, [lat, lng, config, lazyHydrateQueue]);

  useEffect(() => {
    if (!active) return;

    const sessionKey = `${lat},${lng},${JSON.stringify(config)}`;
    if (sessionKeyRef.current !== sessionKey) {
      sessionKeyRef.current = sessionKey;
      seenRef.current = new Set();
      hydrateRequestedRef.current = new Set();
      setQueue([]);
      setDebugById(new Map());
      setSessionApiCalls({ ...EMPTY_API_CALLS });
      setAreaProfile(null);
      setEffectiveBands(null);
      setError(null);
    }
  }, [active, lat, lng, config]);

  useEffect(() => {
    if (!active) return;
    if (queue.length <= REFETCH_THRESHOLD && !fetchingRef.current) {
      fetchBatch();
    }
  }, [active, queue.length, fetchBatch]);

  const currentSpotId = queue[0]?.spotId;

  useEffect(() => {
    if (!active || queue.length === 0) return;
    void lazyHydrateQueue();
  }, [active, currentSpotId, queue.length, lazyHydrateQueue]);

  const recordSwipe = useCallback((action: SwipeAction) => {
    void action;
    setQueue((prev) => {
      const [head, ...rest] = prev;
      if (head) seenRef.current.add(head.spotId);
      return rest;
    });
  }, []);

  const refreshSpotPhotos = useCallback(
    (spotId: string) => {
      if (!spotId || !active) return;
      if (photoRefreshRequestedRef.current.has(spotId)) return;
      photoRefreshRequestedRef.current.add(spotId);

      void (async () => {
        try {
          const res = await fetch("/api/spots/hydrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              spotIds: [spotId],
              lat,
              lng,
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
          setQueue((prev) => prev.map((s) => byId.get(s.spotId) ?? s));
        } catch {
          photoRefreshRequestedRef.current.delete(spotId);
        }
      })();
    },
    [active, lat, lng],
  );

  const currentSpot = queue[0] ?? null;
  const currentDebug = currentSpot
    ? debugById.get(currentSpot.spotId) ?? null
    : null;

  return {
    currentSpot,
    currentDebug,
    queueLength: queue.length,
    sessionApiCalls,
    areaProfile,
    effectiveBands,
    isLoading,
    isRefetching,
    error,
    recordSwipe,
    refreshSpotPhotos,
    refetch: fetchBatch,
  };
}
