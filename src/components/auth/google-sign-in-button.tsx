"use client";

import { useState } from "react";
import { Roboto } from "next/font/google";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLang } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const googleButtonFont = Roboto({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
});

/** Standard-color Google G. Colors and proportions stay as published. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Starts Supabase Google OAuth. `next` is where the app returns after sign-in.
 */
export function GoogleSignInButton({
  next,
  label,
  className,
}: {
  next?: string;
  label?: string;
  className?: string;
}) {
  const { signInWithGoogle } = useAuth();
  const { t } = useLang();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    setFailed(false);
    setSubmitting(true);
    const { error } = await signInWithGoogle(next);
    if (error) {
      setSubmitting(false);
      setFailed(true);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={submitting}
        className={`${googleButtonFont.className} group relative flex h-12 w-full items-center overflow-hidden rounded-xl border border-[#8E918F] bg-[#131314] px-3 text-sm leading-5 tracking-[0.25px] text-[#E3E3E3] transition-[background-color,border-color,box-shadow] duration-200 hover:shadow-[0_1px_2px_0_rgba(0,0,0,0.30),0_1px_3px_1px_rgba(0,0,0,0.15)] disabled:cursor-default disabled:border-[#8E918F]/40 disabled:shadow-none`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08] group-active:opacity-[0.12] group-disabled:opacity-0"
        />
        <span className="relative flex w-full items-center">
          <span className="mr-[10px] flex size-5 shrink-0 items-center justify-center group-disabled:opacity-[0.38]">
            <GoogleMark />
          </span>
          <span className="min-w-0 flex-1 truncate text-center group-disabled:opacity-[0.38]">
            {submitting ? t("auth.pleaseWait") : (label ?? t("auth.googleSignIn"))}
          </span>
          <span className="ml-[10px] size-5 shrink-0" aria-hidden />
        </span>
      </button>
      {failed ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-red-400" role="alert">
          {t("auth.errors.googleFailed")}
        </p>
      ) : null}
    </div>
  );
}
