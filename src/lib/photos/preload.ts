/**
 * Photo preloading is intentionally disabled.
 *
 * Next.js <Image> already fetches photos through /_next/image (server-side,
 * cached at CDN), so calling window.Image() here would hit the Google Places
 * Photo API a second time from the browser — doubling the billing cost for
 * every photo displayed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function preloadPhotoUrls(_urls: string[]): void {
  // no-op — rely on Next.js Image optimisation cache
}
