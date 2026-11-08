"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { ADMIN_PASSKEY_HEADER } from "@/lib/admin/constants";
import { encodePasskeyHeader } from "@/lib/admin/passkey-codec";
import { supabase } from "@/lib/supabase/client";

let ceremony: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = ceremony.then(task, task);
  ceremony = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function authHeaders(token: string): Headers {
  return new Headers({ Authorization: `Bearer ${token}` });
}

async function promptAssertion(token: string): Promise<string> {
  const res = await fetch("/api/admin/passkey/challenge", {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Not Found");
  const options = (await res.json()) as PublicKeyCredentialRequestOptionsJSON;
  try {
    const assertion = await enqueue(() => startAuthentication({ optionsJSON: options }));
    return encodePasskeyHeader(assertion);
  } catch {
    throw new Error("確認がキャンセルされました");
  }
}

/** Header value for one admin operation. The caller must send it on that request only. */
export async function collectPasskeyHeader(): Promise<string> {
  const token = await accessToken();
  if (!token) throw new Error("Not Found");
  return promptAssertion(token);
}

export async function registerAdminPasskey(): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error("Not Found");
  const headers = authHeaders(token);

  const statusRes = await fetch("/api/admin/passkey/status", { headers });
  const statusBody = (await statusRes.json().catch(() => ({}))) as {
    error?: string;
    registered?: boolean;
  };
  if (!statusRes.ok) {
    throw new Error(statusBody.error ?? "Not Found");
  }

  if (statusBody.registered) {
    headers.set(ADMIN_PASSKEY_HEADER, await promptAssertion(token));
  }

  const optionsRes = await fetch("/api/admin/passkey/register", { headers });
  const optionsBody = (await optionsRes.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<PublicKeyCredentialCreationOptionsJSON>;
  if (!optionsRes.ok) throw new Error(optionsBody.error ?? "Not Found");

  let created;
  try {
    created = await enqueue(() =>
      startRegistration({
        optionsJSON: optionsBody as PublicKeyCredentialCreationOptionsJSON,
      }),
    );
  } catch {
    throw new Error("確認がキャンセルされました");
  }

  const save = await fetch("/api/admin/passkey/register", {
    method: "POST",
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(statusBody.registered
        ? { [ADMIN_PASSKEY_HEADER]: headers.get(ADMIN_PASSKEY_HEADER) ?? "" }
        : {}),
    }),
    body: JSON.stringify(created),
  });
  const saveBody = (await save.json().catch(() => ({}))) as { error?: string };
  if (!save.ok) throw new Error(saveBody.error ?? "Not Found");
}
