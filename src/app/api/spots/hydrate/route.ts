import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { enrichSpotFromDetails } from "@/lib/places/ingest";
import { rowToFeedSpot } from "@/lib/places/format";
import type { SpotRow } from "@/types/backend";

const BodySchema = z.object({
  spotIds: z.array(z.string().min(1)).min(1).max(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** POST /api/spots/hydrate — lazy Place Details for visible cards only (max 2 spots). */
export async function POST(req: NextRequest) {
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
    const rows: SpotRow[] = [];

    for (const spotId of spotIds) {
      const { data: cached } = await supabaseAdmin
        .from("spots")
        .select("*")
        .eq("id", spotId)
        .maybeSingle();

      const source = (cached as SpotRow | null) ?? null;

      // Skip Place Details when search cache already has at least one photo
      if (source && (source.photos?.length ?? 0) >= 1) {
        rows.push(source);
        continue;
      }

      const enriched = await enrichSpotFromDetails(spotId, source);
      if (enriched) rows.push(enriched);
      else if (source) rows.push(source);
    }

    const spots = rows.map((row) => rowToFeedSpot(row, lat, lng));

    return NextResponse.json(
      { spots },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hydrate failed";
    console.error("[POST /api/spots/hydrate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
