import { supabaseAdmin } from "@/lib/supabase/server";
import { expandMapsPlaceUrl } from "@/lib/geo/expand-maps-url";
import { parseGoogleMapsPlaceUrl } from "@/lib/geo/maps-place-url";
import { DETAILS_FULL_FIELD_MASK } from "@/lib/places/enrichment-gate";
import { mapPlaceToRow } from "@/lib/places/ingest";
import { rowToFeedSpot } from "@/lib/places/format";
import type { FeedSpot, GooglePlacesPlace, SpotRow } from "@/types/backend";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY env var.");
  return apiKey;
}

async function fetchPlaceDetailsJa(
  placeId: string,
): Promise<GooglePlacesPlace | null> {
  const id = placeId.startsWith("places/")
    ? placeId.slice("places/".length)
    : placeId;
  const res = await fetch(
    `${GOOGLE_PLACES_BASE}/places/${id}?languageCode=ja`,
    {
      headers: {
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask": DETAILS_FULL_FIELD_MASK,
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.warn(
      `[sns-card] Place Details failed for ${placeId}: ${res.status}`,
    );
    return null;
  }
  return (await res.json()) as GooglePlacesPlace;
}

/** Resolve ChIJ when Maps URL only has name + coords (hex ftid). */
async function findPlaceIdByNameNear(
  name: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getApiKey(),
      "X-Goog-FieldMask": "places.id,places.displayName,places.location",
    },
    body: JSON.stringify({
      textQuery: name,
      languageCode: "ja",
      maxResultCount: 3,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 500,
        },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`[sns-card] searchText failed: ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { places?: GooglePlacesPlace[] };
  return data.places?.[0]?.id ?? null;
}

async function loadCachedRow(placeId: string): Promise<SpotRow | null> {
  const { data, error } = await supabaseAdmin
    .from("spots")
    .select("*")
    .eq("id", placeId)
    .maybeSingle();
  if (error) {
    console.warn(`[sns-card] cache select failed: ${error.message}`);
    return null;
  }
  return (data as SpotRow | null) ?? null;
}

/**
 * Build a FeedSpot for admin SNS screenshot cards from a Maps place URL.
 *
 * Always re-fetches Place Details (ja) for fresh photo media names.
 * Does NOT run Hotpepper / booking enrichment (screenshot-only path).
 */
export async function resolveSnsCardFromMapsUrl(
  mapsUrl: string,
): Promise<{
  spot: FeedSpot;
  placeId: string;
  source: "cache" | "details" | "search";
}> {
  const mapsPage = await expandMapsPlaceUrl(mapsUrl);
  const parsed = parseGoogleMapsPlaceUrl(mapsPage);
  if (!parsed) {
    throw new Error(
      "Invalid URL. Paste a Google Maps place link from the website or the app.",
    );
  }

  let placeId = parsed.placeId;
  let source: "cache" | "details" | "search" = "details";

  if (!placeId) {
    if (!parsed.name || parsed.lat == null || parsed.lng == null) {
      throw new Error(
        "Could not find Place ID in the URL. Open the place on Google Maps and copy the full place link.",
      );
    }
    placeId = await findPlaceIdByNameNear(
      parsed.name,
      parsed.lat,
      parsed.lng,
    );
    if (!placeId) {
      throw new Error(
        `No place found for “${parsed.name}” near the URL coordinates.`,
      );
    }
    source = "search";
  }

  const cached = await loadCachedRow(placeId);
  const details = await fetchPlaceDetailsJa(placeId);

  let row: SpotRow | null = null;
  if (details) {
    row = mapPlaceToRow(details, cached ?? undefined);
    // Keep existing booking fields; do not trigger Hotpepper on SNS path.
    if (cached) {
      row.hotpepper_url = cached.hotpepper_url;
      row.booking_url = cached.booking_url;
      row.phone_number = row.phone_number ?? cached.phone_number;
      row.reservation_uri = row.reservation_uri ?? cached.reservation_uri;
    }
    const { error } = await supabaseAdmin
      .from("spots")
      .upsert(row, { onConflict: "id" });
    if (error) {
      console.warn(`[sns-card] upsert failed: ${error.message}`);
    }
  } else if (cached?.photos?.length) {
    console.warn(
      `[sns-card] Details failed; using cached photos for ${placeId}`,
    );
    row = cached;
    source = "cache";
  } else {
    throw new Error("Place Details failed for this place.");
  }

  if (!row.photos?.length) {
    throw new Error(
      "This place has no photos available — cannot build a swipe card.",
    );
  }

  const lat = parsed.lat ?? row.lat;
  const lng = parsed.lng ?? row.lng;
  const spot = rowToFeedSpot(row, lat, lng);

  return { spot, placeId, source };
}
