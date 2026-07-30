import { NextRequest, NextResponse } from "next/server";
import { extractPlacesPhotoName } from "@/lib/places/photo-url";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/;

/**
 * GET /api/photo?name=places%2F...%2Fphotos%2F...&maxWidthPx=400
 * Proxies Google Place Photo media with the server API key.
 */
export async function GET(req: NextRequest) {
  const nameParam = req.nextUrl.searchParams.get("name");
  const widthRaw = req.nextUrl.searchParams.get("maxWidthPx") ?? "800";
  const maxWidthPx = Math.min(
    Math.max(Number.parseInt(widthRaw, 10) || 800, 1),
    4800,
  );

  if (!nameParam) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const name = extractPlacesPhotoName(nameParam) ?? nameParam;
  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_PLACES_API_KEY" },
      { status: 500 },
    );
  }

  const upstream = `${GOOGLE_PLACES_BASE}/${name}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;

  try {
    const res = await fetch(upstream, {
      redirect: "follow",
      // Cache at the edge/CDN briefly; photos are immutable per resource name.
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      console.warn(`[GET /api/photo] upstream ${res.status} for ${name}`);
      return NextResponse.json(
        { error: "Photo fetch failed" },
        { status: res.status === 404 ? 404 : 502 },
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Photo proxy failed";
    console.error("[GET /api/photo]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
