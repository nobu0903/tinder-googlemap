import Image from "next/image";
import { Heart } from "lucide-react";
import type { LikedSpot } from "@/types/backend";

interface CollectionSummaryProps {
  totalCount: number;
  /** When true, show an ellipsis instead of the numeric count */
  isLoading?: boolean;
  previewSpots: LikedSpot[];
}

export function CollectionSummary({
  totalCount,
  isLoading = false,
  previewSpots,
}: CollectionSummaryProps) {
  const label =
    totalCount === 1 ? "amazing place saved" : "amazing places saved";

  return (
    <section className="flex items-center justify-between px-4 py-5">
      <div>
        <p className="text-sm font-medium text-text-primary">
          Your Collection ✨
        </p>
        <p className="mt-0.5 text-4xl font-black leading-none text-electric-chilli">
          {isLoading ? "…" : totalCount}
        </p>
        <p className="mt-1 text-xs text-text-muted">{label}</p>
      </div>

      {previewSpots.length > 0 && (
        <div className="relative h-[72px] w-[120px] shrink-0">
          {previewSpots.slice(0, 5).map((spot, index) => (
            <div
              key={spot.spotId}
              className="absolute overflow-hidden rounded-full ring-2 ring-midnight"
              style={{
                width: 44,
                height: 44,
                right: index * 14,
                top: index % 2 === 0 ? 0 : 12,
                zIndex: 5 - index,
              }}
            >
              {spot.photos[0] ? (
                <Image
                  src={spot.photos[0].url}
                  alt={spot.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="size-full bg-surface-raised" />
              )}
            </div>
          ))}
          <div className="absolute -bottom-1 right-0 z-10 flex size-8 items-center justify-center rounded-full bg-white shadow-md">
            <Heart className="size-4 fill-electric-chilli stroke-electric-chilli" />
          </div>
        </div>
      )}
    </section>
  );
}
