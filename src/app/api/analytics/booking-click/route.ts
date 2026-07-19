import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

const BodySchema = z.object({
  spotId: z.string().min(1),
  bookingUrl: z.string().url(),
  /** 1 = Hotpepper affiliate, 2 = Google Reserve, 3 = Google Maps fallback */
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

/** POST /api/analytics/booking-click — fire-and-forget outbound click telemetry */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { spotId, bookingUrl, tier } = parsed.data;

  // Resolve optional user_id from Bearer token (non-blocking — ignore errors)
  let userId: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    userId = data.user?.id ?? null;
  }

  await supabaseAdmin.from("booking_clicks").insert({
    spot_id: spotId,
    booking_url: bookingUrl,
    booking_tier: tier,
    user_id: userId,
  });

  return NextResponse.json({ ok: true });
}
