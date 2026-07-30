import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enrichSpotFromDetails } from "@/lib/places/ingest";
import { needsDetailsEnrichment } from "@/lib/places/enrichment-gate";
import { rowToFeedSpot } from "@/lib/places/format";
import { createIpRateLimiter, getClientIp } from "@/lib/api/rate-limit";
import type { SpotRow } from "@/types/backend";

const BodySchema = z.object({
  spotIds: z.array(z.string().min(1)).min(1).max(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Stricter than feed — each hit may cost Place Details + Hotpepper */
const hydrateRateLimit = createIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxPerWindow: 30,
});

/**
 * POST /api/spots/hydrate — lazy Place Details for visible cards (max 2 spots).
 *
 * - Guest OK (swipe works anonymously) but IP rate-limited
 * - Optional Bearer: if present must be valid
 * - Unknown spot IDs are rejected (must already exist in spots cache)
 * - Skips Details when photos + booking pipeline are already complete
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = hydrateRateLimit.check(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  // Optional auth — invalid token is rejected; missing token is allowed (guest)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { spotIds, lat, lng } = parsed.data;

  try {
    const { data: cachedRows, error: selectError } = await supabaseAdmin
      .from("spots")
      .select("*")
      .in("id", spotIds);

    if (selectError) {
      console.error("[POST /api/spots/hydrate] select failed:", selectError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const byId = new Map(
      (cachedRows ?? []).map((row) => [row.id as string, row as SpotRow]),
    );

    const missing = spotIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Unknown spot IDs — hydrate only works for cached feed spots",
          missing,
        },
        { status: 404 },
      );
    }

    const rows: SpotRow[] = [];

    for (const spotId of spotIds) {
      const source = byId.get(spotId)!;

      if (!needsDetailsEnrichment(source)) {
        rows.push(source);
        continue;
      }

      const enriched = await enrichSpotFromDetails(spotId, source);
      if (enriched) rows.push(enriched);
      else rows.push(source);
    }

    const spots = rows.map((row) => rowToFeedSpot(row, lat, lng));

    return NextResponse.json(
      { spots },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hydrate failed";
    console.error("[POST /api/spots/hydrate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
