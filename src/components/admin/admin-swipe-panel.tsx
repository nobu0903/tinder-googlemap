"use client";

import { useState } from "react";
import { SwipeCard } from "@/components/swipe/swipe-card";
import { SwipeActions } from "@/components/swipe/swipe-actions";
import type { FeedAlgorithmConfig } from "@/lib/feed/config";
import { useAdminSwipeFeed } from "@/lib/hooks/use-admin-swipe-feed";

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
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  const {
    currentSpot,
    currentDebug,
    queueLength,
    sessionApiCalls,
    isLoading,
    isRefetching,
    error,
    recordSwipe,
    refetch,
  } = useAdminSwipeFeed({ lat, lng, config, active: true });

  const apiSummary = `nearby ${sessionApiCalls.nearbySearch} · text ${sessionApiCalls.textSearch} · details ${sessionApiCalls.placeDetails}`;

  const showLoading = isLoading && !currentSpot;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-midnight">
      <header className="shrink-0 border-b border-white/8 px-4 py-3">
        <div className="mx-auto flex max-w-[400px] items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-widest text-electric-chilli">
              ADMIN SWIPE PREVIEW
            </p>
            <p className="truncate font-mono text-[10px] text-text-muted">
              {coordinatesLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-white/15 px-2.5 py-1 text-xs text-text-muted hover:bg-white/5"
          >
            閉じる
          </button>
        </div>
        <p className="mx-auto mt-1 max-w-[400px] font-mono text-[9px] text-neutral-600">
          Classic≥{config.classicMinReviews} · Vibe {config.vibeMinReviews}–
          {config.vibeMaxReviews} · {config.classicSlotsPerCycle}:
          {config.vibeSlotsPerCycle} · API: {apiSummary}
        </p>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[400px] flex-1 flex-col px-4 pb-28 pt-4">
        {showLoading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted animate-pulse">Loading spots…</p>
          </div>
        )}

        {!showLoading && error && !currentSpot && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-semibold text-text-primary">{error}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
            >
              再試行
            </button>
          </div>
        )}

        {!showLoading && !error && !currentSpot && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-text-muted">この設定では店舗が見つかりませんでした</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
            >
              再読み込み
            </button>
          </div>
        )}

        {currentSpot && (
          <section className="flex min-h-0 flex-1 flex-col pb-2">
            {isRefetching && (
              <p className="mb-2 text-center text-[10px] text-text-muted/70">
                次の店を読み込み中…
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
              <SwipeCard
                spot={currentSpot}
                onMoreInfoOpenChange={setMoreInfoOpen}
              />
              <SwipeActions
                hidden={moreInfoOpen}
                onSwipe={recordSwipe}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
