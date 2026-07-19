import type { Coordinates } from "@/lib/hooks/use-location";

/** Maps Explore theme IDs to feed `tag` query params (vibe_tags filter). */
export const THEME_TAG_MAP: Record<string, string> = {
  "under-1000": "budget-eat",
  "date-night": "splurge",
  "treat-yourself": "splurge",
  "need-energy": "top-rated",
  "with-friends": "budget-eat",
};

/** Themes wired to Swipe — remaining themes are TBD */
export const ACTIVE_THEME_IDS = [
  "under-1000",
  "date-night",
  "treat-yourself",
  "need-energy",
  "with-friends",
] as const;

export type ActiveThemeId = (typeof ACTIVE_THEME_IDS)[number];

export function isActiveThemeId(id: string): id is ActiveThemeId {
  return (ACTIVE_THEME_IDS as readonly string[]).includes(id);
}

export function getThemeTag(themeId: string): string | undefined {
  return THEME_TAG_MAP[themeId];
}

export function buildThemedSwipePath(
  themeId: string,
  coords?: Coordinates | null,
  label?: string | null,
): string {
  const tag = getThemeTag(themeId);
  const params = new URLSearchParams({ theme: themeId });
  if (tag) params.set("tag", tag);
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  }
  if (label) params.set("label", label);
  return `/?${params.toString()}`;
}
