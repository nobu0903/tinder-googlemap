/**
 * Allow only same-origin relative paths for post-auth redirects.
 * Blocks open redirects like `//evil.com` or `https://evil.com`.
 */
export function safeInternalRedirect(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  if (trimmed.includes("://") || trimmed.includes("\\")) {
    return fallback;
  }

  return trimmed;
}

/** Build `/login?redirect=...` with a sanitized destination. */
export function buildLoginPath(destination: string): string {
  const safe = safeInternalRedirect(destination, "/");
  return `/login?redirect=${encodeURIComponent(safe)}`;
}
