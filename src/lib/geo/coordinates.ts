// Google Maps–style coordinates: 47°29'40.3"N 19°04'33.6"E

const DMS_PART =
  /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?\s*([NnSsEeWw])/;

/** Decimal degrees → e.g. 35°39'28.9"N */
export function decimalToDms(decimal: number, isLatitude: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesTotal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesTotal);
  const seconds = (minutesTotal - minutes) * 60;

  const direction = isLatitude
    ? decimal >= 0
      ? "N"
      : "S"
    : decimal >= 0
      ? "E"
      : "W";

  const paddedMinutes = String(minutes).padStart(2, "0");
  return `${degrees}°${paddedMinutes}'${seconds.toFixed(1)}"${direction}`;
}

/** Pair → Google Maps display string */
export function formatGoogleMapsCoordinates(lat: number, lng: number): string {
  return `${decimalToDms(lat, true)} ${decimalToDms(lng, false)}`;
}

function dmsPartToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  direction: string,
): number {
  let value = degrees + minutes / 60 + seconds / 3600;
  const d = direction.toUpperCase();
  if (d === "S" || d === "W") value *= -1;
  return value;
}

/** Parse one DMS component, e.g. 47°29'40.3"N */
export function parseDmsPart(input: string): number | null {
  const trimmed = input.trim();
  const match = trimmed.match(DMS_PART);
  if (!match) return null;

  const degrees = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const direction = match[4];

  if (minutes >= 60 || seconds >= 60) return null;

  const isLat = direction.toUpperCase() === "N" || direction.toUpperCase() === "S";
  const isLng = direction.toUpperCase() === "E" || direction.toUpperCase() === "W";
  if (!isLat && !isLng) return null;

  const decimal = dmsPartToDecimal(degrees, minutes, seconds, direction);
  if (isLat && (decimal < -90 || decimal > 90)) return null;
  if (isLng && (decimal < -180 || decimal > 180)) return null;

  return decimal;
}

/**
 * Parse Google Maps coordinate string.
 * Accepts: 47°29'40.3"N 19°04'33.6"E
 * Fallback: two decimal numbers "35.658 139.701"
 */
export function parseGoogleMapsCoordinates(
  input: string,
): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = [...trimmed.matchAll(new RegExp(DMS_PART.source, "gi"))];
  if (parts.length >= 2) {
    const first = parts[0];
    const second = parts[1];
    const d1 = first[4].toUpperCase();
    const d2 = second[4].toUpperCase();

    let latPart = first;
    let lngPart = second;
    if ((d1 === "E" || d1 === "W") && (d2 === "N" || d2 === "S")) {
      latPart = second;
      lngPart = first;
    }

    const lat = dmsPartToDecimal(
      Number(latPart[1]),
      Number(latPart[2]),
      Number(latPart[3]),
      latPart[4],
    );
    const lng = dmsPartToDecimal(
      Number(lngPart[1]),
      Number(lngPart[2]),
      Number(lngPart[3]),
      lngPart[4],
    );

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  if (parts.length === 1) return null;

  const decimals = trimmed.match(/-?\d+(?:\.\d+)?/g);
  if (decimals && decimals.length >= 2) {
    const lat = Number(decimals[0]);
    const lng = Number(decimals[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  return null;
}
