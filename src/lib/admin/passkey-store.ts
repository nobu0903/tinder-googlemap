import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { WebAuthnCredential } from "@simplewebauthn/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ChallengePurpose, ChallengeStore } from "@/lib/admin/passkey-challenge";

export class PasskeyStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeyStorageError";
  }
}

function raise(error: { message?: string; code?: string } | null): void {
  if (!error) return;
  const missing =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.message ?? "").includes("admin_passkey");
  if (missing) {
    throw new PasskeyStorageError(
      "Passkey storage is not ready. Run migration 009_admin_passkeys.sql.",
    );
  }
  throw new Error(error.message ?? "Passkey storage failed");
}

export const supabaseChallengeStore: ChallengeStore = {
  async put(challenge, purpose, expiresAtMs) {
    await supabaseAdmin
      .from("admin_passkey_challenges")
      .delete()
      .lt("expires_at", new Date().toISOString());
    const { error } = await supabaseAdmin.from("admin_passkey_challenges").insert({
      challenge,
      purpose,
      expires_at: new Date(expiresAtMs).toISOString(),
    });
    raise(error);
  },
  async consume(challenge, purpose, nowMs) {
    const { data, error } = await supabaseAdmin
      .from("admin_passkey_challenges")
      .delete()
      .eq("challenge", challenge)
      .select("purpose, expires_at");
    raise(error);
    const row = data?.[0] as
      | { purpose: ChallengePurpose; expires_at: string }
      | undefined;
    if (!row) return false;
    if (row.purpose !== purpose) return false;
    return new Date(row.expires_at).getTime() > nowMs;
  },
};

export async function listPasskeys(): Promise<WebAuthnCredential[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_passkeys")
    .select("credential_id, public_key, counter, transports");
  raise(error);
  return (data ?? []).map((row) => {
    const record = row as {
      credential_id: string;
      public_key: string;
      counter: number;
      transports: string[] | null;
    };
    return {
      id: record.credential_id,
      publicKey: isoBase64URL.toBuffer(record.public_key),
      counter: Number(record.counter),
      transports: record.transports ?? undefined,
    };
  });
}

export async function savePasskey(credential: WebAuthnCredential): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_passkeys").insert({
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
  });
  raise(error);
}

export async function savePasskeyCounter(
  id: string,
  counter: number,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("admin_passkeys")
    .update({ counter })
    .eq("credential_id", id);
  raise(error);
}
