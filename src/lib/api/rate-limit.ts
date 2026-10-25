/**
 * IP rate limiter for API routes.
 *
 * The client address comes only from platform headers that the edge overwrites
 * (x-vercel-forwarded-for, x-real-ip). A caller-supplied X-Forwarded-For is ignored.
 *
 * Counts are stored in Postgres (consume_api_rate_limit) so they survive
 * across serverless instances. If that function is not installed yet, this
 * falls back to an in-memory window on the current instance.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function createIpRateLimiter(options: {
  windowMs: number;
  maxPerWindow: number;
}) {
  const { windowMs, maxPerWindow } = options;
  const map = new Map<string, { count: number; windowStart: number }>();

  return {
    check(ip: string): RateLimitResult {
      const now = Date.now();
      const entry = map.get(ip);

      if (!entry || now - entry.windowStart >= windowMs) {
        map.set(ip, { count: 1, windowStart: now });
        return {
          allowed: true,
          remaining: maxPerWindow - 1,
          retryAfterSec: Math.ceil(windowMs / 1000),
        };
      }

      if (entry.count >= maxPerWindow) {
        const retryAfterMs = windowMs - (now - entry.windowStart);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }

      entry.count++;
      return {
        allowed: true,
        remaining: maxPerWindow - entry.count,
        retryAfterSec: Math.ceil(
          (windowMs - (now - entry.windowStart)) / 1000,
        ),
      };
    },
  };
}

const memoryLimiters = new Map<
  string,
  ReturnType<typeof createIpRateLimiter>
>();
let loggedDbFallback = false;

function memoryLimiter(
  bucket: string,
  options: { windowMs: number; maxPerWindow: number },
) {
  const existing = memoryLimiters.get(bucket);
  if (existing) return existing;
  const created = createIpRateLimiter(options);
  memoryLimiters.set(bucket, created);
  return created;
}

/** First hop of a platform-set IP header. Rejects empty or non-IP values. */
function firstPlatformIp(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim();
  if (!value || value.length > 64) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return null;
  return value;
}

export function getClientIp(req: Request): string {
  return (
    firstPlatformIp(req.headers.get("x-vercel-forwarded-for")) ??
    firstPlatformIp(req.headers.get("x-real-ip")) ??
    "unknown"
  );
}

interface DbLimitPayload {
  allowed?: unknown;
  remaining?: unknown;
  retry_after_sec?: unknown;
}

function parseDbLimit(data: unknown): RateLimitResult | null {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as DbLimitPayload;
  if (typeof row.allowed !== "boolean") return null;
  if (typeof row.remaining !== "number" || !Number.isFinite(row.remaining)) {
    return null;
  }
  if (
    typeof row.retry_after_sec !== "number" ||
    !Number.isFinite(row.retry_after_sec)
  ) {
    return null;
  }
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSec: Math.max(1, Math.ceil(row.retry_after_sec)),
  };
}

/**
 * Consume one hit for `bucket` + client IP.
 * `bucket` separates limits (swipe, photo, admin-login, …).
 */
export async function consumeRateLimit(
  req: Request,
  bucket: string,
  options: { windowMs: number; maxPerWindow: number },
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const key = `${bucket}:${ip}`;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
      p_key: key,
      p_window_ms: options.windowMs,
      p_max: options.maxPerWindow,
    });
    if (!error) {
      const parsed = parseDbLimit(data);
      if (parsed) return parsed;
    } else if (!loggedDbFallback) {
      loggedDbFallback = true;
      console.error(
        "[rate-limit] DB limiter unavailable, using in-memory fallback",
        error.message,
      );
    }
  } catch (err) {
    if (!loggedDbFallback) {
      loggedDbFallback = true;
      const message = err instanceof Error ? err.message : "rate limit failed";
      console.error(
        "[rate-limit] DB limiter unavailable, using in-memory fallback",
        message,
      );
    }
  }

  return memoryLimiter(bucket, options).check(ip);
}
