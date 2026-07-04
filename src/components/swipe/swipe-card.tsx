"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ChevronUp, MapPin } from "lucide-react";
import { MOCK_SPOT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MoreInfoPanel } from "./more-info-panel";

interface SwipeCardProps {
  className?: string;
}

export function SwipeCard({ className }: SwipeCardProps) {
  const images = MOCK_SPOT.images;
  // Each "page" shows 2 photos. pairIndex = which pair is visible.
  const pairCount = Math.ceil(images.length / 2);
  const [pairIndex, setPairIndex] = useState(0);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  const topPhoto = images[pairIndex * 2];
  const bottomPhoto = images[pairIndex * 2 + 1] ?? images[0];

  const handleMoreInfo = () => {
    setMoreInfoOpen(true);
  };

  // Tap anywhere on the photo stack to advance pairs
  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { clientX, currentTarget } = e;
      const { left, width } = currentTarget.getBoundingClientRect();
      const relativeX = clientX - left;

      if (relativeX < width / 2) {
        setPairIndex((i) => (i > 0 ? i - 1 : i));
      } else {
        setPairIndex((i) => (i < pairCount - 1 ? i + 1 : i));
      }
    },
    [pairCount],
  );

  return (
    <article
      className={cn(
        // overflow-hidden clips the slide-up panel to the card bounds
        "relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]",
        // Raise above action buttons while the panel is open
        moreInfoOpen && "z-50",
        className,
      )}
    >
      {/* ── Photo stack (84% of card) ── */}
      <div
        className="relative flex min-h-0 flex-1 cursor-pointer select-none flex-col"
        onClick={handleTap}
      >
        {/* Progress dashes — top */}
        <div
          aria-label={`Page ${pairIndex + 1} of ${pairCount}`}
          className="absolute inset-x-3 top-3 z-10 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {Array.from({ length: pairCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-all duration-300",
                i === pairIndex
                  ? "bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
                  : "bg-white/35",
              )}
            />
          ))}
        </div>

        {/* Distance badge — top right */}
        <div className="absolute right-4 top-9 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-text-primary backdrop-blur-sm ring-1 ring-white/10">
            <MapPin className="size-3.5 text-text-muted" />
            {MOCK_SPOT.distanceKm} km away
          </span>
        </div>

        {/* Photo 1 — top 50% of photo area */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Image
            key={topPhoto.src}
            src={topPhoto.src}
            alt={topPhoto.alt}
            fill
            priority
            sizes="(max-width: 400px) 100vw, 400px"
            className="object-cover object-center"
          />
        </div>

        {/* Hairline divider between photos */}
        <div aria-hidden className="h-px shrink-0 bg-black" />

        {/* Photo 2 — bottom 50% of photo area */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Image
            key={bottomPhoto.src}
            src={bottomPhoto.src}
            alt={bottomPhoto.alt}
            fill
            sizes="(max-width: 400px) 100vw, 400px"
            className="object-cover object-center"
          />
          {/* Gradient fading photo into text strip
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent"
          /> */}
        </div>
      </div>

      {/* ── Jet-black text strip (≈16% of card) ── */}
      <div className="shrink-0 bg-surface px-5 pb-10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.5rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-text-primary">
              {MOCK_SPOT.name}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] font-medium">
              <span className="text-honey">
                ⭐ {MOCK_SPOT.rating}
              </span>
              <span className="text-text-muted">({MOCK_SPOT.reviewCount})</span>
              <span className="text-text-muted/40">|</span>
              <span className="text-basil">🟢 Open Now</span>
              <span className="text-text-muted/40">|</span>
              <span className="text-chilli-bright">¥{MOCK_SPOT.priceRange}</span>
            </p>
          </div>

          <button
            type="button"
            aria-label="More Info"
            onClick={handleMoreInfo}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-text-primary ring-1 ring-white/15 transition-all hover:bg-white/20",
              // Rotate arrow when panel is open
              moreInfoOpen && "rotate-180",
            )}
          >
            <ChevronUp className="size-5 stroke-[3] transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* ── More Info slide-up panel ── */}
      <MoreInfoPanel
        isOpen={moreInfoOpen}
        onClose={() => setMoreInfoOpen(false)}
      />
    </article>
  );
}
