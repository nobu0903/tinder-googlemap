"use client";



// useSwipeFeed — one card per spot; tracks seen IDs to prevent repeat loops.



import { useState, useEffect, useCallback, useRef } from "react";

import type { FeedSpot, SwipeAction } from "@/types/backend";



const REFETCH_THRESHOLD = 3;



interface UseSwipeFeedOptions {

  tag?: string;

  accessToken?: string | null;

}



interface UseSwipeFeedReturn {

  currentSpot: FeedSpot | null;

  queueLength: number;

  /** True only on the first fetch when the queue is still empty */

  isInitialLoading: boolean;

  /** True during background refetch while cards remain in the queue */

  isRefetching: boolean;

  isLocating: boolean;

  error: string | null;

  advance: () => void;

  recordSwipe: (action: SwipeAction) => void;

}



export function useSwipeFeed({

  tag,

  accessToken = null,

}: UseSwipeFeedOptions = {}): UseSwipeFeedReturn {

  const [queue, setQueue] = useState<FeedSpot[]>([]);

  const [isInitialLoading, setIsInitialLoading] = useState(false);

  const [isRefetching, setIsRefetching] = useState(false);

  const [isLocating, setIsLocating] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const fetchingRef = useRef(false);

  const queueRef = useRef<FeedSpot[]>([]);

  /** Persists across refetches — prevents the same store from looping back */

  const seenSpotIdsRef = useRef<Set<string>>(new Set());



  useEffect(() => {

    queueRef.current = queue;

  }, [queue]);



  const fetchFeed = useCallback(async () => {

    if (fetchingRef.current) return;

    const coords = coordsRef.current;

    if (!coords) return;



    const isBackground = queueRef.current.length > 0;



    fetchingRef.current = true;

    if (isBackground) {

      setIsRefetching(true);

    } else {

      setIsInitialLoading(true);

    }

    setError(null);



    try {

      const url = new URL("/api/swipe", window.location.origin);

      url.searchParams.set("lat", String(coords.lat));

      url.searchParams.set("lng", String(coords.lng));

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

      const newSpots: FeedSpot[] = data.spots ?? [];



      setQueue((prev) => {

        const inQueue = new Set(prev.map((s) => s.spotId));

        const fresh = newSpots.filter(

          (s) =>

            !seenSpotIdsRef.current.has(s.spotId) && !inQueue.has(s.spotId),

        );

        return [...prev, ...fresh];

      });

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to load feed.");

    } finally {

      setIsInitialLoading(false);

      setIsRefetching(false);

      fetchingRef.current = false;

    }

  }, [tag, accessToken]);



  useEffect(() => {

    if (!navigator.geolocation) {

      coordsRef.current = { lat: 35.658034, lng: 139.701636 };

      setIsLocating(false);

      fetchFeed();

      return;

    }



    navigator.geolocation.getCurrentPosition(

      (pos) => {

        coordsRef.current = {

          lat: pos.coords.latitude,

          lng: pos.coords.longitude,

        };

        setIsLocating(false);

        fetchFeed();

      },

      () => {

        coordsRef.current = { lat: 35.658034, lng: 139.701636 };

        setIsLocating(false);

        fetchFeed();

      },

      { timeout: 8_000, maximumAge: 60_000 },

    );

  }, [fetchFeed]);



  useEffect(() => {

    if (!isLocating && queue.length <= REFETCH_THRESHOLD && !fetchingRef.current) {

      fetchFeed();

    }

  }, [queue.length, isLocating, fetchFeed]);



  const advance = useCallback(() => {

    setQueue((prev) => {

      const [head, ...rest] = prev;

      if (head) seenSpotIdsRef.current.add(head.spotId);

      return rest;

    });

  }, []);



  const recordSwipe = useCallback(

    (action: SwipeAction) => {

      const spot = queue[0];

      if (!spot) return;



      seenSpotIdsRef.current.add(spot.spotId);



      if (accessToken) {

        fetch("/api/swipe/action", {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

            Authorization: `Bearer ${accessToken}`,

          },

          body: JSON.stringify({ spotId: spot.spotId, action }),

        }).catch(console.error);

      }



      advance();

    },

    [queue, accessToken, advance],

  );



  return {

    currentSpot: queue[0] ?? null,

    queueLength: queue.length,

    isInitialLoading,

    isRefetching,

    isLocating,

    error,

    advance,

    recordSwipe,

  };

}

