"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadLocationSession,
  saveLocationSession,
  shouldAcceptGpsUpdate,
  type LocationSessionStatus,
} from "@/lib/location/location-session";

export interface Coordinates {
  lat: number;
  lng: number;
}

export type LocationStatus = LocationSessionStatus;

interface UseLocationOptions {
  /** When false, skips automatic geolocation on mount */
  autoRequest?: boolean;
}

interface UseLocationReturn {
  coords: Coordinates | null;
  status: LocationStatus;
  requestGeolocation: () => void;
  setManualCoords: (coords: Coordinates) => void;
}

function readInitial(): {
  coords: Coordinates | null;
  status: LocationStatus;
} {
  const snap = loadLocationSession();
  if (snap?.status === "ready") {
    return { coords: snap.coords, status: "ready" };
  }
  return { coords: null, status: "idle" };
}

export function useLocation({
  autoRequest = true,
}: UseLocationOptions = {}): UseLocationReturn {
  const [coords, setCoords] = useState<Coordinates | null>(
    () => readInitial().coords,
  );
  const [status, setStatus] = useState<LocationStatus>(
    () => readInitial().status,
  );

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    // Already have a fresh session fix — keep it; still refresh GPS quietly.
    const existing = loadLocationSession();
    if (!(existing?.status === "ready" && existing.coords)) {
      setStatus("locating");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCoords((prev) => {
          const snap = loadLocationSession();
          if (!shouldAcceptGpsUpdate(prev, next, snap?.source)) {
            if (prev) {
              saveLocationSession(prev, "ready", {
                source: snap?.source ?? "gps",
              });
            }
            return prev;
          }
          saveLocationSession(next, "ready", { source: "gps" });
          return next;
        });
        setStatus("ready");
      },
      () => {
        // Keep prior session coords if GPS fails on remount
        const snap = loadLocationSession();
        if (snap?.status === "ready" && snap.coords) {
          setCoords(snap.coords);
          setStatus("ready");
          return;
        }
        setStatus("denied");
      },
      { timeout: 8_000, maximumAge: 300_000 },
    );
  }, []);

  const setManualCoords = useCallback((next: Coordinates) => {
    setCoords(next);
    setStatus("ready");
    saveLocationSession(next, "ready", { source: "manual" });
  }, []);

  useEffect(() => {
    if (autoRequest) requestGeolocation();
  }, [autoRequest, requestGeolocation]);

  return {
    coords,
    status,
    requestGeolocation,
    setManualCoords,
  };
}
