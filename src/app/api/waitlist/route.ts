import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";

const BodySchema = z.object({
  email: z.string().trim().email().max(254),
  wantsIos: z.boolean().optional().default(false),
  wantsAndroid: z.boolean().optional().default(false),
  featureRequests: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

/** POST /api/waitlist — register interest for the mobile app */
export async function POST(req: NextRequest) {
  const limit = await consumeRateLimit(req, "waitlist", {
    windowMs: 60 * 60 * 1000,
    maxPerWindow: 8,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const { wantsIos, wantsAndroid, featureRequests } = parsed.data;

  // Insert only. A repeat of an existing email must not overwrite that row
  // (no proof the caller owns the address). Duplicate looks like success.
  const { error } = await supabaseAdmin.from("app_waitlist").insert({
    email,
    wants_ios: wantsIos,
    wants_android: wantsAndroid,
    feature_requests: featureRequests,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("[POST /api/waitlist]", error.message);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
