// GET /api/swipe — production feed (uses shared feed engine)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { runFeedEngine } from "@/lib/feed/engine";
import { injectNativeAd } from "@/lib/feed/native-ad";
import type { SwipeFeedResponse } from "@/types/backend";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  tag: z.string().optional(),
  exclude: z.string().optional(),
});

function parseExcludeParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Server-side rate limiter ──────────────────────────────────────────────────
// Prevents runaway API costs from idle browsers, bots, or abuse.
// Max 15 feed requests per hour per IP.
// Note: in-memory — resets per serverless function instance (adds protection on top
// of the DB-backed ingest cooldown, which is the cross-instance guard).

const ipRateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_PER_WINDOW = 15;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = ipRateMap.get(ip);

  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    ipRateMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_PER_WINDOW - 1 };
  }

  if (entry.count >= RATE_LIMIT_PER_WINDOW) {
    const retryAfterMs = RATE_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_PER_WINDOW - entry.count };
}

// ─────────────────────────────────────────────────────────────────────────────

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

    if (message.includes("Supabase")) {
      return NextResponse.json(
        { error: "Supabase connection failed. Check your .env.local keys." },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
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

  // Rate limit — applied after param parsing but before any expensive work
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)),
          "X-RateLimit-Limit": String(RATE_LIMIT_PER_WINDOW),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const { lat, lng, tag, exclude: excludeParam } = parsed.data;

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

  const clientExcluded = parseExcludeParam(excludeParam);
  const allExcluded = [...swipedIds, ...clientExcluded];

  const result = await runFeedEngine({
    lat,
    lng,
    tag,
    excludeIds: allExcluded,
  });

  const response: SwipeFeedResponse = {
    spots: injectNativeAd(result.spots),
    radiusKm: result.meta.radiusKm,
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
