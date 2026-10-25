import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/api/rate-limit";

describe("getClientIp", () => {
  it("ignores a caller-supplied X-Forwarded-For", () => {
    const req = new Request("http://localhost/api/swipe", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers the platform-set Vercel header over X-Forwarded-For", () => {
    const req = new Request("http://localhost/api/swipe", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": "5.6.7.8, 9.9.9.9",
      },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost/api/photo", {
      headers: { "x-real-ip": "2001:db8::1" },
    });
    expect(getClientIp(req)).toBe("2001:db8::1");
  });
});
