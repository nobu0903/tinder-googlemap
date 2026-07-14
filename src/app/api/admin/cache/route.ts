import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminUnauthorized, verifyAdminRequest } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ensureSpotsCached, boundingBox, staleThresholdIso } from "@/lib/places/ingest";

export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req)) return adminUnauthorized();

  const { count, error } = await supabaseAdmin
    .from("spots")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: latest } = await supabaseAdmin
    .from("spots")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: freshCount } = await supabaseAdmin
    .from("spots")
    .select("*", { count: "exact", head: true })
    .gt("updated_at", staleThresholdIso());

  return NextResponse.json({
    totalSpots: count ?? 0,
    freshSpots: freshCount ?? 0,
    lastUpdated: latest?.updated_at ?? null,
    cacheTtlDays: 14,
  });
}

const IngestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(20).default(5),
  mode: z.enum(["light", "deep"]).default("light"),
});

export async function POST(req: NextRequest) {
  if (!verifyAdminRequest(req)) return adminUnauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = IngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lat, lng, radiusKm, mode } = parsed.data;

  try {
    const result = await ensureSpotsCached({
      lat,
      lng,
      radiusMeters: radiusKm * 1000,
      forceFetch: true,
      ingestProfile: mode === "deep" ? "admin" : "production",
      bypassCooldown: true,
    });

    const box = boundingBox(lat, lng, radiusKm * 1000);
    const { count: inRadius } = await supabaseAdmin
      .from("spots")
      .select("*", { count: "exact", head: true })
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng);

    return NextResponse.json({
      ingested: result.ingested,
      apiCalls: result.apiCalls,
      spotsInRadius: inRadius ?? 0,
      radiusKm,
      mode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminRequest(req)) return adminUnauthorized();

  const { error } = await supabaseAdmin
    .from("spots")
    .delete()
    .neq("id", "");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "All spots cache cleared." });
}
