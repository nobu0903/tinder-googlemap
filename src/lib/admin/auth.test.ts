import { describe, expect, it, afterEach, vi } from "vitest";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminRequest,
} from "@/lib/admin/auth";

function makeReq(opts?: { secretHeader?: string; cookieSecret?: string }): Request {
  const headers = new Headers();
  if (opts?.secretHeader !== undefined) {
    headers.set("x-admin-secret", opts.secretHeader);
  }
  if (opts?.cookieSecret !== undefined) {
    headers.set(
      "cookie",
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(opts.cookieSecret)}`,
    );
  }
  return new Request("http://localhost/api/admin/cache", { headers });
}

describe("verifyAdminRequest (BUG-014)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when ADMIN_SECRET is unset", () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_INSECURE_ADMIN", "");
    expect(verifyAdminRequest(makeReq())).toBe(false);
  });

  it("allows insecure mode only with explicit ALLOW_INSECURE_ADMIN=1 in development", () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_INSECURE_ADMIN", "1");
    expect(verifyAdminRequest(makeReq())).toBe(true);
  });

  it("requires matching x-admin-secret when ADMIN_SECRET is set", () => {
    vi.stubEnv("ADMIN_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyAdminRequest(makeReq({ secretHeader: "wrong" }))).toBe(false);
    expect(verifyAdminRequest(makeReq({ secretHeader: "s3cret" }))).toBe(true);
  });

  it("accepts matching HttpOnly-style cookie", () => {
    vi.stubEnv("ADMIN_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyAdminRequest(makeReq({ cookieSecret: "wrong" }))).toBe(false);
    expect(verifyAdminRequest(makeReq({ cookieSecret: "s3cret" }))).toBe(true);
  });
});
