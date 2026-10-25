import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin/constants";

export { ADMIN_COOKIE_NAME, ADMIN_UNLOCK_PATH } from "@/lib/admin/constants";

/** Signed session lifetime. The cookie is not the ADMIN_SECRET. */
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
const SESSION_VERSION = "v1";

/**
 * Admin routes fail closed: ADMIN_SECRET is always required unless
 * ALLOW_INSECURE_ADMIN=1 in development (explicit local opt-in).
 *
 * x-admin-secret may still present the raw secret (scripts).
 * The vl_admin cookie must be a signed session token from
 * createAdminSessionToken — a cookie equal to ADMIN_SECRET is rejected.
 */
export async function verifyAdminRequest(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return (
      process.env.ALLOW_INSECURE_ADMIN === "1" &&
      process.env.NODE_ENV === "development"
    );
  }

  const header = req.headers.get("x-admin-secret");
  if (header !== null) return adminSecretsMatch(header, secret);

  const token = readAdminCookie(req);
  if (!token) return false;
  return verifyAdminSessionToken(secret, token);
}

/** Constant-time string compare (hashes both sides to a fixed length). */
export async function adminSecretsMatch(
  presented: string,
  secret: string,
): Promise<boolean> {
  const left = await hmacSha256("vl-admin-compare", presented);
  const right = await hmacSha256("vl-admin-compare", secret);
  return timingSafeEqualBytes(left, right);
}

export async function createAdminSessionToken(
  secret: string,
  nowMs = Date.now(),
): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SEC;
  const payload = `${SESSION_VERSION}.${exp}`;
  const sig = bytesToBase64Url(await hmacSha256(secret, payload));
  return `${payload}.${sig}`;
}

export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Attach a signed admin session cookie (HttpOnly — secret never stored). */
export async function attachAdminSessionCookie(
  res: NextResponse,
  secret: string,
) {
  const token = await createAdminSessionToken(secret);
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export function clearAdminSessionCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function readAdminCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function verifyAdminSessionToken(
  secret: string,
  token: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expStr, sig] = parts;
  if (version !== SESSION_VERSION || !expStr || !sig) return false;
  if (!/^\d+$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 <= nowMs) return false;

  const actual = base64UrlToBytes(sig);
  const expected = await hmacSha256(secret, `${version}.${expStr}`);
  if (!actual || !timingSafeEqualBytes(actual, expected)) return false;
  return true;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return new Uint8Array(sig);
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const padLen = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
