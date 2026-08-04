// Mutable feed algorithm config — shared by /api/swipe and admin preview.

export interface FeedAlgorithmConfig {
  classicMinReviews: number;
  /** Hard cap — tourist mega-spots above this never enter the feed */
  classicMaxReviews: number;
  vibeMinReviews: number;
  vibeMaxReviews: number;
  /** Reviews above this are "mega-famous" — reserved for classic slots, not fill */
  classicMegaReviewThreshold: number;
  classicSlotsPerCycle: number;
  vibeSlotsPerCycle: number;
  radiusStepsM: number[];
  minEligibleSpots: number;
  feedBatchSize: number;
}

/** Density tier from nearby cache — drives gem review bands */
export type AreaProfile = "tourist" | "urban" | "local";

/**
 * Review bands scale with *cached density* near the user (not city name).
 * Probe: how many spots nearby have ≥1000 / ≥2000 reviews → local | urban | tourist.
 *
 * local:   vibe 60–400,  classic 401–1200  (Sapporo-scale; was 300/800 — too tight)
 * urban:   vibe 60–700,  classic 701–1500
 * tourist: vibe 60–1000, classic 1001–2500
 */
export const AREA_GEM_BANDS: Record<
  AreaProfile,
  Pick<
    FeedAlgorithmConfig,
    "vibeMaxReviews" | "classicMinReviews" | "classicMaxReviews"
  >
> = {
  local: {
    vibeMaxReviews: 400,
    classicMinReviews: 401,
    classicMaxReviews: 1_200,
  },
  urban: {
    vibeMaxReviews: 700,
    classicMinReviews: 701,
    classicMaxReviews: 1_500,
  },
  tourist: {
    vibeMaxReviews: 1_000,
    classicMinReviews: 1_001,
    classicMaxReviews: 2_500,
  },
};

/**
 * Last-resort bands when the radius ladder still cannot fill a feed page.
 * Keeps vibeMinReviews; widens caps so mid-famous locals can appear.
 */
export function applyStarvationRelaxation(
  config: FeedAlgorithmConfig,
): FeedAlgorithmConfig {
  return {
    ...config,
    vibeMaxReviews: Math.max(config.vibeMaxReviews, 800),
    classicMinReviews: Math.min(config.classicMinReviews, 401),
    classicMaxReviews: Math.max(config.classicMaxReviews, 2_500),
    minEligibleSpots: Math.min(config.minEligibleSpots, 8),
  };
}

const AREA_PROFILE_RANK: Record<AreaProfile, number> = {
  local: 0,
  urban: 1,
  tourist: 2,
};

/** Pick the denser of two area profiles. */
export function denserAreaProfile(a: AreaProfile, b: AreaProfile): AreaProfile {
  return AREA_PROFILE_RANK[a] >= AREA_PROFILE_RANK[b] ? a : b;
}

/** Apply density-based gem bands on top of a base config. */
export function applyAreaGemBands(
  base: FeedAlgorithmConfig,
  profile: AreaProfile,
): FeedAlgorithmConfig {
  const band = AREA_GEM_BANDS[profile];
  return {
    ...base,
    vibeMaxReviews: band.vibeMaxReviews,
    classicMinReviews: band.classicMinReviews,
    classicMaxReviews: band.classicMaxReviews,
  };
}

/**
 * Strip review-band fields owned by area auto-detection.
 * Admin tests should pass this so form "local defaults" never pin the band.
 */
export function withoutAreaBandOverrides(
  partial: Partial<FeedAlgorithmConfig>,
): Partial<FeedAlgorithmConfig> {
  const {
    classicMinReviews: _classicMin,
    classicMaxReviews: _classicMax,
    vibeMaxReviews: _vibeMax,
    ...rest
  } = partial;
  return rest;
}

/**
 * Hidden-gem–first defaults (local / Sapporo-scale).
 * Dense cities raise vibeMax via applyAreaGemBands at request time.
 */
export const DEFAULT_FEED_CONFIG: FeedAlgorithmConfig = {
  classicMinReviews: 401,
  classicMaxReviews: 1_200,
  vibeMinReviews: 60,
  vibeMaxReviews: 400,
  classicMegaReviewThreshold: 5_000,
  classicSlotsPerCycle: 3,
  vibeSlotsPerCycle: 7,
  /** 2km → 3km → 5km → 10km (production uses the full ladder when pool is thin) */
  radiusStepsM: [2_000, 3_000, 5_000, 10_000],
  minEligibleSpots: 20,
  /** Match free-tier daily swipe cap so we don't over-fetch unused cards */
  feedBatchSize: 10,
}

let runtimeConfig: FeedAlgorithmConfig = { ...DEFAULT_FEED_CONFIG };

export function getFeedConfig(): FeedAlgorithmConfig {
  return { ...DEFAULT_FEED_CONFIG, ...runtimeConfig };
}

export function setFeedConfig(partial: Partial<FeedAlgorithmConfig>): FeedAlgorithmConfig {
  runtimeConfig = { ...DEFAULT_FEED_CONFIG, ...runtimeConfig, ...partial };
  return getFeedConfig();
}

export function resetFeedConfig(): FeedAlgorithmConfig {
  runtimeConfig = { ...DEFAULT_FEED_CONFIG };
  return getFeedConfig();
}
