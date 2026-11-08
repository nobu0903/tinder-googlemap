"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SwipeCard } from "@/components/swipe/swipe-card";
import { NativeAdCard } from "@/components/swipe/native-ad-card";
import { SwipeActions } from "@/components/swipe/swipe-actions";
import { SwipeableCard } from "@/components/swipe/swipeable-card";
import { LocationPicker } from "@/components/location/location-picker";
import { useSwipeFeed } from "@/lib/hooks/use-swipe-feed";
import { useAuth } from "@/lib/hooks/use-auth";
import { useLocation } from "@/lib/hooks/use-location";
import { useFreeSwipeQuota } from "@/lib/hooks/use-free-swipe-quota";
import { EXPLORE_THEMES } from "@/lib/explore-mock";
import { useLang } from "@/lib/i18n/context";
import { translations } from "@/lib/i18n/translations";
import {
  feedItemKey,
  isFeedNativeAd,
  type SwipeAction,
} from "@/types/backend";

export function SwipeScreen() {
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag") ?? undefined;
  const themeId = searchParams.get("theme") ?? undefined;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const labelParam = searchParams.get("label");
  const isThemedSwipe = Boolean(tag);

  const { accessToken, isLoading: authLoading, session, signInWithGoogle } = useAuth();
  const { coords, status, setManualCoords } = useLocation();
  const { used, limit, isLimitReached, consume } = useFreeSwipeQuota();
  const { t, lang } = useLang();
  const [locationLabel, setLocationLabel] = useState<string | null>(
    labelParam ?? null,
  );
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const swipeTriggerRef = useRef<((action: SwipeAction) => void) | null>(null);
  const googleRedirectStarted = useRef(false);
  const [googleRedirectHeld, setGoogleRedirectHeld] = useState(false);

  const themeName = useMemo(() => {
    if (!themeId) return null;
    const theme = EXPLORE_THEMES.find((t) => t.id === themeId);
    if (!theme) return null;
    return translations[lang].explore.themes[themeId]?.name ?? theme.name;
  }, [themeId, lang]);

  // Apply Explore / URL coords whenever present (not only when GPS is denied).
  const urlCoordsApplied = useRef(false);
  useEffect(() => {
    if (urlCoordsApplied.current) return;
    if (!latParam || !lngParam) return;
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    if (isNaN(lat) || isNaN(lng)) return;
    urlCoordsApplied.current = true;
    setManualCoords({ lat, lng });
  }, [latParam, lngParam, setManualCoords]);

  useEffect(() => {
    if (session) sessionStorage.removeItem("vl-google-redirect-at");
  }, [session]);

  useEffect(() => {
    if (!isThemedSwipe || authLoading || session || googleRedirectStarted.current) return;
    const redirect = `/?${searchParams.toString()}`;
    let last = 0;
    try {
      last = Number(sessionStorage.getItem("vl-google-redirect-at") ?? 0);
    } catch {
      last = 0;
    }
    if (Number.isFinite(last) && Date.now() - last < 60_000) {
      setGoogleRedirectHeld(true);
      return;
    }
    googleRedirectStarted.current = true;
    try {
      sessionStorage.setItem("vl-google-redirect-at", String(Date.now()));
    } catch {
      // Private mode can block storage. Still start Google once this mount.
    }
    void signInWithGoogle(redirect).then(({ error }) => {
      if (error) setGoogleRedirectHeld(true);
    });
  }, [isThemedSwipe, authLoading, session, searchParams, signInWithGoogle]);

  const feedEnabled =
    Boolean(coords) &&
    (!isThemedSwipe || Boolean(session)) &&
    status === "ready" &&
    !isLimitReached &&
    !pickingLocation;

  const {
    currentItem,
    isInitialLoading,
    isRefetching,
    isWaiting,
    askToWait,
    error,
    isSparseTheme,
    recordSwipe,
    refreshSpotPhotos,
  } = useSwipeFeed({
    tag,
    accessToken,
    coords,
    enabled: feedEnabled,
  });

  const handleSwipe = (action: SwipeAction) => {
    if (!currentItem) return;
    if (!isFeedNativeAd(currentItem)) {
      if (isLimitReached) return;
      consume();
    }
    recordSwipe(action);
  };

  const handleLocationConfirm = (
    nextCoords: { lat: number; lng: number },
    label: string,
  ) => {
    setManualCoords(nextCoords);
    setLocationLabel(label);
    setPickingLocation(false);
  };

  const needsLocationPicker =
    (status === "denied" || status === "unsupported") && !pickingLocation;

  const showLocating = status === "locating" || status === "idle";
  const showAuthGate = isThemedSwipe && (authLoading || !session);
  const showLimitGate = isLimitReached && !showAuthGate;
  const showFullScreenLoading =
    !needsLocationPicker &&
    !pickingLocation &&
    !showAuthGate &&
    !showLimitGate &&
    (showLocating || (isInitialLoading && !currentItem));
  const showAskToWait =
    !showFullScreenLoading &&
    !needsLocationPicker &&
    !pickingLocation &&
    !showAuthGate &&
    !showLimitGate &&
    askToWait &&
    !currentItem;
  const showRefetchingEmpty =
    !showFullScreenLoading &&
    !needsLocationPicker &&
    !pickingLocation &&
    !showAuthGate &&
    !showLimitGate &&
    !error &&
    !showAskToWait &&
    (isRefetching || isWaiting) &&
    !currentItem;
  const showEmpty =
    !showFullScreenLoading &&
    !needsLocationPicker &&
    !pickingLocation &&
    !showAuthGate &&
    !showLimitGate &&
    !error &&
    !showAskToWait &&
    !showRefetchingEmpty &&
    !currentItem;
  const showError =
    !showFullScreenLoading &&
    !needsLocationPicker &&
    !pickingLocation &&
    !showAuthGate &&
    !showLimitGate &&
    error &&
    !currentItem;
  const showCard =
    !showLocating &&
    !needsLocationPicker &&
    !pickingLocation &&
    !showAuthGate &&
    !showLimitGate &&
    currentItem;

  const displayLocation =
    locationLabel ?? (status === "ready" ? t("swipe.nearYou") : null);
  const nearLimit = used >= limit - 5 && used < limit;

  return (
    <MobileShell>
      <main
        className={`flex min-h-0 flex-col px-4 pb-28 pt-6 ${
          needsLocationPicker || pickingLocation
            ? "h-dvh overflow-hidden"
            : "flex-1"
        }`}
      >
        <header className="relative mb-4 flex shrink-0 flex-col items-center">
          <h1 className="text-sm font-bold tracking-[0.18em] text-electric-chilli drop-shadow-[0_0_8px_rgba(224,62,0,0.25)]">
            🔥 {t("nav.swipe")}
          </h1>
          {themeName && (
            <p className="mt-1.5 text-[11px] font-medium text-text-muted">
              {t("swipe.theme")}:{" "}
              <span className="text-text-primary">{themeName}</span>
            </p>
          )}
          {displayLocation && !showLimitGate && (
            <button
              type="button"
              onClick={() => setPickingLocation(true)}
              className="mt-1 text-[10px] text-stealth transition-colors hover:text-text-muted"
            >
              📍 {displayLocation}
              <span className="ml-1 text-text-muted/70 underline underline-offset-2">
                {t("swipe.change")}
              </span>
            </button>
          )}
          {!showLimitGate && (
            <p
              className={`mt-1.5 text-[11px] font-semibold tabular-nums ${
                nearLimit ? "text-electric-chilli" : "text-text-muted/70"
              }`}
            >
              {used} / {limit}
            </p>
          )}
          <span
            aria-hidden
            className="mt-1.5 h-[2px] w-12 rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(224,62,0,0.5)]"
          />
        </header>

        {showAuthGate && (
          <div className="flex flex-1 items-center justify-center px-6">
            {googleRedirectHeld ? (
              <GoogleSignInButton
                next={`/?${searchParams.toString()}`}
                className="max-w-[280px]"
              />
            ) : (
              <p className="animate-pulse text-sm text-text-muted">
                {t("swipe.checkingSignIn")}
              </p>
            )}
          </div>
        )}

        {showLimitGate && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-bold tracking-[0.14em] text-electric-chilli">
              {t("swipe.freeLimit")}
            </p>
            <h2 className="mt-3 text-xl font-black text-text-primary">
              {t("swipe.usedAllSwipes", { limit })}
            </h2>
            <p className="mt-2.5 max-w-[260px] text-sm leading-relaxed text-text-muted">
              {t("swipe.upgradeDesc")}
            </p>
            <Link
              href="/lp"
              className="mt-8 flex h-12 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98] hover:shadow-[0_6px_28px_rgba(224,62,0,0.5)]"
            >
              {t("swipe.readAbout")}
            </Link>
          </div>
        )}

        {(needsLocationPicker || pickingLocation) &&
          !showAuthGate &&
          !showLimitGate && (
            <LocationPicker
              initialCoords={coords}
              onConfirm={handleLocationConfirm}
              onCancel={
                pickingLocation ? () => setPickingLocation(false) : undefined
              }
            />
          )}

        {showFullScreenLoading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="animate-pulse text-sm text-text-muted">
              {showLocating
                ? t("swipe.findingLocation")
                : t("swipe.loadingSpots")}
            </p>
          </div>
        )}

        {showError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-semibold text-text-primary">
              {t("swipe.couldNotLoad")}
            </p>
            <p className="text-xs leading-relaxed text-text-muted">{error}</p>
            <button
              type="button"
              onClick={() => setPickingLocation(true)}
              className="mt-2 flex h-11 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
            >
              {t("swipe.searchAnotherArea")}
            </button>
          </div>
        )}

        {showAskToWait && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-semibold text-text-primary">
              {t("swipe.tryAgainLater")}
            </p>
            <button
              type="button"
              onClick={() => setPickingLocation(true)}
              className="mt-2 flex h-11 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
            >
              {t("swipe.searchAnotherArea")}
            </button>
          </div>
        )}

        {showRefetchingEmpty && (
          <div className="flex flex-1 items-center justify-center">
            <p className="animate-pulse text-sm text-text-muted">
              {t("swipe.loadingMore")}
            </p>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-semibold text-text-primary">
              {t("swipe.noSpotsFound")}
            </p>
            <p className="max-w-[260px] text-xs leading-relaxed text-text-muted">
              {t("swipe.noSpotsDesc")}
            </p>
            <button
              type="button"
              onClick={() => setPickingLocation(true)}
              className="mt-2 flex h-11 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_16px_rgba(224,62,0,0.35)] transition-transform active:scale-[0.98]"
            >
              {t("swipe.searchAnotherArea")}
            </button>
          </div>
        )}

        {showCard && (
          <section className="flex min-h-0 flex-1 flex-col pb-2">
            {isRefetching && (
              <p className="mb-2 text-center text-[10px] font-medium tracking-wide text-text-muted/70">
                {t("swipe.loadingMore")}
              </p>
            )}
            {isThemedSwipe && isSparseTheme && !isRefetching && (
              <p className="mb-2 text-center text-[10px] font-medium text-text-muted/60">
                {t("swipe.sparseTheme")}
              </p>
            )}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <SwipeableCard
                itemKey={feedItemKey(currentItem)}
                disabled={moreInfoOpen}
                onSwipe={handleSwipe}
                swipeRef={swipeTriggerRef}
              >
                {isFeedNativeAd(currentItem) ? (
                  <NativeAdCard ad={currentItem} />
                ) : (
                  <SwipeCard
                    spot={currentItem}
                    onMoreInfoOpenChange={setMoreInfoOpen}
                    accessToken={accessToken}
                    showDistance={!locationLabel}
                    onPhotoError={() => refreshSpotPhotos(currentItem.spotId)}
                  />
                )}
              </SwipeableCard>
              <SwipeActions
                hidden={moreInfoOpen}
                onSwipe={(action) => {
                  if (swipeTriggerRef.current) {
                    swipeTriggerRef.current(action);
                  } else {
                    handleSwipe(action);
                  }
                }}
              />
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </MobileShell>
  );
}
