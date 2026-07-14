"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SwipeCard } from "@/components/swipe/swipe-card";
import { NativeAdCard } from "@/components/swipe/native-ad-card";
import { SwipeActions } from "@/components/swipe/swipe-actions";
import { LocationPicker } from "@/components/location/location-picker";
import { useSwipeFeed } from "@/lib/hooks/use-swipe-feed";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLocation } from "@/lib/hooks/use-location";
import { EXPLORE_THEMES } from "@/lib/explore-mock";
import { isFeedNativeAd } from "@/types/backend";

export function SwipeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag") ?? undefined;
  const themeId = searchParams.get("theme") ?? undefined;
  const isThemedSwipe = Boolean(tag);

  const { accessToken, isLoading: authLoading, session } = useAuth();
  const { coords, status, setManualCoords } = useLocation();
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  const themeName = useMemo(() => {
    if (!themeId) return null;
    return EXPLORE_THEMES.find((t) => t.id === themeId)?.name ?? null;
  }, [themeId]);

  useEffect(() => {
    if (!isThemedSwipe || authLoading) return;
    if (!session) {
      const redirect = `/?${searchParams.toString()}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [isThemedSwipe, authLoading, session, router, searchParams]);

  const feedEnabled =
    Boolean(coords) &&
    (!isThemedSwipe || Boolean(session)) &&
    status === "ready";

  const {
    currentItem,
    isInitialLoading,
    isRefetching,
    error,
    recordSwipe,
  } = useSwipeFeed({
    tag,
    accessToken,
    coords,
    enabled: feedEnabled,
  });

  const needsLocationPicker =
    status === "denied" || status === "unsupported";

  const showLocating = status === "locating" || status === "idle";
  const showAuthGate = isThemedSwipe && (authLoading || !session);
  const showFullScreenLoading =
    !needsLocationPicker &&
    !showAuthGate &&
    (showLocating || (isInitialLoading && !currentItem));
  const showCard = !showLocating && !needsLocationPicker && !showAuthGate && currentItem;

  return (
    <MobileShell>
      <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-6">
        <header className="mb-4 shrink-0 flex flex-col items-center">
          <h1 className="text-sm font-bold tracking-[0.18em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.25)]">
            🔥 SWIPE
          </h1>
          {themeName && (
            <p className="mt-1.5 text-[11px] font-medium text-text-muted">
              Theme: <span className="text-text-primary">{themeName}</span>
            </p>
          )}
          {locationLabel && (
            <p className="mt-1 text-[10px] text-stealth">📍 {locationLabel}</p>
          )}
          <span
            aria-hidden
            className="mt-1.5 h-[2px] w-12 rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(224,62,0,0.5)]"
          />
        </header>

        {showAuthGate && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted animate-pulse">Checking sign-in…</p>
          </div>
        )}

        {needsLocationPicker && !showAuthGate && (
          <LocationPicker
            onConfirm={(nextCoords, label) => {
              setManualCoords(nextCoords);
              setLocationLabel(label);
            }}
          />
        )}

        {showFullScreenLoading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted animate-pulse">
              {showLocating ? "Finding your location…" : "Loading spots…"}
            </p>
          </div>
        )}

        {!showFullScreenLoading && !needsLocationPicker && !showAuthGate && error && !currentItem && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-semibold text-text-primary">Could not load spots</p>
            <p className="text-xs leading-relaxed text-text-muted">{error}</p>
          </div>
        )}

        {!showFullScreenLoading && !needsLocationPicker && !showAuthGate && !error && !currentItem && (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-sm text-text-muted">No spots found nearby. Try again later.</p>
          </div>
        )}

        {showCard && (
          <section className="flex min-h-0 flex-1 flex-col pb-2">
            {isRefetching && (
              <p className="mb-2 text-center text-[10px] font-medium tracking-wide text-text-muted/70">
                Loading more spots…
              </p>
            )}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {isFeedNativeAd(currentItem) ? (
                <NativeAdCard ad={currentItem} />
              ) : (
                <SwipeCard
                  spot={currentItem}
                  onMoreInfoOpenChange={setMoreInfoOpen}
                />
              )}
              <SwipeActions hidden={moreInfoOpen} onSwipe={recordSwipe} />
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </MobileShell>
  );
}
