import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdminRequest } from "@/lib/admin/gate";
import { resolveSnsCardFromMapsUrl } from "@/lib/places/sns-card";

const BodySchema = z.object({
  url: z.string().url().max(4000),
});

/**
 * POST /api/admin/sns-card — resolve a Maps place URL, or a maps.app.goo.gl
 * link that opens one, into a FeedSpot.
 * for screenshot-ready swipe cards on the admin page.
 */
export async function POST(req: NextRequest) {
  const denied = await authorizeAdminRequest(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await resolveSnsCardFromMapsUrl(parsed.data.url);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve SNS card";
    console.error("[POST /api/admin/sns-card]", message);
    const clientError =
      message.startsWith("Invalid") ||
      message.startsWith("Could not") ||
      message.startsWith("No place") ||
      message.startsWith("Place Details failed") ||
      message.startsWith("This place has no photos");
    return NextResponse.json(
      { error: clientError ? message : "Request failed" },
      { status: clientError ? 400 : 500 },
    );
  }
}
