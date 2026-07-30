import { describe, expect, it } from "vitest";
import {
  buildLoginPath,
  safeInternalRedirect,
} from "@/lib/auth/safe-redirect";
import { buildThemedSwipePath } from "@/lib/explore/themes";

describe("safeInternalRedirect", () => {
  it("keeps relative app paths including query strings", () => {
    expect(
      safeInternalRedirect("/?theme=under-1000&tag=budget-eat"),
    ).toBe("/?theme=under-1000&tag=budget-eat");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeInternalRedirect("https://evil.com")).toBe("/");
    expect(safeInternalRedirect("//evil.com")).toBe("/");
    expect(safeInternalRedirect("\\\\evil.com")).toBe("/");
  });

  it("falls back for empty values", () => {
    expect(safeInternalRedirect(null)).toBe("/");
    expect(safeInternalRedirect("")).toBe("/");
  });
});

describe("buildLoginPath + buildThemedSwipePath", () => {
  it("round-trips a themed swipe destination through login redirect", () => {
    const destination = buildThemedSwipePath(
      "date-night",
      { lat: 35.658, lng: 139.7016 },
      "Shibuya",
    );

    expect(destination).toContain("theme=date-night");
    expect(destination).toContain("tag=splurge");
    expect(destination).toContain("lat=35.658");
    expect(destination).toContain("lng=139.7016");
    expect(destination).toContain("label=Shibuya");

    const loginPath = buildLoginPath(destination);
    const redirectParam = new URL(loginPath, "http://localhost").searchParams.get(
      "redirect",
    );

    expect(redirectParam).toBe(destination);
    expect(safeInternalRedirect(redirectParam)).toBe(destination);
  });
});
