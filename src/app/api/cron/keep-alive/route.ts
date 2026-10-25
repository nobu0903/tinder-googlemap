import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/keep-alive
 * Vercel Hobby cron (see vercel.json). One real spots read so the
 * Supabase Free project is not treated as idle.
 * Requires Authorization: Bearer CRON_SECRET (Vercel sends this automatically).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[GET /api/cron/keep-alive] CRON_SECRET is not set");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (!cronAuthorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("spots")
    .select("id")
    .limit(1);

  if (error) {
    console.error("[GET /api/cron/keep-alive]", error.message);
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function cronAuthorized(header: string | null, secret: string): boolean {
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const left = createHmac("sha256", "vl-cron").update(presented).digest();
  const right = createHmac("sha256", "vl-cron").update(secret).digest();
  return timingSafeEqual(left, right);
}
