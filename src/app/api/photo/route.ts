import { NextRequest, NextResponse } from "next/server";
import { extractPlacesPhotoName } from "@/lib/places/photo-url";
import { SWIPE_CARD_PHOTO_WIDTH } from "@/types/backend";
import { createIpRateLimiter, getClientIp } from "@/lib/api/rate-limit";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/;

/** Browser/CDN cache for successful photo bytes (immutable per resource name). */
const PHOTO_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

/** Cap unauthenticated photo proxy abuse (Places Photo billing). */
const photoRateLimit = createIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxPerWindow: 120,
});

/**
 * GET /api/photo?name=places%2F...%2Fphotos%2F...&maxWidthPx=480
 * Proxies Google Place Photo media with the server API key.
 * Streams the upstream body (no full-buffer wait) for faster TTFB.
 *
 * Always fetches Google with cache: 'no-store' so expired photo names are not
 * masked by a long-lived Next.js Data Cache (which made localhost look healthy
 * while production returned 502).
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = photoRateLimit.check(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many photo requests. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const nameParam = req.nextUrl.searchParams.get("name");
  const widthRaw =
    req.nextUrl.searchParams.get("maxWidthPx") ?? String(SWIPE_CARD_PHOTO_WIDTH);
  const maxWidthPx = Math.min(
    Math.max(Number.parseInt(widthRaw, 10) || SWIPE_CARD_PHOTO_WIDTH, 1),
    4800,
  );

  if (!nameParam) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const name = extractPlacesPhotoName(nameParam) ?? nameParam;
  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_PLACES_API_KEY" },
      { status: 500 },
    );
  }

  const upstream = `${GOOGLE_PLACES_BASE}/${name}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;

  try {
    const res = await fetch(upstream, {
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[GET /api/photo] upstream ${res.status} for ${name}`);
      // Expired / invalid Places photo resource names → 404 (not 502).
      if (res.status === 400 || res.status === 404) {
        return NextResponse.json(
          { error: "Photo unavailable", upstreamStatus: res.status },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Photo fetch failed", upstreamStatus: res.status },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const body = res.body;
    if (!body) {
      return NextResponse.json({ error: "Empty photo body" }, { status: 502 });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": PHOTO_CACHE_CONTROL,
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Photo proxy failed";
    console.error("[GET /api/photo]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
