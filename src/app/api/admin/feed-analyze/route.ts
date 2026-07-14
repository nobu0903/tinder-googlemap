import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminUnauthorized, verifyAdminRequest } from "@/lib/admin/auth";
import { getFeedConfig } from "@/lib/feed/config";
import { runFeedAnalyze } from "@/lib/feed/engine";

const ConfigOverrideSchema = z.object({
  classicMinReviews: z.number().int().min(0).optional(),
  vibeMinReviews: z.number().int().min(0).optional(),
  vibeMaxReviews: z.number().int().min(0).optional(),
  classicMegaReviewThreshold: z.number().int().min(0).optional(),
  classicSlotsPerCycle: z.number().int().min(0).optional(),
  vibeSlotsPerCycle: z.number().int().min(1).optional(),
  radiusStepsM: z.array(z.number().int().min(100)).optional(),
  minEligibleSpots: z.number().int().min(1).optional(),
  feedBatchSize: z.number().int().min(1).max(50).optional(),
});

const PostBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tag: z.string().optional(),
  excludeIds: z.array(z.string()).optional(),
  config: ConfigOverrideSchema.optional(),
});

/** POST — DB-only feed analysis (0 Google API calls) */
export async function POST(req: NextRequest) {
  if (!verifyAdminRequest(req)) return adminUnauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { lat, lng, tag, config, excludeIds } = parsed.data;
    const baseConfig = getFeedConfig();
    const mergedConfig = config ? { ...baseConfig, ...config } : baseConfig;

    const result = await runFeedAnalyze({
      lat,
      lng,
      tag,
      excludeIds,
      config: mergedConfig,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/admin/feed-analyze]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
