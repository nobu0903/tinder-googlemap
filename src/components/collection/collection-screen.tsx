"use client";

import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CollectionHeader } from "@/components/collection/collection-header";
import { CollectionGate } from "@/components/collection/collection-gate";
import { CollectionItemCard } from "@/components/collection/collection-item-card";
import { CollectionSummary } from "@/components/collection/collection-summary";
import { SwipeToRemove } from "@/components/collection/swipe-to-remove";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCollection } from "@/lib/hooks/use-collection";
import { useLang } from "@/lib/i18n/context";

function CollectionSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="size-8 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
    </div>
  );
}

function CollectionEmptyState() {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <span className="mb-4 text-5xl">🍜</span>
      <p className="text-sm font-semibold text-text-primary">
        {t("collection.noLikedYet")}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
        {t("collection.noLikedDesc")}
      </p>
    </div>
  );
}

export function CollectionScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const { t } = useLang();
  const {
    spots,
    isLoading: collectionLoading,
    error: collectionError,
    pendingRemoval,
    removeSpot,
    undoRemove,
    refresh,
  } = useCollection({
    accessToken: session?.access_token ?? null,
    enabled: !authLoading && Boolean(session),
  });

  if (authLoading) {
    return (
      <MobileShell>
        <CollectionHeader />
        <CollectionSpinner />
        <BottomNav />
      </MobileShell>
    );
  }

  if (!session) {
    return (
      <MobileShell>
        <CollectionHeader />
        <CollectionGate />
        <BottomNav />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <CollectionHeader />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          <CollectionSummary
            totalCount={spots.length}
            isLoading={collectionLoading}
            previewSpots={spots}
          />

          {collectionLoading && <CollectionSpinner />}

          {!collectionLoading && collectionError && (
            <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
              <p className="text-sm font-semibold text-text-primary">
                {t("collection.couldntLoad")}
              </p>
              <p className="text-xs text-text-muted">{collectionError}</p>
              <button
                type="button"
                onClick={() => refresh()}
                className="mt-1 rounded-xl bg-electric-chilli px-4 py-2 text-sm font-bold text-text-primary"
              >
                {t("collection.tryAgain")}
              </button>
            </div>
          )}

          {!collectionLoading &&
            !collectionError &&
            spots.length === 0 &&
            !pendingRemoval && <CollectionEmptyState />}

          {!collectionLoading && !collectionError && spots.length > 0 && (
            <ul className="flex flex-col gap-3 px-4 pb-4">
              {spots.map((spot, index) => (
                <li key={spot.spotId}>
                  <SwipeToRemove onRemove={() => void removeSpot(spot.spotId)}>
                    <CollectionItemCard spot={spot} priority={index < 2} />
                  </SwipeToRemove>
                </li>
              ))}
            </ul>
          )}

          {!collectionLoading && !collectionError && spots.length > 0 && (
            <p className="px-4 pb-2 text-center text-[10px] text-neutral-600">
              {t("collection.removeHint")}
            </p>
          )}
        </div>
      </main>

      {pendingRemoval && (
        <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-full max-w-[400px] -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#2d2e30] px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
            <p className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
              {t("collection.removed").replace("{name}", pendingRemoval.spot.name)}
            </p>
            <button
              type="button"
              onClick={() => void undoRemove()}
              className="shrink-0 text-[13px] font-bold uppercase tracking-wide text-[#8ab4f8] transition-opacity hover:opacity-80"
            >
              {t("collection.undo")}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </MobileShell>
  );
}
