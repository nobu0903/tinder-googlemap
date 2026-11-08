import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type Uint8Array_,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import {
  decodeClientDataJSON,
  generateChallenge,
  isoBase64URL,
} from "@simplewebauthn/server/helpers";
import { ADMIN_PASSKEY_HEADER } from "@/lib/admin/constants";
import { decodePasskeyHeader } from "@/lib/admin/passkey-codec";
import type { ChallengeStore } from "@/lib/admin/passkey-challenge";
import { adminPasskeyRelyingParty } from "@/lib/admin/passkey-rp";
import {
  listPasskeys,
  savePasskey,
  savePasskeyCounter,
  supabaseChallengeStore,
} from "@/lib/admin/passkey-store";

const CHALLENGE_TTL_MS = 60_000;

export function readPasskeyAssertion(
  req: Request,
): AuthenticationResponseJSON | null {
  const raw = req.headers.get(ADMIN_PASSKEY_HEADER);
  if (!raw) return null;
  try {
    const parsed = decodePasskeyHeader(raw);
    if (!isAssertion(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isAssertion(value: unknown): value is AuthenticationResponseJSON {
  if (!value || typeof value !== "object") return false;
  const row = value as AuthenticationResponseJSON;
  return (
    row.type === "public-key" &&
    typeof row.id === "string" &&
    typeof row.response?.clientDataJSON === "string"
  );
}

export function isRegistrationResponse(
  value: unknown,
): value is RegistrationResponseJSON {
  if (!value || typeof value !== "object") return false;
  const row = value as RegistrationResponseJSON;
  return (
    row.type === "public-key" &&
    typeof row.id === "string" &&
    typeof row.response?.clientDataJSON === "string" &&
    typeof row.response?.attestationObject === "string"
  );
}

async function issueChallenge(
  store: ChallengeStore,
  purpose: "authentication" | "registration",
): Promise<Uint8Array_> {
  const bytes = await generateChallenge();
  const challenge = isoBase64URL.fromBuffer(bytes);
  await store.put(challenge, purpose, Date.now() + CHALLENGE_TTL_MS);
  return bytes;
}

export async function createAuthenticationOptions(
  store: ChallengeStore = supabaseChallengeStore,
): Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>> {
  const { rpID } = adminPasskeyRelyingParty();
  const credentials = await listPasskeys();
  const challenge = await issueChallenge(store, "authentication");
  return generateAuthenticationOptions({
    rpID,
    challenge,
    timeout: CHALLENGE_TTL_MS,
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
  });
}

export async function createRegistrationOptions(
  userId: string,
  store: ChallengeStore = supabaseChallengeStore,
): Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>> {
  const { rpID } = adminPasskeyRelyingParty();
  const existing = await listPasskeys();
  const challenge = await issueChallenge(store, "registration");
  return generateRegistrationOptions({
    rpName: "meshidoko",
    rpID,
    userName: "meshidoko-admin",
    userDisplayName: "meshidoko admin",
    userID: new TextEncoder().encode(userId),
    challenge,
    timeout: CHALLENGE_TTL_MS,
    attestationType: "none",
    excludeCredentials: existing.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
}

type VerifyDeps = {
  store: ChallengeStore;
  loadCredential: (id: string) => Promise<WebAuthnCredential | null>;
  saveCounter: (id: string, counter: number) => Promise<void>;
  nowMs?: number;
};

async function clientChallenge(clientDataJSON: string): Promise<string | null> {
  try {
    const data = decodeClientDataJSON(clientDataJSON);
    return typeof data.challenge === "string" ? data.challenge : null;
  } catch {
    return null;
  }
}

export async function verifyPasskeyAssertion(
  assertion: AuthenticationResponseJSON,
  deps: VerifyDeps,
): Promise<boolean> {
  const challenge = await clientChallenge(assertion.response.clientDataJSON);
  if (!challenge) return false;
  const consumed = await deps.store.consume(
    challenge,
    "authentication",
    deps.nowMs ?? Date.now(),
  );
  if (!consumed) return false;

  try {
    const credential = await deps.loadCredential(assertion.id);
    if (!credential) return false;
    const { origin, rpID } = adminPasskeyRelyingParty();
    const result = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential,
      requireUserVerification: true,
    });
    if (!result.verified || !result.authenticationInfo.userVerified) return false;
    await deps.saveCounter(assertion.id, result.authenticationInfo.newCounter);
    return true;
  } catch {
    return false;
  }
}

export async function verifyPresentedPasskey(req: Request): Promise<boolean> {
  const assertion = readPasskeyAssertion(req);
  if (!assertion) return false;
  const credentials = await listPasskeys();
  return verifyPasskeyAssertion(assertion, {
    store: supabaseChallengeStore,
    loadCredential: async (id) =>
      credentials.find((credential) => credential.id === id) ?? null,
    saveCounter: savePasskeyCounter,
  });
}

export async function discardRegistrationChallenge(
  response: RegistrationResponseJSON,
  store: ChallengeStore = supabaseChallengeStore,
): Promise<void> {
  const challenge = await clientChallenge(response.response.clientDataJSON);
  if (!challenge) return;
  await store.consume(challenge, "registration", Date.now());
}

export async function verifyAndStoreRegistration(
  response: RegistrationResponseJSON,
  store: ChallengeStore = supabaseChallengeStore,
): Promise<boolean> {
  const challenge = await clientChallenge(response.response.clientDataJSON);
  if (!challenge) return false;
  const consumed = await store.consume(challenge, "registration", Date.now());
  if (!consumed) return false;

  try {
    const { origin, rpID } = adminPasskeyRelyingParty();
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      requireUserPresence: true,
    });
    if (!result.verified || !result.registrationInfo.userVerified) return false;
    const transports = response.response.transports;
    await savePasskey({
      ...result.registrationInfo.credential,
      transports: result.registrationInfo.credential.transports ?? transports,
    });
    return true;
  } catch {
    return false;
  }
}
