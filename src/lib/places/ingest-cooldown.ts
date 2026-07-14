/** Per-area ingest cooldown — limits repeated Google API bursts for the same location. */

const INGEST_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

const lastIngestByArea = new Map<string, number>();

/** ~500 m grid key for lat/lng + radius bucket */
export function ingestAreaKey(
  lat: number,
  lng: number,
  radiusMeters: number,
): string {
  const latKey = Math.round(lat * 200) / 200;
  const lngKey = Math.round(lng * 200) / 200;
  const radiusKm = Math.round(radiusMeters / 500);
  return `${latKey}:${lngKey}:r${radiusKm}`;
}

export function isIngestOnCooldown(key: string): boolean {
  const last = lastIngestByArea.get(key);
  if (!last) return false;
  return Date.now() - last < INGEST_COOLDOWN_MS;
}

export function markIngestCompleted(key: string): void {
  lastIngestByArea.set(key, Date.now());
}

export function ingestCooldownRemainingMs(key: string): number {
  const last = lastIngestByArea.get(key);
  if (!last) return 0;
  const remaining = INGEST_COOLDOWN_MS - (Date.now() - last);
  return Math.max(0, remaining);
}
