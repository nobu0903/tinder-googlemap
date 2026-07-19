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
  applyAreaGemBands,
  denserAreaProfile,
  getFeedConfig,
  type AreaProfile,
  type FeedAlgorithmConfig,
} from "./config";
import {
  classifyPool,
  getSpotExclusionReason,
  passesReviewNoiseFloor,
  type FeedPoolKind,
} from "./exclusion";
import { rankVibePool } from "./gem-score";

export type { AreaProfile };

const PREMIUM_VIBE_TAGS = new Set(["splurge", "date", "dinner", "reward"]);

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
  /** Detected tourism density — drives vibe/classic review bands */
  areaProfile: AreaProfile;
  /** Counts used for areaProfile (auto status check) */
  areaDensity: {
    countGte1000: number;
    countGte2000: number;
    probedRadiusM: number;
  };
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
    base()
      .gte("user_rating_count", config.classicMinReviews)
      .lte("user_rating_count", config.classicMaxReviews)
      .limit(120),
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
  const { slotPool: classicSlotPool } = splitClassicByProminence(
    eligibleClassic,
    config.classicMegaReviewThreshold,
  );
  // Gem-first: rank vibe by hidden-gem score (low reviews, solid rating, ≥1 photo)
  const vibePool = rankVibePool(vibe.filter((s) => !excluded.has(s.id)));
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

  // Fill with remaining vibe only — never pad with classic/famous spots
  for (const row of vibePool.slice(vi)) {
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

  // Auto status check across all radius steps (not only 2km).
  let areaDensity = await resolveAreaProfile(lat, lng, config.radiusStepsM);
  let areaProfile = areaDensity.profile;
  let effectiveConfig = applyAreaGemBands(config, areaProfile);

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

    // Re-check density at this radius; escalate bands if cache is denser here.
    const stepCounts = await countAreaDensity(box);
    const stepProfile = profileFromDensity(
      stepCounts.countGte1000,
      stepCounts.countGte2000,
    );
    if (denserAreaProfile(stepProfile, areaProfile) === stepProfile) {
      areaProfile = stepProfile;
      areaDensity = {
        profile: stepProfile,
        ...stepCounts,
        probedRadiusM: radiusM,
      };
      effectiveConfig = applyAreaGemBands(config, areaProfile);
    }

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
    usedRadiusM = radiusM;

    if (batch.rows.length > spots.length) {
      spots = batch.rows;
      assignments = batch.assignments;
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
      areaDensity: {
        countGte1000: areaDensity.countGte1000,
        countGte2000: areaDensity.countGte2000,
        probedRadiusM: areaDensity.probedRadiusM,
      },
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

export interface AreaDensityProbe {
  profile: AreaProfile;
  countGte1000: number;
  countGte2000: number;
  probedRadiusM: number;
}

async function countAreaDensity(
  box: ReturnType<typeof boundingBox>,
): Promise<{ countGte1000: number; countGte2000: number }> {
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

  return {
    countGte1000: count1000 ?? 0,
    countGte2000: count2000 ?? 0,
  };
}

function profileFromDensity(countGte1000: number, countGte2000: number): AreaProfile {
  if (countGte2000 >= 15) return "tourist";
  if (countGte1000 >= 20) return "urban";
  return "local";
}

/**
 * Probe every radius step and keep the densest profile.
 * Admin DB-analyze often has thin 2km cache; mega spots show up at 5–10km.
 */
async function resolveAreaProfile(
  lat: number,
  lng: number,
  radiusStepsM: number[],
): Promise<AreaDensityProbe> {
  const steps = radiusStepsM.length > 0 ? radiusStepsM : [2_000];
  let best: AreaDensityProbe = {
    profile: "local",
    countGte1000: 0,
    countGte2000: 0,
    probedRadiusM: steps[0],
  };

  for (const radiusM of steps) {
    const { countGte1000, countGte2000 } = await countAreaDensity(
      boundingBox(lat, lng, radiusM),
    );
    const profile = profileFromDensity(countGte1000, countGte2000);
    if (denserAreaProfile(profile, best.profile) === profile) {
      best = { profile, countGte1000, countGte2000, probedRadiusM: radiusM };
    }
    if (profile === "tourist") break;
  }

  return best;
}

export async function runFeedEngine(
  opts: RunFeedEngineOptions,
): Promise<FeedEngineResult> {
  const t0 = Date.now();
  const config = opts.config ?? getFeedConfig();
  const ingestProfile = opts.ingestProfile ?? "production";
  const { lat, lng, tag, excludeIds = [], skipHydrate = false, forceIngest = false } = opts;
  const allExcluded = new Set(excludeIds);

  // Scale gem bands to local density (local≈Sapporo, tourist≈Tokyo).
  // Probe all radius steps up front so Admin / cold cache still picks tourist.
  let areaDensity = await resolveAreaProfile(
    lat,
    lng,
    ingestProfile === "production"
      ? config.radiusStepsM.filter((r) => r <= 5_000)
      : config.radiusStepsM,
  );
  let areaProfile = areaDensity.profile;
  let effectiveConfig = applyAreaGemBands(config, areaProfile);

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
      excludedIds: excludeIds,
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

    // After ingest, density may jump (cold Tokyo → tourist). Re-band before query.
    if (ingestResult.ingested > 0 || step === 0) {
      const boxForProfile = boundingBox(lat, lng, radiusM);
      const stepCounts = await countAreaDensity(boxForProfile);
      const stepProfile = profileFromDensity(
        stepCounts.countGte1000,
        stepCounts.countGte2000,
      );
      if (denserAreaProfile(stepProfile, areaProfile) === stepProfile) {
        areaProfile = stepProfile;
        areaDensity = {
          profile: stepProfile,
          ...stepCounts,
          probedRadiusM: radiusM,
        };
        effectiveConfig = applyAreaGemBands(config, areaProfile);
      }
    }

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
      areaDensity: {
        countGte1000: areaDensity.countGte1000,
        countGte2000: areaDensity.countGte2000,
        probedRadiusM: areaDensity.probedRadiusM,
      },
    },
  };
}
