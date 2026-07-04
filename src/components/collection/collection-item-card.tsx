"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Heart, MapPin } from "lucide-react";
import type { CollectionSpot } from "@/lib/collection-mock";
import { cn } from "@/lib/utils";

interface CollectionItemCardProps {
  spot: CollectionSpot;
}

export function CollectionItemCard({ spot }: CollectionItemCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isFirst = currentIndex === 0;

  const handleFavorite = () => {
    console.log("Toggle favorite —", spot.name);
  };

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { clientX, currentTarget } = e;
      const { left, width } = currentTarget.getBoundingClientRect();
      const relativeX = clientX - left;

      if (relativeX < width / 2) {
        setCurrentIndex((i) => (i > 0 ? i - 1 : i));
      } else {
        setCurrentIndex((i) => (i < spot.images.length - 1 ? i + 1 : i));
      }
    },
    [spot.images.length],
  );

  const current = spot.images[currentIndex];

  return (
    <article
      className="relative h-[160px] cursor-pointer select-none overflow-hidden rounded-2xl"
      onClick={handleTap}
    >
      <Image
        key={current.src}
        src={current.src}
        alt={current.alt}
        fill
        sizes="(max-width: 400px) 100vw, 400px"
        className="object-cover object-center transition-opacity duration-200"
      />

      {/* Left gradient — only on first photo for text legibility */}
      {isFirst && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent"
        />
      )}

      {/* Dark overlay on 2nd+ photos for dash visibility */}
      {!isFirst && (
        <div
          aria-hidden
          className="absolute inset-0 bg-black/20"
        />
      )}

      {/* Progress dashes — top */}
      {spot.images.length > 1 && (
        <div
          className="absolute inset-x-2.5 top-2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {spot.images.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[2.5px] flex-1 rounded-full transition-all duration-300",
                i === currentIndex
                  ? "bg-white shadow-[0_0_3px_rgba(255,255,255,0.6)]"
                  : "bg-white/35",
              )}
            />
          ))}
        </div>
      )}

      {/* ♡ button — always visible */}
      <button
        type="button"
        aria-label={`Favorite ${spot.name}`}
        onClick={(e) => {
          e.stopPropagation();
          handleFavorite();
        }}
        className={cn(
          "absolute bottom-2.5 right-2.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
          spot.isFavorite
            ? "text-electric-chilli"
            : "text-electric-chilli/80 hover:text-electric-chilli",
        )}
      >
        <Heart
          className={cn(
            "size-6",
            spot.isFavorite
              ? "fill-electric-chilli stroke-electric-chilli"
              : "stroke-[2.5] stroke-white",
          )}
        />
      </button>

      {/* Info — first photo only */}
      {isFirst && (
        <div className="absolute inset-x-0 bottom-0 flex h-full flex-col justify-between p-3.5">
          <div className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
            <MapPin className="size-3" />
            {spot.distanceKm} km
          </div>

          <div className="pr-10">
            <h2 className="truncate text-[15px] font-black uppercase leading-tight tracking-tight text-text-primary">
              {spot.name}
            </h2>
            <span className="mt-1 inline-flex rounded-full border border-electric-chilli/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chilli-bright">
              {spot.category}
            </span>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
              <span className="text-honey">⭐ {spot.rating}</span>
              <span className="text-text-muted/50">|</span>
              <span className="text-chilli-bright">{spot.priceLevel}</span>
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
