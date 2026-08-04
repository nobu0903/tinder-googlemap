"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited";

export function WaitlistForm() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [wantsIos, setWantsIos] = useState(false);
  const [wantsAndroid, setWantsAndroid] = useState(false);
  const [featureRequests, setFeatureRequests] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          wantsIos,
          wantsAndroid,
          featureRequests,
        }),
      });

      if (res.status === 429) {
        setStatus("rate_limited");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto w-full max-w-sm text-center">
        <p className="text-2xl" aria-hidden>
          📱
        </p>
        <h2 className="mt-3 text-lg font-black text-text-primary">
          {t("waitlist.successTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          {t("waitlist.successDesc")}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98]"
        >
          {t("waitlist.backToSwipe")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-sm space-y-5"
      noValidate
    >
      <div>
        <label
          htmlFor="waitlist-email"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        >
          {t("waitlist.emailLabel")}
          <span className="ml-1 text-electric-chilli">*</span>
        </label>
        <input
          id="waitlist-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-white/10 bg-surface-raised px-3.5 text-sm text-text-primary outline-none ring-electric-chilli/40 placeholder:text-text-muted/50 focus:ring-2"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {t("waitlist.platformLabel")}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-text-muted/60">
            ({t("waitlist.optional")})
          </span>
        </legend>
        <div className="flex gap-2">
          <PlatformChip
            label="iOS"
            checked={wantsIos}
            onChange={setWantsIos}
          />
          <PlatformChip
            label="Android"
            checked={wantsAndroid}
            onChange={setWantsAndroid}
          />
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="waitlist-features"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        >
          {t("waitlist.featuresLabel")}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-text-muted/60">
            ({t("waitlist.optional")})
          </span>
        </label>
        <textarea
          id="waitlist-features"
          rows={3}
          maxLength={1000}
          value={featureRequests}
          onChange={(e) => setFeatureRequests(e.target.value)}
          placeholder={t("waitlist.featuresPlaceholder")}
          className="w-full resize-none rounded-xl border border-white/10 bg-surface-raised px-3.5 py-3 text-sm text-text-primary outline-none ring-electric-chilli/40 placeholder:text-text-muted/50 focus:ring-2"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-text-muted/70">
        {t("waitlist.privacyNote")}{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-text-muted"
        >
          {t("waitlist.privacyLink")}
        </Link>
      </p>

      {(status === "error" || status === "rate_limited") && (
        <p className="text-center text-sm text-electric-chilli" role="alert">
          {status === "rate_limited"
            ? t("waitlist.errorRateLimit")
            : t("waitlist.errorGeneric")}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting" || !email.trim()}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98]",
          (status === "submitting" || !email.trim()) &&
            "opacity-50 active:scale-100",
        )}
      >
        {status === "submitting"
          ? t("waitlist.submitting")
          : t("waitlist.submit")}
      </button>

      <p className="pt-2 text-center">
        <Link
          href="/"
          className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary"
        >
          ← {t("waitlist.backToSwipe")}
        </Link>
      </p>
    </form>
  );
}

function PlatformChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-11 flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition-colors",
        checked
          ? "border-electric-chilli/50 bg-electric-chilli/15 text-text-primary"
          : "border-white/10 bg-surface-raised text-text-muted hover:border-white/20",
      )}
    >
      {label}
    </button>
  );
}
