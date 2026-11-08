import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";

describe("admin middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes /admin and /api/admin through in production without a cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const page = await middleware(new NextRequest("https://meshidoko.com/admin"));
    const api = await middleware(
      new NextRequest("https://meshidoko.com/api/admin/config"),
    );
    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
  });
});
