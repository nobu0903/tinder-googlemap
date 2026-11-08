import { NextRequest, NextResponse } from "next/server";
import { adminNotFound } from "@/lib/admin/auth";
import { requireAdminGoogleUser } from "@/lib/admin/google-user";
import {
  createRegistrationOptions,
  discardRegistrationChallenge,
  isRegistrationResponse,
  verifyAndStoreRegistration,
  verifyPresentedPasskey,
} from "@/lib/admin/passkey";
import { listPasskeys, PasskeyStorageError } from "@/lib/admin/passkey-store";

function storageFailure(err: unknown): NextResponse | null {
  if (err instanceof PasskeyStorageError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return adminNotFound();
  const user = await requireAdminGoogleUser(req);
  if (!user) return adminNotFound();

  try {
    return NextResponse.json(await createRegistrationOptions(user.id));
  } catch (err) {
    const failure = storageFailure(err);
    if (failure) return failure;
    throw err;
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return adminNotFound();
  const user = await requireAdminGoogleUser(req);
  if (!user) return adminNotFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return adminNotFound();
  }
  if (!isRegistrationResponse(body)) return adminNotFound();

  try {
    const existing = await listPasskeys();
    if (existing.length > 0) {
      const existingOk = await verifyPresentedPasskey(req);
      if (!existingOk) {
        await discardRegistrationChallenge(body);
        return adminNotFound();
      }
    }

    const saved = await verifyAndStoreRegistration(body);
    if (!saved) return adminNotFound();
    return NextResponse.json({ registered: true });
  } catch (err) {
    const failure = storageFailure(err);
    if (failure) return failure;
    throw err;
  }
}
