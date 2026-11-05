import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { firstPlaceHit, nominatimSearchUrl } from "@/lib/geo/place-search";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

/**
 * GET /api/geocode?q=吉祥寺
 * One OpenStreetMap place lookup. The map itself does not call Nominatim.
 */
export async function GET(req: NextRequest) {
  const rate = await consumeRateLimit(req, "geocode", {
    windowMs: WINDOW_MS,
    maxPerWindow: MAX_PER_WINDOW,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 80) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const upstream = await fetch(nominatimSearchUrl(q), {
      headers: {
        "User-Agent": "meshidoko/1.0 (location search)",
        "Accept-Language": "ja",
      },
      cache: "no-store",
    });
    if (!upstream.ok) {
      console.warn(`[GET /api/geocode] upstream ${upstream.status}`);
      return NextResponse.json({ error: "Search failed" }, { status: 502 });
    }

    const hit = firstPlaceHit(await upstream.json());
    if (!hit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(hit, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    console.error("[GET /api/geocode]", message);
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
