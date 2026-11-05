// GET /api/swipe — production feed (uses shared feed engine)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { runFeedEngine } from "@/lib/feed/engine";
import { injectNativeAd } from "@/lib/feed/native-ad";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import type { SwipeFeedResponse } from "@/types/backend";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  tag: z.string().optional(),
  exclude: z.string().optional(),
  /** Ids already in the client's queue. Not counted as swiped. */
  pending: z.string().optional(),
});

const MAX_CLIENT_IDS = 100;

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_CLIENT_IDS);
}

// Max 15 feed requests per hour per IP (DB-backed; see consumeRateLimit).
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_PER_WINDOW = 15;

export async function GET(req: NextRequest) {
  try {
    return await handleSwipeFeed(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    console.error("[GET /api/swipe]", message);

    if (
      message.includes("SERVICE_DISABLED") ||
      message.includes("has not been used in project")
    ) {
      return NextResponse.json(
        {
          error:
            "Places API (New) is not enabled on your Google Cloud project.",
        },
        { status: 503 },
      );
    }

    if (message.includes("GOOGLE_PLACES_API_KEY")) {
      return NextResponse.json(
        { error: "Missing GOOGLE_PLACES_API_KEY in .env.local" },
        { status: 500 },
      );
    }

    if (message.includes("migration 008")) {
      return NextResponse.json(
        {
          error:
            "Database setup is missing the area fetch table. Run migration 008 in the Supabase SQL editor.",
        },
        { status: 503 },
      );
    }

    if (message.includes("Supabase")) {
      return NextResponse.json(
        { error: "Supabase connection failed. Check your .env.local keys." },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: "Feed request failed" }, { status: 500 });
  }
}

async function handleSwipeFeed(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rateCheck = await consumeRateLimit(req, "swipe", {
    windowMs: RATE_WINDOW_MS,
    maxPerWindow: RATE_LIMIT_PER_WINDOW,
  });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfterSec),
          "X-RateLimit-Limit": String(RATE_LIMIT_PER_WINDOW),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const { lat, lng, tag, exclude: excludeParam, pending: pendingParam } = parsed.data;

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  if (tag && !userId) {
    return NextResponse.json(
      { error: "Sign in required for themed Explore swipes." },
      { status: 401 },
    );
  }

  const swipedIds: string[] = [];
  if (userId) {
    const { data: swipeRows } = await supabaseAdmin
      .from("swipes")
      .select("spot_id")
      .eq("user_id", userId);
    swipedIds.push(...(swipeRows ?? []).map((r) => r.spot_id));
  }

  const clientExcluded = parseIdList(excludeParam);
  const pendingIds = parseIdList(pendingParam);
  const allExcluded = [...swipedIds, ...clientExcluded];

  const result = await runFeedEngine({
    lat,
    lng,
    tag,
    excludeIds: allExcluded,
    pendingIds,
  });

  if (result.meta.searchFailed && result.spots.length === 0) {
    return NextResponse.json(
      { error: "Feed request failed" },
      { status: 503 },
    );
  }

  const response: SwipeFeedResponse = {
    spots: injectNativeAd(result.spots),
    radiusKm: result.meta.radiusKm,
    busyUntil: result.meta.busyUntil,
    exhausted: result.meta.fetchExhausted,
    searchFailed: result.meta.searchFailed,
    ...(tag !== undefined
      ? { vibeSpotCount: result.meta.pools.vibeAfterFilter }
      : {}),
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
      "X-Api-Nearby": String(result.meta.apiCalls.nearbySearch),
      "X-Api-Details": String(result.meta.apiCalls.placeDetails),
      "X-RateLimit-Limit": String(RATE_LIMIT_PER_WINDOW),
      "X-RateLimit-Remaining": String(rateCheck.remaining),
    },
  });
}
