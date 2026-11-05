import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { adminUnauthorized, verifyAdminRequest } from "@/lib/admin/auth";
import {
  GrowthRefreshLimitedError,
  loadGrowthReport,
} from "@/lib/admin/growth-load";

export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) return adminUnauthorized();

  try {
    const report = await loadGrowthReport(new Date(), async () => {
      const limit = await consumeRateLimit(req, "admin-growth", {
        windowMs: 10 * 60 * 1000,
        maxPerWindow: 1,
      });
      if (!limit.allowed) throw new GrowthRefreshLimitedError(limit.retryAfterSec);
    });
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof GrowthRefreshLimitedError) {
      return NextResponse.json(
        { error: "利用者数の取得が集中しています。少し待ってから開いてください。" },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSec) },
        },
      );
    }
    console.error("[GET /api/admin/growth]", err);
    return NextResponse.json(
      { error: "利用者数の取得に失敗しました" },
      { status: 500 },
    );
  }
}
