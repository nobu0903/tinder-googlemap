"use client";

import { useState, useEffect, useCallback } from "react";
import type { LikedSpot, CollectionResponse } from "@/types/backend";

interface UseCollectionOptions {
  accessToken: string | null;
  /** Set to false while auth is still loading to avoid a premature fetch */
  enabled: boolean;
}

interface UseCollectionReturn {
  spots: LikedSpot[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCollection({
  accessToken,
  enabled,
}: UseCollectionOptions): UseCollectionReturn {
  const [spots, setSpots] = useState<LikedSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async () => {
    if (!enabled || !accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/collection", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to load collection");
      }
      const data: CollectionResponse = await res.json();
      setSpots(data.spots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, enabled]);

  useEffect(() => {
    void fetchCollection();
  }, [fetchCollection]);

  return { spots, isLoading, error, refresh: fetchCollection };
}
