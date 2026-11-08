import { NextResponse } from "next/server";
import { adminNotFound, adminUnauthorized, verifyAdminRequest } from "@/lib/admin/auth";
import { requireAdminGoogleUser } from "@/lib/admin/google-user";
import { verifyPresentedPasskey } from "@/lib/admin/passkey";
import { PasskeyStorageError } from "@/lib/admin/passkey-store";

export type AdminGateDeps = {
  verifyDev: (req: Request) => Promise<boolean>;
  google: (req: Request) => Promise<boolean>;
  passkey: (req: Request) => Promise<boolean>;
};

const defaultDeps: AdminGateDeps = {
  verifyDev: verifyAdminRequest,
  google: async (req) => (await requireAdminGoogleUser(req)) !== null,
  passkey: verifyPresentedPasskey,
};

/**
 * Development keeps the signed cookie and x-admin-secret.
 * Production ignores both. A request is allowed only when getUser matches
 * ADMIN_GOOGLE_EMAIL, Google is linked, this session signed in with Google,
 * and this request's passkey signature verifies. Failure in production is 404.
 */
export async function authorizeAdminRequest(
  req: Request,
  deps: AdminGateDeps = defaultDeps,
): Promise<Response | null> {
  try {
    if (process.env.NODE_ENV !== "production") {
      if (await deps.verifyDev(req)) return null;
      return adminUnauthorized();
    }

    const googleOk = await deps.google(req);
    const passkeyOk = googleOk && (await deps.passkey(req));
    if (!googleOk || !passkeyOk) return adminNotFound();
    return null;
  } catch (err) {
    if (err instanceof PasskeyStorageError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
