"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/layout/mobile-shell";
import { useAuth } from "@/lib/hooks/use-auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.replace(redirect);
  };

  return (
    <MobileShell>
      <main className="flex min-h-dvh flex-col px-6 pb-10 pt-16">
        <header className="mb-8 text-center">
          <h1 className="text-lg font-black tracking-wide text-text-primary">
            Sign in to VibeLoop
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            Themed Explore swipes require an account so we can save your likes.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-sm space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-surface px-3.5 text-[13px] text-text-primary placeholder:text-stealth focus:border-electric-chilli/50 focus:outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-surface px-3.5 text-[13px] text-text-primary placeholder:text-stealth focus:border-electric-chilli/50 focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mx-auto mt-6 max-w-sm text-center text-xs text-text-muted">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="font-semibold text-electric-chilli hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-8 text-center">
          <Link href="/explore" className="text-xs text-text-muted hover:text-text-primary">
            ← Back to Explore
          </Link>
        </p>
      </main>
    </MobileShell>
  );
}
