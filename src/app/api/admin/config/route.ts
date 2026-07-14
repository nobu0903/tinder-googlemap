import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminUnauthorized, verifyAdminRequest } from "@/lib/admin/auth";
import {
  getFeedConfig,
  resetFeedConfig,
  setFeedConfig,
} from "@/lib/feed/config";

export async function GET(req: NextRequest) {
  if (!verifyAdminRequest(req)) return adminUnauthorized();
  return NextResponse.json({ config: getFeedConfig() });
}

const ConfigSchema = z.object({
  classicMinReviews: z.number().int().min(0).optional(),
  vibeMinReviews: z.number().int().min(0).optional(),
  classicMegaReviewThreshold: z.number().int().min(0).optional(),
  classicSlotsPerCycle: z.number().int().min(0).optional(),
  vibeSlotsPerCycle: z.number().int().min(1).optional(),
  radiusStepsM: z.array(z.number().int().min(100)).optional(),
  minEligibleSpots: z.number().int().min(1).optional(),
  feedBatchSize: z.number().int().min(1).max(50).optional(),
  reset: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!verifyAdminRequest(req)) return adminUnauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.reset) {
    return NextResponse.json({ config: resetFeedConfig() });
  }

  const updates = { ...parsed.data };
  delete updates.reset;
  const config = setFeedConfig(updates);
  return NextResponse.json({ config });
}
