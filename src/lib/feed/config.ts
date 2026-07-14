// Mutable feed algorithm config — shared by /api/swipe and admin preview.

export interface FeedAlgorithmConfig {
  classicMinReviews: number;
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

export const DEFAULT_FEED_CONFIG: FeedAlgorithmConfig = {
  classicMinReviews: 500,
  vibeMinReviews: 60,
  vibeMaxReviews: 499,
  classicMegaReviewThreshold: 5_000,
  classicSlotsPerCycle: 1,
  vibeSlotsPerCycle: 9,
  radiusStepsM: [2_000, 5_000, 10_000],
  minEligibleSpots: 20,
  feedBatchSize: 20,
};

let runtimeConfig: FeedAlgorithmConfig = { ...DEFAULT_FEED_CONFIG };

export function getFeedConfig(): FeedAlgorithmConfig {
  return { ...runtimeConfig };
}

export function setFeedConfig(partial: Partial<FeedAlgorithmConfig>): FeedAlgorithmConfig {
  runtimeConfig = { ...runtimeConfig, ...partial };
  return getFeedConfig();
}

export function resetFeedConfig(): FeedAlgorithmConfig {
  runtimeConfig = { ...DEFAULT_FEED_CONFIG };
  return getFeedConfig();
}
