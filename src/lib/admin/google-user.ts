import { supabaseAdmin } from "@/lib/supabase/server";

export const ADMIN_GOOGLE_EMAIL_ENV = "ADMIN_GOOGLE_EMAIL";

type GoogleUser = {
  email?: string | null;
  app_metadata?: { provider?: string | null } | null;
};

/** True only when getUser's email and provider match the server env. */
export function isAdminGoogleUser(
  user: GoogleUser | null | undefined,
  expectedEmail: string | undefined,
): boolean {
  const expected = expectedEmail?.trim().toLowerCase();
  const email = user?.email?.trim().toLowerCase();
  if (!expected || !email || email !== expected) return false;
  return user?.app_metadata?.provider === "google";
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
    if (!isAdminGoogleUser(data.user, process.env[ADMIN_GOOGLE_EMAIL_ENV])) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}
