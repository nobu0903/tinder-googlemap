import { NextResponse, type NextRequest } from "next/server";

/**
 * Admin exists only on the local dev server (`npm run dev`).
 * Production always answers 404 for the screen, the unlock page, and the APIs.
 * Each API still calls verifyAdminRequest, which also refuses production.
 */
export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
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
