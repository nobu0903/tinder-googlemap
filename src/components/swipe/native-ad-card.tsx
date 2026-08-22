"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  clickNativeAdRoot,
  registerNativeAdOpener,
} from "@/lib/ads/native-ad-opener";
import type { FeedNativeAd } from "@/types/backend";

interface NativeAdCardProps {
  ad: FeedNativeAd;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * Display ad unit (AdSense snippet: format=auto, full-width-responsive).
 * Registers an opener so a right-swipe (like) can forward a click into the ad.
 */
export function NativeAdCard({ ad, className }: NativeAdCardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const pushedRef = useRef(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID;
  const slotId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_ID;
  const canRenderAd = Boolean(clientId && slotId);

  useEffect(() => {
    if (!canRenderAd || pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      pushedRef.current = false;
    }
  }, [canRenderAd]);

  useEffect(() => {
    registerNativeAdOpener(() => clickNativeAdRoot(rootRef.current));
    return () => registerNativeAdOpener(null);
  }, [ad.id]);

  return (
    <article
      ref={rootRef}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-elevated shadow-card",
        className,
      )}
      aria-label="Sponsored content"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          {ad.name}
        </span>

        {canRenderAd ? (
          <ins
            className="adsbygoogle w-full"
            style={{ display: "block", minHeight: 280 }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-12">
            <p className="text-sm font-medium text-text-primary">広告枠</p>
            <p className="text-xs leading-relaxed text-text-muted">
              AdSense の Client ID と Slot ID を設定するとここにネイティブ広告が表示されます。
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
