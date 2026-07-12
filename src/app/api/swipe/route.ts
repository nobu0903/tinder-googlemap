// GET /api/swipe?lat=X&lng=Y&tag=some-tag&exclude=id1,id2
//
// Feed pipeline:
//   1. Validate query params with Zod.
//   2. Run Google Places ingestion if the Supabase cache is stale.
//   3. Build the exclusion list from swipes + client `exclude` param.
//   4. Execute the 1:9 ratio engine with radius auto-expansion (2→5→10 km).
//   5. Return up to 20 unseen, filter-eligible spots per request.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ensureSpotsCached, hydrateFeedSpots, boundingBox } from "@/lib/places/ingest";
import { filterDiningSpotRows } from "@/lib/places/dining-filter";
import { rowToFeedSpot } from "@/lib/places/format";
import type { SpotRow, SwipeFeedResponse } from "@/types/backend";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  tag: z.string().optional(),
  /** Comma-separated spot IDs already seen this session (anonymous dedup) */
  exclude: z.string().optional(),
});

const RADIUS_STEPS = [2_000, 5_000, 10_000] as const;
/** Min eligible spots in cache before stopping radius expansion */
const MIN_ELIGIBLE_SPOTS = 20;
/** Max spots returned per API response */
const FEED_BATCH_SIZE = 20;

/** Classic Pool — 大衆モンスター枠: レビュー500件以上（評価は見ない） */
const CLASSIC_MIN_REVIEWS = 500;

/** Vibe Pool — ディープ発掘枠: レビュー60〜499件（評価は見ない） */
const VIBE_MIN_REVIEWS = 60;
const VIBE_MAX_REVIEWS = 499;

/** Feed interleave: 1 classic slot per 9 vibe slots (10% / 90%) */
const CLASSIC_SLOTS_PER_CYCLE = 1;
const VIBE_SLOTS_PER_CYCLE = 9;

const PREMIUM_VIBE_TAGS = new Set(["splurge", "date", "dinner", "reward"]);

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseExcludeParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function queryEligiblePools(
  box: ReturnType<typeof boundingBox>,
  tag?: string,
): Promise<{ classic: SpotRow[]; vibe: SpotRow[] }> {
  const base = () =>
    supabaseAdmin
      .from("spots")
      .select("*")
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng);

  let vibeQuery = base()
    .gte("user_rating_count", VIBE_MIN_REVIEWS)
    .lte("user_rating_count", VIBE_MAX_REVIEWS);

  if (tag) {
    vibeQuery = vibeQuery.contains("vibe_tags", [tag]);
    if (PREMIUM_VIBE_TAGS.has(tag)) {
      vibeQuery = vibeQuery.gte("price_level", 2).lte("price_level", 3);
    }
  }

  const [{ data: classic }, { data: vibe }] = await Promise.all([
    base().gte("user_rating_count", CLASSIC_MIN_REVIEWS).limit(80),
    vibeQuery.limit(80),
  ]);

  return {
    classic: filterDiningSpotRows((classic ?? []) as SpotRow[]),
    vibe: filterDiningSpotRows((vibe ?? []) as SpotRow[]),
  };
}

function buildFeedPool(
  classic: SpotRow[],
  vibe: SpotRow[],
  excluded: Set<string>,
  maxSize: number,
): SpotRow[] {
  const classicPool = shuffle(classic.filter((s) => !excluded.has(s.id)));
  const vibePool = shuffle(vibe.filter((s) => !excluded.has(s.id)));
  const merged: SpotRow[] = [];
  const seen = new Set<string>();

  let ci = 0;
  let vi = 0;

  while (
    merged.length < maxSize &&
    (ci < classicPool.length || vi < vibePool.length)
  ) {
    for (
      let i = 0;
      i < CLASSIC_SLOTS_PER_CYCLE && ci < classicPool.length && merged.length < maxSize;
      i++
    ) {
      const row = classicPool[ci++];
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    for (
      let i = 0;
      i < VIBE_SLOTS_PER_CYCLE && vi < vibePool.length && merged.length < maxSize;
      i++
    ) {
      const row = vibePool[vi++];
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
    if (ci >= classicPool.length && vi >= vibePool.length) break;
  }

  for (const row of [...vibePool.slice(vi), ...classicPool.slice(ci)]) {
    if (merged.length >= maxSize) break;
    if (seen.has(row.id) || excluded.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }

  return merged;
}

function countEligible(
  classic: SpotRow[],
  vibe: SpotRow[],
  excluded: Set<string>,
): number {
  const seen = new Set<string>();
  for (const row of [...classic, ...vibe]) {
    if (excluded.has(row.id)) continue;
    seen.add(row.id);
  }
  return seen.size;
}

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
            "Places API (New) is not enabled on your Google Cloud project. Enable it at console.cloud.google.com → APIs & Services → Library → Places API (New), then wait a few minutes.",
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

    if (message.includes("Could not find the 'address' column")) {
      return NextResponse.json(
        {
          error:
            "Database migration required: run `ALTER TABLE spots ADD COLUMN IF NOT EXISTS address TEXT;` in Supabase SQL Editor.",
        },
        { status: 500 },
      );
    }

    if (message.includes("Could not find the 'primary_type' column")) {
      return NextResponse.json(
        {
          error:
            "Database migration required: run `ALTER TABLE spots ADD COLUMN IF NOT EXISTS primary_type TEXT;` in Supabase SQL Editor.",
        },
        { status: 500 },
      );
    }

    if (message.includes("Supabase upsert error")) {
      return NextResponse.json({ error: message }, { status: 500 });
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

  const { lat, lng, tag, exclude: excludeParam } = parsed.data;

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    userId = data.user?.id ?? null;
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
  const allExcluded = new Set([...swipedIds, ...clientExcluded]);

  let spots: SpotRow[] = [];
  let usedRadiusM: number = RADIUS_STEPS[0];
  let eligibleAtRadius = 0;

  for (let step = 0; step < RADIUS_STEPS.length; step++) {
    const radiusM = RADIUS_STEPS[step];
    const forceFetch = step > 0;

    await ensureSpotsCached({
      lat,
      lng,
      radiusMeters: radiusM,
      excludedIds: [...allExcluded],
      forceFetch,
    });

    const box = boundingBox(lat, lng, radiusM);
    const { classic, vibe } = await queryEligiblePools(box, tag);
    eligibleAtRadius = countEligible(classic, vibe, allExcluded);

    const batch = buildFeedPool(classic, vibe, allExcluded, FEED_BATCH_SIZE);

    if (batch.length > spots.length) {
      spots = batch;
      usedRadiusM = radiusM;
    }

    if (eligibleAtRadius >= MIN_ELIGIBLE_SPOTS) break;
  }

  const hydratedSpots = await hydrateFeedSpots(spots);
  const feedSpots = hydratedSpots.map((row) => rowToFeedSpot(row, lat, lng));

  const response: SwipeFeedResponse = {
    spots: feedSpots,
    radiusKm: usedRadiusM / 1000,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
