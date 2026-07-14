// Feed engine — shared between production swipe API and admin preview.

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  ensureSpotsCached,
  hydrateFeedSpots,
  boundingBox,
  countAvailableSpots,
  countVibeSpotsInBox,
} from "@/lib/places/ingest";
import type { IngestApiCalls, IngestProfile } from "@/lib/places/ingest";
import { EMPTY_INGEST_API_CALLS } from "@/lib/places/ingest";
import { filterDiningSpotRows } from "@/lib/places/dining-filter";
import { rowToFeedSpot } from "@/lib/places/format";
import type { FeedSpot, SpotRow } from "@/types/backend";
import {
  ADMIN_MAX_DETAILS_PER_FEED,
  PRODUCTION_MAX_DETAILS_PER_FEED,
} from "@/types/backend";
import {
  getFeedConfig,
  type FeedAlgorithmConfig,
} from "./config";
import {
  classifyPool,
  getSpotExclusionReason,
  passesReviewNoiseFloor,
  type FeedPoolKind,
} from "./exclusion";

const PREMIUM_VIBE_TAGS = new Set(["splurge", "date", "dinner", "reward"]);

/**
 * Tourism density tiers derived from the local DB cache.
 * - tourist: many 2000+ review spots → classicMinReviews raised to 2000
 * - urban:   many 1000+ review spots → classicMinReviews raised to 1000
 * - local:   sparse popular spots    → classicMinReviews stays at default
 */
export type AreaProfile = "tourist" | "urban" | "local";

export type FeedSlotSource = "classic" | "vibe" | "fill";

export interface FeedSpotDebug {
  spotId: string;
  name: string;
  pool: FeedPoolKind;
  slotSource: FeedSlotSource;
  reviewCount: number | null;
  primaryType: string | null;
  rating: number | null;
}

export interface FeedEngineMeta {
  radiusKm: number;
  eligibleAtRadius: number;
  pools: {
    classicCandidates: number;
    vibeCandidates: number;
    classicAfterFilter: number;
    vibeAfterFilter: number;
  };
  mix: {
    classicInFeed: number;
    vibeInFeed: number;
    fillInFeed: number;
  };
  excluded: {
    chain: number;
    lodging: number;
    hotelName: number;
    outOfPool: number;
    clientExclude: number;
  };
  timingMs: {
    ingest: number;
    query: number;
    hydrate: number;
    total: number;
  };
  apiCalls: IngestApiCalls;
  ingestProfile: IngestProfile | "analyze";
  config: FeedAlgorithmConfig;
  ingestedCount: number;
  /** Detected tourism density — determines which classicMinReviews was applied */
  areaProfile: AreaProfile;
  cacheInRadius?: {
    total: number;
    fresh: number;
    vibe: number;
  };
}

export interface FeedEngineResult {
  spots: FeedSpot[];
  rows: SpotRow[];
  debugSpots: FeedSpotDebug[];
  excludedSamples: Array<{
    name: string;
    reviewCount: number | null;
    primaryType: string | null;
    reason: string;
  }>;
  meta: FeedEngineMeta;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function queryEligiblePools(
  box: ReturnType<typeof boundingBox>,
  config: FeedAlgorithmConfig,
  tag?: string,
): Promise<{ classic: SpotRow[]; vibe: SpotRow[]; rawClassic: number; rawVibe: number }> {
  const noiseFloor = config.vibeMinReviews;

  const base = () =>
    supabaseAdmin
      .from("spots")
      .select("*")
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng)
      .gte("user_rating_count", noiseFloor);

  let vibeQuery = base()
    .gte("user_rating_count", config.vibeMinReviews)
    .lte("user_rating_count", config.vibeMaxReviews);

  if (tag) {
    vibeQuery = vibeQuery.contains("vibe_tags", [tag]);
    if (PREMIUM_VIBE_TAGS.has(tag)) {
      vibeQuery = vibeQuery.gte("price_level", 2).lte("price_level", 3);
    }
  }

  const [{ data: classicRaw }, { data: vibeRaw }] = await Promise.all([
    base().gte("user_rating_count", config.classicMinReviews).limit(120),
    vibeQuery.limit(120),
  ]);

  const applyPoolFilters = (rows: SpotRow[]) =>
    filterDiningSpotRows(rows).filter((row) =>
      passesReviewNoiseFloor(row, noiseFloor),
    );

  return {
    classic: applyPoolFilters((classicRaw ?? []) as SpotRow[]),
    vibe: applyPoolFilters((vibeRaw ?? []) as SpotRow[]),
    rawClassic: (classicRaw ?? []).length,
    rawVibe: (vibeRaw ?? []).length,
  };
}

function splitClassicByProminence(
  rows: SpotRow[],
  megaThreshold: number,
): { slotPool: SpotRow[]; fillPool: SpotRow[] } {
  const regular: SpotRow[] = [];
  const mega: SpotRow[] = [];
  for (const row of rows) {
    const count = row.user_rating_count ?? 0;
    if (count >= megaThreshold) mega.push(row);
    else regular.push(row);
  }
  return {
    slotPool: shuffle([...mega, ...regular]),
    fillPool: shuffle([...regular, ...mega]),
  };
}

function buildFeedPoolWithDebug(
  classic: SpotRow[],
  vibe: SpotRow[],
  excluded: Set<string>,
  config: FeedAlgorithmConfig,
): { rows: SpotRow[]; assignments: Map<string, FeedSlotSource> } {
  const eligibleClassic = classic.filter((s) => !excluded.has(s.id));
  const { slotPool: classicSlotPool, fillPool: classicFillPool } =
    splitClassicByProminence(
      eligibleClassic,
      config.classicMegaReviewThreshold,
    );
  const vibePool = shuffle(vibe.filter((s) => !excluded.has(s.id)));
  const merged: SpotRow[] = [];
  const assignments = new Map<string, FeedSlotSource>();
  const seen = new Set<string>();

  let csi = 0;
  let vi = 0;

  while (
    merged.length < config.feedBatchSize &&
    (csi < classicSlotPool.length || vi < vibePool.length)
  ) {
    for (
      let i = 0;
      i < config.classicSlotsPerCycle &&
      csi < classicSlotPool.length &&
      merged.length < config.feedBatchSize;
      i++
    ) {
      const row = classicSlotPool[csi++];
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
      assignments.set(row.id, "classic");
    }
    for (
      let i = 0;
      i < config.vibeSlotsPerCycle &&
      vi < vibePool.length &&
      merged.length < config.feedBatchSize;
      i++
    ) {
      const row = vibePool[vi++];
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
      assignments.set(row.id, "vibe");
    }
    if (csi >= classicSlotPool.length && vi >= vibePool.length) break;
  }

  for (const row of [...vibePool.slice(vi), ...classicFillPool]) {
    if (merged.length >= config.feedBatchSize) break;
    if (seen.has(row.id) || excluded.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    assignments.set(row.id, "fill");
  }

  return { rows: merged, assignments };
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

async function collectExcludedSamples(
  box: ReturnType<typeof boundingBox>,
  config: FeedAlgorithmConfig,
  limit = 15,
): Promise<FeedEngineResult["excludedSamples"]> {
  const { data } = await supabaseAdmin
    .from("spots")
    .select("*")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(120);

  const samples: FeedEngineResult["excludedSamples"] = [];

  for (const row of (data ?? []) as SpotRow[]) {
    const reason = getSpotExclusionReason(row);
    if (reason) {
      samples.push({
        name: row.name,
        reviewCount: row.user_rating_count,
        primaryType: row.primary_type,
        reason,
      });
      if (samples.length >= limit) break;
      continue;
    }
    if (classifyPool(row, config) === "none") {
      samples.push({
        name: row.name,
        reviewCount: row.user_rating_count,
        primaryType: row.primary_type,
        reason: `out of pool (reviews: ${row.user_rating_count ?? "null"})`,
      });
      if (samples.length >= limit) break;
    }
  }

  return samples;
}

function countExcludedBreakdown(
  box: ReturnType<typeof boundingBox>,
  rows: SpotRow[],
): FeedEngineMeta["excluded"] {
  let chain = 0;
  let lodging = 0;
  let hotelName = 0;

  for (const row of rows) {
    const reason = getSpotExclusionReason(row);
    if (!reason) continue;
    if (reason.startsWith("chain")) chain++;
    else if (reason.startsWith("lodging")) lodging++;
    else if (reason === "hotel name") hotelName++;
  }

  return { chain, lodging, hotelName, outOfPool: 0, clientExclude: 0 };
}

export interface RunFeedEngineOptions {
  lat: number;
  lng: number;
  tag?: string;
  excludeIds?: string[];
  skipHydrate?: boolean;
  forceIngest?: boolean;
  ingestProfile?: IngestProfile;
  config?: FeedAlgorithmConfig;
}

export interface RunFeedAnalyzeOptions {
  lat: number;
  lng: number;
  tag?: string;
  excludeIds?: string[];
  config?: FeedAlgorithmConfig;
}

/** DB-only feed simulation — no Google API calls */
export async function runFeedAnalyze(
  opts: RunFeedAnalyzeOptions,
): Promise<FeedEngineResult> {
  const t0 = Date.now();
  const config = opts.config ?? getFeedConfig();
  const { lat, lng, tag, excludeIds = [] } = opts;
  const allExcluded = new Set(excludeIds);

  const initialBox = boundingBox(lat, lng, config.radiusStepsM[0]);
  const { profile: areaProfile, effectiveClassicMin } = await detectAreaProfile(
    initialBox,
    config.classicMinReviews,
  );
  const effectiveConfig: typeof config =
    effectiveClassicMin !== config.classicMinReviews
      ? { ...config, classicMinReviews: effectiveClassicMin }
      : config;

  let spots: SpotRow[] = [];
  let assignments = new Map<string, FeedSlotSource>();
  let usedRadiusM = config.radiusStepsM[0];
  let eligibleAtRadius = 0;
  let poolStats = {
    classicCandidates: 0,
    vibeCandidates: 0,
    classicAfterFilter: 0,
    vibeAfterFilter: 0,
  };
  let queryMs = 0;

  for (let step = 0; step < effectiveConfig.radiusStepsM.length; step++) {
    const radiusM = effectiveConfig.radiusStepsM[step];
    const box = boundingBox(lat, lng, radiusM);
    const queryStart = Date.now();
    const { classic, vibe, rawClassic, rawVibe } = await queryEligiblePools(
      box,
      effectiveConfig,
      tag,
    );
    queryMs += Date.now() - queryStart;

    poolStats = {
      classicCandidates: rawClassic,
      vibeCandidates: rawVibe,
      classicAfterFilter: classic.length,
      vibeAfterFilter: vibe.length,
    };

    eligibleAtRadius = countEligible(classic, vibe, allExcluded);
    const batch = buildFeedPoolWithDebug(classic, vibe, allExcluded, effectiveConfig);

    if (batch.rows.length > spots.length) {
      spots = batch.rows;
      assignments = batch.assignments;
      usedRadiusM = radiusM;
    }

    if (eligibleAtRadius >= effectiveConfig.minEligibleSpots) break;
  }

  const feedSpots = spots.map((row) => rowToFeedSpot(row, lat, lng));

  const debugSpots: FeedSpotDebug[] = spots.map((row) => {
    const slotSource = assignments.get(row.id) ?? "fill";
    return {
      spotId: row.id,
      name: row.name,
      pool: classifyPool(row, effectiveConfig),
      slotSource,
      reviewCount: row.user_rating_count,
      primaryType: row.primary_type,
      rating: row.rating,
    };
  });

  const mix = {
    classicInFeed: debugSpots.filter((s) => s.slotSource === "classic").length,
    vibeInFeed: debugSpots.filter((s) => s.slotSource === "vibe").length,
    fillInFeed: debugSpots.filter((s) => s.slotSource === "fill").length,
  };

  const box = boundingBox(lat, lng, usedRadiusM);
  const excludedSamples = await collectExcludedSamples(box, effectiveConfig);

  const { data: rawInBox } = await supabaseAdmin
    .from("spots")
    .select("name, primary_type")
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .limit(200);

  const excludedBreakdown = countExcludedBreakdown(
    box,
    (rawInBox ?? []) as SpotRow[],
  );
  excludedBreakdown.clientExclude = allExcluded.size;

  const [totalInRadius, freshInRadius, vibeInRadius] = await Promise.all([
    countSpotsInBox(box),
    countAvailableSpots(box, []),
    countVibeSpotsInBox(
      box,
      effectiveConfig.vibeMinReviews,
      effectiveConfig.vibeMaxReviews,
      [],
    ),
  ]);

  return {
    spots: feedSpots,
    rows: spots,
    debugSpots,
    excludedSamples,
    meta: {
      radiusKm: usedRadiusM / 1000,
      eligibleAtRadius,
      pools: poolStats,
      mix,
      excluded: excludedBreakdown,
      timingMs: {
        ingest: 0,
        query: queryMs,
        hydrate: 0,
        total: Date.now() - t0,
      },
      apiCalls: { ...EMPTY_INGEST_API_CALLS },
      ingestProfile: "analyze",
      config: effectiveConfig,
      ingestedCount: 0,
      areaProfile,
      cacheInRadius: {
        total: totalInRadius,
        fresh: freshInRadius,
        vibe: vibeInRadius,
      },
    },
  };
}

async function countSpotsInBox(box: ReturnType<typeof boundingBox>): Promise<number> {
  const { count } = await supabaseAdmin
    .from("spots")
    .select("*", { count: "exact", head: true })
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng);
  return count ?? 0;
}

/**
 * Detect local tourism density by counting cached spots above two review thresholds.
 * Uses two parallel HEAD-only COUNT queries (no rows transferred).
 *
 * Returns an adjusted classicMinReviews that is always >= the config default, so
 * spots with 500–1999 reviews become "vibe" in dense tourist / urban areas — giving
 * the feed engine a much larger vibe pool to draw from without any Google API calls.
 */
async function detectAreaProfile(
  box: ReturnType<typeof boundingBox>,
  configClassicMin: number,
): Promise<{ profile: AreaProfile; effectiveClassicMin: number }> {
  const base = () =>
    supabaseAdmin
      .from("spots")
      .select("*", { count: "exact", head: true })
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng);

  const [{ count: count2000 }, { count: count1000 }] = await Promise.all([
    base().gte("user_rating_count", 2000),
    base().gte("user_rating_count", 1000),
  ]);

  let profile: AreaProfile;
  let detectedMin: number;

  if ((count2000 ?? 0) >= 15) {
    profile = "tourist";
    detectedMin = 2000;
  } else if ((count1000 ?? 0) >= 20) {
    profile = "urban";
    detectedMin = 1000;
  } else {
    profile = "local";
    detectedMin = configClassicMin;
  }

  // Never lower the config-specified threshold (respects admin overrides).
  return { profile, effectiveClassicMin: Math.max(configClassicMin, detectedMin) };
}

export async function runFeedEngine(
  opts: RunFeedEngineOptions,
): Promise<FeedEngineResult> {
  const t0 = Date.now();
  const config = opts.config ?? getFeedConfig();
  const ingestProfile = opts.ingestProfile ?? "production";
  const { lat, lng, tag, excludeIds = [], skipHydrate = false, forceIngest = false } = opts;
  const allExcluded = new Set(excludeIds);

  // Detect tourism density before the loop so every radius step uses the same threshold.
  // Uses the initial (smallest) radius box — cold start returns "local" (default).
  const initialBox = boundingBox(lat, lng, config.radiusStepsM[0]);
  const { profile: areaProfile, effectiveClassicMin } = await detectAreaProfile(
    initialBox,
    config.classicMinReviews,
  );
  const effectiveConfig: typeof config =
    effectiveClassicMin !== config.classicMinReviews
      ? { ...config, classicMinReviews: effectiveClassicMin }
      : config;

  let spots: SpotRow[] = [];
  let assignments = new Map<string, FeedSlotSource>();
  let usedRadiusM = config.radiusStepsM[0];
  let eligibleAtRadius = 0;
  let poolStats = {
    classicCandidates: 0,
    vibeCandidates: 0,
    classicAfterFilter: 0,
    vibeAfterFilter: 0,
  };
  let ingestedCount = 0;
  let ingestMs = 0;
  let queryMs = 0;
  const totalApiCalls: IngestApiCalls = { ...EMPTY_INGEST_API_CALLS };

  const radiusSteps =
    ingestProfile === "production"
      ? config.radiusStepsM.filter((r) => r <= 5_000)
      : config.radiusStepsM;

  for (let step = 0; step < radiusSteps.length; step++) {
    const radiusM = radiusSteps[step];
    // Production: widen DB query only — never force Google ingest on radius expansion.
    const shouldForce =
      forceIngest ||
      (ingestProfile !== "production" &&
        step > 0 &&
        eligibleAtRadius < effectiveConfig.minEligibleSpots);

    const ingestStart = Date.now();
    const ingestResult = await ensureSpotsCached({
      lat,
      lng,
      radiusMeters: radiusM,
      forceFetch: shouldForce,
      ingestProfile,
      bypassCooldown: forceIngest,
      vibeMinReviews: effectiveConfig.vibeMinReviews,
      vibeMaxReviews: effectiveConfig.vibeMaxReviews,
    });
    ingestedCount += ingestResult.ingested;
    totalApiCalls.nearbySearch += ingestResult.apiCalls.nearbySearch;
    totalApiCalls.textSearch += ingestResult.apiCalls.textSearch;
    ingestMs += Date.now() - ingestStart;

    const box = boundingBox(lat, lng, radiusM);
    const queryStart = Date.now();
    const { classic, vibe, rawClassic, rawVibe } = await queryEligiblePools(
      box,
      effectiveConfig,
      tag,
    );
    queryMs += Date.now() - queryStart;

    poolStats = {
      classicCandidates: rawClassic,
      vibeCandidates: rawVibe,
      classicAfterFilter: classic.length,
      vibeAfterFilter: vibe.length,
    };

    eligibleAtRadius = countEligible(classic, vibe, allExcluded);
    const batch = buildFeedPoolWithDebug(classic, vibe, allExcluded, effectiveConfig);

    if (batch.rows.length > spots.length) {
      spots = batch.rows;
      assignments = batch.assignments;
      usedRadiusM = radiusM;
    }

    if (eligibleAtRadius >= effectiveConfig.minEligibleSpots) break;
  }

  const hydrateStart = Date.now();
  const hydrateApiCalls: IngestApiCalls = { ...EMPTY_INGEST_API_CALLS };
  const maxDetailsCalls = skipHydrate
    ? 0
    : ingestProfile === "production"
      ? PRODUCTION_MAX_DETAILS_PER_FEED
      : ADMIN_MAX_DETAILS_PER_FEED;
  const hydratedSpots = await hydrateFeedSpots(spots, hydrateApiCalls, {
    maxDetailsCalls,
  });
  totalApiCalls.placeDetails += hydrateApiCalls.placeDetails;
  const hydrateMs = skipHydrate ? 0 : Date.now() - hydrateStart;

  const feedSpots = hydratedSpots.map((row) => rowToFeedSpot(row, lat, lng));

  const debugSpots: FeedSpotDebug[] = hydratedSpots.map((row) => {
    const slotSource = assignments.get(row.id) ?? "fill";
    return {
      spotId: row.id,
      name: row.name,
      pool: classifyPool(row, effectiveConfig),
      slotSource,
      reviewCount: row.user_rating_count,
      primaryType: row.primary_type,
      rating: row.rating,
    };
  });

  const mix = {
    classicInFeed: debugSpots.filter((s) => s.slotSource === "classic").length,
    vibeInFeed: debugSpots.filter((s) => s.slotSource === "vibe").length,
    fillInFeed: debugSpots.filter((s) => s.slotSource === "fill").length,
  };

  const box = boundingBox(lat, lng, usedRadiusM);

  // Skip expensive debug-only queries in production (results aren't sent to clients).
  const excludedSamples: FeedEngineResult["excludedSamples"] =
    ingestProfile !== "production" ? await collectExcludedSamples(box, effectiveConfig) : [];

  const excludedBreakdown: FeedEngineMeta["excluded"] =
    ingestProfile !== "production"
      ? await (async () => {
          const { data: rawInBox } = await supabaseAdmin
            .from("spots")
            .select("name, primary_type")
            .gte("lat", box.minLat)
            .lte("lat", box.maxLat)
            .gte("lng", box.minLng)
            .lte("lng", box.maxLng)
            .limit(200);
          const breakdown = countExcludedBreakdown(
            box,
            (rawInBox ?? []) as SpotRow[],
          );
          breakdown.clientExclude = allExcluded.size;
          return breakdown;
        })()
      : { chain: 0, lodging: 0, hotelName: 0, outOfPool: 0, clientExclude: allExcluded.size };

  return {
    spots: feedSpots,
    rows: hydratedSpots,
    debugSpots,
    excludedSamples,
    meta: {
      radiusKm: usedRadiusM / 1000,
      eligibleAtRadius,
      pools: poolStats,
      mix,
      excluded: excludedBreakdown,
      timingMs: {
        ingest: ingestMs,
        query: queryMs,
        hydrate: hydrateMs,
        total: Date.now() - t0,
      },
      apiCalls: totalApiCalls,
      ingestProfile,
      config: effectiveConfig,
      ingestedCount,
      areaProfile,
    },
  };
}
