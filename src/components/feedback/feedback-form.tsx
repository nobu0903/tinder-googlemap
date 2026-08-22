"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  type FeedbackArea,
  type FeedbackKind,
} from "@/lib/feedback/schema";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited";

export function FeedbackForm() {
  const { t } = useLang();
  const { user, accessToken } = useAuth();
  const [area, setArea] = useState<FeedbackArea | null>(null);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [extra, setExtra] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const canSubmit = Boolean(area && kind && message.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "submitting" || !area || !kind) return;
    setStatus("submitting");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({
          area,
          kind,
          message,
          extra,
          email,
          source: "settings",
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
          🙏
        </p>
        <h2 className="mt-3 text-lg font-black text-text-primary">
          {t("feedback.successTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          {t("feedback.successDesc")}
        </p>
        <Link
          href="/settings"
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98]"
        >
          {t("feedback.backToSettings")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-sm space-y-6"
      noValidate
    >
      <fieldset>
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          1. {t("feedback.areaLabel")}
          <span className="ml-1 text-electric-chilli">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_AREAS.map((id) => (
            <ChoiceChip
              key={id}
              label={t(`feedback.areas.${id}`)}
              selected={area === id}
              onClick={() => setArea(id)}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          2. {t("feedback.kindLabel")}
          <span className="ml-1 text-electric-chilli">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map((id) => (
            <ChoiceChip
              key={id}
              label={t(`feedback.kinds.${id}`)}
              selected={kind === id}
              onClick={() => setKind(id)}
            />
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="feedback-message"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        >
          3. {t("feedback.messageLabel")}
          <span className="ml-1 text-electric-chilli">*</span>
        </label>
        <textarea
          id="feedback-message"
          rows={3}
          maxLength={2000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("feedback.messagePlaceholder")}
          className="w-full resize-none rounded-xl border border-white/10 bg-surface-raised px-3.5 py-3 text-sm text-text-primary outline-none ring-electric-chilli/40 placeholder:text-text-muted/50 focus:ring-2"
        />
      </div>

      <div>
        <label
          htmlFor="feedback-extra"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        >
          {t("feedback.extraLabel")}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-text-muted/60">
            ({t("feedback.optional")})
          </span>
        </label>
        <textarea
          id="feedback-extra"
          rows={2}
          maxLength={1000}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder={t("feedback.extraPlaceholder")}
          className="w-full resize-none rounded-xl border border-white/10 bg-surface-raised px-3.5 py-3 text-sm text-text-primary outline-none ring-electric-chilli/40 placeholder:text-text-muted/50 focus:ring-2"
        />
      </div>

      <div>
        <label
          htmlFor="feedback-email"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-muted"
        >
          {t("feedback.emailLabel")}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-text-muted/60">
            ({t("feedback.optional")})
          </span>
        </label>
        <input
          id="feedback-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-white/10 bg-surface-raised px-3.5 text-sm text-text-primary outline-none ring-electric-chilli/40 placeholder:text-text-muted/50 focus:ring-2"
        />
        <p className="mt-1.5 text-[11px] text-text-muted/60">
          {t("feedback.emailHint")}
        </p>
      </div>

      {(status === "error" || status === "rate_limited") && (
        <p className="text-center text-sm text-electric-chilli" role="alert">
          {status === "rate_limited"
            ? t("feedback.errorRateLimit")
            : t("feedback.errorGeneric")}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || status === "submitting"}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98]",
          (!canSubmit || status === "submitting") &&
            "opacity-50 active:scale-100",
        )}
      >
        {status === "submitting"
          ? t("feedback.submitting")
          : t("feedback.submit")}
      </button>

      <p className="text-center">
        <Link
          href="/settings"
          className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary"
        >
          ← {t("feedback.backToSettings")}
        </Link>
      </p>
    </form>
  );
}

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-[12px] font-semibold transition-colors",
        selected
          ? "border-electric-chilli/50 bg-electric-chilli/15 text-text-primary"
          : "border-white/10 bg-surface-raised text-text-muted hover:border-white/20",
      )}
    >
      {label}
    </button>
  );
}
