// Review gate — the one rule for "enough reviews to trust" used when saving
// spots, building card pools, and counting hidden gems.

/** Spots with fewer reviews than this are never shown or cached. */
export const LOW_REVIEW_MIN = 20;
/** Below the full review floor, a spot also needs at least this rating. */
export const LOW_REVIEW_MIN_RATING = 3.0;

/**
 * True when a spot has `fullMinReviews`+ reviews, or LOW_REVIEW_MIN+ reviews
 * with a rating of at least LOW_REVIEW_MIN_RATING.
 */
export function passesReviewGate(
  row: { user_rating_count: number | null | undefined; rating: number | null | undefined },
  fullMinReviews: number,
): boolean {
  const count = row.user_rating_count;
  if (count === null || count === undefined) return false;
  if (count >= fullMinReviews) return true;
  if (count < LOW_REVIEW_MIN) return false;
  const rating = row.rating;
  return rating !== null && rating !== undefined && rating >= LOW_REVIEW_MIN_RATING;
}

/** PostgREST `.or()` filter equal to `passesReviewGate` on the spots table. */
export function reviewGateOrFilter(fullMinReviews: number): string {
  return (
    `user_rating_count.gte.${fullMinReviews},` +
    `and(user_rating_count.gte.${LOW_REVIEW_MIN},rating.gte.${LOW_REVIEW_MIN_RATING})`
  );
}
