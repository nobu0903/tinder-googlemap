"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Heart, MapPin } from "lucide-react";
import type { LikedSpot } from "@/types/backend";
import { buildGoogleMapsPlaceUrl } from "@/types/backend";
import { formatPriceLabel } from "@/lib/places/format";
import { cn } from "@/lib/utils";

interface CollectionItemCardProps {
  spot: LikedSpot;
}

function formatPrimaryType(raw: string | null): string {
  if (!raw) return "Restaurant";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CollectionItemCard({ spot }: CollectionItemCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isFirst = currentIndex === 0;

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (spot.photos.length <= 1) return;
      const { clientX, currentTarget } = e;
      const { left, width } = currentTarget.getBoundingClientRect();
      const relativeX = clientX - left;

      if (relativeX < width / 2) {
        setCurrentIndex((i) => (i > 0 ? i - 1 : i));
      } else {
        setCurrentIndex((i) =>
          i < spot.photos.length - 1 ? i + 1 : i,
        );
      }
    },
    [spot.photos.length],
  );

  const handleOpenMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(buildGoogleMapsPlaceUrl(spot.spotId, spot.name), "_blank");
  };

  const currentPhoto = spot.photos[currentIndex];

  return (
    <article
      className="relative h-[160px] cursor-pointer select-none overflow-hidden rounded-2xl"
      onClick={handleTap}
    >
      {/* Photo or placeholder */}
      {currentPhoto ? (
        <Image
          key={currentPhoto.url}
          src={currentPhoto.url}
          alt={spot.name}
          fill
          sizes="(max-width: 400px) 100vw, 400px"
          className="object-cover object-center transition-opacity duration-200"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-raised" />
      )}

      {/* Left gradient on first photo for text legibility */}
      {isFirst && currentPhoto && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent"
        />
      )}

      {/* Dark overlay on 2nd+ photos */}
      {!isFirst && (
        <div aria-hidden className="absolute inset-0 bg-black/20" />
      )}

      {/* Photo progress dashes */}
      {spot.photos.length > 1 && (
        <div
          className="absolute inset-x-2.5 top-2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {spot.photos.map((_, i) => (
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

      {/* Open in Maps button */}
      <button
        type="button"
        aria-label={`Open ${spot.name} in Google Maps`}
        onClick={handleOpenMaps}
        className="absolute bottom-2.5 right-2.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors text-electric-chilli"
      >
        <Heart className="size-6 fill-electric-chilli stroke-electric-chilli" />
      </button>

      {/* Info overlay — first photo only */}
      {isFirst && (
        <div className="absolute inset-x-0 bottom-0 flex h-full flex-col justify-between p-3.5">
          {spot.address && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <MapPin className="size-3" />
              <span className="line-clamp-1">{spot.address}</span>
            </div>
          )}

          <div className="pr-10">
            <h2 className="truncate text-[15px] font-black uppercase leading-tight tracking-tight text-text-primary">
              {spot.name}
            </h2>
            <span className="mt-1 inline-flex rounded-full border border-electric-chilli/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chilli-bright">
              {formatPrimaryType(spot.primaryType)}
            </span>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
              {spot.rating !== null && (
                <span className="text-honey">⭐ {spot.rating.toFixed(1)}</span>
              )}
              {spot.rating !== null && spot.priceLevel !== null && (
                <span className="text-text-muted/50">|</span>
              )}
              {spot.priceLevel !== null && (
                <span className="text-chilli-bright">
                  {formatPriceLabel(spot.priceLevel)}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
