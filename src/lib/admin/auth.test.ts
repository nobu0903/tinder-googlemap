import { describe, expect, it, afterEach, vi } from "vitest";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
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

  it("fails closed when ADMIN_SECRET is unset", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_INSECURE_ADMIN", "");
    expect(await verifyAdminRequest(makeReq())).toBe(false);
  });

  it("allows insecure mode only with explicit ALLOW_INSECURE_ADMIN=1 in development", async () => {
    vi.stubEnv("ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_INSECURE_ADMIN", "1");
    expect(await verifyAdminRequest(makeReq())).toBe(true);
  });

  it("requires matching x-admin-secret when ADMIN_SECRET is set", async () => {
    vi.stubEnv("ADMIN_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "development");
    expect(await verifyAdminRequest(makeReq({ secretHeader: "wrong" }))).toBe(
      false,
    );
    expect(await verifyAdminRequest(makeReq({ secretHeader: "s3cret" }))).toBe(
      true,
    );
  });

  it("accepts a signed session cookie and rejects the raw secret", async () => {
    vi.stubEnv("ADMIN_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "development");
    const token = await createAdminSessionToken("s3cret");
    expect(await verifyAdminRequest(makeReq({ cookieSecret: "wrong" }))).toBe(
      false,
    );
    expect(await verifyAdminRequest(makeReq({ cookieSecret: "s3cret" }))).toBe(
      false,
    );
    expect(await verifyAdminRequest(makeReq({ cookieSecret: token }))).toBe(
      true,
    );
  });

  it("refuses every admin request on a production server", async () => {
    vi.stubEnv("ADMIN_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_INSECURE_ADMIN", "1");
    const token = await createAdminSessionToken("s3cret");
    expect(await verifyAdminRequest(makeReq({ secretHeader: "s3cret" }))).toBe(
      false,
    );
    expect(await verifyAdminRequest(makeReq({ cookieSecret: token }))).toBe(
      false,
    );
  });

  it("rejects an expired or tampered session cookie", async () => {
    vi.stubEnv("ADMIN_SECRET", "s3cret");
    const expired = await createAdminSessionToken(
      "s3cret",
      Date.now() - 40 * 24 * 60 * 60 * 1000,
    );
    expect(await verifyAdminRequest(makeReq({ cookieSecret: expired }))).toBe(
      false,
    );

    const token = await createAdminSessionToken("s3cret");
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(await verifyAdminRequest(makeReq({ cookieSecret: tampered }))).toBe(
      false,
    );
  });
});
