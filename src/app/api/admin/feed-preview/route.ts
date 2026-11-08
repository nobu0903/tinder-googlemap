import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminRequest } from "@/lib/admin/gate";
import { getFeedConfig, withoutAreaBandOverrides } from "@/lib/feed/config";
import { runFeedEngine } from "@/lib/feed/engine";

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  tag: z.string().optional(),
  forceIngest: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  skipHydrate: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const ConfigOverrideSchema = z.object({
  classicMinReviews: z.number().int().min(0).optional(),
  classicMaxReviews: z.number().int().min(0).optional(),
  vibeMinReviews: z.number().int().min(0).optional(),
  vibeMaxReviews: z.number().int().min(0).optional(),
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
  forceIngest: z.boolean().optional(),
  skipHydrate: z.boolean().optional(),
  excludeIds: z.array(z.string()).optional(),
  config: ConfigOverrideSchema.optional(),
});

async function runPreview(opts: {
  lat: number;
  lng: number;
  tag?: string;
  forceIngest?: boolean;
  skipHydrate?: boolean;
  excludeIds?: string[];
  config?: z.infer<typeof ConfigOverrideSchema>;
}) {
  const baseConfig = getFeedConfig();
  const mergedConfig = opts.config
    ? { ...baseConfig, ...withoutAreaBandOverrides(opts.config) }
    : baseConfig;

  return runFeedEngine({
    lat: opts.lat,
    lng: opts.lng,
    tag: opts.tag,
    excludeIds: opts.excludeIds,
    forceIngest: opts.forceIngest ?? false,
    skipHydrate: opts.skipHydrate ?? false,
    ingestProfile: opts.forceIngest ? "admin" : "production",
    config: mergedConfig,
  });
}

export async function GET(req: NextRequest) {
  const denied = await authorizeAdminRequest(req);
  if (denied) return denied;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { lat, lng, tag, forceIngest, skipHydrate } = parsed.data;
    const result = await runPreview({
      lat,
      lng,
      tag,
      forceIngest,
      skipHydrate,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[GET /api/admin/feed-preview]", message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}

/** POST — preview with Algorithm config form values (no Save required) */
export async function POST(req: NextRequest) {
  const denied = await authorizeAdminRequest(req);
  if (denied) return denied;

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
    const { lat, lng, tag, forceIngest, skipHydrate, config, excludeIds } =
      parsed.data;
    const result = await runPreview({
      lat,
      lng,
      tag,
      forceIngest,
      skipHydrate,
      config,
      excludeIds,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/admin/feed-preview]", message);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
