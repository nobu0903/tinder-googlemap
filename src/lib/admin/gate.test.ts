import { describe, expect, it, afterEach, vi } from "vitest";
import { authorizeAdminRequest } from "@/lib/admin/gate";
import { isAdminGoogleUser } from "@/lib/admin/google-user";
import { createMemoryChallengeStore } from "@/lib/admin/passkey-challenge";
import { verifyPasskeyAssertion } from "@/lib/admin/passkey";
import { adminPasskeyRelyingParty } from "@/lib/admin/passkey-rp";
import { operationNeedsPasskey } from "@/lib/admin/client";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

describe("isAdminGoogleUser", () => {
  it("accepts only the env email with provider google", () => {
    const user = {
      email: "Admin@Example.com",
      app_metadata: { provider: "google" },
    };
    expect(isAdminGoogleUser(user, "admin@example.com")).toBe(true);
    expect(isAdminGoogleUser(user, "other@example.com")).toBe(false);
    expect(
      isAdminGoogleUser(
        { email: "admin@example.com", app_metadata: { provider: "email" } },
        "admin@example.com",
      ),
    ).toBe(false);
    expect(isAdminGoogleUser(user, "")).toBe(false);
    expect(isAdminGoogleUser(null, "admin@example.com")).toBe(false);
  });
});

describe("adminPasskeyRelyingParty", () => {
  it("uses the configured site origin instead of a request header", () => {
    expect(
      adminPasskeyRelyingParty({
        NODE_ENV: "production",
        ADMIN_PASSKEY_ORIGIN: "https://evil.example",
      }),
    ).toEqual({ rpID: "evil.example", origin: "https://evil.example" });
    expect(adminPasskeyRelyingParty({ NODE_ENV: "production" })).toEqual({
      rpID: "meshidoko.com",
      origin: "https://meshidoko.com",
    });
  });
});

describe("authorizeAdminRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const deps = {
    verifyDev: async () => true,
    google: async () => false,
    passkey: async () => false,
  };

  it("does not allow production when the cookie check is true and Google or the passkey is not", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const denied = await authorizeAdminRequest(new Request("https://meshidoko.com/api/admin/config"), {
      ...deps,
      google: async () => true,
    });
    expect(denied?.status).toBe(404);

    const noGoogle = await authorizeAdminRequest(
      new Request("https://meshidoko.com/api/admin/config"),
      deps,
    );
    expect(noGoogle?.status).toBe(404);
  });

  it("allows production only when Google and the passkey both pass", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const allowed = await authorizeAdminRequest(
      new Request("https://meshidoko.com/api/admin/config"),
      {
        verifyDev: async () => false,
        google: async () => true,
        passkey: async () => true,
      },
    );
    expect(allowed).toBeNull();
  });

  it("keeps the development cookie gate and its 401", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const allowed = await authorizeAdminRequest(
      new Request("http://localhost/api/admin/config"),
      deps,
    );
    expect(allowed).toBeNull();

    const denied = await authorizeAdminRequest(
      new Request("http://localhost/api/admin/config"),
      { ...deps, verifyDev: async () => false },
    );
    expect(denied?.status).toBe(401);
  });
});

describe("passkey challenges", () => {
  it("discards a challenge after a failed signature and rejects reuse", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSKEY_ORIGIN", "https://meshidoko.com");
    const store = createMemoryChallengeStore();
    const challenge = "challenge-once";
    await store.put(challenge, "authentication", Date.now() + 60_000);
    const assertion = assertionFor(challenge, "https://evil.example");
    const saved: number[] = [];

    const first = await verifyPasskeyAssertion(assertion, verifier(store, assertion.id, saved));
    expect(first).toBe(false);
    expect(await store.consume(challenge, "authentication", Date.now())).toBe(false);

    const second = await verifyPasskeyAssertion(assertion, verifier(store, assertion.id, saved));
    expect(second).toBe(false);
    expect(saved).toEqual([]);
  });
});

describe("operationNeedsPasskey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for a passkey on production operations and not on the session route", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(operationNeedsPasskey("/api/admin/config", false)).toBe(true);
    expect(operationNeedsPasskey("/api/admin/session", false)).toBe(false);
    expect(operationNeedsPasskey("/api/admin/passkey/challenge", false)).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(operationNeedsPasskey("/api/admin/config", false)).toBe(false);
  });
});

function verifier(
  store: ReturnType<typeof createMemoryChallengeStore>,
  id: string,
  saved: number[],
) {
  return {
    store,
    loadCredential: async () => ({
      id,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
    }),
    saveCounter: async (_credentialId: string, counter: number) => {
      saved.push(counter);
    },
  };
}

function assertionFor(challenge: string, origin: string): AuthenticationResponseJSON {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin }),
  ).toString("base64url");
  return {
    id: "cred",
    rawId: "cred",
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON,
      authenticatorData: Buffer.from("not-an-authenticator").toString("base64url"),
      signature: Buffer.from("not-a-signature").toString("base64url"),
      userHandle: undefined,
    },
  };
}
