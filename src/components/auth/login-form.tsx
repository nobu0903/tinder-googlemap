"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLang } from "@/lib/i18n/context";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.1l6.3 5.3C37.4 38.4 44 33 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = safeInternalRedirect(searchParams.get("redirect"), "/");
  const confirmFailed = searchParams.get("error") === "confirmation_failed";
  const { t } = useLang();
  const { signInWithGoogle } = useAuth();

  const themeHint = (() => {
    try {
      return new URL(redirect, "http://local").searchParams.get("theme");
    } catch {
      return null;
    }
  })();

  const [error, setError] = useState<string | null>(
    confirmFailed ? t("auth.errors.confirmationFailed") : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setIsSubmitting(true);
    const { error: err } = await signInWithGoogle(redirect);
    if (err) {
      setIsSubmitting(false);
      setError(t("auth.errors.googleFailed"));
    }
  };

  return (
    <MobileShell>
      <div className="flex min-h-dvh flex-col px-6 pb-10 pt-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-[20px] bg-surface-raised shadow-[0_0_40px_rgba(224,62,0,0.2)] ring-1 ring-white/8">
            <span className="text-3xl leading-none" aria-hidden>
              🔥
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">
            VibeLoop
          </h1>
          <p className="mt-1 text-xs text-text-muted">{t("auth.tagline")}</p>
          {themeHint ? (
            <p className="mt-3 rounded-xl border border-electric-chilli/25 bg-electric-chilli/10 px-3 py-2 text-[12px] font-medium text-chilli-bright">
              {t("auth.afterSignIn")}
            </p>
          ) : null}
        </div>

        <div className="mx-auto w-full max-w-sm">
          <p className="mb-4 text-center text-sm leading-relaxed text-text-muted">
            {t("auth.googleOnlyHint")}
          </p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2.5">
              <p className="text-xs leading-relaxed text-red-400" role="alert">
                {error}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-bold text-neutral-900 shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all duration-150 hover:bg-neutral-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleMark />
            {isSubmitting ? t("auth.pleaseWait") : t("auth.googleSignIn")}
          </button>
        </div>

        <div className="mx-auto mt-auto w-full max-w-sm pt-8 text-center">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="size-3.5" />
            {t("auth.continueWithout")}
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}
