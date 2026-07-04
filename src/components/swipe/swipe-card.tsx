"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { ChevronUp, MapPin } from "lucide-react";
import { MOCK_SPOT } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SwipeCardProps {
  className?: string;
}

export function SwipeCard({ className }: SwipeCardProps) {
  const images = MOCK_SPOT.images;
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleMoreInfo = () => {
    console.log("More Info clicked — Menya Soul Heaven");
  };

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { clientX, currentTarget } = e;
      const { left, width } = currentTarget.getBoundingClientRect();
      const relativeX = clientX - left;

      if (relativeX < width / 2) {
        // Left tap — prev
        setCurrentIndex((i) => (i > 0 ? i - 1 : i));
      } else {
        // Right tap — next
        setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : i));
      }
    },
    [images.length],
  );

  const current = images[currentIndex];

  return (
    <article
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      {/* Tappable full-bleed photo area */}
      <div
        className="relative min-h-0 flex-1 cursor-pointer select-none overflow-hidden"
        onClick={handleTap}
      >
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          priority={currentIndex === 0}
          sizes="(max-width: 400px) 100vw, 400px"
          className="object-cover object-center transition-opacity duration-200"
        />

        {/* Bottom gradient */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-t from-black/75 via-black/30 to-transparent"
        />

        {/* Progress dashes — Tinder style */}
        <div
          aria-label={`Photo ${currentIndex + 1} of ${images.length}`}
          className="absolute inset-x-3 top-3 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-all duration-300",
                i === currentIndex
                  ? "bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
                  : "bg-white/35",
              )}
            />
          ))}
        </div>

        {/* Distance badge — top right (below dashes) */}
        <div className="absolute right-4 top-9">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/10">
            <MapPin className="size-3.5 text-white/80" />
            {MOCK_SPOT.distanceKm} km away
          </span>
        </div>

        {/* Info stack — Tinder-style, pinned low on photo */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-[3.25rem]">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.625rem] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
                {MOCK_SPOT.name}
              </h2>

              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] font-medium">
                <span className="text-chilli-bright">⭐ {MOCK_SPOT.rating}</span>
                <span className="text-white/70">({MOCK_SPOT.reviewCount})</span>
                <span className="text-white/30">•</span>
                <span className="text-[#6ee76e]">🟢 Open Now</span>
                <span className="text-white/30">•</span>
                <span className="text-chilli-bright">¥{MOCK_SPOT.priceRange}</span>
              </p>
            </div>

            <button
              type="button"
              aria-label="More Info"
              onClick={(e) => {
                e.stopPropagation();
                handleMoreInfo();
              }}
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm ring-1 ring-white/10 transition-colors hover:bg-black/70"
            >
              <ChevronUp className="size-5 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
