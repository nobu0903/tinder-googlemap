import { NextResponse } from "next/server";

export function verifyAdminRequest(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  return req.headers.get("x-admin-secret") === secret;
}

export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
