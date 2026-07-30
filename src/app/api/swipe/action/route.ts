// POST /api/swipe/action
//
// Records a like or dislike swipe action for the authenticated user.
// The `swipes` table enforces UNIQUE(user_id, spot_id), so duplicate swipes
// are silently ignored via ON CONFLICT DO NOTHING.
//
// Body: { spotId: string; action: "like" | "dislike" }
// Requires: Authorization: Bearer <supabase-access-token>

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SwipeActionResponse } from "@/types/backend";

const BodySchema = z.object({
  spotId: z.string().min(1),
  action: z.enum(["like", "dislike"]),
});

export async function POST(req: NextRequest) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: userData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { spotId, action } = parsed.data;

  // ── Upsert swipe row ──────────────────────────────────────────────────────
  // ON CONFLICT (user_id, spot_id) → update action (allows changing like→dislike)
  const { error } = await supabaseAdmin.from("swipes").upsert(
    { user_id: userId, spot_id: spotId, action },
    { onConflict: "user_id,spot_id" },
  );

  if (error) {
    console.error("swipe action upsert error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const response: SwipeActionResponse = { ok: true };
  return NextResponse.json(response);
}
