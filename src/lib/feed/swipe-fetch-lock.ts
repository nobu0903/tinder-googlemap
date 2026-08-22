/**
 * Process-wide in-flight lock for /api/swipe.
 * Survives React Strict Mode remounts (instance refs do not).
 * Concurrent callers with the same key share one Promise and one network request.
 */

let inFlight: Promise<unknown> | null = null;
let inFlightKey: string | null = null;

export function swipeFetchKey(
  lat: number,
  lng: number,
  tag?: string | null,
): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}|${tag ?? ""}`;
}

/**
 * If the same key is already fetching, wait on that promise and return its result
 * instead of starting another request.
 */
export async function runSwipeFetchExclusive<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  if (inFlight && inFlightKey === key) {
    return (await inFlight) as T;
  }

  const run = work().finally(() => {
    if (inFlightKey === key) {
      inFlight = null;
      inFlightKey = null;
    }
  });

  inFlight = run;
  inFlightKey = key;
  return await run;
}
