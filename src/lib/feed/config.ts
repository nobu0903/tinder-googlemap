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
 * Review bands scale with city density so "hidden gem" means the same
 * relative thing in Sapporo (local) and Tokyo (tourist).
 *
 * local:   vibe 60–300,  classic 301–800
 * urban:   vibe 60–600,  classic 601–1200
 * tourist: vibe 60–1000, classic 1001–2000
 */
export const AREA_GEM_BANDS: Record<
  AreaProfile,
  Pick<
    FeedAlgorithmConfig,
    "vibeMaxReviews" | "classicMinReviews" | "classicMaxReviews"
  >
> = {
  local: {
    vibeMaxReviews: 300,
    classicMinReviews: 301,
    classicMaxReviews: 800,
  },
  urban: {
    vibeMaxReviews: 600,
    classicMinReviews: 601,
    classicMaxReviews: 1_200,
  },
  tourist: {
    vibeMaxReviews: 1_000,
    classicMinReviews: 1_001,
    classicMaxReviews: 2_000,
  },
};

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
  classicMinReviews: 301,
  classicMaxReviews: 800,
  vibeMinReviews: 60,
  vibeMaxReviews: 300,
  classicMegaReviewThreshold: 5_000,
  classicSlotsPerCycle: 3,
  vibeSlotsPerCycle: 7,
  radiusStepsM: [2_000, 5_000, 10_000],
  minEligibleSpots: 20,
  feedBatchSize: 20,
};

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
