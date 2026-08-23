import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";

export { ADMIN_COOKIE_NAME, ADMIN_UNLOCK_PATH } from "@/lib/admin/constants";

/**
 * Admin routes fail closed: ADMIN_SECRET is always required unless
 * ALLOW_INSECURE_ADMIN=1 in development (explicit local opt-in).
 */
export function verifyAdminRequest(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return (
      process.env.ALLOW_INSECURE_ADMIN === "1" &&
      process.env.NODE_ENV === "development"
    );
  }
  return readPresentedSecret(req) === secret;
}

export function readPresentedSecret(req: Request): string | null {
  const header = req.headers.get("x-admin-secret");
  if (header) return header;

  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Attach admin session cookie (HttpOnly — secret never readable by client JS). */
export function attachAdminSessionCookie(res: NextResponse, secret: string) {
  res.cookies.set(ADMIN_COOKIE_NAME, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearAdminSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
