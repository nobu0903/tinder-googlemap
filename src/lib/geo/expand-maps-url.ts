import https from "node:https";
import { parseGoogleMapsPlaceUrl } from "@/lib/geo/maps-place-url";

const MAX_HOPS = 4;
const HOP_TIMEOUT_MS = 8000;

const SHORT_LINK_ERROR =
  "Could not open that short link. Paste the full google.com/maps/place URL.";
const NOT_A_PLACE_ERROR =
  "Could not turn that short link into a place page. Paste the full google.com/maps/place URL.";

export type MapsHop = {
  status: number;
  location: string | null;
};

function hostnameOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/\.$/, "");
}

function isShortMapsHost(hostname: string): boolean {
  return hostname === "maps.app.goo.gl";
}

function isLegacyMapsShortPath(url: URL): boolean {
  return (
    hostnameOf(url) === "goo.gl" &&
    (url.pathname === "/maps" || url.pathname.startsWith("/maps/"))
  );
}

function isGoogleMapsWebHost(hostname: string): boolean {
  return (
    hostname === "google.com" ||
    hostname === "www.google.com" ||
    hostname === "maps.google.com" ||
    hostname === "google.co.jp" ||
    hostname === "www.google.co.jp" ||
    hostname === "maps.google.co.jp"
  );
}

/** True only for the short links this admin field may open. */
export function isMapsShortUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (!isSafeHttps(url)) return false;
  return isShortMapsHost(hostnameOf(url)) || isLegacyMapsShortPath(url);
}

function isSafeHttps(url: URL): boolean {
  return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443");
}

function assertAllowedHop(url: URL): void {
  if (!isSafeHttps(url)) throw new Error(SHORT_LINK_ERROR);
  const hostname = hostnameOf(url);
  if (isShortMapsHost(hostname) || isLegacyMapsShortPath(url)) return;
  if (isGoogleMapsWebHost(hostname) && url.pathname.includes("/maps")) return;
  throw new Error(NOT_A_PLACE_ERROR);
}

function defaultHop(url: URL, signal: AbortSignal): Promise<MapsHop> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: { Accept: "text/html", "User-Agent": "MeshidokoAdmin/1.0" },
        signal,
      },
      (res) => {
        const location = res.headers.location;
        res.destroy();
        resolve({
          status: res.statusCode ?? 0,
          location: Array.isArray(location) ? (location[0] ?? null) : (location ?? null),
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Leave a full place URL untouched. Open only maps.app.goo.gl or goo.gl/maps,
 * and only while each hop stays on Google Maps.
 */
export async function expandMapsPlaceUrl(
  raw: string,
  requestHop: (url: URL, signal: AbortSignal) => Promise<MapsHop> = defaultHop,
): Promise<string> {
  const trimmed = raw.trim();
  if (parseGoogleMapsPlaceUrl(trimmed)) return trimmed;
  if (!isMapsShortUrl(trimmed)) return trimmed;

  let current = new URL(trimmed);
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    assertAllowedHop(current);
    let response: MapsHop;
    try {
      response = await requestHop(current, AbortSignal.timeout(HOP_TIMEOUT_MS));
    } catch {
      throw new Error(SHORT_LINK_ERROR);
    }

    if (response.status < 300 || response.status >= 400 || !response.location) {
      throw new Error(NOT_A_PLACE_ERROR);
    }

    let next: URL;
    try {
      next = new URL(response.location, current);
    } catch {
      throw new Error(NOT_A_PLACE_ERROR);
    }
    assertAllowedHop(next);
    if (parseGoogleMapsPlaceUrl(next.toString())) return next.toString();
    current = next;
  }

  throw new Error(NOT_A_PLACE_ERROR);
}
