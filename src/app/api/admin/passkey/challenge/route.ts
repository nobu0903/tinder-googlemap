import { NextRequest, NextResponse } from "next/server";
import { adminNotFound } from "@/lib/admin/auth";
import { requireAdminGoogleUser } from "@/lib/admin/google-user";
import { createAuthenticationOptions } from "@/lib/admin/passkey";
import { PasskeyStorageError } from "@/lib/admin/passkey-store";

/** A fresh challenge for one admin operation. Google check only; the signature comes back on the operation. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return adminNotFound();
  const user = await requireAdminGoogleUser(req);
  if (!user) return adminNotFound();

  try {
    return NextResponse.json(await createAuthenticationOptions());
  } catch (err) {
    if (err instanceof PasskeyStorageError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
