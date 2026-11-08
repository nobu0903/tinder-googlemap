import { NextRequest, NextResponse } from "next/server";
import {
  adminNotFound,
  adminSecretsMatch,
  attachAdminSessionCookie,
  clearAdminSessionCookie,
  verifyAdminRequest,
} from "@/lib/admin/auth";
import { consumeRateLimit } from "@/lib/api/rate-limit";

function isLocalAdminEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * GET /api/admin/session — check admin session.
 * Returns 200 always (avoids noisy 401 in the browser console while gated).
 *
 * A signed cookie is issued only by POST with ADMIN_SECRET.
 * This route exists only on the local dev server. Production returns 404.
 * Opening the page does not attach a cookie.
 */
export async function GET(req: NextRequest) {
  if (!isLocalAdminEnabled()) return adminNotFound();

  if (await verifyAdminRequest(req)) {
    return NextResponse.json({ authenticated: true });
  }

  if (
    !process.env.ADMIN_SECRET?.trim() &&
    process.env.ALLOW_INSECURE_ADMIN === "1" &&
    process.env.NODE_ENV === "development"
  ) {
    return NextResponse.json({ authenticated: true, insecure: true });
  }

  return NextResponse.json({ authenticated: false });
}

/**
 * POST /api/admin/session — unlock with password matching ADMIN_SECRET.
 * Local dev server only.
 */
export async function POST(req: NextRequest) {
  if (!isLocalAdminEnabled()) return adminNotFound();

  const limit = await consumeRateLimit(req, "admin-login", {
    windowMs: 15 * 60 * 1000,
    maxPerWindow: 8,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not configured on the server" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!(await adminSecretsMatch(password, secret))) {
    console.warn("[POST /api/admin/session] rejected login");
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ authenticated: true });
  await attachAdminSessionCookie(res, secret);
  return res;
}

/** DELETE /api/admin/session — clear cookie */
export async function DELETE() {
  if (!isLocalAdminEnabled()) return adminNotFound();

  const res = NextResponse.json({ authenticated: false });
  clearAdminSessionCookie(res);
  return res;
}
