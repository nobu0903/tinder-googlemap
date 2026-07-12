// Presentation-layer formatting helpers shared between API routes and the feed hook.

import type {
  SpotRow,
  FeedSpot,
  SpotPhoto,
  FeedPhotoPage,
} from "@/types/backend";
import { MAX_STORED_PHOTOS } from "@/types/backend";

/** Maps price_level (0–4) to a ¥ string. */
export function formatPriceLabel(level: number | null): string {
  if (level === null) return "";
  return "¥".repeat(Math.min(Math.max(level, 1), 4));
}

/**
 * Haversine straight-line distance between two lat/lng points in km.
 * Used to annotate feed items — NOT for DB spatial queries.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Determine today's closing time string, e.g. "22:00", from opening_hours. */
function getTodayClose(row: SpotRow): string | null {
  const periods = row.opening_hours?.periods;
  if (!periods) return null;

  const todayDay = new Date().getDay();
  const period = periods.find((p) => p.open.day === todayDay);
  if (!period) return null;

  const h = String(period.close.hour).padStart(2, "0");
  const m = String(period.close.minute).padStart(2, "0");
  return `${h}:${m}`;
}

function isPortrait(photo: SpotPhoto): boolean {
  return photo.height > photo.width;
}

function isLandscape(photo: SpotPhoto): boolean {
  return photo.width > photo.height;
}

function toPhotoMeta(photo: SpotPhoto, row: SpotRow, index: number) {
  return {
    url: photo.url,
    alt: `${row.name} photo ${index + 1}`,
  };
}

/**
 * Build browsable photo pages from up to 10 stored photos.
 * Portrait → SINGLE_FULL (1 photo). Landscape → pair into DUAL_STACK (2 photos).
 */
export function buildPhotoPages(
  photos: SpotPhoto[],
  row: SpotRow,
): FeedPhotoPage[] {
  const pool = photos.slice(0, MAX_STORED_PHOTOS);
  const pages: FeedPhotoPage[] = [];
  let i = 0;
  let photoIndex = 0;

  while (i < pool.length) {
    const current = pool[i];

    if (isPortrait(current)) {
      pages.push({
        layoutType: "SINGLE_FULL",
        photos: [toPhotoMeta(current, row, photoIndex)],
      });
      i++;
      photoIndex++;
      continue;
    }

    if (isLandscape(current)) {
      const next = pool[i + 1];
      if (next && isLandscape(next)) {
        pages.push({
          layoutType: "DUAL_STACK",
          photos: [
            toPhotoMeta(current, row, photoIndex),
            toPhotoMeta(next, row, photoIndex + 1),
          ],
        });
        i += 2;
        photoIndex += 2;
      } else {
        pages.push({
          layoutType: "SINGLE_FULL",
          photos: [toPhotoMeta(current, row, photoIndex)],
        });
        i++;
        photoIndex++;
      }
      continue;
    }

    pages.push({
      layoutType: "SINGLE_FULL",
      photos: [toPhotoMeta(current, row, photoIndex)],
    });
    i++;
    photoIndex++;
  }

  return pages;
}

/** Map a `SpotRow` + user coordinates into one `FeedSpot` (1 card, up to 10 photos). */
export function rowToFeedSpot(
  row: SpotRow,
  userLat: number,
  userLng: number,
): FeedSpot {
  const all = row.photos ?? [];
  const photoPages = buildPhotoPages(all, row);
  const firstPage = photoPages[0];

  return {
    id: row.id,
    spotId: row.id,
    photoCount: Math.min(all.length, MAX_STORED_PHOTOS),
    photoPages,
    name: row.name,
    rating: row.rating,
    reviewCount: row.user_rating_count,
    priceLevel: row.price_level,
    priceLabel: formatPriceLabel(row.price_level),
    distanceKm:
      Math.round(haversineKm(userLat, userLng, row.lat, row.lng) * 10) / 10,
    isOpen: row.opening_hours?.openNow ?? false,
    todayClose: getTodayClose(row),
    category: row.vibe_tags.length > 0 ? row.vibe_tags[0] : "Restaurant",
    layoutType: firstPage?.layoutType ?? "SINGLE_FULL",
    photos: firstPage?.photos ?? [],
    vibeTags: row.vibe_tags,
    address: row.address,
    weekdayDescriptions: row.opening_hours?.weekdayDescriptions ?? [],
  };
}

/** @deprecated Use rowToFeedSpot — one card per spot */
export function rowToFeedCards(
  row: SpotRow,
  userLat: number,
  userLng: number,
): FeedSpot[] {
  return [rowToFeedSpot(row, userLat, userLng)];
}
