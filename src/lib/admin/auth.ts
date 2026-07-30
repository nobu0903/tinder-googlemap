import { NextResponse } from "next/server";

/**
 * Admin routes fail closed: ADMIN_SECRET is always required unless
 * ALLOW_INSECURE_ADMIN=1 in development (explicit local opt-in).
 */
export function verifyAdminRequest(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return (
      process.env.ALLOW_INSECURE_ADMIN === "1" &&
      process.env.NODE_ENV === "development"
    );
  }
  return req.headers.get("x-admin-secret") === secret;
}

export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
