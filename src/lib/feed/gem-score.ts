import type { SpotRow } from "@/types/backend";

/**
 * Hidden-gem score for vibe-pool ranking.
 * Higher = more "undiscovered" — used to order the main swipe feed.
 *
 * Factors (no distance):
 * - Fewer reviews → higher score
 * - Solid rating (≈4.0–4.7) → bonus; very low rating → penalty
 * - At least one photo → strong boost (1 photo is enough)
 */
export function gemScore(row: SpotRow): number {
  const reviews = row.user_rating_count ?? 60;
  const rating = row.rating;
  const photoCount = row.photos?.length ?? 0;

  // Inverse log: 60 reviews scores much higher than 300
  const reviewScore = 100 / Math.log10(reviews + 10);

  let ratingScore = 0;
  if (rating != null) {
    if (rating >= 4.0 && rating <= 4.7) ratingScore = 18;
    else if (rating > 4.7 && rating <= 5) ratingScore = 10;
    else if (rating >= 3.5 && rating < 4.0) ratingScore = 8;
    else if (rating < 3.5) ratingScore = -12;
  }

  const photoScore = photoCount >= 1 ? 40 : 0;

  return reviewScore + ratingScore + photoScore;
}

/**
 * Sort vibe candidates by gem score with strong jitter so the same
 * high-scoring spots don't dominate every session.
 */
export function rankVibePool(rows: SpotRow[]): SpotRow[] {
  const scored = rows.map((row) => ({
    row,
    score: gemScore(row) + Math.random() * 28,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.row);
}
