"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LikedSpot, CollectionResponse } from "@/types/backend";

interface UseCollectionOptions {
  accessToken: string | null;
  /** Set to false while auth is still loading to avoid a premature fetch */
  enabled: boolean;
}

interface PendingRemoval {
  spot: LikedSpot;
  index: number;
}

interface UseCollectionReturn {
  spots: LikedSpot[];
  isLoading: boolean;
  error: string | null;
  pendingRemoval: PendingRemoval | null;
  refresh: () => void;
  /** Optimistically remove; persists dislike. Returns false if request fails. */
  removeSpot: (spotId: string) => Promise<boolean>;
  /** Undo the last removal (re-like). */
  undoRemove: () => Promise<boolean>;
  dismissUndo: () => void;
}

async function postSwipeAction(
  accessToken: string,
  spotId: string,
  action: "like" | "dislike",
): Promise<boolean> {
  const res = await fetch("/api/swipe/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ spotId, action }),
  });
  return res.ok;
}

export function useCollection({
  accessToken,
  enabled,
}: UseCollectionOptions): UseCollectionReturn {
  const [spots, setSpots] = useState<LikedSpot[]>([]);
  /** Start true when enabled so we don't flash empty before first fetch */
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(
    null,
  );
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped on each remove/undo so stale in-flight responses are ignored */
  const actionGenRef = useRef(0);
  const dislikeGenBySpotRef = useRef<Map<string, number>>(new Map());

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const dismissUndo = useCallback(() => {
    clearUndoTimer();
    setPendingRemoval(null);
  }, [clearUndoTimer]);

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
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load collection",
        );
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
    if (enabled) setIsLoading(true);
    void fetchCollection();
  }, [fetchCollection, enabled]);

  useEffect(() => () => clearUndoTimer(), [clearUndoTimer]);

  const removeSpot = useCallback(
    async (spotId: string) => {
      if (!accessToken) return false;

      const index = spots.findIndex((s) => s.spotId === spotId);
      if (index < 0) return false;
      const spot = spots[index];

      const gen = ++actionGenRef.current;
      dislikeGenBySpotRef.current.set(spotId, gen);

      setSpots((prev) => prev.filter((s) => s.spotId !== spotId));

      clearUndoTimer();
      setPendingRemoval({ spot, index });
      undoTimerRef.current = setTimeout(() => {
        setPendingRemoval(null);
        undoTimerRef.current = null;
      }, 5000);

      const ok = await postSwipeAction(accessToken, spotId, "dislike");

      // Undo (or a newer remove) superseded this dislike — ignore result
      if (dislikeGenBySpotRef.current.get(spotId) !== gen) {
        return true;
      }

      if (!ok) {
        setSpots((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, spot);
          return next;
        });
        dismissUndo();
        setError("Couldn't remove spot. Try again.");
        return false;
      }
      return true;
    },
    [accessToken, spots, clearUndoTimer, dismissUndo],
  );

  const undoRemove = useCallback(async () => {
    if (!accessToken || !pendingRemoval) return false;
    const { spot, index } = pendingRemoval;

    // Invalidate any in-flight dislike for this spot
    const gen = ++actionGenRef.current;
    dislikeGenBySpotRef.current.set(spot.spotId, gen);

    dismissUndo();

    setSpots((prev) => {
      const next = [...prev];
      const insertAt = Math.min(index, next.length);
      next.splice(insertAt, 0, spot);
      return next;
    });

    const ok = await postSwipeAction(accessToken, spot.spotId, "like");
    if (dislikeGenBySpotRef.current.get(spot.spotId) !== gen) {
      return true;
    }
    if (!ok) {
      setSpots((prev) => prev.filter((s) => s.spotId !== spot.spotId));
      setError("Couldn't undo. Spot stays removed.");
      return false;
    }
    return true;
  }, [accessToken, pendingRemoval, dismissUndo]);

  return {
    spots,
    isLoading,
    error,
    pendingRemoval,
    refresh: fetchCollection,
    removeSpot,
    undoRemove,
    dismissUndo,
  };
}
