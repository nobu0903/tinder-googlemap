"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { buildLoginPath } from "@/lib/auth/safe-redirect";
import { useLang } from "@/lib/i18n/context";

interface ThemeLoginPromptProps {
  themeName: string;
  destination: string;
  onClose: () => void;
}

/** Bottom sheet prompting sign-in before a themed Explore swipe. */
export function ThemeLoginPrompt({
  themeName,
  destination,
  onClose,
}: ThemeLoginPromptProps) {
  const loginHref = buildLoginPath(destination);
  const { t } = useLang();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label={t("themePrompt.dismiss")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal
        aria-labelledby="theme-login-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[400px] rounded-t-[28px] border-t border-white/8 bg-surface px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_40px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <button
          type="button"
          aria-label={t("themePrompt.close")}
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-stealth transition-colors hover:bg-white/5 hover:text-text-muted"
        >
          <X className="size-4" />
        </button>

        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-surface-raised ring-1 ring-white/8">
          <Lock className="size-6 text-electric-chilli" strokeWidth={1.5} />
        </div>

        <h2
          id="theme-login-title"
          className="text-center text-xl font-black tracking-tight text-text-primary"
        >
          {t("themePrompt.signInToExplore")}
        </h2>
        <p className="mx-auto mt-2 max-w-[280px] text-center text-sm leading-relaxed text-text-muted">
          <span className="font-semibold text-text-primary">{themeName}</span>{" "}
          {t("themePrompt.themeNeedsAccount").replace("{theme}", "")}
        </p>

        <Link
          href={loginHref}
          className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
        >
          {t("themePrompt.signInCreate")}
        </Link>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2 text-center text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          {t("themePrompt.notNow")}
        </button>
      </div>
    </>
  );
}
