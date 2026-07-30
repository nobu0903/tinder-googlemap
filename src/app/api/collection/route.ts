// GET /api/collection — returns the authenticated user's liked spots.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { toClientPhotoUrl } from "@/lib/places/photo-url";
import type { LikedSpot, CollectionResponse, SpotRow } from "@/types/backend";

export async function GET(req: NextRequest) {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: userData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  // ── Fetch liked swipes (most recent first) ────────────────────────────────
  const { data: swipes, error: swipesError } = await supabaseAdmin
    .from("swipes")
    .select("spot_id, created_at")
    .eq("user_id", userId)
    .eq("action", "like")
    .order("created_at", { ascending: false });

  if (swipesError) {
    console.error("[GET /api/collection] swipes query failed:", swipesError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const spotIds = (swipes ?? []).map((s) => s.spot_id);

  if (spotIds.length === 0) {
    const response: CollectionResponse = { spots: [], total: 0 };
    return NextResponse.json(response);
  }

  // ── Fetch spot details ────────────────────────────────────────────────────
  const { data: spotRows, error: spotsError } = await supabaseAdmin
    .from("spots")
    .select("*")
    .in("id", spotIds);

  if (spotsError) {
    console.error("[GET /api/collection] spots query failed:", spotsError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Preserve like order (most recent first) and merge with spot data
  const spotById = new Map(
    (spotRows ?? []).map((row) => [row.id, row as SpotRow]),
  );

  const spots: LikedSpot[] = (swipes ?? [])
    .filter((s) => spotById.has(s.spot_id))
    .map((s) => {
      const row = spotById.get(s.spot_id)!;
      return {
        spotId: row.id,
        name: row.name,
        rating: row.rating,
        priceLevel: row.price_level,
        primaryType: row.primary_type,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        photos: (row.photos ?? []).map((p) => ({
          ...p,
          url: toClientPhotoUrl(p.url),
        })),
        bookingUrl: row.booking_url,
        likedAt: s.created_at,
      };
    });

  const response: CollectionResponse = { spots, total: spots.length };
  return NextResponse.json(response);
}
