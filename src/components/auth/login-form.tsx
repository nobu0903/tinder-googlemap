"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { cn } from "@/lib/utils";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLang } from "@/lib/i18n/context";

type AuthView = "signin" | "signup" | "verify";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeInternalRedirect(searchParams.get("redirect"), "/");
  const confirmFailed = searchParams.get("error") === "confirmation_failed";
  const { t } = useLang();

  const themeHint = (() => {
    try {
      const theme = new URL(redirect, "http://local").searchParams.get("theme");
      return theme;
    } catch {
      return null;
    }
  })();

  const { signIn, signUp, resendConfirmation } = useAuth();

  const [view, setView] = useState<AuthView>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    confirmFailed ? t("auth.errors.confirmationFailed") : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  function friendlyError(raw: string): string {
    if (raw.includes("Invalid login credentials"))
      return t("auth.errors.invalidCredentials");
    if (raw.includes("Email not confirmed"))
      return t("auth.errors.emailNotConfirmed");
    if (raw.includes("User already registered"))
      return t("auth.errors.userAlreadyRegistered");
    if (raw.includes("Password should be"))
      return t("auth.errors.passwordTooShort");
    return raw;
  }

  const switchView = (next: AuthView) => {
    setView(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (view === "signin") {
      const { error: err } = await signIn(email, password);
      setIsSubmitting(false);
      if (err) {
        setError(friendlyError(err));
        return;
      }
      router.replace(redirect);
    } else {
      const { error: err } = await signUp(email, password, { next: redirect });
      setIsSubmitting(false);
      if (err) {
        setError(friendlyError(err));
        return;
      }
      setView("verify");
    }
  };

  const handleResend = async () => {
    if (resendCooldown) return;
    const { error: err } = await resendConfirmation(email, { next: redirect });
    if (err) {
      setError(friendlyError(err));
      return;
    }
    setError(null);
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 60_000);
  };

  // ── Verify screen ────────────────────────────────────────────────────────────
  if (view === "verify") {
    return (
      <MobileShell>
        <div className="flex min-h-dvh flex-col items-center justify-center px-8 pb-12 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-ping rounded-full bg-electric-chilli/15" />
            <div className="relative flex size-[72px] items-center justify-center rounded-full bg-surface-raised ring-1 ring-electric-chilli/30">
              <Mail className="size-8 text-electric-chilli" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-[1.75rem] font-black leading-tight tracking-[-0.02em] text-text-primary">
            {t("auth.checkInbox")}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            {t("auth.sentTo")}
          </p>
          <p className="mt-0.5 max-w-[280px] break-all text-sm font-semibold text-text-primary">
            {email}
          </p>

          <p className="mt-5 max-w-[260px] text-xs leading-relaxed text-text-muted">
            {t("auth.clickLink")}
          </p>

          {error && (
            <p
              className="mt-4 max-w-[280px] text-sm text-electric-chilli"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown}
            className="mt-8 text-sm font-semibold text-electric-chilli transition-opacity hover:underline disabled:opacity-40"
          >
            {resendCooldown ? t("auth.emailSent") : t("auth.resend")}
          </button>

          <button
            type="button"
            onClick={() => switchView("signin")}
            className="mt-4 flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="size-3.5" />
            {t("auth.backToSignIn")}
          </button>
        </div>
      </MobileShell>
    );
  }

  // ── Sign in / Sign up form ───────────────────────────────────────────────────
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

        <div className="mx-auto mb-7 flex w-full max-w-sm rounded-2xl bg-surface-raised p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchView(m)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200",
                view === m
                  ? "bg-electric-chilli text-text-primary shadow-[0_2px_12px_rgba(224,62,0,0.35)]"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              {m === "signin" ? t("auth.signIn") : t("auth.signUp")}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-sm space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >
              {t("auth.emailLabel")}
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete={view === "signin" ? "username" : "email"}
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 w-full rounded-xl border border-white/8 bg-surface-raised px-4 text-sm text-text-primary placeholder:text-stealth transition-colors focus:border-electric-chilli/50 focus:outline-none focus:ring-1 focus:ring-electric-chilli/20"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >
              {t("auth.passwordLabel")}
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={
                  view === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-white/8 bg-surface-raised px-4 pr-12 text-sm text-text-primary placeholder:text-stealth transition-colors focus:border-electric-chilli/50 focus:outline-none focus:ring-1 focus:ring-electric-chilli/20"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={
                  showPassword
                    ? t("auth.passwordLabel")
                    : t("auth.passwordLabel")
                }
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stealth transition-colors hover:text-text-primary"
              >
                {showPassword ? (
                  <EyeOff className="size-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="size-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
            {view === "signup" && (
              <p className="mt-1.5 text-[11px] text-stealth">
                {t("auth.minChars")}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2.5">
              <p className="text-xs leading-relaxed text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all duration-150 hover:shadow-[0_6px_28px_rgba(224,62,0,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t("auth.pleaseWait")
              : view === "signin"
                ? t("auth.signIn")
                : t("auth.createAccount")}
          </button>
        </form>

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
