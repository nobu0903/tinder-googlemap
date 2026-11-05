// Per-area Google fetch state (migration 008). Decides when an area may call
// Google again and keeps concurrent requests from paying for the same search.
//
// Retry times are written only after a Google search returns without error —
// never from spot photo refreshes or spots.updated_at.

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Wait after a search that returned places */
export const AREA_RETRY_AFTER_MS = 30 * DAY_MS;
/** Shorter wait when Google returned nothing, in case it was a one-off */
export const AREA_EMPTY_RETRY_AFTER_MS = 7 * DAY_MS;
/** Lock lifetime — covers Nearby plus three Text Search pages with timeouts */
export const AREA_FETCH_LOCK_TTL_MS = 30_000;
/** Text Search (New) returns at most 3 pages of 20 */
export const MAX_TEXT_SEARCH_PAGES = 3;

/** ~500 m grid key for lat/lng + radius bucket */
export function areaFetchKey(lat: number, lng: number, radiusMeters: number): string {
  const latKey = Math.round(lat * 200) / 200;
  const lngKey = Math.round(lng * 200) / 200;
  const radiusKey = Math.round(radiusMeters / 500);
  return `${latKey}:${lngKey}:r${radiusKey}`;
}

export interface AreaFetchState {
  primaryRetryAfter: string | null;
  vibeRetryAfter: string | null;
  textRetryAfter: string | null;
  textNextPageToken: string | null;
  textPagesFetched: number;
}

export type AreaFetchPatch = Partial<AreaFetchState> & { eligibleCount?: number };

interface AreaFetchRow {
  primary_retry_after: string | null;
  vibe_retry_after: string | null;
  text_retry_after: string | null;
  text_next_page_token: string | null;
  text_pages_fetched: number | null;
}

const EMPTY_STATE: AreaFetchState = {
  primaryRetryAfter: null,
  vibeRetryAfter: null,
  textRetryAfter: null,
  textNextPageToken: null,
  textPagesFetched: 0,
};

/** True when `retryAfter` is unset or already passed. */
export function isRetryDue(retryAfter: string | null, now = Date.now()): boolean {
  return retryAfter === null || Date.parse(retryAfter) <= now;
}

/** Next allowed fetch time after a successful search with `placeCount` results. */
export function nextRetryAfter(placeCount: number, now = Date.now()): string {
  const wait = placeCount > 0 ? AREA_RETRY_AFTER_MS : AREA_EMPTY_RETRY_AFTER_MS;
  return new Date(now + wait).toISOString();
}

function toRowPatch(patch: AreaFetchPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.primaryRetryAfter !== undefined) row.primary_retry_after = patch.primaryRetryAfter;
  if (patch.vibeRetryAfter !== undefined) row.vibe_retry_after = patch.vibeRetryAfter;
  if (patch.textRetryAfter !== undefined) row.text_retry_after = patch.textRetryAfter;
  if (patch.textNextPageToken !== undefined) row.text_next_page_token = patch.textNextPageToken;
  if (patch.textPagesFetched !== undefined) row.text_pages_fetched = patch.textPagesFetched;
  if (patch.eligibleCount !== undefined) row.eligible_count = patch.eligibleCount;
  return row;
}

function fromRow(row: AreaFetchRow | null): AreaFetchState {
  if (!row) return { ...EMPTY_STATE };
  return {
    primaryRetryAfter: row.primary_retry_after,
    vibeRetryAfter: row.vibe_retry_after,
    textRetryAfter: row.text_retry_after,
    textNextPageToken: row.text_next_page_token,
    textPagesFetched: row.text_pages_fetched ?? 0,
  };
}

/**
 * One request's view of an area. Load once, take the lock before the first
 * Google call, and `finish()` exactly once (in a finally block).
 */
export class AreaFetchSession {
  readonly key: string;
  private state: AreaFetchState | null = null;
  private lockToken: string | null = null;
  private lockAttempted = false;
  private pending: AreaFetchPatch = {};
  /** Set when another request holds the lock */
  busyUntil: string | null = null;

  constructor(key: string) {
    this.key = key;
  }

  async load(): Promise<AreaFetchState> {
    if (this.state) return this.state;
    const { data, error } = await supabaseAdmin
      .from("area_fetch_state")
      .select(
        "primary_retry_after, vibe_retry_after, text_retry_after, text_next_page_token, text_pages_fetched",
      )
      .eq("area_key", this.key)
      .maybeSingle();
    if (error) {
      throw new Error(
        `area_fetch_state is missing (run migration 008 in the SQL editor): ${error.message}`,
      );
    }
    this.state = fromRow(data as AreaFetchRow | null);
    return this.state;
  }

  /** Current state including changes not yet written by `finish()`. */
  async current(): Promise<AreaFetchState> {
    const base = await this.load();
    const { eligibleCount: _eligible, ...rest } = this.pending;
    return { ...base, ...rest };
  }

  /** Take the area lock once per request. False when another request holds it. */
  async acquire(): Promise<boolean> {
    if (this.lockToken) return true;
    if (this.lockAttempted) return false;
    this.lockAttempted = true;

    const token = randomUUID();
    const { data, error } = await supabaseAdmin.rpc("try_lock_area_fetch", {
      p_key: this.key,
      p_token: token,
      p_ttl_ms: AREA_FETCH_LOCK_TTL_MS,
    });
    if (error) {
      throw new Error(
        `try_lock_area_fetch is missing (run migration 008 in the SQL editor): ${error.message}`,
      );
    }
    const result = parseLockResult(data);
    if (result.acquired) {
      this.lockToken = token;
      return true;
    }
    this.busyUntil = result.lockExpiresAt;
    return false;
  }

  get isLocked(): boolean {
    return this.lockToken !== null;
  }

  record(patch: AreaFetchPatch): void {
    this.pending = { ...this.pending, ...patch };
  }

  /** Write recorded changes and release the lock. No-op when the lock was never held. */
  async finish(): Promise<void> {
    if (!this.lockToken) return;
    const token = this.lockToken;
    this.lockToken = null;
    const { error } = await supabaseAdmin
      .from("area_fetch_state")
      .update({
        ...toRowPatch(this.pending),
        lock_token: null,
        lock_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("area_key", this.key)
      .eq("lock_token", token);
    if (error) {
      console.error(`[area-fetch] state write failed for ${this.key}: ${error.message}`);
    }
  }
}

export function parseLockResult(data: unknown): {
  acquired: boolean;
  lockExpiresAt: string | null;
} {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { acquired: false, lockExpiresAt: null };
    }
  }
  if (!value || typeof value !== "object") return { acquired: false, lockExpiresAt: null };
  const row = value as { acquired?: unknown; lock_expires_at?: unknown };
  return {
    acquired: row.acquired === true,
    lockExpiresAt: typeof row.lock_expires_at === "string" ? row.lock_expires_at : null,
  };
}
