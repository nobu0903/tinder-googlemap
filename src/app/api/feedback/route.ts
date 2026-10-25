import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { FeedbackBodySchema } from "@/lib/feedback/schema";
import { supabaseAdmin } from "@/lib/supabase/server";

/** POST /api/feedback — store guided feedback from Settings */
export async function POST(req: NextRequest) {
  const limit = await consumeRateLimit(req, "feedback", {
    windowMs: 60 * 60 * 1000,
    maxPerWindow: 10,
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

  const parsed = FeedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const { area, kind, message, extra, email, source } = parsed.data;

  let userId: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
    userId = data.user?.id ?? null;
  }

  const { error } = await supabaseAdmin.from("feedback").insert({
    area,
    kind,
    message,
    extra,
    email: typeof email === "string" ? email.toLowerCase() : null,
    user_id: userId,
    source,
  });

  if (error) {
    console.error("[POST /api/feedback]", error.message);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
