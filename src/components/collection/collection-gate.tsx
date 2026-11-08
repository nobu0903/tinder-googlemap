"use client";

import { Heart, Lock } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useLang } from "@/lib/i18n/context";

export function CollectionGate() {
  const { t } = useLang();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-28 text-center">
      <div className="relative mb-7">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-surface-raised ring-1 ring-white/8">
          <Heart
            className="size-9 text-electric-chilli/40"
            strokeWidth={1.5}
          />
        </div>
        <div className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-surface-raised ring-1 ring-white/10">
          <Lock className="size-3.5 text-stealth" />
        </div>
      </div>

      <h2 className="text-xl font-black tracking-tight text-text-primary">
        {t("collectionGate.title")}
      </h2>
      <p className="mt-2.5 max-w-[260px] text-sm leading-relaxed text-text-muted">
        {t("collectionGate.desc")}
      </p>

      <GoogleSignInButton
        next="/collection"
        label={t("collectionGate.signInOrCreate")}
        className="mt-8 max-w-[280px]"
      />

      <p className="mt-4 text-xs text-stealth">{t("collectionGate.freeAndFast")}</p>
    </div>
  );
}
