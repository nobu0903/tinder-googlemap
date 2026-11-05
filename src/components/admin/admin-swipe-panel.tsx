"use client";

import { useRef, useState } from "react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WaitlistHeaderButton } from "@/components/waitlist/waitlist-header-button";
import { SwipeCard } from "@/components/swipe/swipe-card";
import { SwipeActions } from "@/components/swipe/swipe-actions";
import { SwipeableCard } from "@/components/swipe/swipeable-card";
import type { FeedAlgorithmConfig } from "@/lib/feed/config";
import { useAdminSwipeFeed } from "@/lib/hooks/use-admin-swipe-feed";
import { useLang } from "@/lib/i18n/context";
import type { SwipeAction } from "@/types/backend";

interface AdminSwipePanelProps {
  lat: number;
  lng: number;
  coordinatesLabel: string;
  config: Partial<FeedAlgorithmConfig>;
  onClose: () => void;
}

function poolBadge(pool: string) {
  const colors: Record<string, string> = {
    classic: "bg-amber-900/60 text-amber-300",
    vibe: "bg-emerald-900/60 text-emerald-300",
    none: "bg-neutral-800 text-neutral-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[pool] ?? colors.none}`}
    >
      {pool}
    </span>
  );
}

export function AdminSwipePanel({
  lat,
  lng,
  coordinatesLabel,
  config,
  onClose,
}: AdminSwipePanelProps) {
  const { t } = useLang();
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const swipeTriggerRef = useRef<((action: SwipeAction) => void) | null>(null);

  const {
    currentSpot,
    currentDebug,
    queueLength,
    sessionApiCalls,
    areaProfile,
    effectiveBands,
    isLoading,
    isRefetching,
    error,
    recordSwipe,
    refreshSpotPhotos,
    refetch,
  } = useAdminSwipeFeed({ lat, lng, config, active: true });

  const apiSummary = `nearby ${sessionApiCalls.nearbySearch} · text ${sessionApiCalls.textSearch} · details ${sessionApiCalls.placeDetails}`;
  const bandSummary = effectiveBands
    ? `Classic ${effectiveBands.classicMin}–${effectiveBands.classicMax} · Vibe ${effectiveBands.vibeMin}–${effectiveBands.vibeMax}`
    : `Classic ${config.classicMinReviews ?? "?"}–${config.classicMaxReviews ?? "?"} · Vibe ${config.vibeMinReviews ?? "?"}–${config.vibeMaxReviews ?? "?"}`;

  const showLoading = isLoading && !currentSpot;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-midnight">
      <MobileShell>
        <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-6">
          <header className="relative mb-4 flex shrink-0 flex-col items-center">
            <WaitlistHeaderButton className="absolute right-0 top-0" />
            <h1 className="text-sm font-bold tracking-[0.18em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.25)]">
              🔥 {t("nav.swipe")}
            </h1>
            <button
              type="button"
              onClick={onClose}
              className="mt-1 text-[10px] text-stealth transition-colors hover:text-text-muted"
            >
              📍 {coordinatesLabel}
              <span className="ml-1 text-text-muted/70 underline underline-offset-2">
                閉じる
              </span>
            </button>
            <p className="mt-1.5 max-w-full truncate px-8 text-center font-mono text-[9px] text-neutral-600">
              {areaProfile ? `area=${areaProfile} · ` : "area=… · "}
              {bandSummary} · {config.classicSlotsPerCycle}:
              {config.vibeSlotsPerCycle} · API: {apiSummary}
            </p>
            <span
              aria-hidden
              className="mt-1.5 h-[2px] w-12 rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(224,62,0,0.5)]"
            />
          </header>

          {showLoading && (
            <div className="flex flex-1 items-center justify-center">
              <p className="animate-pulse text-sm text-text-muted">
                {t("swipe.loadingSpots")}
              </p>
            </div>
          )}

          {!showLoading && error && !currentSpot && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm font-semibold text-text-primary">
                {t("swipe.couldNotLoad")}
              </p>
              <p className="text-xs leading-relaxed text-text-muted">{error}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 flex h-11 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
              >
                再試行
              </button>
            </div>
          )}

          {!showLoading && !error && !currentSpot && isRefetching && (
            <div className="flex flex-1 items-center justify-center">
              <p className="animate-pulse text-sm text-text-muted">
                {t("swipe.loadingMore")}
              </p>
            </div>
          )}

          {!showLoading && !error && !currentSpot && !isRefetching && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm font-semibold text-text-primary">
                {t("swipe.noSpotsFound")}
              </p>
              <p className="max-w-[260px] text-xs leading-relaxed text-text-muted">
                この設定では店舗が見つかりませんでした
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 flex h-11 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
              >
                再読み込み
              </button>
            </div>
          )}

          {currentSpot && (
            <section className="flex min-h-0 flex-1 flex-col pb-2">
              {isRefetching && (
                <p className="mb-2 text-center text-[10px] font-medium tracking-wide text-text-muted/70">
                  {t("swipe.loadingMore")}
                </p>
              )}

              {currentDebug && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-surface-raised/80 px-3 py-2 text-[10px]">
                  {poolBadge(currentDebug.pool)}
                  <span className="font-mono text-text-muted">
                    slot: {currentDebug.slotSource}
                  </span>
                  <span className="font-mono text-text-muted">
                    reviews: {currentDebug.reviewCount ?? "—"}
                  </span>
                  <span className="ml-auto font-mono text-neutral-500">
                    残り {queueLength}
                  </span>
                </div>
              )}

              <div className="relative flex min-h-0 flex-1 flex-col">
                <SwipeableCard
                  itemKey={currentSpot.spotId}
                  disabled={moreInfoOpen}
                  onSwipe={recordSwipe}
                  swipeRef={swipeTriggerRef}
                >
                  <SwipeCard
                    spot={currentSpot}
                    onMoreInfoOpenChange={setMoreInfoOpen}
                    onPhotoError={() => refreshSpotPhotos(currentSpot.spotId)}
                  />
                </SwipeableCard>
                <SwipeActions
                  hidden={moreInfoOpen}
                  onSwipe={(action) => {
                    if (swipeTriggerRef.current) {
                      swipeTriggerRef.current(action);
                    } else {
                      recordSwipe(action);
                    }
                  }}
                />
              </div>
            </section>
          )}
        </main>

        <BottomNav />
      </MobileShell>
    </div>
  );
}
