"use client";

import { useRef, useState } from "react";
import { MobileShell } from "@/components/layout/mobile-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WaitlistHeaderButton } from "@/components/waitlist/waitlist-header-button";
import { SwipeCard } from "@/components/swipe/swipe-card";
import { SwipeActions } from "@/components/swipe/swipe-actions";
import { SwipeableCard } from "@/components/swipe/swipeable-card";
import { adminFetch } from "@/lib/admin/client";
import { useLang } from "@/lib/i18n/context";
import type { FeedSpot, SwipeAction } from "@/types/backend";

/**
 * Admin: paste a Maps place URL → open the real swipe chrome (full screen)
 * so screenshots match production SWIPE / App / BottomNav / LIKE·NOPE.
 */
export function AdminSnsCardPanel() {
  const { t } = useLang();
  const [url, setUrl] = useState("");
  const [spot, setSpot] = useState<FeedSpot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  /** Bump to remount SwipeableCard after a demo swipe */
  const [cardKey, setCardKey] = useState(0);
  const swipeTriggerRef = useRef<((action: SwipeAction) => void) | null>(null);
  const lastUrlRef = useRef("");

  const resolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = url.trim();
      lastUrlRef.current = trimmed;
      const data = (await adminFetch("/api/admin/sns-card", {
        method: "POST",
        body: JSON.stringify({ url: trimmed }),
      })) as { spot: FeedSpot };
      setSpot(data.spot);
      setCardKey((k) => k + 1);
      setMoreInfoOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve card");
      setSpot(null);
    } finally {
      setLoading(false);
    }
  };

  const closePreview = () => {
    setSpot(null);
    setMoreInfoOpen(false);
  };

  const handleSwipe = (_action: SwipeAction) => {
    // Visual only — remount so the same spot stays for another screenshot.
    setCardKey((k) => k + 1);
  };

  const refreshPhotos = () => {
    if (!lastUrlRef.current) return;
    void (async () => {
      try {
        const data = (await adminFetch("/api/admin/sns-card", {
          method: "POST",
          body: JSON.stringify({ url: lastUrlRef.current }),
        })) as { spot: FeedSpot };
        setSpot(data.spot);
        setCardKey((k) => k + 1);
      } catch {
        // Non-fatal for screenshot preview
      }
    })();
  };

  return (
    <>
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          SNS card (screenshot)
        </h2>
        <p className="mb-3 text-[11px] leading-relaxed text-neutral-500">
          ブラウザの{" "}
          <code className="text-neutral-400">google.com/maps/place/...</code>{" "}
          と、アプリの共有リンク（
          <code className="text-neutral-400">maps.app.goo.gl</code>
          、<code className="text-neutral-400">google.co.jp</code>
          、店の ID 付きの検索リンク）を貼れます。店のページに着いたときだけ開きます。
        </p>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading && url.trim()) void resolve();
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-500">
            Google Maps place URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/... または https://www.google.com/maps/place/..."
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-200"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="shrink-0 rounded bg-electric-chilli px-4 py-2 text-xs font-semibold text-white hover:bg-chilli-deep disabled:opacity-50"
          >
            {loading ? "読み込み中…" : "スワイプ画面で開く"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
      </section>

      {spot && (
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
                  onClick={closePreview}
                  className="mt-1 text-[10px] text-stealth transition-colors hover:text-text-muted"
                >
                  📍 {spot.name}
                  <span className="ml-1 text-text-muted/70 underline underline-offset-2">
                    閉じる
                  </span>
                </button>
                <span
                  aria-hidden
                  className="mt-1.5 h-[2px] w-12 rounded-full bg-electric-chilli shadow-[0_0_8px_rgba(224,62,0,0.5)]"
                />
              </header>

              <section className="flex min-h-0 flex-1 flex-col pb-2">
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <SwipeableCard
                    itemKey={`${spot.spotId}-${cardKey}`}
                    disabled={moreInfoOpen}
                    onSwipe={handleSwipe}
                    swipeRef={swipeTriggerRef}
                  >
                    <SwipeCard
                      spot={spot}
                      onMoreInfoOpenChange={setMoreInfoOpen}
                      showDistance={false}
                      onPhotoError={refreshPhotos}
                    />
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
            </main>

            <BottomNav />
          </MobileShell>
        </div>
      )}
    </>
  );
}
