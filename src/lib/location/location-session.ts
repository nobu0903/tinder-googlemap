/**
 * Survives SwipeScreen unmount so remount does not re-race GPS vs feed cache.
 */

import type { Coordinates } from "@/lib/hooks/use-location";

const STORAGE_KEY = "vibeloop:location-session-v1";
const MAX_AGE_MS = 30 * 60 * 1000;
/** Ignore GPS jitter / tiny moves when we already have a fix */
export const LOCATION_MOVE_THRESHOLD_M = 400;

export type LocationSessionStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unsupported";

export type LocationSource = "gps" | "manual";

export interface LocationSessionSnapshot {
  coords: Coordinates;
  status: LocationSessionStatus;
  label: string | null;
  /** Manual city pick must not be overwritten by remount GPS */
  source: LocationSource;
  savedAt: number;
}

let memory: LocationSessionSnapshot | null = null;

function haversineMeters(
  a: Coordinates,
  b: Coordinates,
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  return haversineMeters(a, b);
}

export function loadLocationSession(): LocationSessionSnapshot | null {
  if (memory && Date.now() - memory.savedAt <= MAX_AGE_MS) return memory;

  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationSessionSnapshot;
    if (
      !parsed?.coords ||
      typeof parsed.coords.lat !== "number" ||
      typeof parsed.coords.lng !== "number" ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.source !== "manual" && parsed.source !== "gps") {
      parsed.source = "gps";
    }
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocationSession(
  coords: Coordinates,
  status: LocationSessionStatus,
  options?: { label?: string | null; source?: LocationSource },
): void {
  const label = options?.label ?? memory?.label ?? null;
  const source = options?.source ?? memory?.source ?? "gps";
  memory = { coords, status, label, source, savedAt: Date.now() };
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // private mode / quota
  }
}

export function saveLocationLabel(label: string | null): void {
  if (!memory) return;
  memory = { ...memory, label, savedAt: Date.now() };
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

/**
 * Whether a new GPS fix should replace the active session.
 * Manual picks are sticky; GPS only moves the pin after a real relocation.
 */
export function shouldAcceptGpsUpdate(
  current: Coordinates | null,
  next: Coordinates,
  source: LocationSource | undefined = memory?.source,
): boolean {
  if (source === "manual") return false;
  if (!current) return true;
  return distanceMeters(current, next) >= LOCATION_MOVE_THRESHOLD_M;
}

export function __resetLocationSessionForTests(): void {
  memory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
