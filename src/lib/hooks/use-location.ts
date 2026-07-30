"use client";

import { useCallback, useEffect, useState } from "react";

export interface Coordinates {
  lat: number;
  lng: number;
}

export type LocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unsupported";

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

export function useLocation({
  autoRequest = true,
}: UseLocationOptions = {}): UseLocationReturn {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatus("ready");
      },
      () => {
        setStatus("denied");
      },
      { timeout: 8_000, maximumAge: 60_000 },
    );
  }, []);

  const setManualCoords = useCallback((next: Coordinates) => {
    setCoords(next);
    setStatus("ready");
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
