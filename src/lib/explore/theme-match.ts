import type { SpotRow } from "@/types/backend";

/** Cheap primary types used when Google omits priceLevel. */
const BUDGET_TYPES = new Set([
  "cafe",
  "coffee_shop",
  "bakery",
  "meal_takeaway",
]);

/**
 * Soft theme match for Explore tags.
 * Prefer explicit vibe_tags, but fall back to price / rating / type so
 * rural caches without rich tags still produce a themed feed.
 */
export function matchesTheme(row: SpotRow, tag: string): boolean {
  return themeMatchScore(row, tag) > 0;
}

/**
 * Higher = better fit for the theme.
 * 100+ = explicit tag; 1–99 = soft heuristic; 0 = no match.
 */
export function themeMatchScore(row: SpotRow, tag: string): number {
  const tags = row.vibe_tags ?? [];
  if (tags.includes(tag)) return 100 + softBonus(row, tag);

  return scoreSoftMatch(row, tag);
}

function scoreSoftMatch(row: SpotRow, tag: string): number {
  const price = row.price_level;
  const rating = row.rating;
  const type = row.primary_type ?? "";

  switch (tag) {
    case "budget-eat": {
      if (price !== null && price <= 1) return 80 - price * 5;
      if (price === null && BUDGET_TYPES.has(type)) return 55;
      return 0;
    }
    case "splurge": {
      // Date / treat themes — accept mid-premium (¥¥) when tags are missing
      if (price !== null && price >= 3) return 85;
      if (price !== null && price === 2) return 65;
      if (price === null && rating !== null && rating >= 4.4) return 45;
      return 0;
    }
    case "top-rated": {
      if (rating === null) return 0;
      if (rating >= 4.5) return 90;
      if (rating >= 4.2) return 60;
      return 0;
    }
    case "late-night": {
      // Soft fallback only — explicit vibe_tags already scored in themeMatchScore
      return (row.vibe_tags ?? []).includes("late-night") ? 100 : 0;
    }
    default:
      return 0;
  }
}

function softBonus(row: SpotRow, tag: string): number {
  // Tiny nudge so tagged + soft-fit ranks above tagged alone
  return Math.min(10, Math.floor(scoreSoftMatch(row, tag) / 10));
}

/** Sort rows by theme fit (desc), stable for equal scores. */
export function rankByThemeFit(rows: SpotRow[], tag: string): SpotRow[] {
  return [...rows].sort(
    (a, b) => themeMatchScore(b, tag) - themeMatchScore(a, tag),
  );
}
