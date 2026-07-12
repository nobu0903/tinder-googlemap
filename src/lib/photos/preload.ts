const preloaded = new Set<string>();

/** Warm the browser cache for photo URLs (deduped per session). */
export function preloadPhotoUrls(urls: string[]): void {
  if (typeof window === "undefined") return;

  for (const url of urls) {
    if (!url || preloaded.has(url)) continue;
    preloaded.add(url);
    const img = new window.Image();
    img.src = url;
  }
}
