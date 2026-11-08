"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin/client";

/**
 * Unlock form. Production only renders this after the bookmark key matches.
 * Wrong password shows a clear error.
 */
export function AdminUnlockScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    setLoading(true);
    setError(null);
    try {
      await adminFetch("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0b] px-4 text-neutral-200">
      <section className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h1 className="text-sm font-semibold tracking-wide text-neutral-200">
          Continue
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
          Enter the server <code className="text-neutral-400">ADMIN_SECRET</code>.
          After unlock you will be redirected. Bookmark this page — it is not
          linked from the public app.
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-200"
            placeholder="Secret"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="rounded bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
          >
            {loading ? "…" : "Continue"}
          </button>
        </form>
      </section>
    </div>
  );
}
