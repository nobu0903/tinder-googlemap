"use client";

import Link from "next/link";
import { ExternalLink, Globe, LogOut, Zap } from "lucide-react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import {
  SettingsRowButton,
  SettingsRowExternalLink,
  SettingsRowInfo,
  SettingsRowLink,
  SettingsSection,
} from "@/components/settings/settings-rows";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  FREE_SWIPE_LIMIT,
  useFreeSwipeQuota,
} from "@/lib/hooks/use-free-swipe-quota";
import { swipeQuotaProgressPercent } from "@/lib/swipe-quota";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n/context";
import type { Lang } from "@/lib/i18n/translations";

const APP_VERSION = "0.1.0";
/** Set NEXT_PUBLIC_FEEDBACK_URL to show the feedback row. */
const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim() ?? "";

export function SettingsScreen() {
  const { user, isLoading, signOut } = useAuth();
  const { used, remaining, isLimitReached } = useFreeSwipeQuota();
  const { t, lang, setLang } = useLang();
  const isLoggedIn = Boolean(user);

  return (
    <MobileShell>
      <header className="shrink-0 border-b border-white/8 px-5 pb-3 pt-5">
        <p className="text-[11px] font-bold tracking-[0.18em] text-electric-chilli">
          VIBELOOP
        </p>
        <h1 className="mt-0.5 text-xl font-black tracking-tight text-text-primary">
          {t("settings.title")}
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-32">
        <SettingsSection label={t("settings.account")}>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="size-5 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
            </div>
          ) : isLoggedIn ? (
            <>
              <SettingsRowInfo
                label={t("settings.signedInAs")}
                value={user?.email ?? "—"}
              />
              <SettingsRowButton
                label={t("settings.signOut")}
                icon={<LogOut className="size-4 text-red-400" />}
                labelClassName="text-red-400"
                onClick={signOut}
              />
            </>
          ) : (
            <div className="px-5 py-4">
              <p className="mb-3 text-sm text-text-muted">
                {t("settings.signInPrompt")}
              </p>
              <Link
                href="/login"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.3)] transition-transform active:scale-[0.98]"
              >
                {t("settings.signInCreate")}
              </Link>
            </div>
          )}
        </SettingsSection>

        <SettingsSection label={t("settings.freeSwipes")}>
          <SwipeQuotaBlock
            used={used}
            remaining={remaining}
            isLimitReached={isLimitReached}
            t={t}
          />
          <SettingsRowLink
            label={t("settings.upgradePro")}
            icon={<Zap className="size-4 text-honey" />}
            href="/pro"
            labelClassName="font-semibold text-honey"
            bordered
          />
        </SettingsSection>

        <SettingsSection label={t("settings.language")}>
          <LanguageToggle lang={lang} setLang={setLang} />
        </SettingsSection>

        <SettingsSection label={t("settings.more")}>
          {FEEDBACK_URL ? (
            <SettingsRowExternalLink
              label={t("settings.sendFeedback")}
              icon={<ExternalLink className="size-4 text-text-muted" />}
              href={FEEDBACK_URL}
            />
          ) : null}
        </SettingsSection>

        <p className="mt-6 px-5 text-center text-[10px] text-neutral-700">
          VibeLoop v{APP_VERSION}
        </p>
      </main>

      <BottomNav />
    </MobileShell>
  );
}

function LanguageToggle({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Globe className="size-4 shrink-0 text-text-muted" />
      <div className="flex flex-1 rounded-xl bg-surface-raised p-1">
        {(["ja", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={cn(
              "flex-1 rounded-lg py-2 text-[13px] font-bold transition-all duration-200",
              lang === l
                ? "bg-electric-chilli text-text-primary shadow-[0_2px_8px_rgba(224,62,0,0.35)]"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            {l === "ja" ? "日本語" : "English"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwipeQuotaBlock({
  used,
  remaining,
  isLimitReached,
  t,
}: {
  used: number;
  remaining: number;
  isLimitReached: boolean;
  t: (key: string) => string;
}) {
  const progressPct = swipeQuotaProgressPercent(used);

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-end justify-between">
        <span className="text-sm text-text-muted">
          {remaining} / {FREE_SWIPE_LIMIT} {t("settings.remaining")}
        </span>
        <span className="text-xs font-semibold text-electric-chilli">
          {used} {t("settings.used")}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isLimitReached ? "bg-red-500" : "bg-electric-chilli",
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
