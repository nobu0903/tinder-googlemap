import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isGuestId } from "@/lib/swipe/guest-id";
import { GuestSwipeStoreError, noteGuestSwipe } from "@/lib/swipe/guest-presence";

const BodySchema = z.object({
  guestId: z.string().refine(isGuestId),
});

async function userIdFromRequest(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** One mark per browser per Tokyo day. A bearer attaches those marks to the account. */
export async function POST(req: NextRequest) {
  const limit = await consumeRateLimit(req, "guest-swipe", {
    windowMs: 15 * 60 * 1000,
    maxPerWindow: 30,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const userId = await userIdFromRequest(req);
    await noteGuestSwipe(parsed.data.guestId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GuestSwipeStoreError) {
      const status = err.message.includes("not ready") ? 503 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    throw err;
  }
}
