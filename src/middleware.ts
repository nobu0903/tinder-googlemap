import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

/**
 * Hide /admin + /api/admin from the public internet in production.
 *
 * Development: pass-through (local auto-unlock via /api/admin/session still works).
 * Production:
 *   - POST/GET/DELETE /api/admin/session always allowed (login / status / logout)
 *   - everything else under /admin or /api/admin requires a valid admin cookie
 *   - failures return 404 (not 401) so the surface does not advertise itself
 *
 * Real authorization remains verifyAdminRequest inside each API route.
 */
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Chicken-and-egg: unlock must be able to check/set the session without a cookie.
  if (pathname === "/api/admin/session") {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (verifyAdminRequest(req)) return NextResponse.next();
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (pathname.startsWith("/api/admin")) {
    if (verifyAdminRequest(req)) return NextResponse.next();
    // Same status as a missing route — do not leak "Unauthorized".
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
