"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { MobileShell } from "@/components/layout/mobile-shell";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { useLang } from "@/lib/i18n/context";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = safeInternalRedirect(searchParams.get("redirect"), "/");
  const confirmFailed = searchParams.get("error") === "confirmation_failed";
  const { t } = useLang();

  const themeHint = (() => {
    try {
      return new URL(redirect, "http://local").searchParams.get("theme");
    } catch {
      return null;
    }
  })();

  const [error] = useState<string | null>(
    confirmFailed ? t("auth.errors.confirmationFailed") : null,
  );

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

          <GoogleSignInButton
            next={redirect}
            label={t("auth.googleSignIn")}
          />
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
