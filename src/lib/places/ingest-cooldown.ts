/**
 * Per-area ingest cooldown — in-memory L1 cache for same-instance rapid requests.
 *
 * This is an L1 guard only.  For cross-serverless-instance protection we rely on
 * the DB-backed `hadRecentIngestInBox` check in ingest.ts (checks updated_at on
 * the spots table).  The two layers together make sure a fresh Lambda instance
 * that hasn't seen an ingest yet will still check the DB before calling Google.
 */

// 7 days — restaurant data rarely changes week-to-week. The DB-backed guard in
// ingest.ts (PRODUCTION_INGEST_COOLDOWN_MS) is the cross-instance floor; this
// in-memory cache extends it for same-instance rapid requests.
const INGEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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
