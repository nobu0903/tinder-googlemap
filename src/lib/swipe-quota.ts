import { FREE_SWIPE_LIMIT } from "@/lib/hooks/use-free-swipe-quota";

/** Progress 0–100 for the free-swipe usage bar. */
export function swipeQuotaProgressPercent(
  used: number,
  limit: number = FREE_SWIPE_LIMIT,
): number {
  if (limit <= 0) return 0;
  const safeUsed = Math.max(0, used);
  return Math.min(100, (safeUsed / limit) * 100);
}

export function swipeQuotaRemaining(
  used: number,
  limit: number = FREE_SWIPE_LIMIT,
): number {
  return Math.max(0, limit - Math.max(0, used));
}
