"use client";

import Link from "next/link";
import { ExternalLink, LogOut, Zap } from "lucide-react";
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

const APP_VERSION = "0.1.0";
/** Replace with the real feedback form URL when available. */
const FEEDBACK_URL = "https://forms.gle/placeholder";

export function SettingsScreen() {
  const { user, isLoading, signOut } = useAuth();
  const { used, remaining, isLimitReached } = useFreeSwipeQuota();
  const isLoggedIn = Boolean(user);

  return (
    <MobileShell>
      <header className="shrink-0 border-b border-white/8 px-5 pb-3 pt-5">
        <p className="text-[11px] font-bold tracking-[0.18em] text-electric-chilli">
          VIBELOOP
        </p>
        <h1 className="mt-0.5 text-xl font-black tracking-tight text-text-primary">
          Settings
        </h1>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-32">
        <SettingsSection label="Account">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="size-5 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
            </div>
          ) : isLoggedIn ? (
            <>
              <SettingsRowInfo
                label="Signed in as"
                value={user?.email ?? "—"}
              />
              <SettingsRowButton
                label="Sign out"
                icon={<LogOut className="size-4 text-red-400" />}
                labelClassName="text-red-400"
                onClick={signOut}
              />
            </>
          ) : (
            <div className="px-5 py-4">
              <p className="mb-3 text-sm text-text-muted">
                Sign in to save your liked spots and unlock more features.
              </p>
              <Link
                href="/login"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.3)] transition-transform active:scale-[0.98]"
              >
                Sign in / Create account
              </Link>
            </div>
          )}
        </SettingsSection>

        <SettingsSection label="Free swipes">
          <SwipeQuotaBlock
            used={used}
            remaining={remaining}
            isLimitReached={isLimitReached}
          />
          <SettingsRowLink
            label="Upgrade to Pro"
            icon={<Zap className="size-4 text-honey" />}
            href="/pro"
            labelClassName="font-semibold text-honey"
            bordered
          />
        </SettingsSection>

        <SettingsSection label="More">
          <SettingsRowExternalLink
            label="Send feedback"
            icon={<ExternalLink className="size-4 text-text-muted" />}
            href={FEEDBACK_URL}
          />
        </SettingsSection>

        <p className="mt-6 px-5 text-center text-[10px] text-neutral-700">
          VibeLoop v{APP_VERSION}
        </p>
      </main>

      <BottomNav />
    </MobileShell>
  );
}

/** Free-tier swipe cap is absolute for all users (login does not unlock more). */
function SwipeQuotaBlock({
  used,
  remaining,
  isLimitReached,
}: {
  used: number;
  remaining: number;
  isLimitReached: boolean;
}) {
  const progressPct = swipeQuotaProgressPercent(used);

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-end justify-between">
        <span className="text-sm text-text-muted">
          {remaining} / {FREE_SWIPE_LIMIT} remaining
        </span>
        <span className="text-xs font-semibold text-electric-chilli">
          {used} used
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
