import { NextRequest, NextResponse } from "next/server";
import { adminNotFound } from "@/lib/admin/auth";
import { requireAdminGoogleUser } from "@/lib/admin/google-user";
import { listPasskeys, PasskeyStorageError } from "@/lib/admin/passkey-store";

/** Tells the signed-in admin whether a site passkey exists. It does not authorize an operation. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return adminNotFound();
  const user = await requireAdminGoogleUser(req);
  if (!user) return adminNotFound();

  try {
    const credentials = await listPasskeys();
    return NextResponse.json({ registered: credentials.length > 0 });
  } catch (err) {
    if (err instanceof PasskeyStorageError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
