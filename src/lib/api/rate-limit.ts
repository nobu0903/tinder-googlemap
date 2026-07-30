/**
 * Simple in-memory IP rate limiter for API routes.
 * Resets per serverless instance — defense in depth, not a global guarantee.
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

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
