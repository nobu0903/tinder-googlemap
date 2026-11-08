import { supabaseAdmin } from "@/lib/supabase/server";

export const ADMIN_GOOGLE_EMAIL_ENV = "ADMIN_GOOGLE_EMAIL";

type GoogleUser = {
  email?: string | null;
  app_metadata?: { provider?: string | null; providers?: string[] | null } | null;
  identities?: { provider?: string | null }[] | null;
};

export type GoogleLoginClaims = {
  /** Methods on this access token. A refresh keeps the method from the original sign-in. */
  methods: string[];
};

const EMAIL_LOGIN_METHODS = new Set(["password", "otp", "magiclink"]);

function linkedProviders(user: GoogleUser): Set<string> {
  const providers = new Set<string>();
  const primary = user.app_metadata?.provider;
  if (primary) providers.add(primary);
  for (const provider of user.app_metadata?.providers ?? []) {
    if (provider) providers.add(provider);
  }
  for (const identity of user.identities ?? []) {
    if (identity.provider) providers.add(identity.provider);
  }
  return providers;
}

function isOauthMethod(method: string): boolean {
  return method === "oauth" || method.startsWith("oauth_provider/");
}

/**
 * The account email must match, Google must be linked, and this session must
 * be a Google sign-in. Email can stay linked. An email or password session
 * for the same address does not pass.
 */
export function isAdminGoogleUser(
  user: GoogleUser | null | undefined,
  expectedEmail: string | undefined,
  login?: GoogleLoginClaims,
): boolean {
  const expected = expectedEmail?.trim().toLowerCase();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !expected || !email || email !== expected) return false;

  const providers = linkedProviders(user);
  const social = [...providers].filter((provider) => provider !== "email");
  if (!(social.length === 1 && social[0] === "google")) return false;

  if (!login) return user.app_metadata?.provider === "google";
  if (login.methods.some((method) => EMAIL_LOGIN_METHODS.has(method))) return false;
  if (login.methods.some(isOauthMethod)) return true;
  return login.methods.length === 0 && user.app_metadata?.provider === "google";
}

export function loginClaimsFromAccessToken(token: string): GoogleLoginClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      amr?: unknown;
    };
    if (!Array.isArray(json.amr)) return { methods: [] };
    const methods = json.amr.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      if (entry && typeof entry === "object" && typeof (entry as { method?: unknown }).method === "string") {
        return [(entry as { method: string }).method];
      }
      return [];
    });
    return { methods };
  } catch {
    return null;
  }
}

export async function requireAdminGoogleUser(
  req: Request,
): Promise<{ id: string } | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const login = loginClaimsFromAccessToken(token);
    if (!login) return null;
    if (!isAdminGoogleUser(data.user, process.env[ADMIN_GOOGLE_EMAIL_ENV], login)) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}
