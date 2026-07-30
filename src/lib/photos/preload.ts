/**
 * Prefetch same-origin `/api/photo` URLs into the browser HTTP cache.
 *
 * Safe with `unoptimized` Next/Image (or plain <img>): both hit the same URL,
 * so the second request is a cache hit and does not re-bill Google Place Photo.
 *
 * Do NOT use this if photos go through `/_next/image?url=...` — that is a
 * different URL and would cause a second upstream fetch (double billing).
 */

const warmed = new Set<string>();

export function preloadPhotoUrls(urls: string[]): void {
  if (typeof window === "undefined") return;

  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    // Only warm our photo proxy — never external URLs with unknown cache semantics.
    if (!url.startsWith("/api/photo")) continue;
    warmed.add(url);

    const img = new window.Image();
    img.decoding = "async";
    img.src = url;
  }
}

/** First display photo URL for a feed spot (cover / page 0). */
export function coverPhotoUrl(spot: {
  photos?: { url: string }[];
  photoPages?: { photos: { url: string }[] }[];
}): string | null {
  const fromPage = spot.photoPages?.[0]?.photos?.[0]?.url;
  if (fromPage) return fromPage;
  const fromPhotos = spot.photos?.[0]?.url;
  return fromPhotos || null;
}
