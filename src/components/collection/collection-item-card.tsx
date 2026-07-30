"use client";

import { useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import type { LikedSpot } from "@/types/backend";
import {
  MAX_STORED_PHOTOS,
  buildGoogleMapsPlaceUrl,
} from "@/types/backend";
import { CollectionPhoto } from "@/components/collection/collection-photo";
import { GoogleMapsIcon } from "@/components/icons/google-maps-icon";
import { formatPriceLabel, formatPrimaryType } from "@/lib/places/format";
import { cn } from "@/lib/utils";

interface CollectionItemCardProps {
  spot: LikedSpot;
  /** Eager-load first paint for above-the-fold cards */
  priority?: boolean;
  /** When true, ignore photo-carousel taps (e.g. mid swipe-to-remove) */
  interactionsLocked?: boolean;
}

export function CollectionItemCard({
  spot,
  priority = false,
  interactionsLocked = false,
}: CollectionItemCardProps) {
  const photos = spot.photos.slice(0, MAX_STORED_PHOTOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isFirst = currentIndex === 0;
  const mapsUrl = buildGoogleMapsPlaceUrl(spot.spotId, spot.name);

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactionsLocked || photos.length <= 1) return;
      const { clientX, currentTarget } = e;
      const { left, width } = currentTarget.getBoundingClientRect();
      const relativeX = clientX - left;

      if (relativeX < width / 2) {
        setCurrentIndex((i) => (i > 0 ? i - 1 : i));
      } else {
        setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : i));
      }
    },
    [interactionsLocked, photos.length],
  );

  const currentPhoto = photos[currentIndex];

  return (
    <article
      className="relative h-[160px] cursor-pointer select-none overflow-hidden rounded-2xl"
      onClick={handleTap}
    >
      {currentPhoto ? (
        <CollectionPhoto
          key={currentPhoto.url}
          src={currentPhoto.url}
          alt={spot.name}
          priority={priority && currentIndex === 0}
        />
      ) : (
        <div className="absolute inset-0 bg-surface-raised" />
      )}

      {isFirst && currentPhoto && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent"
        />
      )}

      {!isFirst && (
        <div aria-hidden className="absolute inset-0 bg-black/20" />
      )}

      {photos.length > 1 && (
        <div
          className="absolute inset-x-2.5 top-2 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((_, i) => (
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

      {isFirst && (
        <div className="absolute inset-x-0 bottom-0 flex h-full flex-col justify-between p-3.5 pr-14">
          {spot.address && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <MapPin className="size-3 shrink-0" />
              <span className="line-clamp-1">{spot.address}</span>
            </div>
          )}

          <div>
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

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${spot.name} in Google Maps`}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 right-3 z-10 flex size-10 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-transform active:scale-95"
      >
        <GoogleMapsIcon className="size-7" />
      </a>
    </article>
  );
}
