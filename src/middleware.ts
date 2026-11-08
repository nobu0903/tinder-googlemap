import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_UNLOCK_PATH } from "@/lib/admin/constants";

/**
 * Development passes through. The password cookie is checked by each admin route.
 *
 * Production lets /admin and /api/admin reach the route. The route returns 404
 * unless the Google account and a fresh passkey signature both pass.
 * /api/admin/session and the unlock page still pass here first. The unlock page
 * itself returns 404 unless ?k= matches ADMIN_UNLOCK_KEY.
 */
export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (
    pathname === "/api/admin/session" ||
    pathname === ADMIN_UNLOCK_PATH ||
    pathname.startsWith(`${ADMIN_UNLOCK_PATH}/`)
  ) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/ohyeswaitaminutemisterpostman",
    "/ohyeswaitaminutemisterpostman/:path*",
  ],
};
