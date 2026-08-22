// Presentation-layer formatting helpers shared between API routes and the feed hook.

import type {
  SpotRow,
  FeedSpot,
  SpotPhoto,
  FeedPhotoPage,
  OpeningHoursPeriod,
} from "@/types/backend";
import { MAX_STORED_PHOTOS, SWIPE_CARD_PHOTO_WIDTH } from "@/types/backend";
import {
  stripHoursUnavailableStub,
  spotPhotosNeedRefresh,
} from "@/lib/places/enrichment-gate";
import { toClientPhotoUrl } from "@/lib/places/photo-url";

/** Japan product — Google periods are local wall times; evaluate in Tokyo. */
export const FEED_TIMEZONE = "Asia/Tokyo";

const WEEKDAY_TO_DAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Maps price_level (0–4) to a ¥ string. Free (0) is explicit. */
export function formatPriceLabel(level: number | null): string {
  if (level === null) return "";
  if (level === 0) return "Free";
  return "¥".repeat(Math.min(Math.max(level, 1), 4));
}

/** Human-readable Google primary type, e.g. "coffee_shop" → "Coffee Shop". */
export function formatPrimaryType(raw: string | null | undefined): string {
  if (!raw) return "Restaurant";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

/** Weekday (0=Sun) + minutes-since-midnight in the given IANA timezone. */
export function getZonedDayAndMinutes(
  date: Date,
  timeZone: string = FEED_TIMEZONE,
): { day: number; mins: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  return {
    day: WEEKDAY_TO_DAY[weekday] ?? 0,
    mins: hour * 60 + minute,
  };
}

function formatCloseTime(close: { hour: number; minute: number }): string {
  const h = String(close.hour).padStart(2, "0");
  const m = String(close.minute).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Calculates whether a spot is open RIGHT NOW from the stored `periods` array.
 * Uses Asia/Tokyo (not the server process TZ).
 */
export function isOpenNow(
  row: SpotRow,
  now: Date = new Date(),
  timeZone: string = FEED_TIMEZONE,
): boolean {
  const periods = row.opening_hours?.periods;
  if (!periods || periods.length === 0) return false;

  const { day: currentDay, mins: currentMins } = getZonedDayAndMinutes(
    now,
    timeZone,
  );

  for (const p of periods) {
    if (!p.open) continue;
    const openMins = p.open.hour * 60 + p.open.minute;

    // Google may omit close for some always-open / incomplete encodings
    if (!p.close) {
      if (currentDay === p.open.day && currentMins >= openMins) return true;
      continue;
    }

    const closeMins = p.close.hour * 60 + p.close.minute;

    if (p.open.day === p.close.day) {
      if (openMins === 0 && closeMins === 0) return true;
      if (
        currentDay === p.open.day &&
        currentMins >= openMins &&
        currentMins < closeMins
      ) {
        return true;
      }
    } else {
      if (currentDay === p.open.day && currentMins >= openMins) return true;
      if (currentDay === p.close.day && currentMins < closeMins) return true;
    }
  }

  return false;
}

/**
 * Closing time for the period that is active now, or that opens today.
 * Handles overnight periods that opened yesterday.
 */
export function getTodayClose(
  row: SpotRow,
  now: Date = new Date(),
  timeZone: string = FEED_TIMEZONE,
): string | null {
  const periods = row.opening_hours?.periods;
  if (!periods?.length) return null;

  const { day: todayDay, mins: currentMins } = getZonedDayAndMinutes(
    now,
    timeZone,
  );
  const yesterday = (todayDay + 6) % 7;

  const active = findActivePeriod(periods, todayDay, currentMins);
  if (active?.close) return formatCloseTime(active.close);

  const opensToday = periods.find(
    (p) => p.open?.day === todayDay && p.close,
  );
  if (opensToday?.close) return formatCloseTime(opensToday.close);

  const overnight = periods.find(
    (p) =>
      p.open?.day === yesterday &&
      p.close &&
      p.close.day === todayDay,
  );
  if (overnight?.close) return formatCloseTime(overnight.close);

  return null;
}

function findActivePeriod(
  periods: OpeningHoursPeriod[],
  currentDay: number,
  currentMins: number,
): OpeningHoursPeriod | null {
  for (const p of periods) {
    if (!p.open || !p.close) continue;
    const openMins = p.open.hour * 60 + p.open.minute;
    const closeMins = p.close.hour * 60 + p.close.minute;

    if (p.open.day === p.close.day) {
      if (openMins === 0 && closeMins === 0 && currentDay === p.open.day) {
        return p;
      }
      if (
        currentDay === p.open.day &&
        currentMins >= openMins &&
        currentMins < closeMins
      ) {
        return p;
      }
    } else {
      if (currentDay === p.open.day && currentMins >= openMins) return p;
      if (currentDay === p.close.day && currentMins < closeMins) return p;
    }
  }
  return null;
}

function isPortrait(photo: SpotPhoto): boolean {
  return photo.height > photo.width;
}

function isLandscape(photo: SpotPhoto): boolean {
  return photo.width > photo.height;
}

function toPhotoMeta(photo: SpotPhoto, row: SpotRow, index: number) {
  return {
    url: toClientPhotoUrl(photo.url, SWIPE_CARD_PHOTO_WIDTH),
    alt: `${row.name} photo ${index + 1}`,
  };
}

/**
 * Build browsable photo pages from stored photos (capped by MAX_STORED_PHOTOS).
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

/** Map a `SpotRow` + user coordinates into one `FeedSpot` (1 card, up to MAX_STORED_PHOTOS). */
export function rowToFeedSpot(
  row: SpotRow,
  userLat: number,
  userLng: number,
): FeedSpot {
  const all = row.photos ?? [];
  const photoPages = buildPhotoPages(all, row);
  const firstPage = photoPages[0];
  const hours = stripHoursUnavailableStub(row.opening_hours);
  // Only affiliate resolve markers — not opening hours (Admin may fill hours first)
  const bookingResolved =
    row.booking_url != null || row.hotpepper_url != null;

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
    isOpen: isOpenNow(row),
    todayClose: getTodayClose(row),
    category: formatPrimaryType(row.primary_type),
    layoutType: firstPage?.layoutType ?? "SINGLE_FULL",
    photos: firstPage?.photos ?? [],
    vibeTags: row.vibe_tags,
    address: row.address,
    weekdayDescriptions: hours?.weekdayDescriptions ?? [],
    bookingUrl: row.booking_url ?? null,
    bookingResolved,
    photosNeedRefresh: spotPhotosNeedRefresh(row.updated_at),
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
